# Unit Test Execution

Unit tests for **AnyCompanyRead** use [Vitest](https://vitest.dev/), configured at the repo
root (`vitest.config.ts`) to discover `packages/**/*.{test,spec}.ts`.

## Run Unit Tests

### 1. Execute All Unit Tests
```bash
cd anycompanyread
npm test
```
Equivalent to `vitest run` (single pass, non-watch).

Other modes:
```bash
npm run test:watch      # re-run on file changes
npm run test:coverage   # with V8 coverage report
```

### 2. Review Test Results

**Current suite** (verified):

| Test File | Scope | Tests |
|-----------|-------|-------|
| `packages/shared/src/responses.test.ts` | API response helpers (`success`, `error`, `corsPreflight`, `parseBody`) | 6 |
| `packages/backend/src/handlers/books/filter.test.ts` | Catalog filter/sort logic (`filterBooks`) | 8 |

**Expected**: `Test Files 2 passed (2)`, `Tests 14 passed (14)`, 0 failures.

Coverage reports (when run with `npm run test:coverage`) are written to `coverage/`.

### 3. Fix Failing Tests
If tests fail:
1. Review the Vitest output — it prints the file, test name, and a diff of expected vs actual.
2. Identify the failing case and the source module it exercises.
3. Fix the code (not the test, unless the test encodes a wrong expectation).
4. Re-run `npm test` until green.

## What Is Unit-Tested

- **Pure logic only** — no AWS calls. The catalog filter/sort logic was extracted into
  `packages/backend/src/handlers/books/filter.ts` specifically so it can be tested without
  DynamoDB.
- **Response helpers** validate status codes, CORS headers, and JSON body shaping.

## Extending the Suite

- Add `*.test.ts` next to the module under test; Vitest auto-discovers it.
- For handler logic that touches AWS SDK v3, mock the client with
  [`aws-sdk-client-mock`](https://github.com/m-radzikowski/aws-sdk-client-mock) or inject a
  document-client, then assert on the command inputs.
- Suggested next targets: cart total computation, checkout order-building, and the frontend
  `formatPrice`/`formatDate` utilities (add `@testing-library/react` + `jsdom` for component tests).
