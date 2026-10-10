/**
 * OrdersHandler Lambda — checkout and order history.
 * Routes (authenticated via Cognito authorizer):
 *   POST /checkout            (create order from cart, clear cart)
 *   GET  /orders              (list user's orders)
 *   GET  /orders/{orderId}    (order detail with items)
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  GetCommand,
  PutCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  success,
  error,
  corsPreflight,
  TABLE_NAMES,
  type CartItem,
  type Order,
  type OrderItem,
  type OrderDetail,
} from '@anycompanyread/shared';
import { getUserId } from '../shared/auth';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') return corsPreflight();

  const userId = getUserId(event);
  if (!userId) return error('Unauthorized', 401);

  try {
    const path = event.path;
    const method = event.httpMethod;
    const orderId = event.pathParameters?.orderId;

    if (method === 'POST' && path.endsWith('/checkout')) return await checkout(userId);
    if (method === 'GET' && orderId) return await getOrder(userId, orderId);
    if (method === 'GET') return await listOrders(userId);

    return error('Method not allowed', 405);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('Orders error:', message);
    return error(message, 500);
  }
};

/**
 * Create an order from the user's cart, then clear the cart.
 * Simulated checkout — no payment. Order is immediately CONFIRMED.
 */
async function checkout(userId: string): Promise<APIGatewayProxyResult> {
  // 1. Read the cart.
  const cartResult = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAMES.CARTS,
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': userId },
    })
  );
  const cartItems = (cartResult.Items || []) as CartItem[];
  if (cartItems.length === 0) return error('Cart is empty', 400);

  const orderId = randomUUID();
  const createdAt = new Date().toISOString();
  const totalPrice = round(
    cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
  );
  const itemCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);

  // 2. Create the order record.
  const order: Order = {
    userId,
    orderId,
    totalPrice,
    status: 'CONFIRMED',
    createdAt,
    itemCount,
  };
  await ddb.send(new PutCommand({ TableName: TABLE_NAMES.ORDERS, Item: order }));

  // 3. Create order items (batched).
  const orderItems: OrderItem[] = cartItems.map((c) => ({
    orderId,
    bookId: c.bookId,
    quantity: c.quantity,
    price: c.price,
    title: c.title,
    coverImageUrl: c.coverImageUrl,
  }));
  await batchWrite(
    TABLE_NAMES.ORDER_ITEMS,
    orderItems.map((item) => ({ PutRequest: { Item: item } }))
  );

  // 4. Clear the cart.
  await batchWrite(
    TABLE_NAMES.CARTS,
    cartItems.map((c) => ({ DeleteRequest: { Key: { userId, bookId: c.bookId } } }))
  );

  return success({ order }, 201);
}

/** List the user's orders, newest first. */
async function listOrders(userId: string): Promise<APIGatewayProxyResult> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAMES.ORDERS,
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': userId },
    })
  );
  const orders = ((result.Items || []) as Order[]).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
  return success({ orders });
}

/** Fetch a single order plus its items (verifying ownership). */
async function getOrder(
  userId: string,
  orderId: string
): Promise<APIGatewayProxyResult> {
  const orderResult = await ddb.send(
    new GetCommand({ TableName: TABLE_NAMES.ORDERS, Key: { userId, orderId } })
  );
  if (!orderResult.Item) return error('Order not found', 404);

  const itemsResult = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAMES.ORDER_ITEMS,
      KeyConditionExpression: 'orderId = :oid',
      ExpressionAttributeValues: { ':oid': orderId },
    })
  );

  const detail: OrderDetail = {
    order: orderResult.Item as Order,
    items: (itemsResult.Items || []) as OrderItem[],
  };
  return success(detail);
}

/** Write items in chunks of 25 (DynamoDB BatchWrite limit). */
async function batchWrite(
  tableName: string,
  requests: Record<string, unknown>[]
): Promise<void> {
  for (let i = 0; i < requests.length; i += 25) {
    const chunk = requests.slice(i, i + 25);
    await ddb.send(
      new BatchWriteCommand({ RequestItems: { [tableName]: chunk as never } })
    );
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
