/**
 * API Gateway (Lambda proxy) response helpers with CORS headers.
 * Keeps handler code clean and consistent.
 */

export interface ApiGatewayResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

/** CORS headers applied to every response. Origin is permissive for the demo. */
const CORS_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

/** 2xx success response. */
export function success(data: unknown, statusCode = 200): ApiGatewayResponse {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(data),
  };
}

/** Error response with a message. */
export function error(message: string, statusCode = 400): ApiGatewayResponse {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify({ message }),
  };
}

/** Pre-flight CORS OPTIONS response. */
export function corsPreflight(): ApiGatewayResponse {
  return {
    statusCode: 204,
    headers: CORS_HEADERS,
    body: '',
  };
}

/** Safely parse a JSON request body, returning {} if empty/invalid. */
export function parseBody<T>(body: string | null): T {
  if (!body) return {} as T;
  try {
    return JSON.parse(body) as T;
  } catch {
    return {} as T;
  }
}
