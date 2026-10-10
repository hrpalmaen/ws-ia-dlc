import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as path from 'path';

/**
 * AnyCompanyRead infrastructure stack.
 *
 * Provisions the full serverless backend plus frontend hosting:
 *  - Cognito User Pool + Client (email/password auth)
 *  - 4 DynamoDB tables (Books, Carts, Orders, OrderItems) — on-demand billing
 *  - 4 Lambda functions (auth, books, cart, orders)
 *  - API Gateway REST API (14 routes, Cognito authorizer on protected routes, CORS)
 *  - S3 buckets (frontend hosting + book cover images)
 *  - CloudFront distribution (serves frontend + images)
 */
export class AnyCompanyReadStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ---------------------------------------------------------------------
    // DynamoDB Tables (on-demand / pay-per-request for cost optimization)
    // ---------------------------------------------------------------------
    const booksTable = new dynamodb.Table(this, 'BooksTable', {
      tableName: 'AnyCompanyRead-Books',
      partitionKey: { name: 'bookId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // demo: clean teardown
    });

    const cartsTable = new dynamodb.Table(this, 'CartsTable', {
      tableName: 'AnyCompanyRead-Carts',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'bookId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const ordersTable = new dynamodb.Table(this, 'OrdersTable', {
      tableName: 'AnyCompanyRead-Orders',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'orderId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const orderItemsTable = new dynamodb.Table(this, 'OrderItemsTable', {
      tableName: 'AnyCompanyRead-OrderItems',
      partitionKey: { name: 'orderId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'bookId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ---------------------------------------------------------------------
    // Cognito User Pool (email/password sign-in)
    // ---------------------------------------------------------------------
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'AnyCompanyRead-Users',
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: false },
        fullname: { required: true, mutable: true },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool,
      authFlows: {
        userPassword: true, // enables USER_PASSWORD_AUTH used by the auth handler
      },
      generateSecret: false, // public SPA client
    });

    // ---------------------------------------------------------------------
    // Lambda Functions
    // ---------------------------------------------------------------------
    const handlersDir = path.join(
      __dirname,
      '..',
      '..',
      'backend',
      'src',
      'handlers'
    );

    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      bundling: {
        externalModules: ['@aws-sdk/*'], // provided by the Lambda runtime
      },
    };

    const tableEnv = {
      BOOKS_TABLE: booksTable.tableName,
      CARTS_TABLE: cartsTable.tableName,
      ORDERS_TABLE: ordersTable.tableName,
      ORDER_ITEMS_TABLE: orderItemsTable.tableName,
    };

    const authFn = new NodejsFunction(this, 'AuthHandler', {
      ...commonLambdaProps,
      entry: path.join(handlersDir, 'auth', 'index.ts'),
      environment: {
        USER_POOL_ID: userPool.userPoolId,
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
      },
    });

    const booksFn = new NodejsFunction(this, 'BooksHandler', {
      ...commonLambdaProps,
      entry: path.join(handlersDir, 'books', 'index.ts'),
      environment: tableEnv,
    });

    const cartFn = new NodejsFunction(this, 'CartHandler', {
      ...commonLambdaProps,
      entry: path.join(handlersDir, 'cart', 'index.ts'),
      environment: tableEnv,
    });

    const ordersFn = new NodejsFunction(this, 'OrdersHandler', {
      ...commonLambdaProps,
      entry: path.join(handlersDir, 'orders', 'index.ts'),
      environment: tableEnv,
    });

    // IAM: grant least-privilege table access.
    booksTable.grantReadData(booksFn);
    booksTable.grantReadData(cartFn); // cart denormalizes book fields
    cartsTable.grantReadWriteData(cartFn);
    cartsTable.grantReadWriteData(ordersFn); // checkout clears the cart
    ordersTable.grantReadWriteData(ordersFn);
    orderItemsTable.grantReadWriteData(ordersFn);

    // Auth handler needs admin-confirm on the user pool.
    userPool.grant(
      authFn,
      'cognito-idp:AdminConfirmSignUp',
      'cognito-idp:SignUp',
      'cognito-idp:InitiateAuth',
      'cognito-idp:ForgotPassword',
      'cognito-idp:ConfirmForgotPassword'
    );

    // ---------------------------------------------------------------------
    // API Gateway REST API
    // ---------------------------------------------------------------------
    const api = new apigateway.RestApi(this, 'Api', {
      restApiName: 'AnyCompanyRead-Api',
      description: 'AnyCompanyRead REST API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
      deployOptions: { stageName: 'prod' },
    });

    // Cognito authorizer for protected routes.
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this,
      'CognitoAuthorizer',
      { cognitoUserPools: [userPool] }
    );
    const authOpts: apigateway.MethodOptions = {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    };

    // --- /auth/* (public) ---
    const auth = api.root.addResource('auth');
    const authIntegration = new apigateway.LambdaIntegration(authFn);
    auth.addResource('signup').addMethod('POST', authIntegration);
    auth.addResource('login').addMethod('POST', authIntegration);
    auth.addResource('forgot-password').addMethod('POST', authIntegration);
    auth.addResource('confirm-forgot-password').addMethod('POST', authIntegration);

    // --- /books (public) ---
    const booksIntegration = new apigateway.LambdaIntegration(booksFn);
    const books = api.root.addResource('books');
    books.addMethod('GET', booksIntegration);
    books.addResource('{bookId}').addMethod('GET', booksIntegration);

    // --- /cart (protected) ---
    const cartIntegration = new apigateway.LambdaIntegration(cartFn);
    const cart = api.root.addResource('cart');
    cart.addMethod('GET', cartIntegration, authOpts);
    cart.addMethod('POST', cartIntegration, authOpts);
    const cartItem = cart.addResource('{bookId}');
    cartItem.addMethod('PUT', cartIntegration, authOpts);
    cartItem.addMethod('DELETE', cartIntegration, authOpts);

    // --- /checkout + /orders (protected) ---
    const ordersIntegration = new apigateway.LambdaIntegration(ordersFn);
    api.root.addResource('checkout').addMethod('POST', ordersIntegration, authOpts);
    const orders = api.root.addResource('orders');
    orders.addMethod('GET', ordersIntegration, authOpts);
    orders.addResource('{orderId}').addMethod('GET', ordersIntegration, authOpts);

    // ---------------------------------------------------------------------
    // S3 + CloudFront (frontend hosting + book cover images)
    // ---------------------------------------------------------------------
    const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    const imagesBucket = new s3.Bucket(this, 'ImagesBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(frontendBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      additionalBehaviors: {
        '/images/*': {
          origin: origins.S3BucketOrigin.withOriginAccessControl(imagesBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
      },
      defaultRootObject: 'index.html',
      // SPA fallback: route 403/404 to index.html for client-side routing.
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
    });

    // ---------------------------------------------------------------------
    // Stack Outputs
    // ---------------------------------------------------------------------
    new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
    });
    new cdk.CfnOutput(this, 'FrontendBucketName', {
      value: frontendBucket.bucketName,
    });
    new cdk.CfnOutput(this, 'ImagesBucketName', { value: imagesBucket.bucketName });
    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: `https://${distribution.distributionDomainName}`,
    });
    new cdk.CfnOutput(this, 'BooksTableName', { value: booksTable.tableName });
  }
}
