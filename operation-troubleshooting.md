# Operation Troubleshooting — ECS Sample Application Health Check

**Date**: 2026-10-10
**Region**: us-east-1  **Account**: 127214200273
**Entry point**: `http://ecs-sample-alb-280789863.us-east-1.elb.amazonaws.com`
**Scope**: Full health check of the infrastructure mapped in `operation-architecture.md`.

> **No changes were made.** This is a diagnosis-only report. Remediation suggestions are listed
> separately in the "Recommended Fixes (NOT applied)" section for your review.

---

## Executive Summary

The application is **partially down and unstable**. Live probes:

| Probe | Result |
|-------|--------|
| `GET /` on public ALB | HTTP 200 (intermittent — see Issue 1) |
| `GET /catalog` on public ALB | **HTTP 500** |
| Public target group `ecs-sample` | **UNHEALTHY** (health check 404) |
| Internal target group `ecs-sample-internal` | Target healthy, but `ui` task cycling |

**Two independent root causes**, both confirmed with evidence:

1. **Health-check path mismatch** on the `ui` service → ECS repeatedly kills and replaces the `ui`
   task, so the public endpoint is intermittently unavailable.
2. **`catalog` service is scaled to 0** → every catalog-dependent page returns 500/404.

A third latent issue (catalog security group has no ingress) would block catalog even after it is
scaled up.

---

## Severity-Ranked Issues

### 🔴 Issue 1 — `ui` task fails ALB health checks → continuous kill/replace loop (CRITICAL)

**Symptom**: The `ui` Fargate task is registered healthy by its *container* health check but is
marked **unhealthy by the ALB target group** and killed by the ECS scheduler, roughly every
~7 minutes, then replaced — a perpetual loop.

**Evidence**:
- Public TG `ecs-sample` health check path = `GET /health`; current target state:
  `unhealthy — Target.ResponseCodeMismatch — Health checks failed with these codes: [404]`.
- The `ui` app is **Spring Boot WebFlux** and exposes actuator endpoints under **`/actuator`**
  (log: `Exposing 4 endpoints beneath base path '/actuator'`). So `/actuator/health` returns 200,
  but **`/health` returns 404**.
- Internal TG `ecs-sample-internal` health check path = `/actuator/health` → target **healthy**.
- The `ui` **container** health check in the task definition also uses `/actuator/health`
  (`curl -f http://localhost:8080/actuator/health`) and reports container health = HEALTHY.
- ECS service events (service `ui`) repeat, every few minutes:
  `(service ui) (task …) (port 8080) is unhealthy in (target-group …/ecs-sample/…) due to
  (reason Health checks failed with these codes: [404])` → `has stopped 1 running tasks` →
  `has started 1 tasks … Amazon ECS replaced 1 tasks due to an unhealthy status`.
- Stopped tasks show `stoppedReason: Task failed ELB health checks …`,
  `stopCode: ServiceSchedulerInitiated`.
- During discovery the registered target rotated from `10.0.2.7` to `10.0.3.15` (new task),
  confirming the loop is active.

**Impact**: While a task is being replaced, the public ALB has **no healthy target** → requests
return **503**. Between replacements a task is briefly healthy (observed `GET / → 200`). Net effect:
the site is intermittently reachable and never stable.

**Root cause**: The **public** target group's health-check path (`/health`) does not match the
application's actual health endpoint (`/actuator/health`). (The internal TG is configured
correctly.)

---

### 🔴 Issue 2 — `catalog` service scaled to 0 → catalog features return 500/404 (CRITICAL)

**Symptom**: Any catalog-backed request fails.

**Evidence**:
- `catalog` service: `desiredCount = 0`, `runningCount = 0` (service ACTIVE, "steady state").
- `ui` task definition env: `RETAIL_UI_ENDPOINTS_CATALOG=http://catalog` (Service Connect alias in
  namespace `ecs-sample.local`).
- `ui` application log (live):
  `500 Server Error for HTTP GET "/catalog"` caused by
  `com.microsoft.kiota.ApiException: the server returned an unexpected status code … 503`
  (the catalog upstream is unreachable → 503 → UI surfaces 500).
- `loadgen` log shows the user-visible pattern repeating every ~2s:
  `GET / -> HTTP 200`, `GET /catalog -> HTTP 500`, `GET /catalog/product/{1,2,3} -> HTTP 404`.
- Live probe just now: `GET /catalog` on the public ALB → **HTTP 500**.

**Impact**: The home page renders, but the product catalog and product detail pages are broken for
all users.

**Root cause**: There is no running `catalog` task for the `ui` to call. (Service intentionally or
accidentally set to desired 0.)

---

### 🟠 Issue 3 — `catalog` security group has NO ingress rules (HIGH — latent)

**Symptom**: Even if `catalog` is scaled up, nothing is permitted to connect to it.

**Evidence**:
- `ecs-sample-backend-sg` (sg-0fdea63c1fa7a061a, attached to the `catalog` service):
  **ingress = [] (empty)**, egress = all.
- The `ui`/frontend tasks run under `ecs-sample-frontend-sg` (sg-0e06bcd4a64c92cb4). There is **no
  rule** allowing frontend → backend on port 8080.

**Impact**: Scaling `catalog` to 1 alone would **not** restore it — Service Connect / direct calls
from `ui` on :8080 would be dropped by the backend SG. This must be addressed together with Issue 2.

**Root cause**: Missing SG ingress rule on the backend SG (expected: allow TCP 8080 from the
frontend SG, and/or from the Service Connect/VPC CIDR as appropriate).

---

### 🟡 Issue 4 — Internal ALB security group is open to the world (MEDIUM — security posture)

**Symptom**: The *internal* ALB accepts inbound from any source.

**Evidence**:
- `ecs-sample-internal-alb-sg` (sg-03732aba1c000988a): ingress `TCP 80 from 0.0.0.0/0`
  ("Allow all inbound traffic (internal ALB)").
- The ALB is `scheme: internal` (no public IP), so it is not directly reachable from the internet;
  however the SG still allows the entire VPC/any routable source rather than being scoped to the
  frontend SG or VPC CIDR.

**Impact**: Not an availability issue, but a broader-than-necessary ingress on an internal LB.
Low exploitability (internal scheme) but worth tightening.

**Root cause**: Overly permissive CIDR on the internal ALB SG.

---

### 🟡 Issue 5 — Health-check churn is filling logs / noisy signal (LOW/INFORMATIONAL)

**Evidence**:
- Log group `retail-store-ecs-tasks` holds ~235 MB, dominated by repeated UI start/stop cycles and
  the loadgen 500/404 loop.
- Dozens of stopped `ui` tasks accumulate from the replace loop.

**Impact**: Makes real signal harder to find and grows CloudWatch storage; symptomatic of Issues
1–2 rather than a separate fault. Resolves once Issues 1–2 are fixed.

---

## Component-by-Component Health Matrix

| Component | State | Health | Notes |
|-----------|-------|--------|-------|
| Public ALB `ecs-sample-alb` | active | ⚠️ Degraded | Up, but backing TG has no stable healthy target |
| Internal ALB `ecs-sample-internal-alb` | active | ✅ / ⚠️ | TG healthy, but target cycles due to Issue 1; SG too open (Issue 4) |
| TG `ecs-sample` (public) | — | 🔴 Unhealthy | `/health` → 404 (Issue 1) |
| TG `ecs-sample-internal` | — | ✅ Healthy | `/actuator/health` → 200 |
| ECS cluster `ecs-sample-cluster` | ACTIVE | ✅ | — |
| Service `ui` | ACTIVE 1/1 | 🔴 Unstable | Kill/replace loop (Issue 1); catalog calls 500 (Issue 2) |
| Service `catalog` | ACTIVE 0/0 | 🔴 Down | Scaled to 0 (Issue 2); SG has no ingress (Issue 3) |
| Service `loadgen` | ACTIVE 1/1 | ✅ Running | Confirms user-facing 500/404 pattern |
| Task def `retail-store-ecs-ui:1` | — | ✅ Valid | Container healthcheck `/actuator/health` is correct |
| Task def `retail-store-ecs-catalog:1` | — | ✅ Valid | No running task to apply it |
| SG `ecs-sample-alb-sg` | — | ✅ | :80 from 0.0.0.0/0 (expected for public ALB) |
| SG `ecs-sample-frontend-sg` | — | ✅ | :8080 from both ALB SGs (correct) |
| SG `ecs-sample-backend-sg` | — | 🟠 Misconfigured | No ingress (Issue 3) |
| SG `ecs-sample-internal-alb-sg` | — | 🟡 Too open | :80 from 0.0.0.0/0 (Issue 4) |
| VPC / Subnets / IGW / NAT (x2) | available | ✅ | Networking is healthy; not a factor in the outage |
| Service Connect `ecs-sample.local` | — | ✅ | `ui`, `catalog` registered; catalog has no backing task |

---

## Evidence Appendix (key raw signals)

- **Public TG health (live)**: `10.0.3.15:8080` → `unhealthy / ResponseCodeMismatch / [404]`;
  `10.0.2.7:8080` → `draining` (old task deregistering).
- **Stopped task**: `stoppedReason = "Task failed ELB health checks in (target-group …/ecs-sample-internal/…)"`,
  `stopCode = ServiceSchedulerInitiated`.
- **UI log**: `Exposing 4 endpoints beneath base path '/actuator'`; `Netty started on port 8080`;
  `500 Server Error for HTTP GET "/catalog"` ← `ApiException … status code … 503`.
- **loadgen log**: `GET / -> HTTP 200`, `GET /catalog -> HTTP 500`, `GET /catalog/product/1 -> HTTP 404` (repeating).
- **Live curl**: `GET / → 200`, `GET /catalog → 500`.

---

## Recommended Fixes (NOT applied — for your review)

Listed in dependency order. Do not treat as executed.

1. **Fix the public TG health-check path (Issue 1)** — change target group `ecs-sample`
   health-check path from `/health` to **`/actuator/health`** (match the internal TG and the
   container health check). This stops the kill/replace loop and stabilizes the public endpoint.
2. **Scale up `catalog` (Issue 2)** — set the `catalog` service `desiredCount` to 1 so the `ui`'s
   `http://catalog` calls succeed.
3. **Add backend SG ingress (Issue 3)** — on `ecs-sample-backend-sg` (sg-0fdea63c1fa7a061a), allow
   **TCP 8080 from `ecs-sample-frontend-sg` (sg-0e06bcd4a64c92cb4)** (and/or the Service Connect
   path as required). Required for Issue 2's fix to actually work.
4. **Tighten the internal ALB SG (Issue 4)** — scope `ecs-sample-internal-alb-sg` ingress :80 from
   `0.0.0.0/0` down to the frontend SG or the VPC CIDR `10.0.0.0/16`.
5. **(Optional) Reduce log churn (Issue 5)** — resolves automatically after 1–3; optionally set a
   log retention policy on `retail-store-ecs-tasks`.

**Suggested validation order after any change**: 3 → 2 → 1, then re-check public TG health = healthy
and `GET /` + `GET /catalog` both return 200.

---

## What was checked (methodology)

- ELBv2: load balancers, listeners, target groups, **live target health** (both TGs).
- ECS: cluster, all 3 services (counts + rollout state + events), running & stopped tasks
  (**stop reasons**), all 3 task definitions (image, ports, health checks, env, log config).
- CloudWatch Logs: `retail-store-ecs-tasks` — live `ui` application logs and `loadgen` logs.
- EC2: 4 security groups (ingress/egress), VPC, subnets, IGW, NAT gateways.
- Service Discovery: Cloud Map namespace `ecs-sample.local`.
- Live HTTP probes of the public ALB URL (`/` and `/catalog`).
