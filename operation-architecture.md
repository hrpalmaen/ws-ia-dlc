# Operation Architecture — ECS Sample Application Infrastructure Map

**Discovery date**: 2026-10-10
**Last updated**: 2026-10-10T11:09Z (post-remediation)
**Region**: us-east-1
**Account**: 127214200273
**Entry point (ALB URL)**: `http://ecs-sample-alb-280789863.us-east-1.elb.amazonaws.com`
**Owning stack**: CloudFormation `workshop-stack` (VPC logical id `AIDLCPlatformVpc`)
**Current status**: ✅ **OPERATIONAL** — public endpoint returns HTTP 200 on `/`, `/catalog`, and `/actuator/health`.

> This document was originally a read-only infrastructure map. It has since been **updated to
> reflect the current (post-fix) state** after remediating the ALB health-check, catalog scaling,
> and backend security-group issues. See the "Remediation Applied" and updated "Status" sections.

---

## 1. Component Inventory

### Load Balancers (ALB)
| Name | Scheme | ARN (suffix) | VPC | Security Group | Subnets (AZ) |
|------|--------|--------------|-----|----------------|--------------|
| `ecs-sample-alb` | internet-facing | `app/ecs-sample-alb/1affd28348093689` | vpc-0c4505e1fb340f436 | sg-0498c9e7b8a16bde4 (`ecs-sample-alb-sg`) | subnet-0a3e38efbcfacc39c (1a, public), subnet-0ff35e35430347ca9 (1b, public) |
| `ecs-sample-internal-alb` | internal | `app/ecs-sample-internal-alb/b7747f861aae7687` | vpc-0c4505e1fb340f436 | sg-03732aba1c000988a (`ecs-sample-internal-alb-sg`) | subnet-06ffe52076751b7eb (1a, private), subnet-0294d786f112b65a0 (1b, private) |

- **`ecs-sample-alb`** is the public entry point referenced by the app URL (DNS `ecs-sample-alb-280789863...`).
- **`ecs-sample-internal-alb`** is an internal LB fronting the same `ui` service on private subnets.

### Listeners
| ALB | Listener | Port/Protocol | Default Action → Target Group |
|-----|----------|---------------|-------------------------------|
| ecs-sample-alb | `.../3b5b4055b2c4498c` | HTTP :80 | forward → `ecs-sample` |
| ecs-sample-internal-alb | `.../76b15eefd7d522f9` | HTTP :80 | forward → `ecs-sample-internal` |

### Target Groups
| Name | ARN (suffix) | Protocol/Port | Target Type | Health Check | Attached ALB | Registered Target |
|------|--------------|---------------|-------------|--------------|--------------|-------------------|
| `ecs-sample` | `targetgroup/ecs-sample/0fe29526bd91c9a3` | HTTP :8080 | ip (Fargate) | `GET /actuator/health` (200) every 30s **[updated from `/health`]** | ecs-sample-alb | 10.0.3.15:8080 — **HEALTHY** |
| `ecs-sample-internal` | `targetgroup/ecs-sample-internal/40fdff94772491ac` | HTTP :8080 | ip (Fargate) | `GET /actuator/health` (200) every 30s | ecs-sample-internal-alb | 10.0.3.15:8080 — **HEALTHY** |

Both target groups now point at the same healthy `ui` task (10.0.3.15) and both use `/actuator/health`.

### ECS Cluster
| Cluster | ARN |
|---------|-----|
| `ecs-sample-cluster` | `arn:aws:ecs:us-east-1:127214200273:cluster/ecs-sample-cluster` |

### ECS Services
| Service | Status | Desired | Running | Launch | Task Definition | Load Balancer attach | Task SG | Service Connect |
|---------|--------|---------|---------|--------|-----------------|----------------------|---------|-----------------|
| `ui` | ACTIVE | 1 | 1 | FARGATE | `retail-store-ecs-ui:1` | `ecs-sample` + `ecs-sample-internal` TGs (container `application`:8080) | sg-0e06bcd4a64c92cb4 (`ecs-sample-frontend-sg`) | enabled — alias `ui:80` |
| `catalog` | ACTIVE | **1** | **1** | FARGATE | `retail-store-ecs-catalog:1` | none | sg-0fdea63c1fa7a061a (`ecs-sample-backend-sg`) | enabled — alias `catalog:80` |
| `loadgen` | ACTIVE | 1 | 1 | FARGATE | `retail-store-ecs-loadgen:1` | none | sg-0e06bcd4a64c92cb4 (`ecs-sample-frontend-sg`) | none |

All services run in private subnets `subnet-06ffe52076751b7eb` (1a) + `subnet-0294d786f112b65a0` (1b), `assignPublicIp=DISABLED`.

### Running Tasks
| Task (id) | Service | Task Def | Last Status | Container Health | Private IP (AZ) | ENI |
|-----------|---------|----------|-------------|------------------|-----------------|-----|
| 8f0e42c7…1ab9 | ui | retail-store-ecs-ui:1 | RUNNING | HEALTHY | 10.0.2.7 (1a) | eni-084ed4ea032fb3234 |
| d5f1e79b…5517 | loadgen | retail-store-ecs-loadgen:1 | RUNNING | UNKNOWN (no healthcheck) | 10.0.2.110 (1a) | eni-0e2becf764889f93c |

(`catalog` has no running task — desiredCount 0.)

### Task Definitions
| Family:Rev | CPU / Mem | Container | Image | Port | App Health Check | Key Env |
|------------|-----------|-----------|-------|------|------------------|---------|
| `retail-store-ecs-ui:1` | 1024 / 2048 | application | `public.ecr.aws/aws-containers/retail-store-sample-ui:1.6.2` | 8080 | `curl /actuator/health` | `RETAIL_UI_ENDPOINTS_CATALOG=http://catalog` |
| `retail-store-ecs-catalog:1` | 1024 / 2048 | application | `public.ecr.aws/aws-containers/retail-store-sample-catalog:1.6.2` | 8080 | `curl /health` | `RETAIL_CATALOG_PERSISTENCE_PROVIDER=in-memory`, `RETAIL_CATALOG_PERSISTENCE_DB_NAME=catalog` |
| `retail-store-ecs-loadgen:1` | 256 / 512 | loadgen | `public.ecr.aws/docker/library/alpine:latest` | none | none | none |

- **Task Execution Role**: `workshop-stack-CdkConstructFakeWebAppEcsTaskExecuti-LGVE4hfYs6Ma`
- **Task Role**: `workshop-stack-CdkConstructFakeWebAppEcsTaskRole63D-l8pNrbKoRwcM`
- **Network mode**: `awsvpc` (all task defs)

### Service Connect / Service Discovery
| Namespace | Name | Type | Members (alias:port) |
|-----------|------|------|----------------------|
| ns-7xhbnhlxb4yfdr6b | `ecs-sample.local` | DNS_PRIVATE (Cloud Map) | `ui:80`, `catalog:80` |

The `ui` service reaches `catalog` via Service Connect DNS `http://catalog` (port 80 → container 8080).

---

## 2. Security Groups

| SG | Name | Purpose | Ingress | Egress |
|----|------|---------|---------|--------|
| sg-0498c9e7b8a16bde4 | `ecs-sample-alb-sg` | Public ALB | TCP 80 from `0.0.0.0/0` | all |
| sg-03732aba1c000988a | `ecs-sample-internal-alb-sg` | Internal ALB | TCP 80 from `0.0.0.0/0` | all |
| sg-0e06bcd4a64c92cb4 | `ecs-sample-frontend-sg` | ui + loadgen tasks | TCP 8080 from sg-0498c9e7b8a16bde4 (public ALB) **and** sg-03732aba1c000988a (internal ALB) | all |
| sg-0fdea63c1fa7a061a | `ecs-sample-backend-sg` | catalog task | TCP 8080 from sg-0e06bcd4a64c92cb4 (frontend tasks) **[rule added: sgr-0d31e9b5bea3055fb]** | all |

---

## 3. Networking

| Component | ID | Details |
|-----------|-----|---------|
| VPC | vpc-0c4505e1fb340f436 | `retail-store-vpc`, CIDR 10.0.0.0/16 |
| Internet Gateway | igw-06f9dae106b8c8888 | attached (available) |
| Public Subnet 1 | subnet-0a3e38efbcfacc39c | 1a, 10.0.0.0/24, map-public-ip=true (public ALB + NAT) |
| Public Subnet 2 | subnet-0ff35e35430347ca9 | 1b, 10.0.1.0/24, map-public-ip=true (public ALB + NAT) |
| Private Subnet 1 | subnet-06ffe52076751b7eb | 1a, 10.0.2.0/24 (ECS tasks + internal ALB) |
| Private Subnet 2 | subnet-0294d786f112b65a0 | 1b, 10.0.3.0/24 (ECS tasks + internal ALB) |
| NAT Gateway 1 | nat-0c06d482e762c9479 | in subnet-0a3e38efbcfacc39c (public 1a) |
| NAT Gateway 2 | nat-0814809d940f497b3 | in subnet-0ff35e35430347ca9 (public 1b) |

---

## 4. Text-Based Connection Diagram

```
                               Internet (0.0.0.0/0)
                                      |
                                      v  HTTP :80
                     +--------------------------------------+
                     |  Internet Gateway  igw-06f9dae1...   |
                     +--------------------------------------+
                                      |
          ============================|=============================  VPC vpc-0c45...05e1 (retail-store-vpc, 10.0.0.0/16)
                                      |
                                      v
          +-----------------------------------------------------------+
          |  PUBLIC ALB  ecs-sample-alb  (internet-facing)            |
          |  DNS: ecs-sample-alb-280789863.us-east-1.elb.amazonaws.com|
          |  SG: ecs-sample-alb-sg (sg-0498...) ingress :80 from 0/0  |
          |  Public subnets: 10.0.0.0/24 (1a), 10.0.1.0/24 (1b)       |
          |  Listener HTTP :80  --default-->  TG ecs-sample           |
          +-----------------------------------------------------------+
                                      |
                                      |  forward
                                      v
          +-----------------------------------------------------------+
          |  TARGET GROUP  ecs-sample  (ip / HTTP :8080)              |
          |  Health check: GET /health  (expects 200)                 |
          |  Registered target: 10.0.2.7:8080  --> [UNHEALTHY: 404]   |
          +-----------------------------------------------------------+
                                      |
                                      v  (SG ecs-sample-frontend-sg allows :8080 from ALB SG)
     +===========================================================================+
     |                       ECS CLUSTER  ecs-sample-cluster                     |
     |                                                                           |
     |   +-------------------------------------------------------------------+   |
     |   |  SERVICE  ui   (FARGATE, desired 1 / running 1)                   |   |
     |   |  TaskDef retail-store-ecs-ui:1                                    |   |
     |   |  Image: retail-store-sample-ui:1.6.2   container :8080            |   |
     |   |  App healthcheck: /actuator/health     SG: frontend-sg           |   |
     |   |  Task 8f0e42c7...  IP 10.0.2.7 (private subnet 1a)  [HEALTHY]     |   |
     |   |  Registered in BOTH target groups (public + internal)            |   |
     |   +-------------------------------------------------------------------+   |
     |         |                                   ^                             |
     |         | Service Connect                   |  HTTP :80                   |
     |         | http://catalog  (ecs-sample.local)|  (via internal ALB TG)      |
     |         v                                   |                             |
     |   +-------------------------------------+   |                             |
     |   |  SERVICE  catalog                   |   |                             |
     |   |  (FARGATE, desired 0 / running 0)   |   |                             |
     |   |  TaskDef retail-store-ecs-catalog:1 |   |                             |
     |   |  Image: ...sample-catalog:1.6.2     |   |                             |
     |   |  SG: ecs-sample-backend-sg          |   |                             |
     |   |  [NO RUNNING TASK]                  |   |                             |
     |   +-------------------------------------+   |                             |
     |                                             |                             |
     |   +-------------------------------------+   |                             |
     |   |  SERVICE  loadgen                   |   |                             |
     |   |  (FARGATE, desired 1 / running 1)   |   |                             |
     |   |  Image: alpine:latest   SG: frontend-sg                            |  |
     |   |  Task d5f1e79b...  IP 10.0.2.110 (1a)                              |  |
     |   +-------------------------------------+   |                             |
     +===========================================================================+
                                                   |
          +----------------------------------------+------------------+
          |  INTERNAL ALB  ecs-sample-internal-alb  (internal)        |
          |  DNS: internal-ecs-sample-internal-alb-1755060707...      |
          |  SG: ecs-sample-internal-alb-sg (sg-0373...) :80 from 0/0 |
          |  Private subnets: 10.0.2.0/24 (1a), 10.0.3.0/24 (1b)      |
          |  Listener HTTP :80 --default--> TG ecs-sample-internal    |
          |  TG health check: GET /actuator/health  --> [HEALTHY]     |
          +----------------------------------------------------------+

   Outbound (tasks -> internet, e.g. image pulls): private subnets --> NAT GW
     nat-0c06d482... (public 1a) / nat-0814809d... (public 1b) --> IGW --> Internet

   Service Discovery: Cloud Map private DNS namespace  ecs-sample.local
     - ui       -> alias ui:80
     - catalog  -> alias catalog:80
```

---

## 5. Request Flow Summary

1. Client → `http://ecs-sample-alb-...` (public ALB, HTTP :80).
2. Public ALB listener forwards to **TG `ecs-sample`** (`/health` check), target `ui` task 10.0.2.7:8080.
3. `ui` task (SG `ecs-sample-frontend-sg`) accepts :8080 from the ALB SG.
4. `ui` calls **catalog** over Service Connect at `http://catalog` (namespace `ecs-sample.local`).
5. A second path exists: **internal ALB → TG `ecs-sample-internal` (`/actuator/health`) → same `ui` task**.
6. `loadgen` runs independently (no LB, no Service Connect), generating traffic.
7. Task egress to the internet (image pulls, etc.) goes via NAT gateways in the public subnets → IGW.

---

## 6. Remediation Applied & Current Status

The issues originally observed here were remediated on **2026-10-10**. Changes applied:

| # | Issue (original) | Fix applied | Resource changed |
|---|------------------|-------------|------------------|
| 1 | Public TG `ecs-sample` health check `/health` → 404 → `ui` kill/replace loop | Health-check path changed `/health` → **`/actuator/health`** | TG `ecs-sample` (0fe29526bd91c9a3) |
| 2 | `catalog` service scaled to 0 → `/catalog` returns 500 | `desiredCount` **0 → 1** | Service `catalog` |
| 3 | `ecs-sample-backend-sg` had no ingress → catalog unreachable | Added ingress **TCP 8080 from `ecs-sample-frontend-sg`** | SG sg-0fdea63c1fa7a061a (rule sgr-0d31e9b5bea3055fb) |

### Current verified status (2026-10-10T11:09Z)

- **Public ALB endpoint** `http://ecs-sample-alb-280789863.us-east-1.elb.amazonaws.com`
  - `GET /` → **HTTP 200**
  - `GET /catalog` → **HTTP 200** (renders the "Demo Store" catalog)
  - `GET /actuator/health` → **HTTP 200** `{"status":"UP"}`
- **Public TG `ecs-sample`**: target 10.0.3.15 → **healthy**
- **Internal TG `ecs-sample-internal`**: target 10.0.3.15 → **healthy**
- **ECS services**: `ui` 1/1, `catalog` 1/1, `loadgen` 1/1 — all **steady state** (no more task replacement loop)
- **catalog task** (10.0.2.197): RUNNING + container HEALTHY

### Still outstanding (not an availability issue — left as-is per request)

4. **Internal ALB SG open to the world.** `ecs-sample-internal-alb-sg` (sg-03732aba1c000988a) still
   allows ingress `TCP 80 from 0.0.0.0/0`. The ALB is `internal` scheme (not internet-reachable),
   so this is a security-hardening item, not an outage. Recommended future change: scope ingress to
   the frontend SG or the VPC CIDR `10.0.0.0/16`.
---

## 7. Resource Reference (IDs)

| Type | Identifier |
|------|------------|
| Public ALB | arn:aws:elasticloadbalancing:us-east-1:127214200273:loadbalancer/app/ecs-sample-alb/1affd28348093689 |
| Internal ALB | arn:aws:elasticloadbalancing:us-east-1:127214200273:loadbalancer/app/ecs-sample-internal-alb/b7747f861aae7687 |
| TG (public) | arn:aws:elasticloadbalancing:us-east-1:127214200273:targetgroup/ecs-sample/0fe29526bd91c9a3 |
| TG (internal) | arn:aws:elasticloadbalancing:us-east-1:127214200273:targetgroup/ecs-sample-internal/40fdff94772491ac |
| ECS cluster | arn:aws:ecs:us-east-1:127214200273:cluster/ecs-sample-cluster |
| Service ui | arn:aws:ecs:us-east-1:127214200273:service/ecs-sample-cluster/ui |
| Service catalog | arn:aws:ecs:us-east-1:127214200273:service/ecs-sample-cluster/catalog |
| Service loadgen | arn:aws:ecs:us-east-1:127214200273:service/ecs-sample-cluster/loadgen |
| VPC | vpc-0c4505e1fb340f436 |
| Internet Gateway | igw-06f9dae106b8c8888 |
| NAT Gateways | nat-0c06d482e762c9479, nat-0814809d940f497b3 |
| SG public ALB | sg-0498c9e7b8a16bde4 |
| SG internal ALB | sg-03732aba1c000988a |
| SG frontend tasks | sg-0e06bcd4a64c92cb4 |
| SG backend task | sg-0fdea63c1fa7a061a |
| Cloud Map namespace | ns-7xhbnhlxb4yfdr6b (ecs-sample.local) |
