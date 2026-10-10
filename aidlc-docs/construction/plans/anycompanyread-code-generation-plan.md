# AnyCompanyRead — Code Generation Plan

## Single Source of Truth
This plan is the single source of truth for the Code Generation stage. Generation follows these steps exactly, in order, marking each `[x]` as completed.

## Unit Context
- **Unit**: AnyCompanyRead (single unit of work)
- **Project Type**: Greenfield
- **Architecture**: AWS Serverless (Cognito + API Gateway + Lambda + DynamoDB + S3 + CloudFront)
- **Language**: TypeScript (frontend + backend + infrastructure)
- **Repository Structure**: Monorepo via npm workspaces

## Code Location (per user instruction)
- **Application Code**: `anycompanyread/` folder at workspace root
- **Documentation Summary**: `aidlc-docs/construction/code/` (unit-name subdirectory skipped — single-unit project)

## Target Directory Layout
```
anycompanyread/
├── package.json                 # Root workspace config
├── tsconfig.base.json
├── README.md
├── .gitignore
├── packages/
│   ├── shared/                  # Shared types, constants, utils
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── types.ts
│   │       ├── constants.ts
│   │       ├── responses.ts
│   │       └── index.ts
│   ├── backend/                 # Lambda handlers
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/handlers/
│   │       ├── auth/index.ts
│   │       ├── books/index.ts
│   │       ├── cart/index.ts
│   │       └── orders/index.ts
│   ├── infrastructure/          # AWS CDK
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── cdk.json
│   │   ├── bin/app.ts
│   │   ├── lib/anycompanyread-stack.ts
│   │   └── scripts/seed-data.ts
│   └── frontend/                # React SPA (Vite + shadcn/ui + Tailwind)
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── tailwind.config.js
│       ├── postcss.config.js
│       ├── index.html
│       └── src/
│           ├── main.tsx, App.tsx, index.css
│           ├── lib/ (api.ts, utils.ts)
│           ├── context/ (AuthContext.tsx, CartContext.tsx, ThemeContext.tsx)
│           ├── components/ (ui/*, layout/*)
│           └── pages/ (Home, Books, BookDetail, Login, Signup, Cart, Orders)
```

---

## Story Traceability
Requirements are the source of truth (User Stories skipped per workflow plan). Each step maps to functional requirements:

| Step Area | Requirements Covered |
|-----------|---------------------|
| Shared package | Data model (FR-2.1, FR-3.5), API contracts |
| Auth handler | FR-1.1 – FR-1.5 |
| Books handler | FR-2.1 – FR-2.5 |
| Cart handler | FR-3.1 – FR-3.5 |
| Orders handler | FR-3.6 – FR-3.10 |
| Infrastructure | NFR-2, NFR-5, NFR-6, FR-2.7 |
| Seed data | FR-2.6 |
| Frontend | FR-1.*, FR-2.*, FR-3.*, FR-4.* |

---

## Generation Steps

### Step 1: Project Structure Setup
- [x] Create `anycompanyread/` root with `package.json` (npm workspaces), `tsconfig.base.json`, `.gitignore`

### Step 2: Shared Package (Business Logic — shared layer)
- [x] `packages/shared/package.json`, `tsconfig.json`
- [x] `src/types.ts` — Book, CartItem, Order, OrderItem, request/response types
- [x] `src/constants.ts` — table names, API paths, genres
- [x] `src/responses.ts` — API Gateway response helpers (success, error, CORS headers)
- [x] `src/index.ts` — barrel export

### Step 3: Backend — Auth Handler (API + business logic)
- [x] `packages/backend/package.json`, `tsconfig.json`
- [x] `src/handlers/auth/index.ts` — signup, login, forgotPassword, confirmForgotPassword via Cognito (FR-1)

### Step 4: Backend — Books Handler
- [x] `src/handlers/books/index.ts` — listBooks (search/genre filter), getBook (FR-2)

### Step 5: Backend — Cart Handler
- [x] `src/handlers/cart/index.ts` — getCart, addToCart, updateCartItem, removeFromCart (FR-3.1–3.5)

### Step 6: Backend — Orders Handler
- [x] `src/handlers/orders/index.ts` — checkout, listOrders, getOrder (FR-3.6–3.10)

### Step 7: Infrastructure — CDK Stack
- [x] `packages/infrastructure/package.json`, `tsconfig.json`, `cdk.json`
- [x] `bin/app.ts` — CDK app entry
- [x] `lib/anycompanyread-stack.ts` — Cognito, DynamoDB (4 tables), 4 Lambdas, API Gateway (14 routes + authorizer), S3 (frontend + images), CloudFront, CORS (NFR-5/6)

### Step 8: Seed Data Script
- [x] `packages/infrastructure/scripts/seed-data.ts` — populate Books table with sample catalog incl. cover image URLs (FR-2.6)

### Step 9: Frontend — Scaffolding & Config
- [x] `packages/frontend/package.json`, `tsconfig.json`, `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`, `index.html`
- [x] `src/index.css` (Tailwind + theme tokens), `src/main.tsx`, `src/App.tsx` (routing)
- [x] `src/lib/utils.ts` (cn helper), `src/lib/api.ts` (REST client)

### Step 10: Frontend — shadcn/ui Primitives & Context
- [x] `src/components/ui/` — button, card, input, badge, skeleton, table, dialog, alert, toast (sonner), select, dropdown-menu
- [x] `src/context/ThemeContext.tsx` (dark mode — FR-4.2)
- [x] `src/context/AuthContext.tsx` (FR-1)
- [x] `src/context/CartContext.tsx` (FR-3)

### Step 11: Frontend — Layout & Pages
- [x] `src/components/layout/Navbar.tsx` (search, cart badge, user menu, theme toggle — FR-4.1/4.2)
- [x] `src/pages/Home.tsx` (hero + featured — FR-4.3)
- [x] `src/pages/Books.tsx` (search, genre filter, grid, skeletons — FR-2.2–2.4, FR-4.5)
- [x] `src/pages/BookDetail.tsx` (FR-2.5, FR-3.1)
- [x] `src/pages/Login.tsx`, `src/pages/Signup.tsx` (FR-1.1/1.2)
- [x] `src/pages/Cart.tsx` (table, qty controls, remove dialog, checkout — FR-3.2–3.4, 3.6–3.8)
- [x] `src/pages/Orders.tsx` (order history table + detail — FR-3.9/3.10)

### Step 12: Documentation
- [x] `anycompanyread/README.md` — architecture overview, setup, deploy, seed, learning notes (NFR-2)
- [x] `aidlc-docs/construction/code/code-generation-summary.md` — AIDLC code generation summary (per user instruction)

---

## Completion Criteria
- All steps marked `[x]`
- All functional requirements implemented
- CDK stack defines all AWS resources
- Frontend builds with shadcn/ui + Tailwind + dark mode + responsive design
- README and AIDLC summary written
