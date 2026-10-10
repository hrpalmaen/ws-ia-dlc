/**
 * CartHandler Lambda — manages the authenticated user's shopping cart.
 * Routes (authenticated via Cognito authorizer):
 *   GET    /cart
 *   POST   /cart              { bookId, quantity }
 *   PUT    /cart/{bookId}     { quantity }
 *   DELETE /cart/{bookId}
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  success,
  error,
  corsPreflight,
  TABLE_NAMES,
  type Book,
  type CartItem,
  type CartResponse,
  type AddToCartRequest,
  type UpdateCartItemRequest,
} from '@anycompanyread/shared';
import { parseBody } from '@anycompanyread/shared';
import { getUserId } from '../shared/auth';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') return corsPreflight();

  const userId = getUserId(event);
  if (!userId) return error('Unauthorized', 401);

  try {
    const method = event.httpMethod;
    const bookId = event.pathParameters?.bookId;

    if (method === 'GET') return await getCart(userId);
    if (method === 'POST') return await addToCart(userId, event);
    if (method === 'PUT' && bookId) return await updateCartItem(userId, bookId, event);
    if (method === 'DELETE' && bookId) return await removeFromCart(userId, bookId);

    return error('Method not allowed', 405);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('Cart error:', message);
    return error(message, 500);
  }
};

/** Return all cart items for the user plus computed totals. */
async function getCart(userId: string): Promise<APIGatewayProxyResult> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAMES.CARTS,
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': userId },
    })
  );

  const items = (result.Items || []) as CartItem[];
  const response: CartResponse = {
    items,
    totalPrice: round(items.reduce((sum, i) => sum + i.price * i.quantity, 0)),
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
  };
  return success(response);
}

/** Add a book to the cart (or increment quantity if already present). */
async function addToCart(
  userId: string,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const { bookId, quantity } = parseBody<AddToCartRequest>(event.body);
  if (!bookId || !quantity || quantity < 1) {
    return error('bookId and a positive quantity are required');
  }

  // Look up the book to denormalize display fields into the cart item.
  const bookResult = await ddb.send(
    new GetCommand({ TableName: TABLE_NAMES.BOOKS, Key: { bookId } })
  );
  const book = bookResult.Item as Book | undefined;
  if (!book) return error('Book not found', 404);

  // Check for an existing cart row to accumulate quantity.
  const existing = await ddb.send(
    new GetCommand({ TableName: TABLE_NAMES.CARTS, Key: { userId, bookId } })
  );
  const newQuantity = ((existing.Item as CartItem | undefined)?.quantity || 0) + quantity;

  const item: CartItem = {
    userId,
    bookId,
    quantity: newQuantity,
    title: book.title,
    author: book.author,
    price: book.price,
    coverImageUrl: book.coverImageUrl,
  };

  await ddb.send(new PutCommand({ TableName: TABLE_NAMES.CARTS, Item: item }));
  return success({ item }, 201);
}

/** Set an absolute quantity for a cart item. */
async function updateCartItem(
  userId: string,
  bookId: string,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const { quantity } = parseBody<UpdateCartItemRequest>(event.body);
  if (!quantity || quantity < 1) return error('A positive quantity is required');

  const result = await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAMES.CARTS,
      Key: { userId, bookId },
      UpdateExpression: 'SET quantity = :q',
      ConditionExpression: 'attribute_exists(bookId)',
      ExpressionAttributeValues: { ':q': quantity },
      ReturnValues: 'ALL_NEW',
    })
  );
  return success({ item: result.Attributes as CartItem });
}

/** Remove a single item from the cart. */
async function removeFromCart(
  userId: string,
  bookId: string
): Promise<APIGatewayProxyResult> {
  await ddb.send(
    new DeleteCommand({ TableName: TABLE_NAMES.CARTS, Key: { userId, bookId } })
  );
  return success({ message: 'Item removed from cart' });
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
