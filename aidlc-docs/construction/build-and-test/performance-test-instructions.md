# Performance Test Instructions

## Purpose
Validate that the demo meets its (relaxed) performance targets under light load. Performance is
**demo-grade** per NFR-4 — this is a learning app, not a production system, so the goals are
modest and the testing is lightweight.

## Performance Requirements (NFR-4, demo-grade)
- **Response Time**: < 1000 ms for the public `GET /books` and `GET /books/{id}` endpoints
- **Throughput**: handle a handful of concurrent demo users (target ~10 concurrent)
- **Error Rate**: < 1% under the light load above
- **Page Load**: reasonable for a demo (frontend bundle ~368 kB gzipped ~116 kB, served via CloudFront)

> Cold starts: the Node.js 20 Lambdas may show a one-time cold-start latency (hundreds of ms) on
> the first request after idle. This is expected and acceptable for the demo.

## Setup Performance Test Environment
```bash
export API_URL=<ApiUrl>
# k6 (recommended) — https://k6.io  — or use Apache Bench (ab) for a quick check
```

## Run Performance Tests

### Option A: Quick check with Apache Bench
```bash
# 200 requests, 10 concurrent, against the public catalog endpoint
ab -n 200 -c 10 "$API_URL/books"
```
Review `Time per request` (mean) and `Failed requests` in the output.

### Option B: Load test with k6
Create `perf/books-load.js`:
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 }, // ramp to 10 virtual users
    { duration: '1m', target: 10 },  // hold
    { duration: '15s', target: 0 },  // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% under 1s
    http_req_failed: ['rate<0.01'],    // <1% errors
  },
};

export default function () {
  const res = http.get(`${__ENV.API_URL}/books`);
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
```
Run:
```bash
API_URL=$API_URL k6 run perf/books-load.js
```

## Analyze Performance Results
- **Response Time**: compare p95 against the < 1000 ms target.
- **Throughput**: requests/second reported by the tool.
- **Error Rate**: should be < 1%.
- **Bottlenecks**: the `GET /books` handler uses a DynamoDB **Scan** + in-memory filter — fine for
  the ~12-item demo catalog, but it is the first thing to optimize (GSI or query) if the catalog
  grows large.

## Optimization (only if targets are missed)
1. Increase Lambda memory (currently 256 MB) — more memory also raises CPU share.
2. Replace the Books `Scan` with a query against a GSI (e.g., by genre) for large catalogs.
3. Rely on CloudFront caching for cover images and the static frontend (already configured).

## Scope Note
Performance testing is **optional for this demo** and not wired into CI. The targets above are
intentionally relaxed per the project's demo-grade NFRs.
