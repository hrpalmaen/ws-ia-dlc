/**
 * Extract the authenticated user's id (Cognito "sub") from the API Gateway
 * request context populated by the Cognito User Pool authorizer.
 */
import type { APIGatewayProxyEvent } from 'aws-lambda';

export function getUserId(event: APIGatewayProxyEvent): string | null {
  const claims = event.requestContext?.authorizer?.claims;
  if (!claims) return null;
  // "sub" is the stable unique user id; fall back to username/email if absent.
  return claims.sub || claims['cognito:username'] || claims.email || null;
}
