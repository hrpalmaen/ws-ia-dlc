/**
 * AuthHandler Lambda — handles signup, login, and password reset via Amazon Cognito.
 * Routes (public, no authorizer):
 *   POST /auth/signup
 *   POST /auth/login
 *   POST /auth/forgot-password
 *   POST /auth/confirm-forgot-password
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  AdminConfirmSignUpCommand,
  InitiateAuthCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  success,
  error,
  corsPreflight,
  parseBody,
  type SignupRequest,
  type LoginRequest,
  type ForgotPasswordRequest,
  type ConfirmForgotPasswordRequest,
} from '@anycompanyread/shared';

const cognito = new CognitoIdentityProviderClient({});

const USER_POOL_ID = process.env.USER_POOL_ID || '';
const CLIENT_ID = process.env.USER_POOL_CLIENT_ID || '';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') return corsPreflight();

  const path = event.path;

  try {
    if (path.endsWith('/signup')) return await signup(event);
    if (path.endsWith('/login')) return await login(event);
    if (path.endsWith('/forgot-password')) return await forgotPassword(event);
    if (path.endsWith('/confirm-forgot-password')) {
      return await confirmForgotPassword(event);
    }
    return error('Not found', 404);
  } catch (err) {
    // Cognito throws typed errors; surface the message for the demo UI.
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('Auth error:', message);
    return error(message, 400);
  }
};

/** Register a new user and auto-confirm them (demo convenience — skips email verification). */
async function signup(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { email, password, name } = parseBody<SignupRequest>(event.body);
  if (!email || !password || !name) {
    return error('email, password, and name are required');
  }

  await cognito.send(
    new SignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'name', Value: name },
      ],
    })
  );

  // Auto-confirm so the demo user can log in immediately without email verification.
  await cognito.send(
    new AdminConfirmSignUpCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
    })
  );

  return success({ message: 'Signup successful. You can now log in.' }, 201);
}

/** Authenticate with email/password and return JWT tokens. */
async function login(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { email, password } = parseBody<LoginRequest>(event.body);
  if (!email || !password) {
    return error('email and password are required');
  }

  const result = await cognito.send(
    new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    })
  );

  const auth = result.AuthenticationResult;
  if (!auth) return error('Authentication failed', 401);

  return success({
    idToken: auth.IdToken,
    accessToken: auth.AccessToken,
    refreshToken: auth.RefreshToken,
    expiresIn: auth.ExpiresIn,
  });
}

/** Begin a password reset — Cognito emails a confirmation code. */
async function forgotPassword(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const { email } = parseBody<ForgotPasswordRequest>(event.body);
  if (!email) return error('email is required');

  await cognito.send(
    new ForgotPasswordCommand({ ClientId: CLIENT_ID, Username: email })
  );

  return success({ message: 'Password reset code sent to your email.' });
}

/** Complete a password reset using the emailed code. */
async function confirmForgotPassword(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const { email, code, newPassword } =
    parseBody<ConfirmForgotPasswordRequest>(event.body);
  if (!email || !code || !newPassword) {
    return error('email, code, and newPassword are required');
  }

  await cognito.send(
    new ConfirmForgotPasswordCommand({
      ClientId: CLIENT_ID,
      Username: email,
      ConfirmationCode: code,
      Password: newPassword,
    })
  );

  return success({ message: 'Password reset successful. You can now log in.' });
}
