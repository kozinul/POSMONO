# Infrastructure & DevOps Architecture

> **Platform:** POSMono — Modular Business Operating System
> **Status:** Infrastructure Design (Pre-Code)
> **Mindset:** Shopify / Square / Toast — enterprise-grade SaaS infrastructure

---

## Table of Contents

1. [Infrastructure Architecture](#1-infrastructure-architecture)
2. [Container Architecture](#2-container-architecture)
3. [Reverse Proxy & Load Balancing](#3-reverse-proxy--load-balancing)
4. [CI/CD Pipeline](#4-cicd-pipeline)
5. [Monitoring Architecture](#5-monitoring-architecture)
6. [Logging Architecture](#6-logging-architecture)
7. [Backup Strategy](#7-backup-strategy)
8. [Disaster Recovery Strategy](#8-disaster-recovery-strategy)
9. [Security Infrastructure](#9-security-infrastructure)
10. [Future Scaling Roadmap](#10-future-scaling-roadmap)

---

## 1. Infrastructure Architecture

### 1.1 Philosophy

Production infrastructure for a POS SaaS platform must prioritize:

- **Availability** — POS cannot be down during business hours
- **Data integrity** — every transaction must be durable
- **Security** — payment data, tenant isolation, API protection
- **Observability** — know what's happening at all times
- **Cost efficiency** — UMKM SaaS has thin margins, infrastructure must scale efficiently

### 1.2 Service Map

```
                       ┌─────────────────────────────────────┐
                       │         CLOUD FLARE / DNS            │
                       │  (DDoS protection, CDN, SSL)         │
                       └──────────────┬──────────────────────┘
                                      │
                       ┌──────────────▼──────────────────────┐
                       │         REVERSE PROXY               │
                       │       (Nginx / Traefik)             │
                       │  SSL termination · routing · LB     │
                       │  Subdomain routing per tenant       │
                       └──────┬──────┬──────┬──────┬─────────┘
                              │      │      │      │
              ┌───────────────┘      │      │      └───────────────┐
              ▼                      ▼      ▼                      ▼
     ┌────────────────┐    ┌──────────────┐    ┌──────────────────┐
     │  STATIC FILES   │    │  API SERVICE  │    │  SOCKET SERVICE  │
     │  (CDN / S3)     │    │  (Express)    │    │  (Socket.IO)     │
     │                 │    │               │    │                  │
     │  • PWA bundle   │    │  • Auth       │    │  • Real-time POS │
     │  • Electron pkg │    │  • Ordering   │    │  • KDS updates   │
     │  • Assets       │    │  • Payment    │    │  • Printer status │
     │                 │    │  • Catalog    │    │  • Sync events    │
     └─────────────────┘    │  • Customer   │    └──────────────────┘
                            │  • Reporting  │
                            │  • Inventory  │
                            └──────┬───────-┘
                                   │
                                   ▼
     ┌────────────────┐    ┌──────────────┐    ┌──────────────────┐
     │  WORKER SERVICE  │    │  MONGO DB    │    │  REDIS            │
     │  (BullMQ)        │    │              │    │                  │
     │                   │    │  • System DB │    │  • Cache          │
     │  • Outbox worker  │    │  • Tenant DB │    │  • BullMQ queues  │
     │  • Notifications  │    │    (N x DB)  │    │  • Session store  │
     │  • Report calc    │    │              │    │  • Rate limiter   │
     │  • Receipt gen    │    │  • Replica   │    │  • Socket adapter │
     │  • n8n triggers   │    │  • Backups   │    │  • Idempotency    │
     └──────────────────┘    └──────────────┘    └──────────────────┘
                                   │
                                   ▼
     ┌──────────────────────────────────────────────────────────┐
     │                    EXTERNAL SERVICES                      │
     │                                                          │
     │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
     │  │ Midtrans  │  │   n8n    │  │  S3-compat│  │  SMTP  │  │
     │  │ (Payment) │  │(Workflow)│  │ (Storage) │  │ (Email)│  │
     │  └──────────┘  └──────────┘  └──────────┘  └────────┘  │
     └──────────────────────────────────────────────────────────┘
```

### 1.3 Service Responsibilities

```
SERVICE                     RESPONSIBILITY                     SCALE STRATEGY
──────────────────  ───────────────────────────────────  ───────────────────────
API Service          All HTTP API requests                 Horizontal scaling
                     REST endpoints for POS,               (stateless)
                     dashboard, settings
                     Tenant context resolution
                     Authentication & authorization
                     Request validation

Socket Service       Real-time bidirectional              Horizontal with Redis
                     communication                         adapter for sticky
                     POS terminal sync                     sessions via Socket.IO
                     Kitchen Display System
                     Printer status updates
                     Admin notifications

Worker Service       Background job processing             Horizontal (jobs are
                     BullMQ consumers                      idempotent, any worker
                     Outbox event publishing               can pick any job)
                     Notification dispatch
                     Receipt generation
                     Report materialization
                     n8n webhook triggers

Database (MongoDB)   Data persistence                      Vertical then sharded
                     Per-tenant database isolation          Replica set for HA
                     Aggregation queries

Cache (Redis)        In-memory cache                       Cluster mode for HA
                     BullMQ job queues
                     Socket.IO pub/sub
                     Rate limiter counters
                     Idempotency key store

File Storage         Static assets (images)                S3-compatible object
(S3-compatible)       Receipt PDFs                         storage
                     Export files
```

### 1.4 Stage 1 Infrastructure — Single VPS

For launch (1-100 tenants), a single VPS is sufficient and cost-effective:

```
┌──────────────────────────────────────────────────────────────┐
│                    SINGLE VPS (8 vCPU, 32GB RAM, 200GB SSD)   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  DOCKER COMPOSE                                        │   │
│  │                                                        │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐      │   │
│  │  │  Nginx      │  │  API        │  │  Socket     │      │   │
│  │  │  (proxy)    │──►│  (Express)  │  │  (Socket.IO)│      │   │
│  │  └────────────┘  └────────────┘  └────────────┘      │   │
│  │                                                        │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐      │   │
│  │  │  Worker     │  │  MongoDB    │  │  Redis      │      │   │
│  │  │  (BullMQ)   │  │  (Replica)  │  │  (Standalone)│    │   │
│  │  └────────────┘  └────────────┘  └────────────┘      │   │
│  │                                                        │   │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────────────┐ │   │
│  │  │  Prometheus │  │  Grafana   │  │  Loki +          │ │   │
│  │  │  (metrics)  │  │  (dash)    │  │  Promtail (logs) │ │   │
│  │  └────────────┘  └────────────┘  └──────────────────┘ │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲           │
│  │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │           │
│  └─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┘           │
│  Docker host (Linux) with systemd, unattended-upgrades        │
└──────────────────────────────────────────────────────────────┘
```

**Which services run independently from day one:**

```
CONTAINER           DAY 1?    REASON
──────────────────  ──────  ─────────────────────────────────────────────
API                 ✅      Core service — must be behind load balancer
MongoDB             ✅      Database — single replica set member
Redis               ✅      Cache + queues — single instance
Worker              ✅      Background jobs — separate process prevents
                             API from being blocked by heavy jobs
Nginx               ✅      Reverse proxy — SSL, routing, rate limiting
Socket              ✅      Real-time — separate scaling profile from API
Prometheus +        ✅      Observability from day 1
  Grafana
Loki + Promtail     ✅      Centralized logging from day 1
n8n                 ⬜      Optional — add when automation workflows needed
MinIO (S3)          ⬜      Optional — use S3-compatible cloud service
```

### 1.5 Network Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        NETWORK SEGMENTS                               │
│                                                                       │
│  PUBLIC NETWORK                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Cloudflare (DDoS, WAF, CDN, SSL termination origin pull)     │  │
│  └──────────────────────────┬─────────────────────────────────────┘  │
│                             │                                         │
│  ┌──────────────────────────▼─────────────────────────────────────┐  │
│  │  Nginx (Reverse Proxy)                                         │  │
│  │  Port 443 (HTTPS), Port 80 (redirect to 443)                   │  │
│  └──────┬──────────┬──────────┬───────────────────────────────────┘  │
│         │          │          │                                      │
│         ▼          ▼          ▼                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                             │
│  │  API      │ │  Socket   │ │  Grafana │                             │
│  │  :3000    │ │  :3001    │ │  :3030   │                             │
│  └──────────┘ └──────────┘ └──────────┘                             │
│                                                                       │
│  INTERNAL NETWORK (docker network — not exposed)                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│  │  MongoDB  │ │  Redis   │ │  Worker  │ │  Prom.   │               │
│  │  :27017   │ │  :6379   │ │          │ │  :9090   │               │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘               │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Container Architecture

### 2.1 Multi-Stage Build Strategy

Each service uses a multi-stage Docker build for minimal image size:

```
BASE IMAGE: node:20-alpine (or distroless for production)
  │
  ├── STAGE 1: deps
  │     Install production dependencies only
  │     pnpm install --frozen-lockfile --prod
  │
  ├── STAGE 2: builder
  │     Install all dependencies + build
  │     pnpm run build
  │
  └── STAGE 3: runner
        Copy only: compiled JS + production node_modules
        No build tools, no dev dependencies
        Non-root user (node, UID 1000)
        Read-only root filesystem
```

### 2.2 Container Images

```
IMAGE NAME                   BASE              SIZE GOAL    NOTES
──────────────────────  ────────────────  ────────────────  ─────────────────
posmono/api              node:20-alpine    ~150 MB           Express API
posmono/worker           node:20-alpine    ~150 MB           BullMQ worker
posmono/socket           node:20-alpine    ~100 MB           Socket.IO server
posmono/nginx            nginx:1.25-alpine ~50 MB            Reverse proxy
                                                                            
Shared layer: All Node.js images share the same base and node_modules          
(layer caching via pnpm workspaces — only changed code is rebuilt)             
```

### 2.3 Image Build Optimization

```
WORKSPACE-AWARE BUILD:
──────────────────────

  TurboRepo + Docker layer caching strategy:

  Layer 1: pnpm-workspace.yaml + package.json files
    → Only rebuild if dependencies change

  Layer 2: pnpm-lock.yaml
    → Only rebuild if lockfile changes

  Layer 3: Shared package (types, validation, constants)
    → Only rebuild if shared/* changes

  Layer 4: Service code (backend/src/*)
    → Rebuild on every code change

  This means:
    • 90% of builds use cached layers (just Layer 4 rebuilds)
    • Average build time: 30-60 seconds (not 5 minutes)
```

### 2.4 Container Resource Allocation

```
CONTAINER           CPU        MEMORY        STORAGE       SCALING
──────────────────  ────────  ────────────  ────────────  ───────────────────
API                 1-2 vCPU   512MB-1GB     —             Horizontal
Socket              1 vCPU     256-512MB     —             Horizontal
Worker              1-2 vCPU   512MB-1GB     —             Horizontal
MongoDB             2-4 vCPU   4-8GB         50GB+ SSD     Vertical → Shard
Redis               1-2 vCPU   1-4GB         —             Cluster mode
Nginx               0.5 vCPU   128-256MB     —             Vertical
Prometheus          1 vCPU     1-2GB         50GB          Vertical
Grafana             0.5 vCPU   256MB         10GB          Vertical
Loki                1 vCPU     2-4GB         100GB         Horizontal later

STAGE 1 TOTAL:      10-16 vCPU  16-32GB RAM  200GB+ SSD
```

### 2.5 Docker Compose — Production

```yaml
# docker/docker-compose.yml
version: '3.8'

services:
  nginx:
    image: posmono/nginx:${TAG:-latest}
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
      - certbot_data:/var/www/certbot
    depends_on:
      - api
      - socket
    restart: unless-stopped

  api:
    image: posmono/api:${TAG:-latest}
    env_file: ../.env
    environment:
      - NODE_ENV=production
      - PORT=3000
    healthcheck:
      test: ['CMD', 'wget', '--no-verbose', '--tries=1', 'http://localhost:3000/health']
      interval: 15s
      timeout: 5s
      retries: 3
    volumes:
      - api_tmp:/tmp
    depends_on:
      mongodb:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  socket:
    image: posmono/socket:${TAG:-latest}
    env_file: ../.env
    environment:
      - NODE_ENV=production
      - PORT=3001
    healthcheck:
      test: ['CMD', 'wget', '--no-verbose', '--tries=1', 'http://localhost:3001/health']
      interval: 15s
      timeout: 5s
      retries: 3
    depends_on:
      - redis
    restart: unless-stopped

  worker:
    image: posmono/worker:${TAG:-latest}
    env_file: ../.env
    environment:
      - NODE_ENV=production
    depends_on:
      - mongodb
      - redis
    restart: unless-stopped

  mongodb:
    image: mongo:7
    command: ['mongod', '--replSet', 'rs0', '--bind_ip_all', '--auth']
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_ROOT_USER}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD}
    volumes:
      - mongodb_data:/data/db
      - mongodb_config:/data/configdb
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh --quiet
      interval: 30s
      timeout: 10s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: ['redis-server', '--appendonly', 'yes', '--requirepass', '${REDIS_PASSWORD}']
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 15s
      timeout: 5s
      retries: 3
    restart: unless-stopped

  prometheus:
    image: prom/prometheus:v2.50
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=30d'
    restart: unless-stopped

  grafana:
    image: grafana/grafana:10.3
    environment:
      - GF_SECURITY_ADMIN_PASSWORD__FILE=/run/secrets/grafana_admin_password
      - GF_INSTALL_PLUGINS=grafana-piechart-panel
    volumes:
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards:ro
      - ./grafana/datasources:/etc/grafana/provisioning/datasources:ro
      - grafana_data:/var/lib/grafana
    depends_on:
      - prometheus
      - loki
    restart: unless-stopped

  loki:
    image: grafana/loki:2.9
    volumes:
      - ./loki/loki-config.yml:/etc/loki/local-config.yaml:ro
      - loki_data:/loki
    command: -config.file=/etc/loki/local-config.yaml
    restart: unless-stopped

  promtail:
    image: grafana/promtail:2.9
    volumes:
      - /var/log:/var/log:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - ./promtail/promtail-config.yml:/etc/promtail/config.yml:ro
    command: -config.file=/etc/promtail/config.yml
    restart: unless-stopped

volumes:
  mongodb_data:
  mongodb_config:
  redis_data:
  prometheus_data:
  grafana_data:
  loki_data:
  certbot_data:
  api_tmp:
```

### 2.6 Container Security

```
SECURITY MEASURES:
──────────────────

  ALL CONTAINERS:
  ───────────────
  • Run as non-root user (USER node)
  • Read-only root filesystem (read_only: true)
  • No privileged mode
  • Resource limits (mem_limit, cpus)
  • Drop all capabilities, add only needed (--cap-drop ALL --cap-add NET_BIND_SERVICE)

  API / WORKER / SOCKET:
  ─────────────────────
  • Security: no-new-privileges
  • Secrets via environment (from .env or Docker secrets)
  • No volumes except tmp for file uploads
  • Healthcheck required

  MONGODB / REDIS:
  ────────────────
  • Authentication required
  • Internal network only (no port mapping to host)
  • Persistent volumes for data

  NGINX:
  ─────
  • Only port 80/443 exposed to host
  • SSL certificates via Let's Encrypt
  • Rate limiting configured
  • Request body size limits
```

---

## 3. Reverse Proxy & Load Balancing

### 3.1 Choice: Nginx

Nginx is the right choice for Stage 1-2:

- Proven reliability in production
- Lower resource usage than Traefik
- Handles SSL termination, WebSocket proxying, rate limiting
- Simpler configuration for single-server setups
- Traefik can replace Nginx at Stage 3 when Kubernetes is introduced

### 3.2 Nginx Configuration Strategy

```
UPSTREAM SERVICES:
──────────────────

  api_upstream:
    - api:3000                  (single server in Stage 1)
    - Round-robin load balancing
    - Max fails: 3, fail timeout: 30s
    - Keepalive: 32 connections

  socket_upstream:
    - socket:3001
    - IP hash for sticky sessions (Socket.IO requires this)
    - Max fails: 3, fail timeout: 30s

ROUTING RULES:
──────────────

  /api/*                        → api_upstream
  /socket.io/*                  → socket_upstream
  /health                       → api_upstream (load balancer health check)
  /metrics                      → api_upstream (Prometheus metrics)
  /grafana/*                    → grafana:3030 (admin-only, VPN-restricted)

SUBDOMAIN ROUTING:
─────────────────

  *.posmono.app                 → Nginx (catch-all)
  tenant-a.posmono.app          → Nginx → API (X-Tenant header)
  tenant-b.posmono.app          → Nginx → API (X-Tenant header)

  Nginx extracts subdomain and passes as X-Tenant-Slug header:
    server_name ~^(?<tenant>.+)\.posmono\.app$;
    proxy_set_header X-Tenant-Slug $tenant;

CUSTOM DOMAIN (premium tier):
─────────────────────────────

  pos.warungmakmur.com          → CNAME to posmono.app
  → Nginx validates custom domain against tenant DB
  → Proxies to same API upstream
```

### 3.3 SSL Strategy

```
CERTIFICATE MANAGEMENT:
───────────────────────

  • Let's Encrypt via certbot (automated renewal)
  • Wildcard certificate: *.posmono.app
  • Auto-renewal via cron job (weekly)
  • HTTP-01 challenge for wildcard (DNS challenge)
  • Custom domains: individual certificates per domain

  SSL CONFIGURATION:
  ─────────────────
  • TLS 1.3 only (no TLS 1.1/1.0)
  • Strong ciphers (Mozilla intermediate profile)
  • HSTS enabled (max-age=31536000; includeSubDomains)
  • OCSP stapling
  • HTTP/2 enabled
```

### 3.4 Rate Limiting

```
NGINX RATE LIMITING:
────────────────────

  TENANT-LEVEL:
    • 100 requests/second per tenant
    • Key: $http_x_tenant_id
    • Burst: 50
    • Delay: nodelay

  IP-LEVEL:
    • 30 requests/second per IP
    • Key: $binary_remote_addr
    • Burst: 20
    • Delay: nodelay

  AUTH ENDPOINTS:
    • 5 requests/minute per IP (login)
    • 10 requests/minute per IP (register)
    • Key: $binary_remote_addr

  WEBHOOK ENDPOINTS:
    • Whitelist Midtrans IPs (no rate limit)
    • All other IPs: 10 requests/minute

  API:
    • Payload size limit: 10MB
    • Connection timeout: 60s
    • Proxy read timeout: 120s (for report generation)
```

---

## 4. CI/CD Pipeline

### 4.1 Tool Choice: GitHub Actions

- Native GitHub integration (repo already on GitHub)
- Matrix builds for parallel testing
- Self-hosted runner option for production deployments
- Secrets management via GitHub Secrets
- No additional cost within free tier limits

### 4.2 Pipeline Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        CI/CD PIPELINE                                │
│                                                                       │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐       │
│  │  CODE     │───►│  CI      │───►│  BUILD   │───►│  DEPLOY  │       │
│  │  PUSH     │    │  TESTS   │    │  IMAGES  │    │          │       │
│  └──────────┘    └──────────┘    └──────────┘    └────┬─────┘       │
│                                                        │             │
│                                                        ▼             │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    POST-DEPLOY                                │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │   │
│  │  │  Health   │  │  Smoke   │  │  Migrate │  │  Notify  │    │   │
│  │  │  Check    │  │  Tests   │  │  (if any)│  │          │    │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.3 CI Pipeline (On Push/PR)

```yaml
# .github/workflows/ci.yml (simplified)
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm run lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm run typecheck

  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1, 2, 3, 4]       # parallel test shards
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm run test -- --shard=${{ matrix.shard }}/4
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: test-results-${{ matrix.shard }}
          path: test-results/

  build:
    needs: [lint, typecheck, test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm run build
      - uses: actions/upload-artifact@v4
        with:
          name: build-output
          path: |
            backend/dist
            shared/dist
```

### 4.4 CD Pipeline (On Push to Main)

```yaml
# .github/workflows/cd.yml (simplified)
name: CD

on:
  push:
    branches: [main]

jobs:
  docker-build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [api, worker, socket]
    steps:
      - uses: actions/checkout@v4
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      - name: Login to Docker Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - name: Build and Push
        uses: docker/build-push-action@v5
        with:
          context: .
          file: docker/Dockerfile
          target: ${{ matrix.service }}
          push: true
          tags: |
            ghcr.io/posmono/${{ matrix.service }}:${{ github.sha }}
            ghcr.io/posmono/${{ matrix.service }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: [docker-build]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Production
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_KEY }}
          script: |
            cd /opt/posmono
            docker compose pull
            docker compose up -d --remove-orphans
            docker system prune -f --filter "until=24h"

  health-check:
    needs: [deploy]
    runs-on: ubuntu-latest
    steps:
      - name: Wait for deployment
        run: sleep 30
      - name: Check health endpoint
        run: |
          curl -f --retry 5 --retry-delay 10 \
            https://api.posmono.app/health \
            || exit 1
      - name: Run smoke tests
        run: |
          # Basic API smoke tests
          curl -f https://api.posmono.app/api/v1/health
          curl -f https://api.posmono.app/api/v1/metrics

  rollback:
    needs: [health-check]
    if: failure()
    runs-on: ubuntu-latest
    steps:
      - name: Rollback to previous version
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_KEY }}
          script: |
            cd /opt/posmono
            # Re-tag previous images and restart
            docker compose pull
            docker compose up -d --remove-orphans

  notify:
    needs: [deploy, rollback]
    runs-on: ubuntu-latest
    if: always()
    steps:
      - name: Notify team
        uses: slackapi/slack-github-action@v1.24.0
        with:
          payload: |
            {
              "text": "Deployment ${{ job.status }}: ${{ github.sha }}"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

### 4.5 Deployment Strategy

```
STRATEGY: Blue-Green (when budget allows)
──────────────────────────────────────────

  Stage 1 (single VPS):
    • Stop-and-replace (acceptable for early stage)
    • Max downtime: ~10 seconds
    • Migrations run before deploy
    • Rollback: docker compose pull previous tag

  Stage 2 (multi-server):
    • Rolling update (one instance at a time)
    • Zero-downtime achievable
    • Health check must pass before next instance

  Stage 3 (Kubernetes):
    • Rolling update via Deployment strategy
    • Canary deployments for risky changes
    • Automatic rollback on health check failure

MIGRATION STRATEGY:
───────────────────

  • Migrations are run AS A SEPARATE STEP before deploy
  • Backward-compatible schema changes only
  • Never delete a column in the same deploy that stops using it
  • Two-phase: Add new → Deploy code using new → Remove old
```

### 4.6 Version & Tag Strategy

```
GIT TAGGING:
────────────

  v1.2.3               → Semantic version (production release)
  v1.2.3-rc.1          → Release candidate
  v1.2.3-beta.2        → Beta release

DOCKER IMAGE TAGGING:
─────────────────────

  ghcr.io/posmono/api:v1.2.3           → Git tag (immutable)
  ghcr.io/posmono/api:latest            → Latest stable
  ghcr.io/posmono/api:sha-abc123def     → Every push to main

ENVIRONMENT TAGS:
─────────────────

  ghcr.io/posmono/api:staging           → Staging environment
  ghcr.io/posmono/api:production        → Production environment
```

---

## 5. Monitoring Architecture

### 5.1 Four Golden Signals

Every service must expose metrics for:

```
1. LATENCY         — Time to serve requests (p50, p95, p99)
2. TRAFFIC         — Request rate (requests/second)
3. ERRORS          — Error rate (5xx, 4xx, exceptions)
4. SATURATION      — Resource utilization (CPU, memory, connections)

POS-SPECIFIC METRICS:
─────────────────────
5. QUEUE DEPTH     — BullMQ queue sizes (pending, active, delayed, failed)
6. PAYMENT RATE    — Transactions/minute, success/failure ratio
7. SYNC HEALTH     — Offline sync conflicts, failed syncs
8. PRINTER HEALTH  — Successful/failed print jobs per printer
9. DEVICE HEALTH   — Active devices, stale heartbeats
```

### 5.2 Prometheus Metrics

```
ENDPOINT: /metrics (exposed on port 9090 internally)

DEFAULT METRICS (auto-collected):
───────────────────────────────────
  process_cpu_seconds_total
  process_resident_memory_bytes
  nodejs_eventloop_lag_seconds
  nodejs_heap_size_used_bytes
  nodejs_active_handles
  nodejs_active_requests

APPLICATION METRICS (custom Prometheus client):
────────────────────────────────────────────────

  HTTP:
  ────
  http_requests_total{method, path, status, tenant}
  http_request_duration_seconds{method, path, quantile}
  http_requests_in_flight{method}

  DATABASE:
  ────────
  mongodb_connections_active
  mongodb_operations_total{operation, collection}
  mongodb_operation_duration_seconds{operation}
  mongodb_query_execution_time_seconds{collection}

  QUEUE (BullMQ):
  ──────────────
  bullmq_queue_size{queue, status}           // waiting, active, delayed, failed
  bullmq_job_duration_seconds{queue, job}
  bullmq_jobs_completed_total{queue}
  bullmq_jobs_failed_total{queue, error}

  PAYMENT:
  ───────
  payments_total{method, status}
  payment_duration_seconds{method}
  payment_failed_total{reason}

  WEBSOCKET:
  ─────────
  socket_connections_active{tenant}
  socket_events_total{event}
  socket_errors_total{type}

  SYNC:
  ────
  sync_operations_total{type, status}
  sync_conflicts_total{type, resolution}
  sync_duration_seconds

  PRINTER:
  ───────
  printer_jobs_total{printer, status}
  printer_job_duration_seconds{printer}
  printer_errors_total{printer, error}

  BUSINESS:
  ────────
  orders_created_total{source}
  orders_completed_total
  revenue_total{payment_method}
  active_tenants
  active_devices{type}
```

### 5.3 Critical Alerts

```
ALERT                           CONDITION                         SEVERITY    CHANNEL
──────────────────────  ─────────────────────────────────────  ──────────  ────────────────
API Down                 Health check fails for > 30s           CRITICAL    PagerDuty + SMS
High Error Rate          5xx rate > 5% for 5 minutes            CRITICAL    PagerDuty + SMS
High Latency             p99 latency > 2s for 5 minutes         HIGH        Slack + Email
Payment Failure Rate     payment_failed > 10% in 5 min          CRITICAL    PagerDuty + SMS
Queue Backlog            any queue with > 1000 pending jobs     HIGH        Slack
Queue Stuck              no jobs processed in 5 minutes         CRITICAL    PagerDuty
Disk Space               < 20% remaining                        HIGH        Slack
Memory                   > 85% for 10 minutes                   HIGH        Slack
MongoDB Replication      any replica lag > 10s                  CRITICAL    PagerDuty
Redis Down               connection lost                        CRITICAL    PagerDuty
Printer Failure          > 10 failed jobs in 5 min per printer  MEDIUM      Slack (admin)
Sync Conflict            > 5 conflicts in 10 minutes            MEDIUM      Slack
Tenant Limit Reached     any tenant near plan limit             LOW         Email
SSL Expiry               < 30 days                              MEDIUM      Email
Certificate Error        SSL handshake failures                 HIGH        Slack
```

### 5.4 Grafana Dashboards

```
DASHBOARD: EXECUTIVE SUMMARY
─────────────────────────────
  Purpose: C-level visibility
  Panels:
    • Active tenants + devices (gauge)
    • Revenue today vs yesterday (stat)
    • Orders in last 24h (timeseries)
    • Error rate (timeseries)
    • System health (5 green/red lights)

DASHBOARD: API PERFORMANCE
───────────────────────────
  Purpose: Engineering — API health
  Panels:
    • Request rate (rps) by endpoint
    • Latency p50/p95/p99 by endpoint
    • Error rate by status code
    • Top slowest endpoints (table)
    • Active connections
    • CPU/Memory per container

DASHBOARD: QUEUE & WORKER
──────────────────────────
  Purpose: Engineering — background job health
  Panels:
    • Queue depth per queue (stacked bar)
    • Job processing rate
    • Failed jobs by queue
    • Worker CPU/memory
    • Dead letter queue count

DASHBOARD: PAYMENT OPERATIONS
─────────────────────────────
  Purpose: Finance + Engineering
  Panels:
    • Transactions/minute by method
    • Success rate by method
    • Failed transactions list (table)
    • Revenue by hour (bar)
    • Midtrans webhook latency

DASHBOARD: TENANT HEALTH
─────────────────────────
  Purpose: Support team
  Panels:
    • Per-tenant request rate
    • Per-tenant error rate
    • Per-tenant active devices
    • Per-tenant queue jobs
    • Top tenants by load (table)

DASHBOARD: DATABASE
────────────────────
  Purpose: DBA
  Panels:
    • Connections per tenant
    • Query latency p95
    • Disk usage
    • Replication lag
    • Index usage stats

DASHBOARD: DEVICE & PRINTER
────────────────────────────
  Purpose: Operations
  Panels:
    • Active devices by type
    • Devices with stale heartbeats
    • Print jobs by status (pie)
    • Printer error rate
    • Offline sync queue size per tenant
```

---

## 6. Logging Architecture

### 6.1 Log Philosophy

```
STRUCTURED LOGS ONLY (No plain text):
─────────────────────────────────────

  Every log is a JSON object with:
  {
    "level": "info" | "warn" | "error" | "debug",
    "timestamp": "2026-06-30T10:30:00.000Z",
    "service": "api" | "worker" | "socket",
    "tenantId": "tnt_abc123" | null,
    "correlationId": "corr_xyz",
    "message": "Order created successfully",
    "context": { ... }           // structured data, not string interpolation
  }
```

### 6.2 Log Levels

```
LEVEL       USE CASE                                    ACTION
───────  ──────────────────────────────────────────  ────────────────────────
ERROR     System is degraded, manual intervention     Immediate Slack alert
          needed (payment failed, DB connection lost)

WARN      Something unexpected but handled            Slack notification
          (retry attempt, rate limit hit, slow query)  (non-urgent)

INFO      Business events, state changes              Stored for analysis
          (order created, invoice paid, user login)    Grafana exploration

DEBUG     Developer troubleshooting only              Not shipped to production
          (request payloads, query results)             (configurable via env)

TRACE     Distributed tracing data                    Zipkin/Jaeger integration
          (event flow across contexts)                  (Phase 2+)
```

### 6.3 Log Storage & Query

```
ARCHITECTURE:
─────────────

  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
  │  Node.js  │───►│ Promtail │───►│   Loki   │───►│  Grafana │
  │  (stdout) │    │ (agent)  │    │ (store)  │    │ (query)  │
  └──────────┘    └──────────┘    └──────────┘    └──────────┘

  WHY LOKI INSTEAD OF ELK:
  ────────────────────────
  • Loki is designed for logs + metrics correlation (Grafana native)
  • Lower resource usage (no indexing, just labels)
  • No separate log shipper needed (Promtail covers it)
  • Cost-effective for high log volume
  • ELK can be introduced later if full-text search is needed

  LOG RETENTION:
  ─────────────
  • Real-time: 7 days in Loki (hot)
  • Archived: 30 days in object storage (cool)
  • Compliance: 1 year in cold storage (S3 Glacier)
  • Audit logs: Permanent (in MongoDB, not Loki)
```

### 6.4 What to Log

```
EVERYTHING:
───────────

  • Every HTTP request (method, path, status, duration, tenant)
  • Every database query (slow queries only in production)
  • Every domain event published/subscribed
  • Every payment webhook (full payload, masked sensitive data)
  • Every queue job lifecycle (enqueue, start, complete, fail)
  • Every authentication attempt (success/failure, IP, user agent)
  • Every state machine transition
  • Every sync operation
  • Every print job
  • Every error with full stack trace

SENSITIVE DATA — NEVER LOG:
───────────────────────────

  ✗ Passwords (even hashed)
  ✗ JWT tokens
  ✗ Midtrans server key
  ✗ Full credit card numbers (Midtrans handles tokenization)
  ✗ Database connection strings with credentials
  ✗ API keys / secrets
```

### 6.5 Log Correlation

```
CORRELATION ID FLOW:
─────────────────────

  REQUEST COMES IN:
  1. Nginx generates correlationId (UUID) if not present
  2. Passed as X-Correlation-Id header to API
  3. ALL logs in the request chain carry this ID
  4. When API publishes event, event carries same correlationId
  5. Worker processing the event logs with same correlationId
  6. Can trace: Request → API Handler → Event → Worker → DB

  TRACING A FAILED ORDER:
  ────────────────────────
  grafana explore:
    {correlationId="corr_xyz"}
    → See: API request → OrderCreated event → Payment handler
    → Inventory deduction → Error → Retry → DLQ
```

### 6.6 Audit Logs (Compliance)

Audit logs are stored in MongoDB (not Loki) because:

- They are immutable (append-only collection)
- Need long-term retention (years)
- Need per-tenant isolation
- Need query capability by tenant, user, resource

```javascript
{
  _id: "aud_" + nanoid,
  tenantId: "tnt_abc123",
  userId: "usr_456",
  userEmail: "budi@warung.com",
  action: "order.cancelled",
  resourceType: "Order",
  resourceId: "ord_abc123",
  changes: {
    previousStatus: "paid",
    newStatus: "cancelled",
    reason: "Customer requested cancellation"
  },
  ipAddress: "192.168.1.100",
  userAgent: "POSMono/Electron",
  correlationId: "corr_xyz",
  occurredAt: ISODate("2026-06-30T10:30:00.000Z")
}
```

---

## 7. Backup Strategy

### 7.1 Backup Schedule

```
DATABASE BACKUPS (MongoDB):
───────────────────────────

  TYPE            FREQUENCY    RETENTION     STORAGE        METHOD
  ────────────  ───────────  ────────────  ───────────  ─────────────────
  Oplog实时      Continuous   N/A            Same server   Replica set sync
  (replication)
  Snapshot       Every 6h     7 days         Local disk    mongodump with
                                                                            --oplog
  Daily          1x/day       30 days        S3            mongodump → gzip → S3
  Weekly         1x/week      12 months      S3 Glacier    mongodump → gzip → S3 IA
  Monthly        1x/month     3 years        S3 Glacier    mongodump → gzip → S3 Glacier

  BACKUP STRATEGY: mongodump per database (tenant-by-tenant)
  ────────────────────────────────────────────────────────────
  Instead of dumping entire MongoDB instance (which is large and slow):
    • Iterate over tenant list
    • Dump each tenant DB individually (smaller, parallelizable)
    • System DB dumped separately
    • Each tenant backup is independently restorable
```

### 7.2 Backup Implementation

```
BACKUP SCRIPT (runs as cron job in container):
──────────────────────────────────────────────

  #!/bin/bash
  # /scripts/backup.sh

  TIMESTAMP=$(date +%Y%m%d-%H%M%S)
  BACKUP_DIR="/backups/daily/$TIMESTAMP"
  S3_BUCKET="s3://posmono-backups"

  # 1. List all tenant databases
  tenant_dbs=$(mongosh --quiet --eval \
    "db.getSiblingDB('posmono_system').tenants.find({}, {databaseName:1}).map(t => t.databaseName)")

  # 2. Backup each tenant database in parallel (max 4 concurrent)
  for db in $tenant_dbs; do
    mongodump \
      --uri="$MONGO_URI" \
      --db="$db" \
      --archive="$BACKUP_DIR/$db.archive" \
      --gzip \
      --oplog &
  done
  wait

  # 3. Upload to S3
  s5cmd sync "$BACKUP_DIR/" "$S3_BUCKET/daily/$TIMESTAMP/"

  # 4. Cleanup local files
  rm -rf "$BACKUP_DIR"

  # 5. Slack notification on failure
  if [ $? -ne 0 ]; then
    curl -X POST -H 'Content-type: application/json' \
      --data '{"text":"Backup FAILED: '"$TIMESTAMP"'"}' \
      $SLACK_WEBHOOK_URL
  fi
```

### 7.3 Other Backup Types

```
APPLICATION DATA:
─────────────────

  TYPE                FREQUENCY    RETENTION     METHOD
  ────────────────  ───────────  ────────────  ─────────────────────
  Uploaded images    Real-time     Forever       S3 (source of truth)
  Receipt PDFs       Real-time     Forever       S3 (generated from data)
  Tenant config      Per update    Forever       MongoDB (in system DB)
  Billing data       Real-time     Forever       MongoDB (in system DB)
  n8n workflows      Daily         30 days       Export to S3

REDIS DATA:
───────────

  Redis is a CACHE, not source of truth for critical data.
  BullMQ uses Redis — queue jobs are recoverable from outbox.

  Backup: RDB/AOF snapshot every 6h
  Retention: 7 days
  Purpose: Faster recovery (rebuild from MongoDB otherwise)

FILES:
──────

  • docker-compose.yml, nginx config, .env → Git repository
  • SSL certificates → Certbot auto-renewal + backup to S3
  • Grafana dashboards → Provisioned from Git
  • Prometheus rules → Provisioned from Git
  • All infrastructure-as-code → Git repository
```

### 7.4 Backup Verification

```
MONTHLY RESTORE TEST:
──────────────────────

  Every month:
  1. Spin up isolated restore environment
  2. Download latest daily backup from S3
  3. Restore to test MongoDB instance
  4. Run automated verification:
     a. Application starts successfully
     b. Can authenticate with test user
     c. Can read data from test tenant
     d. Sample query returns expected results
  5. Report result to team

  FAILURE RESPONSE:
  ─────────────────
  • If restore test fails → fix backup process immediately
  • Root cause analysis required
  • Retrospective to prevent recurrence
```

### 7.5 S3 Bucket Structure

```
s3://posmono-backups/
├── daily/2026-06-30-020000/
│   ├── posmono_system.archive.gz
│   ├── posmono_tnt_abc123.archive.gz
│   ├── posmono_tnt_xyz789.archive.gz
│   └── ...
├── weekly/2026-W27/
│   └── ...
├── monthly/2026-06/
│   └── ...
├── redis/
│   └── dump-2026-06-30.rdb
├── n8n/
│   └── workflows-2026-06-30.json

s3://posmono-assets/
├── uploads/
│   └── {tenantId}/
│       └── {date}/
│           └── {filename}
├── receipts/
│   └── {tenantId}/
│       └── {year}/{month}/
│           └── receipt-{orderNumber}.pdf
└── exports/
    └── {tenantId}/
        └── {date}/
            └── report-{type}.xlsx
```

---

## 8. Disaster Recovery Strategy

### 8.1 Failure Scenarios & Recovery Time

```
SCENARIO                    RTO          RPO         IMPACT              RECOVERY
──────────────────────  ──────────  ──────────  ─────────────────  ───────────────────────
Single container crash   < 30s       None        Minimal            Docker auto-restart
                                                                   (restart: unless-stopped)
API process hang         < 1 min     None        POS unavailable    Health check → restart
MongoDB primary down     < 30s       < 5s        DB write outage    Replica set election
MongoDB entire cluster   < 2 hrs     < 6h        Total outage       Restore from S3 backup
Redis down               < 1 min     < 6h        Queues degraded    Rebuild from AOF/RDB
                                                   (BullMQ delayed)
Full server failure      < 30 min    < 6h        Total outage       Spare VPS + restore
Data corruption          < 2 hrs     < 6h        Data integrity     Point-in-time restore
Security breach          < 1 hr      N/A         Confidentiality    Isolate, rotate keys,
                                                                   restore from clean backup
Region outage (cloud)    < 4 hrs     < 24h       Total outage       Multi-region DR
Payment webhook lost     < 5 min     None        Payment pending    Midtrans retry + pull
Disk full                < 15 min    None        Services down      Purge + extend volume
```

### 8.2 Recovery Procedures

```
CONTAINER CRASH:
────────────────
  • Docker restart policy handles this automatically
  • If container restarts > 3 times in 60s → pause container
  • Alert sent to engineering
  • Engineer SSHes, checks logs, resolves issue

API DEGRADED / SLOW:
────────────────────
  • Auto-scale (if multi-instance) — spin up new instance
  • Circuit breaker trips for downstream dependencies
  • Degrade gracefully: disable non-critical features
  • Return 503 with retry-after header
  • Alert: p99 latency > 2s

DATABASE CORRUPTION:
────────────────────
  DETECTION:
    • Replication fails consistently
    • Query results are inconsistent
    • Validation checks fail

  RECOVERY:
    1. Stop all services (prevent further corruption)
    2. Identify the corruption point (from oplog)
    3. Choose restore point:
       a. If corruption < 1h ago: restore from last snapshot
       b. If corruption > 1h: point-in-time recovery from oplog
    4. Restore to new MongoDB instance
    5. Validate data integrity
    6. Switch traffic to new instance
    7. Identify root cause of corruption

FULL SERVER FAILURE:
────────────────────
  PREREQUISITES:
    • Regular backups to S3 (every 6h)
    • Infrastructure-as-code in Git
    • .env secrets backed up (encrypted)

  RECOVERY:
    1. Provision new VPS (from snapshot or fresh)
    2. Install Docker + dependencies (via Ansible script)
    3. Clone infrastructure repo
    4. Restore .env from encrypted backup
    5. Pull latest Docker images
    6. Download latest backup from S3
    7. Restore MongoDB
    8. Start services
    9. Validate health
    10. Update DNS to new server IP

  TARGET RTO: 30 minutes (with warm spare)
  TARGET RTO: 2 hours (without warm spare)

PAYMENT WEBHOOK LOST:
─────────────────────
  Midtrans has built-in retry mechanism:
    • Retries webhook every 5 minutes for up to 24 hours
    • Dashboard shows failed webhooks

  ADDITIONAL SAFEGUARDS:
    • Poll Midtrans transaction status API every 5 min for pending payments
    • Manual reconciliation report generated daily
    • Admin can trigger status check from dashboard
```

### 8.3 High Availability Strategy

```
STAGE 1 (single VPS):
─────────────────────
  • Docker auto-restart policies
  • MongoDB replica set (3 members in container)
    - 1 primary + 2 secondaries (arbiter for split-brain prevention)
  • Redis AOF persistence (append-only fsync every second)
  • Not fully HA (single server is single point of failure)
  • Daily backup is the primary recovery mechanism

STAGE 2 (multi-server):
────────────────────────
  • 2+ VPS behind load balancer
  • API + Socket deployed on both servers
  • MongoDB replica set across servers (primary + 2 secondaries)
  • Redis cluster (3 nodes) for HA
  • Worker can run on either server (jobs are idempotent)
  • Nginx on both servers (keepalived for floating IP)

STAGE 3 (Kubernetes):
──────────────────────
  • Pod auto-healing (failed pods are rescheduled)
  • Horizontal Pod Autoscaler (scale based on CPU/memory)
  • MongoDB Operator for automated failover
  • Redis Sentinel for automated failover
  • Multi-AZ deployment (if cloud)
  • Blue-green or canary deployments
```

### 8.4 Disaster Recovery Plan — Runbook

```
DR PLAN: SERVER FAILURE
════════════════════════

  1. DETECT
     • PagerDuty alert: "API Down — health check failed"
     • Engineer acknowledges within 5 minutes

  2. ASSESS
     • Can I SSH into server?
       YES → Check docker ps, docker logs, systemctl status
       NO → Proceed to restore on spare server
     • Is data affected?
       YES → Use latest clean backup
       NO → Just restart services

  3. RESTORE (if server unrecoverable)
     • Notify team: "DR in progress"
     • Provision spare VPS from Ansible:
       ansible-playbook deploy/playbooks/provision.yml
     • Restore latest backup:
       rsync -avz s3-backup-restore/ /data/restore/
     • Start services:
       docker compose -f docker/docker-compose.yml up -d
     • Verify health:
       curl https://api.posmono.app/health

  4. VALIDATE
     • Run smoke tests
     • Verify a few tenant orders exist
     • Process a test payment (sandbox)
     • Verify dashboard data

  5. RESOLVE
     • Update DNS if IP changed (TTL 60s)
     • Notify team: "DR completed"
     • Post-mortem within 24 hours

DR PLAN: DATA CORRUPTION
══════════════════════════

  1. FREEZE
     • Immediately stop all services
     • Prevent more writes

  2. IDENTIFY
     • When did corruption start?
     • Which tenants are affected?
     • How extensive is it?

  3. RESTORE
     • Restore to point just before corruption
     • If partial (one tenant): restore just that tenant DB
     • If full: restore entire MongoDB from snapshot

  4. RECONCILE
     • Identify transactions between backup time and corruption
     • Re-process from payment gateway logs
     • Manual reconciliation if needed

  5. RESUME
     • Start services
     • Monitor for recurrence
```

### 8.5 Monitoring for DR

```
PROACTIVE DETECTION:
────────────────────

  WHAT WE MONITOR                     ALERT IF
  ──────────────────────────────  ─────────────────────────────────
  MongoDB replication lag         > 10 seconds
  Disk usage                      > 80%
  Memory usage                    > 85% for 10 minutes
  CPU usage                       > 90% for 10 minutes
  SSL certificate expiry          < 30 days
  Backup completion               Backup did not run in 24h
  Backup age                      Last backup > 12h ago
  Failed backup                   Backup script returned error
  Read-only filesystem            Can't write to /data
  OOM killer                      Out of memory events
```

---

## 9. Security Infrastructure

### 9.1 Security Layers

```
LAYER 1: NETWORK
─────────────────
  • Cloudflare for DDoS protection + WAF
  • Only ports 80 (redirect) and 443 (HTTPS) exposed
  • SSH only from trusted IPs (VPN or bastion host)
  • Rate limiting at Nginx level
  • Fail2Ban for brute force protection
  • Docker internal network (no cross-container eavesdropping)

LAYER 2: APPLICATION
─────────────────────
  • All traffic over TLS 1.3
  • JWT with short expiry (8h) + refresh tokens
  • Device authentication with shared secret
  • RBAC enforced at middleware level
  • Input validation (Zod) on every endpoint
  • Rate limiting per tenant + per IP
  • Idempotency keys prevent replay attacks
  • CORS restricted to known origins

LAYER 3: DATA
──────────────
  • Database-per-tenant (physical isolation)
  • MongoDB authentication required
  • Encryption at rest (MongoDB + disk encryption)
  • Secrets never in code (always .env or Docker secrets)
  • Payment data handled by Midtrans (tokenization)
  • No sensitive data in logs
  • Audit trail for all data modifications

LAYER 4: CONTAINER
───────────────────
  • Non-root user in containers
  • Read-only root filesystem
  • No privileged containers
  • Resource limits prevent DoS via resource exhaustion
  • Regular image scanning (Trivy)
  • Minimal base images (alpine/distroless)
```

### 9.2 Secrets Management

```
STAGE 1 (single VPS):
─────────────────────
  • .env file on server (outside repo)
  • Backed up encrypted to S3
  • Permissions: 600, owner: root

STAGE 2 (multi-server):
─────────────────────────
  • Docker secrets (files mounted in containers)
  • HashiCorp Vault (for advanced needs)

STAGE 3 (Kubernetes):
──────────────────────
  • Kubernetes Secrets (encrypted at rest)
  • External Secrets Operator (syncs from Vault/AWS Secrets Manager)

SECRETS ROTATION:
─────────────────
  • JWT signing keys: rotate every 90 days
  • Device secrets: rotate on device re-registration
  • Database passwords: rotate every 180 days
  • API keys (Midtrans, n8n): rotate on compromise suspicion
  • SSL certificates: auto-renew every 60 days (Let's Encrypt)
```

### 9.3 API Security

```
AUTHENTICATION:
───────────────
  • JWT access tokens (8h expiry, short-lived)
  • Refresh tokens (30d, rotate on use)
  • Device tokens (24h, refresh via secret)
  • Webhook signatures (Midtrans HMAC verification)

AUTHORIZATION:
──────────────
  • Middleware chain: Authenticate → Resolve Tenant → Authorize
  • RBAC with granular permissions
  • Tenant isolation check on every request
  • Device scope validation

VALIDATION:
───────────
  • Zod schemas on every request body
  • Sanitize all inputs (NoSQL injection prevention)
  • Maximum request size: 10MB
  • Content-Type enforcement (application/json only)

RATE LIMITING:
──────────────
  • Global: 1000 req/min
  • Per-tenant: 100 req/s
  • Per-IP: 30 req/s
  • Auth endpoints: 5 req/min per IP
  • Burst handling with nodelay

CORS:
─────
  • Allowed origins: *.posmono.app, custom domains
  • No CORS for API endpoints (only same-origin)
  • Credentials: same-origin
```

### 9.4 Payment Security

```
MIDTRANS INTEGRATION:
─────────────────────

  • Server key stored as secret (never in code or client)
  • Webhook signature verification (HMAC SHA512)
  • Idempotency key prevents duplicate charges
  • Amount verification (server always sets amount, never client)
  • Order status verification before payment processing
  • No credit card data handled by our servers (Midtrans handles PCI-DSS)

  WEBHOOK SECURITY:
  ────────────────
  1. Verify HMAC signature using MIDTRANS_SERVER_KEY
  2. Verify order_id matches pending order
  3. Verify gross_amount matches order total
  4. Verify transaction_status is valid transition
  5. Verify webhook IP is in Midtrans IP range
  6. Process idempotently (check if already processed)
```

### 9.5 Tenant Isolation

```
PHYSICAL ISOLATION:
───────────────────
  • Database-per-tenant (MongoDB)
  • Each tenant's data is in a separate database
  • No shared collections across tenants
  • Connection pooling per tenant (isolated)

LOGICAL ISOLATION:
───────────────────
  • Tenant context resolved from JWT/subdomain/header
  • Middleware enforces tenant scope on every request
  • Repository base class always filters by tenantId
  • Even if middleware fails, query returns empty (not cross-tenant data)

ISOLATION VERIFICATION:
───────────────────────
  • Penetration testing: attempt cross-tenant data access
  • Automated test: "Tenant A cannot access Tenant B data"
  • Code review: every new query includes tenantId filter
```

### 9.6 Infrastructure Security Checklist

```
DAILY:
──────
  □ Review failed login attempts
  □ Check rate limit breaches
  □ Monitor error rates for anomalies

WEEKLY:
───────
  □ Review audit log for suspicious activity
  □ Check for dependency vulnerabilities (pnpm audit)
  □ Review firewall rules

MONTHLY:
────────
  □ Rotate JWT signing keys (if compromised)
  □ Review access to production (SSH keys, team changes)
  □ Run docker image vulnerability scan (Trivy)
  □ Restore test backup (verify backup integrity)

QUARTERLY:
──────────
  □ Penetration test
  □ Security audit of dependencies
  □ Review infrastructure-as-code for security misconfigurations
  □ Update SSL/TLS configuration to latest best practices
  □ Team security training
```

---

## 10. Future Scaling Roadmap

### 10.1 Stage Details

```
STAGE 1: LAUNCH (0-100 tenants)
══════════════════════════════════

  INFRASTRUCTURE:
  ───────────────
  • Single VPS (8 vCPU, 32GB RAM, 200GB SSD)
  • Docker Compose (all services on one machine)
  • MongoDB replica set (3 containers on same VPS)
  • Redis standalone
  • Nginx + Let's Encrypt
  • Prometheus + Grafana + Loki (same VPS)

  CAPACITY:
  ────────
  • 100 tenants × 500 orders/day = 50,000 orders/day
  • 100 concurrent API requests
  • 500 Socket.IO connections
  • 50,000 BullMQ jobs/day

  COST:
  ────
  • VPS: ~$80/month (Hetzner / DigitalOcean)
  • S3: ~$10/month
  • Monitoring: $0 (self-hosted)
  • Total: ~$100/month

  LIMITATIONS:
  ────────────
  • Single point of failure (the VPS)
  • No horizontal scaling
  • MongoDB replica set members on same disk
  • Redis not highly available

STAGE 2: GROWTH (100-1,000 tenants)
══════════════════════════════════════

  INFRASTRUCTURE:
  ───────────────
  • 2-3 VPS (for redundancy)
  • Docker Compose with Swarm mode (or Nomad)
  • Load balancer (Nginx on separate VPS or Cloudflare LB)
  • MongoDB replica set across VPS (1 primary + 2 secondaries)
  • Redis cluster (3 nodes across VPS)
  • API + Socket deployed on all VPS (behind LB)
  • Workers distributed across VPS
  • Monitoring stack on dedicated VPS (or same nodes)

  WHAT CHANGES FROM STAGE 1:
  ──────────────────────────
  • Session storage moved to Redis (shared across instances)
  • File uploads moved to S3-compatible storage (was local disk)
  • Socket.IO with Redis adapter (cross-instance pub/sub)
  • Nginx configured with multiple upstreams
  • Blue-green deployment becomes possible

  CAPACITY:
  ────────
  • 1,000 tenants × 500 orders/day = 500,000 orders/day
  • 500 concurrent API requests
  • 3,000 Socket.IO connections

  COST:
  ────
  • 3 VPS: ~$240/month
  • S3: ~$50/month
  • Load balancer: ~$20/month
  • Monitoring: $0 (self-hosted)
  • Total: ~$350/month

STAGE 3: SCALE (1,000-10,000 tenants)
════════════════════════════════════════

  INFRASTRUCTURE:
  ───────────────
  • Kubernetes cluster (managed: DOKS, EKS, or GKE)
  • 5-10 nodes (auto-scaling)
  • MongoDB Atlas (managed) or self-managed sharded cluster
  • Redis Enterprise or ElastiCache
  • Kafka (for event bus at scale)
  • Separated services (see extraction order below)
  • Istio or Linkerd for service mesh

  WHAT CHANGES FROM STAGE 2:
  ──────────────────────────
  • Kubernetes for container orchestration
  • MongoDB sharded by tenant ID
  • Event bus evolves from Redis pub/sub to Kafka
  • Services extracted and independently scalable
  • Multi-region deployment (active-passive)
  • Full CI/CD with canary deployments
  • Auto-scaling based on load

  CAPACITY:
  ────────
  • 10,000 tenants × 500 orders/day = 5,000,000 orders/day
  • 5,000 concurrent API requests
  • 30,000 Socket.IO connections

  COST:
  ────
  • Kubernetes: ~$500-1,500/month
  • MongoDB Atlas: ~$500-2,000/month
  • Redis: ~$100-500/month
  • S3: ~$200/month
  • Monitoring: ~$100/month
  • Total: ~$1,500-5,000/month

STAGE 4: ENTERPRISE (10,000+ tenants)
═══════════════════════════════════════

  INFRASTRUCTURE:
  ───────────────
  • Multi-region active-active
  • Global load balancer (Cloudflare / AWS Global Accelerator)
  • Dedicated Kubernetes clusters per region
  • MongoDB multi-region clusters
  • Kafka multi-region
  • CDN for static assets + edge caching for API
  • Fully autonomous infrastructure (GitOps)

  WHAT CHANGES FROM STAGE 3:
  ──────────────────────────
  • Multi-region for compliance (data residency)
  • Edge caching for read-heavy endpoints
  • Separate cluster per data region (e.g., EU, US, Asia)
  • Eventual consistency across regions
  • Full microservices with dedicated teams
```

### 10.2 Service Extraction Order

```
EXTRACTION SEQUENCE AS SCALE GROWS:
────────────────────────────────────

  FIRST EXTRACTION (Stage 2→3 boundary, ~500 tenants):
  ─────────────────────────────────────────────────────
  REASON: High traffic, clear boundary, independent scaling

  1. PAYMENT SERVICE
     Why first:
       • Payment processing has strict latency requirements
       • Midtrans webhooks need fast, reliable response (5s timeout)
       • Payment failures affect revenue directly
       • Can be deployed and scaled independently
     How:
       • Extract payment context as separate Express app
       • Shares MongoDB (same cluster, different DB)
       • Communicates via events to core

  2. NOTIFICATION SERVICE
     Why second:
       • Asynchronous — no need for request-response
       • Different scaling profile (bursty, spiky)
       • Can use different tech (n8n integration)
       • Easy extraction (event-driven, no direct calls)
     How:
       • Runs as a worker process (BullMQ consumer)
       • No HTTP API needed
       • n8n handles complex workflows

  SECOND EXTRACTION (Stage 3, ~2,000 tenants):
  ──────────────────────────────────────────────
  REASON: Resource-heavy, can be offloaded

  3. REPORTING SERVICE
     Why:
       • Heavy aggregation queries affect API performance
       • Can use read replicas or different DB (ClickHouse)
       • Stale data is acceptable (eventual consistency)
     How:
       • Materialized view pattern with event sourcing
       • Separate MongoDB instance or ClickHouse

  4. PRINTER SERVICE
     Why:
       • Device-specific protocols (ESC/POS)
       • Queue management per printer
       • Can be deployed close to devices (edge)
     How:
       • BullMQ queue + WebSocket for real-time status
       • Local print agent on Electron devices

  THIRD EXTRACTION (Stage 3→4, ~5,000 tenants):
  ────────────────────────────────────────────────
  REASON: Domain-specific, moderate traffic

  5. INVENTORY SERVICE
     Why:
       • High contention on stock operations
       • Needs dedicated optimization (version, CAS)
       • Dedicated cache for fast stock reads
     How:
       • Optimistic locking with version vectors
       • Redis for fast stock reads
       • Events to update catalog

  6. IDENTITY SERVICE
     Why:
       • Universal dependency for ALL services
       • Can be shared across multiple products
       • SSO, OAuth, social login
     How:
       • OAuth 2.0 / OpenID Connect
       • Separate user store (PostgreSQL)
       • Shared across services via JWT
```

### 10.3 When to Move to Kubernetes

```
SIGNS YOU'RE READY FOR KUBERNETES:
────────────────────────────────────

  ✅ You have 3+ servers and manually SSHing to deploy
  ✅ Your deployment process takes > 30 minutes
  ✅ You need per-service auto-scaling
  ✅ You need rolling updates with zero downtime
  ✅ You need self-healing infrastructure
  ✅ You have a dedicated DevOps engineer (or team)
  ✅ You understand networking, storage, and security well

  SIGNS YOU'RE NOT READY:
  ────────────────────────
  ❌ You have 1 server (Kubernetes adds complexity without benefit)
  ❌ You have < 5 engineers (Kubernetes is a full-time job)
  ❌ You don't know what a pod is (learn Docker Compose first)
  ❌ Your application can't handle ephemeral storage
  ❌ You don't have CI/CD yet (Kubernetes without CI/CD is painful)

  RECOMMENDED PATH:
  ─────────────────
  Stage 1: Docker Compose (simplest, sufficient)
  Stage 2: Nomad or Docker Swarm (lightweight orchestration)
  Stage 3: Kubernetes (full orchestration, auto-scaling)
```

### 10.4 Infrastructure Cost Projection

```
COST BY TENANT COUNT (estimate):
─────────────────────────────────

  TENANTS     INFRA MONTHLY     PER-TENANT/MONTH    REVENUE NEEDED
  ────────  ────────────────  ──────────────────  ────────────────
  10         ~$80             $8.00               $10/tenant/mo
  50         ~$80             $1.60               $10/tenant/mo
  100        ~$100            $1.00               $10/tenant/mo      ← Profitable
  500        ~$200            $0.40               $10/tenant/mo
  1,000      ~$350            $0.35               $10/tenant/mo
  5,000      ~$1,500          $0.30               $10/tenant/mo
  10,000     ~$3,000          $0.30               $10/tenant/mo

  NOTE: Per-tenant costs decrease as you scale.
  At 100 tenants with $10/month pricing, infrastructure is 10% of revenue.
```

### 10.5 Infrastructure as Code

```
FROM DAY 1 — VERSION-CONTROLLED INFRASTRUCTURE:
─────────────────────────────────────────────────

  posmono/
  ├── deploy/
  │   ├── ansible/               # Server provisioning
  │   │   ├── playbooks/
  │   │   │   ├── provision.yml
  │   │   │   ├── docker.yml
  │   │   │   └── firewall.yml
  │   │   └── vars/
  │   │       └── production.yml
  │   │
  │   ├── terraform/              # Cloud resources (Stage 2+)
  │   │   ├── main.tf
  │   │   ├── variables.tf
  │   │   └── outputs.tf
  │   │
  │   └── kubernetes/            # K8s manifests (Stage 3+)
  │       ├── namespaces/
  │       ├── deployments/
  │       └── services/
  │
  └── docker/                     # Docker configs
      ├── docker-compose.yml
      ├── Dockerfile
      ├── nginx/
      │   └── nginx.conf
      ├── prometheus/
      │   └── prometheus.yml
      ├── grafana/
      │   ├── dashboards/
      │   └── datasources/
      ├── loki/
      │   └── loki-config.yml
      └── promtail/
          └── promtail-config.yml
```

---

## Appendix A: Infrastructure ADRs

### ADR-001: Docker Compose over Kubernetes for Stage 1

```
Status: Accepted
Context: Single-server deployment, small team, no dedicated DevOps.
Decision: Use Docker Compose for Stage 1 deployment.
  All services run on a single VPS.
Consequences: Simple deployment, easy debugging. Single point of failure.
  Migration to K8s is planned for Stage 3.
```

### ADR-002: Nginx over Traefik for Reverse Proxy

```
Status: Accepted
Context: Need SSL termination, WebSocket proxy, subdomain routing, rate limiting.
Decision: Use Nginx. It's battle-tested, lower resource usage,
  simpler configuration for our use case.
Consequences: Manual config updates. Can migrate to Traefik when
  Kubernetes is introduced (Traefik is K8s-native).
```

### ADR-003: Prometheus + Grafana over Datadog/New Relic

```
Status: Accepted
Context: Early-stage SaaS with limited budget.
Decision: Self-hosted Prometheus + Grafana for metrics.
  Loki for logs. This keeps monitoring costs near zero.
Consequences: Requires operational overhead to maintain monitoring stack.
  Can migrate to managed services when budget allows.
```

### ADR-004: Loki over ELK for Logging

```
Status: Accepted
Context: Need centralized logging, limited budget, Grafana ecosystem.
Decision: Loki + Promtail. Native Grafana integration means
  logs are queryable alongside metrics. Lower resource usage than ELK.
Consequences: Limited full-text search (Loki is label-based).
  Can add Elasticsearch later for full-text search if needed.
```

### ADR-005: S3-Compatible Storage for Files

```
Status: Accepted
Context: Need scalable, durable file storage for uploads and receipts.
Decision: Use S3-compatible object storage.
  Stage 1: MinIO on same VPS (if bandwidth is low).
  Stage 2+: Managed S3 (DigitalOcean Spaces, AWS S3, Backblaze B2).
Consequences: File storage is decoupled from application servers.
  Backup strategy includes S3 replication.
```

### ADR-006: MongoDB Replica Set from Day 1

```
Status: Accepted
Context: Need data durability and point-in-time recovery.
Decision: Deploy MongoDB as a 3-node replica set from day 1
  (even if all on same VPS). This enables oplog-based recovery.
Consequences: 3x storage for MongoDB. Enables rolling restarts
  without downtime. Oplog enables point-in-time recovery.
```

---

## Appendix B: Infrastructure Commands Reference

```
SERVER SETUP:
─────────────

  # Initial server provisioning
  ansible-playbook deploy/playbooks/provision.yml -i inventory/production.yml

  # Deploy latest version
  ssh deploy@posmono.app "cd /opt/posmono && docker compose pull && docker compose up -d"

  # View logs
  ssh deploy@posmono.app "docker compose logs -f api"

  # Scale a service (Stage 2+)
  docker compose up -d --scale api=3 --scale worker=2

  # Backup manually
  docker exec posmono-mongodb mongodump --archive=/backups/manual.archive.gz --gzip

  # Restore from backup
  docker exec -i posmono-mongodb mongorestore --archive < backup.archive.gz

MONITORING:
───────────

  # Check container health
  docker ps

  # View resource usage
  docker stats

  # Check queue status (inside worker container)
  curl http://localhost:3000/api/admin/queues

  # Trigger Prometheus alert test
  curl -X POST http://prometheus:9090/api/v1/alerts

TROUBLESHOOTING:
────────────────

  # Container keeps restarting
  docker logs <container> --tail 100
  docker inspect <container> | jq '.[0].State'

  # MongoDB slow queries
  docker exec posmono-mongodb mongosh --eval "db.currentOp({secs_running: {$gt: 5}})"

  # Redis memory usage
  docker exec posmono-redis redis-cli INFO memory

  # Check disk space
  df -h
  du -sh /var/lib/docker/volumes/*
```
