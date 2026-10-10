# AnyCompanyRead

> An online book e-commerce platform — a polished, learning-focused demo built on AWS serverless.

AnyCompanyRead is a full-stack demo bookstore. Users browse a catalog, search and filter
books, add them to a cart, and check out. It showcases a clean AWS serverless backend and a
modern, accessible React frontend (shadcn/ui + Tailwind CSS with dark mode).

---

## Architecture

```
Frontend (React SPA, shadcn/ui, Tailwind)
      |  HTTPS (REST)
      v
API Gateway  --(Cognito authorizer on protected routes)
      |
      |-- /auth/*    --> AuthHandler    --> Amazon Cognito
      |-- /books/*   --> BooksHandler   --> DynamoDB: Books
      |-- /cart/*    --> CartHandler    --> DynamoDB: Carts
      |-- /checkout  --> OrdersHandler  --> DynamoDB: Orders, OrderItems, Carts
      |-- /orders/*  --> OrdersHandler  --> DynamoDB: Orders, OrderItems

Static hosting: S3 (frontend + book cover images) fronted by CloudFront
```

### AWS Services
| Service | Purpose |
|---------|---------|
| Amazon Cognito | Email/password authentication (JWT) |
| Amazon API Gateway | REST API (14 routes) |
| AWS Lambda | 4 TypeScript handlers (auth, books, cart, orders) |
| Amazon DynamoDB | 4 tables (Books, Carts, Orders, OrderItems), on-demand |
| Amazon S3 | Frontend hosting + cover images |
| Amazon CloudFront | CDN for frontend + images |
| AWS CDK | Infrastructure as code |

---

## Monorepo Layout

```
anycompanyread/
├── packages/
│   ├── shared/           # Shared TypeScript types, constants, response helpers
│   ├── backend/          # Lambda handlers (auth, books, cart, orders)
│   ├── infrastructure/   # AWS CDK stack + seed-data script
│   └── frontend/         # React SPA (Vite + shadcn/ui + Tailwind)
├── package.json          # npm workspaces root
└── tsconfig.base.json
```

Managed with **npm workspaces**. Build order: `shared → backend → frontend → infrastructure`.

---

## Prerequisites

- Node.js 20+
- An AWS account with credentials configured (`aws configure`)
- AWS CDK bootstrapped in your target account/region: `npx cdk bootstrap`

---

## Setup & Deploy

```bash
# 1. Install all workspace dependencies
npm install

# 2. Build shared + backend (required before CDK synth/deploy)
npm run build:shared
npm run build:backend

# 3. Deploy the infrastructure (Cognito, API Gateway, Lambda, DynamoDB, S3, CloudFront)
npm run deploy
#    -> Note the stack outputs: ApiUrl, UserPoolId, UserPoolClientId,
#       FrontendBucketName, CloudFrontUrl, BooksTableName
```

### Seed the catalog
```bash
# Use the BooksTableName from the deploy outputs
BOOKS_TABLE=AnyCompanyRead-Books npm run seed
```

### Build & publish the frontend
```bash
# Point the frontend at your deployed API, then build
VITE_API_URL=<ApiUrl-from-outputs> npm run build:frontend

# Upload the build to the frontend S3 bucket, then invalidate CloudFront
aws s3 sync packages/frontend/dist s3://<FrontendBucketName> --delete
```

Open the `CloudFrontUrl` from the stack outputs in your browser.

---

## Local Frontend Development

```bash
cd packages/frontend
VITE_API_URL=<ApiUrl-from-outputs> npm run dev
# -> http://localhost:5173
```

---

## API Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/signup` | No | Register (auto-confirmed for demo) |
| POST | `/auth/login` | No | Log in, returns JWT tokens |
| POST | `/auth/forgot-password` | No | Begin password reset |
| POST | `/auth/confirm-forgot-password` | No | Complete password reset |
| GET | `/books` | No | List/search/filter books (`?search=`, `?genre=`) |
| GET | `/books/{bookId}` | No | Book details |
| GET | `/cart` | Yes | Get cart |
| POST | `/cart` | Yes | Add item `{ bookId, quantity }` |
| PUT | `/cart/{bookId}` | Yes | Update quantity `{ quantity }` |
| DELETE | `/cart/{bookId}` | Yes | Remove item |
| POST | `/checkout` | Yes | Place order from cart (simulated) |
| GET | `/orders` | Yes | Order history |
| GET | `/orders/{orderId}` | Yes | Order detail |

Protected routes expect the Cognito **ID token** in the `Authorization` header.

---

## Teardown

```bash
npm run destroy --workspace=packages/infrastructure
```

All resources use `RemovalPolicy.DESTROY` and auto-delete S3 objects, so teardown is clean.

---

## Learning Notes

- **Auth is simplified for demo**: signup auto-confirms the user (no email verification step),
  so you can log in immediately.
- **Books list uses a DynamoDB Scan** with in-memory search/genre filtering — simple and fine
  for a small catalog. Production would use a GSI or a search service.
- **Checkout is a sequence, not a transaction**: it reads the cart, writes the order and items,
  then clears the cart. Eventual consistency is acceptable for this demo.
- **Cost-conscious**: DynamoDB on-demand billing, small Lambda memory, and S3 + CloudFront keep
  this near the AWS Free Tier.
- **No real payment** is processed; orders are created with status `CONFIRMED`.

---

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, shadcn/ui (Radix UI), Tailwind CSS, React Router, Lucide icons, Sonner toasts
- **Backend**: TypeScript, AWS SDK v3, AWS Lambda
- **Infra**: AWS CDK v2 (TypeScript)
