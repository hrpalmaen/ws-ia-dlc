/**
 * BooksHandler Lambda — public book catalog queries.
 * Routes (public):
 *   GET /books              (optional ?search= &genre=)
 *   GET /books/{bookId}
 *
 * Note: For a demo catalog, a DynamoDB Scan with in-memory filtering is simple
 * and adequate. A production system would use a GSI or a search service.
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import {
  success,
  error,
  corsPreflight,
  TABLE_NAMES,
  type Book,
  type ListBooksResponse,
} from '@anycompanyread/shared';
import { filterBooks } from './filter';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') return corsPreflight();

  try {
    const bookId = event.pathParameters?.bookId;
    if (bookId) return await getBook(bookId);
    return await listBooks(event);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('Books error:', message);
    return error(message, 500);
  }
};

/** List books, optionally filtered by search term (title/author) and genre. */
async function listBooks(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const search = event.queryStringParameters?.search || '';
  const genre = event.queryStringParameters?.genre || '';

  const result = await ddb.send(new ScanCommand({ TableName: TABLE_NAMES.BOOKS }));
  const allBooks = (result.Items || []) as Book[];

  // Pure filtering/sorting logic lives in filter.ts (unit tested).
  const books = filterBooks(allBooks, search, genre);

  const response: ListBooksResponse = { books, totalCount: books.length };
  return success(response);
}

/** Fetch a single book by id. */
async function getBook(bookId: string): Promise<APIGatewayProxyResult> {
  const result = await ddb.send(
    new GetCommand({ TableName: TABLE_NAMES.BOOKS, Key: { bookId } })
  );
  if (!result.Item) return error('Book not found', 404);
  return success({ book: result.Item as Book });
}
