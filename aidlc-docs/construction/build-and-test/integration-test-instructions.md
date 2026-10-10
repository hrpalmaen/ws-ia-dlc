# Integration Test Instructions

## Purpose
Validate that the deployed units work together end-to-end: API Gateway → Lambda → DynamoDB/Cognito,
and the full auth → browse → cart → checkout → orders flow. These tests run against **real
deployed AWS resources** (demo stack), since the app is AWS-serverless with no local emulation
layer configured.

## Prerequisites
- Stack deployed: `npm run deploy` (see build-instructions.md)
- Catalog seeded: `BOOKS_TABLE=<BooksTableName> npm run seed`
- Capture these CDK stack outputs: `ApiUrl`, `UserPoolId`, `UserPoolClientId`

## Setup Integration Test Environment
```bash
export API_URL=<ApiUrl>          # e.g. https://abc123.execute-api.us-east-1.amazonaws.com/prod
export TEST_EMAIL="itest+$(date +%s)@example.com"
export TEST_PASSWORD="Test1234"  # meets Cognito policy: 8+ chars, upper, lower, digit
```

## Test Scenarios

### Scenario 1: Auth → Books (public) 
- **Description**: Unauthenticated catalog access works; auth issues a usable JWT.
- **Steps**:
  ```bash
  # Public: list books (no auth)
  curl -s "$API_URL/books" | jq '.totalCount'            # expect >= 12 after seeding

  # Signup (auto-confirmed) then login
  curl -s -X POST "$API_URL/auth/signup" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"name\":\"Test User\"}"

  TOKEN=$(curl -s -X POST "$API_URL/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" | jq -r '.idToken')
  echo "$TOKEN" | cut -c1-20   # should print a JWT prefix
  ```
- **Expected**: `/books` returns the seeded count; login returns a non-empty `idToken`.

### Scenario 2: Cart (authenticated) → DynamoDB
- **Description**: Adding/updating/removing cart items persists per user.
- **Steps**:
  ```bash
  BOOK_ID=$(curl -s "$API_URL/books" | jq -r '.books[0].bookId')

  # Add to cart
  curl -s -X POST "$API_URL/cart" -H "Authorization: $TOKEN" \
    -H 'Content-Type: application/json' -d "{\"bookId\":\"$BOOK_ID\",\"quantity\":2}"

  # Get cart
  curl -s "$API_URL/cart" -H "Authorization: $TOKEN" | jq '{itemCount, totalPrice}'

  # Update quantity
  curl -s -X PUT "$API_URL/cart/$BOOK_ID" -H "Authorization: $TOKEN" \
    -H 'Content-Type: application/json' -d '{"quantity":3}'
  ```
- **Expected**: cart `itemCount` reflects quantity; 401 if `Authorization` header is omitted.

### Scenario 3: Checkout → Orders (OrdersHandler spans Carts, Orders, OrderItems)
- **Description**: Checkout creates an order from the cart and clears the cart.
- **Steps**:
  ```bash
  # Checkout
  ORDER_ID=$(curl -s -X POST "$API_URL/checkout" -H "Authorization: $TOKEN" | jq -r '.order.orderId')

  # Cart is now empty
  curl -s "$API_URL/cart" -H "Authorization: $TOKEN" | jq '.itemCount'   # expect 0

  # Order appears in history + detail
  curl -s "$API_URL/orders" -H "Authorization: $TOKEN" | jq '.orders | length'   # expect >= 1
  curl -s "$API_URL/orders/$ORDER_ID" -H "Authorization: $TOKEN" | jq '{status: .order.status, items: (.items|length)}'
  ```
- **Expected**: order `status` is `CONFIRMED`; cart `itemCount` is 0; order detail lists the items.

### Scenario 4: Authorization enforcement
- **Description**: Protected routes reject missing/invalid tokens.
- **Steps**:
  ```bash
  curl -s -o /dev/null -w "%{http_code}\n" "$API_URL/cart"                    # expect 401
  curl -s -o /dev/null -w "%{http_code}\n" "$API_URL/orders" -H "Authorization: bad"  # expect 401
  ```
- **Expected**: HTTP 401 from the API Gateway Cognito authorizer.

## Cleanup
```bash
# Remove the test user from the pool
aws cognito-idp admin-delete-user --user-pool-id <UserPoolId> --username "$TEST_EMAIL"
# (Optional) full teardown of the demo stack:
npm run destroy --workspace=packages/infrastructure
```

## Notes
- No automated integration-test runner is wired up for the demo; the curl flows above are the
  canonical manual integration checks. To automate, wrap these in a Vitest/Jest suite that reads
  `API_URL` from the environment and runs against the deployed stack (an "e2e" project).
