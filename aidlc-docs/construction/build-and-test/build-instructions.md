# Build Instructions

Build instructions for the **AnyCompanyRead** monorepo (`anycompanyread/`).

## Prerequisites

- **Build Tool**: npm workspaces (npm 10+); TypeScript 5.4; Vite 5 (frontend); AWS CDK 2 (infrastructure)
- **Runtime**: Node.js 20+ (verified on Node.js 22)
- **Dependencies**: Installed from the root via npm workspaces (shared, backend, infrastructure, frontend)
- **Environment Variables**:
  - `VITE_API_URL` — API Gateway URL (frontend build; from CDK stack output `ApiUrl`)
  - `BOOKS_TABLE` — DynamoDB Books table name (seed script; from output `BooksTableName`)
  - AWS credentials configured (`aws configure`) for deploy/synth
- **System Requirements**: Any Linux/macOS/Windows dev machine; ~500 MB disk for `node_modules`

## Build Steps

### 1. Install Dependencies
```bash
cd anycompanyread
npm install
```
Installs all workspace dependencies in a single pass (~248 packages).

### 2. Build the Shared Package (required first)
```bash
npm run build:shared
```
Produces a dual build: CommonJS (`packages/shared/dist/`) for backend/CDK and ESM
(`packages/shared/dist/esm/`) for the Vite frontend. **Must run before backend, frontend, or synth.**

### 3. Build the Backend
```bash
npm run build:backend
```
Compiles the four Lambda handlers (`packages/backend/dist/`).

### 4. Build the Frontend
```bash
# VITE_API_URL points the SPA at your deployed API
VITE_API_URL=<ApiUrl> npm run build:frontend
```
Runs `tsc` type-check then `vite build` → `packages/frontend/dist/`.

### 5. Build Everything (shared → backend → frontend)
```bash
npm run build
```

### 6. Synthesize Infrastructure (validate CDK, no deploy)
```bash
npm run synth
```
Builds shared + backend, then runs `cdk synth` to produce CloudFormation.

## Verify Build Success

| Step | Expected Output | Artifact Location |
|------|-----------------|-------------------|
| shared | tsc completes silently | `packages/shared/dist/`, `packages/shared/dist/esm/` |
| backend | tsc completes silently | `packages/backend/dist/` |
| frontend | `✓ built in Ns`, bundle sizes printed (~368 kB JS) | `packages/frontend/dist/` |
| synth | CloudFormation YAML; `Outputs:` incl. ApiUrl, UserPoolId, CloudFrontUrl | `packages/infrastructure/cdk.out/` |

**Acceptable warning**: `uuid@9 ... no longer supported` (deprecation notice only) and the Vite
"CJS build of Vite's Node API is deprecated" notice. Neither affects the build.

## Troubleshooting

### `"GENRES" is not exported by "../shared/dist/index.js"` during `vite build`
- **Cause**: Frontend resolved the CommonJS shared build; Rollup can't statically read named
  value exports from the CJS `__exportStar` pattern.
- **Solution**: Ensure the shared package was built with the dual build (`npm run build:shared`),
  which emits ESM into `dist/esm/` and declares the `exports` map in
  `packages/shared/package.json`. Rebuild shared, then the frontend.

### Build fails with dependency / module-not-found errors
- **Cause**: Dependencies not installed, or shared package not built.
- **Solution**: Run `npm install` at the repo root, then `npm run build:shared` before other packages.

### `cdk synth` fails to find Lambda entry files
- **Cause**: Backend handler paths in `lib/anycompanyread-stack.ts` resolve relative to the
  infrastructure package.
- **Solution**: Run from `packages/infrastructure` (the `synth` script does this) and ensure
  `packages/backend/src/handlers/*/index.ts` exist.
