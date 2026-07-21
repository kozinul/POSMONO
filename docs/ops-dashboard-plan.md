# Ops Dashboard - Rencana Implementasi

> Platform Administration & Server Operations Dashboard
> Date: July 2026

---

## Overview

Dashboard untuk operasional tech team yang memungkinkan:
1. **Tenant Management** - CRUD, status, modul, billing
2. **User Management** - Cross-tenant user administration
3. **System Health** - Server monitoring, database, queue
4. **Audit & Activity Logs** - Track semua operasi penting
5. **Infrastructure Ops** - Deploy, config, scaling

---

## Architecture

### Concept: Dual-Scope Access

```
┌─────────────────────────────────────────────────┐
│                  OPS DASHBOARD                   │
│                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │
│  │   Platform   │  │   Tenant    │  │  System  │ │
│  │    Admin     │  │   Admin     │  │  Health  │ │
│  │              │  │             │  │          │ │
│  │ - Tenants    │  │ - Users     │  │ - Server │ │
│  │ - Plans      │  │ - Roles     │  │ - DB     │ │
│  │ - Billing    │  │ - Settings  │  │ - Queue  │ │
│  │ - Platform   │  │ - Reports   │  │ - Logs   │ │
│  └─────────────┘  └─────────────┘  └──────────┘ │
│                                                  │
│  Scope: platform (no tenant)  │  Scope: tenant   │
└─────────────────────────────────────────────────┘
```

### Access Control: Platform Admin vs Tenant Admin

```typescript
// User entity enhancement
interface IUser {
  // ... existing fields
  platformRole: 'super_admin' | 'admin' | 'support' | null; // null = tenant-only user
  isPlatformUser: boolean; // quick check
}

// Middleware: requirePlatformAdmin
// Checks: user.platformRole !== null && user.platformRole !== undefined
```

**Roles:**
| Role | Scope | Capabilities |
|------|-------|-------------|
| `super_admin` | Platform | Full access - create tenants, manage plans, view all data |
| `admin` | Platform | Manage tenants, users, view reports |
| `support` | Platform | View tenants, impersonate, view health |
| `tenant_admin` | Tenant | Manage own tenant users, roles, settings |

---

## Phase 1: Foundation (Backend)

### Step 1.1: Platform Admin Middleware & Auth

**New files:**
```
backend/src/@shared/interfaces/middleware/
  requirePlatform.ts        # requirePlatformAdmin middleware
  requireTenantOrPlatform.ts # dual-scope middleware

backend/src/core/identity/domain/
  PlatformRole.ts           # Value object for platform roles
```

**Middleware logic:**
```typescript
// requirePlatform.ts
export function requirePlatformAdmin(req, res, next) {
  // 1. Authenticate user (existing middleware)
  // 2. Check user.platformRole is not null
  // 3. Check platformRole in ['super_admin', 'admin', 'support']
  // 4. Attach req.platformRole = user.platformRole
  // 5. next() or 403
}
```

**User entity changes:**
- Add `platformRole: string | null` field
- Add `isPlatformUser: boolean` computed property
- Update UserSchema with `platformRole` field

### Step 1.2: Tenant Management API

**Enhance existing Tenant domain:**

```typescript
// backend/src/core/tenant/application/services/TenantService.ts

// New methods:
async list(input: { page, limit, search?, status? }): Promise<{ tenants, total, page, limit }>
async getById(id: string): Promise<Tenant>
async suspend(id: string, reason: string): Promise<Tenant>
async activate(id: string): Promise<Tenant>
async updateModules(id: string, modules: string[]): Promise<Tenant>
async getStats(): Promise<{ total, active, trial, suspended, cancelled }>
```

**New routes:**
```
# Platform Admin routes
GET    /api/admin/tenants              # List all tenants (paginated, filterable)
GET    /api/admin/tenants/stats        # Tenant statistics
GET    /api/admin/tenants/:id          # Tenant detail
POST   /api/admin/tenants              # Create tenant (new)
PATCH  /api/admin/tenants/:id/status   # Suspend/activate/cancel
PATCH  /api/admin/tenants/:id/modules  # Enable/disable modules
PATCH  /api/admin/tenants/:id/config   # Update tenant config
DELETE /api/admin/tenants/:id          # Soft delete (mark cancelled)
```

**Repository enhancements:**
```typescript
// MongoTenantRepository.ts
async findAll(input: { page, limit, search?, status? }): Promise<{ tenants, total }>
async count(): Promise<number>
async countByStatus(): Promise<Record<string, number>>
async search(query: string): Promise<Tenant[]>
```

### Step 1.3: Enhanced Health Check

**Upgrade `/health` endpoint:**

```typescript
// GET /health
{
  status: 'ok' | 'degraded' | 'down',
  timestamp: string,
  uptime: number,
  version: string,
  environment: string,
  checks: {
    database: { status: 'ok' | 'down', latency: number },
    redis: { status: 'ok' | 'down', latency: number },
    memory: { used: number, total: number, percentage: number },
    cpu: { usage: number },
    disk: { used: number, total: number, percentage: number }
  }
}

// GET /health/ready  (readiness probe)
// GET /health/live   (liveness probe)
```

**New infrastructure file:**
```
backend/src/@shared/infrastructure/monitoring/
  HealthChecker.ts        # Checks DB, Redis, memory, disk
  SystemMetrics.ts        # CPU, memory, uptime tracking
```

### Step 1.4: Audit Log System

**New domain:**
```
backend/src/core/platform/
  domain/
    AuditLog.ts           # AuditLog aggregate
  infrastructure/
    persistence/
      schemas/
        AuditLogSchema.ts
      MongoAuditLogRepository.ts
  application/
    services/
      AuditLogService.ts
  interfaces/
    http/
      controllers/
        AuditLogController.ts
      routes/
        audit.routes.ts
```

**AuditLog entity:**
```typescript
interface IAuditLog {
  id: string;
  tenantId: string | null;      // null = platform-level action
  userId: string;
  userName: string;
  action: string;               // 'tenant.created', 'user.deleted', etc.
  entityType: string;           // 'Tenant', 'User', 'Order', etc.
  entityId: string;
  changes: Record<string, { before: any; after: any }>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}
```

**API Routes:**
```
GET  /api/admin/audit-logs           # List all audit logs (platform scope)
GET  /api/admin/audit-logs/tenant/:tenantId  # Tenant-scoped audit logs
GET  /api/admin/audit-logs/user/:userId      # User-scoped audit logs
```

**Auto-capture:** Hook into domain events via EventBus to auto-log important actions.

### Step 1.5: Fix Permission System

**Critical bug fix:**
```typescript
// backend/src/@shared/interfaces/middleware/authenticate.ts
// Current: req.userPermissions = [] (always empty)
// Fix: Populate from DB based on JWT role

async authenticate(req, res, next) {
  // ... existing JWT verification ...
  
  // NEW: Load user's role and permissions from DB
  const role = await roleRepository.findById(payload.role);
  req.userPermissions = role ? role.permissions : [];
  req.platformRole = user.platformRole;
  req.isPlatformUser = user.isPlatformUser;
}
```

---

## Phase 2: Platform Management APIs

### Step 2.1: Plan & Subscription Management

**New domain:**
```
backend/src/core/billing/
  domain/
    Plan.ts               # Plan aggregate
    Subscription.ts       # Subscription aggregate
  infrastructure/
    persistence/
      schemas/
        PlanSchema.ts
        SubscriptionSchema.ts
      MongoPlanRepository.ts
      MongoSubscriptionRepository.ts
  application/
    services/
      PlanService.ts
      SubscriptionService.ts
  interfaces/
    http/
      controllers/
        PlanController.ts
        SubscriptionController.ts
      routes/
        plan.routes.ts
        subscription.routes.ts
```

**Plan entity:**
```typescript
interface IPlan {
  id: string;
  name: string;                    // 'Starter', 'Professional', 'Enterprise'
  code: string;                    // 'starter', 'pro', 'enterprise'
  description: string;
  price: number;
  billingCycle: 'monthly' | 'yearly';
  features: {
    maxUsers: number;
    maxProducts: number;
    maxOrdersPerMonth: number;
    modules: string[];             // enabled modules
    apiAccess: boolean;
    prioritySupport: boolean;
    customBranding: boolean;
  };
  isActive: boolean;
  createdAt: Date;
}
```

**Subscription entity:**
```typescript
interface ISubscription {
  id: string;
  tenantId: string;
  planId: string;
  status: 'active' | 'trialing' | 'past_due' | 'cancelled' | 'expired';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEndsAt: Date | null;
  paymentMethod: string;
  lastPaymentDate: Date | null;
  nextBillingDate: Date | null;
  createdAt: Date;
}
```

**API Routes:**
```
# Plans
GET    /api/admin/plans              # List all plans
POST   /api/admin/plans              # Create plan
PUT    /api/admin/plans/:id          # Update plan
DELETE /api/admin/plans/:id          # Delete plan (soft)

# Subscriptions
GET    /api/admin/subscriptions              # List all subscriptions
GET    /api/admin/subscriptions/tenant/:tenantId  # Tenant subscription
POST   /api/admin/subscriptions              # Create subscription
PATCH  /api/admin/subscriptions/:id          # Update subscription
PATCH  /api/admin/subscriptions/:id/status   # Change status
```

### Step 2.2: User Management (Cross-Tenant)

**Enhance UserService:**
```typescript
async listAll(input: { page, limit, search?, tenantId?, role? }): Promise<{ users, total }>
async getUserStats(): Promise<{ total, active, byTenant }>
async impersonate(userId: string, platformAdminId: string): Promise<{ token, expiresAt }>
async deactivateUser(userId: string): Promise<void>
```

**New routes:**
```
GET    /api/admin/users              # List all users (cross-tenant)
GET    /api/admin/users/stats        # User statistics
GET    /api/admin/users/:id          # User detail (cross-tenant)
PATCH  /api/admin/users/:id/status   # Activate/deactivate
POST   /api/admin/users/:id/impersonate  # Impersonate user (creates temporary token)
```

### Step 2.3: System Configuration

**New domain:**
```
backend/src/core/platform/
  domain/
    SystemConfig.ts       # System-wide configuration
  infrastructure/
    persistence/
      schemas/
        SystemConfigSchema.ts
      MongoSystemConfigRepository.ts
  application/
    services/
      SystemConfigService.ts
  interfaces/
    http/
      controllers/
        SystemConfigController.ts
      routes/
        config.routes.ts
```

**API Routes:**
```
GET    /api/admin/config             # Get system config
PATCH  /api/admin/config             # Update system config
GET    /api/admin/config/features    # Feature flags
PATCH  /api/admin/config/features    # Toggle feature flags
```

---

## Phase 3: Frontend

### Step 3.1: Admin Layout & Routing

**New files:**
```
frontend/src/
  layouts/
    AdminLayout.tsx              # Separate layout for admin
  core/
    admin/
      pages/
        AdminDashboardPage.tsx   # Main ops dashboard
        TenantListPage.tsx       # Tenant management
        TenantDetailPage.tsx     # Tenant detail view
        UserListPage.tsx         # Cross-tenant user management
        PlanListPage.tsx         # Plan management
        HealthPage.tsx           # System health monitoring
        AuditLogPage.tsx         # Audit log viewer
        SystemConfigPage.tsx     # System configuration
      components/
        TenantCard.tsx           # Tenant summary card
        TenantStatusBadge.tsx    # Status indicator
        HealthStatusCard.tsx     # Health check display
        AuditLogTable.tsx        # Audit log table
        PlanCard.tsx             # Plan display card
        StatsCard.tsx            # Statistics card
        ActivityFeed.tsx         # Real-time activity feed
        UserImpersonateModal.tsx # Impersonation confirmation
```

**Router changes:**
```typescript
// frontend/src/app/router.tsx

// Admin routes (separate layout)
<Route path="/admin" element={<AdminLayout />}>
  <Route index element={<AdminDashboardPage />} />
  <Route path="tenants" element={<TenantListPage />} />
  <Route path="tenants/:id" element={<TenantDetailPage />} />
  <Route path="users" element={<UserListPage />} />
  <Route path="plans" element={<PlanListPage />} />
  <Route path="health" element={<HealthPage />} />
  <Route path="audit-logs" element={<AuditLogPage />} />
  <Route path="settings" element={<SystemConfigPage />} />
</Route>
```

### Step 3.2: Admin Dashboard Page

**Main dashboard layout:**
```
┌─────────────────────────────────────────────────────┐
│  Ops Dashboard                              [Admin] │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ Tenants  │ │  Users   │ │  Orders  │ │Revenue │ │
│  │   156    │ │  2,340   │ │  12,450  │ │ $45.2K │ │
│  │  +12 new │ │  +89 new │ │  +1,230  │ │ +15%   │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│                                                     │
│  ┌─────────────────────┐ ┌─────────────────────────┐│
│  │  System Health      │ │  Recent Activity        ││
│  │                     │ │                         ││
│  │  DB: ✅ OK (12ms)   │ │  Tenant created - Toko ││
│  │  Redis: ✅ OK (2ms) │ │  User suspended - John ││
│  │  CPU: 23%           │ │  Plan changed - Cafe   ││
│  │  Memory: 67%        │ │  System config updated ││
│  │  Uptime: 15d 4h     │ │                         ││
│  └─────────────────────┘ └─────────────────────────┘│
│                                                     │
│  ┌─────────────────────────────────────────────────┐│
│  │  Tenant List (paginated)                        ││
│  │  Search: [____________] Filter: [Status ▼]      ││
│  │                                                  ││
│  │  Name        Status    Plan      Users  Orders  ││
│  │  ─────────────────────────────────────────────── ││
│  │  Toko ABC    Active    Pro       12     1,234   ││
│  │  Cafe XYZ    Trial     Starter   3      456     ││
│  │  Hotel DEF   Active    Enterprise 45    8,901   ││
│  │                                                  ││
│  │  [1] [2] [3] ... [15]                            ││
│  └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

### Step 3.3: Tenant Management Page

**Features:**
- List tenants with search, filter by status/plan
- Create new tenant (wizard form)
- View tenant detail (tabs: Overview, Users, Orders, Subscription, Config)
- Suspend/activate tenant with reason
- Enable/disable modules per tenant
- View tenant health and usage
- Impersonate tenant admin

**Create Tenant Wizard:**
```
Step 1: Basic Info
  - Name, Slug, Business Type, Contact

Step 2: Plan Selection
  - Choose plan (Starter/Pro/Enterprise)
  - Trial period settings

Step 3: Module Selection
  - POS, Catalog, Inventory, etc.

Step 4: Admin User
  - Create admin user for this tenant

Step 5: Review & Create
  - Summary before creation
```

### Step 3.4: System Health Page

**Real-time monitoring:**
```
┌─────────────────────────────────────────────────────┐
│  System Health                            [Refresh] │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────────────────────────────────────┐│
│  │  Server Status                                  ││
│  │  Status: ✅ All Systems Operational             ││
│  │  Uptime: 15 days, 4 hours, 23 minutes          ││
│  │  Version: 1.2.3 (Production)                    ││
│  │  Last Deploy: 2026-07-15 14:30 UTC              ││
│  └─────────────────────────────────────────────────┘│
│                                                     │
│  ┌─────────────────────┐ ┌─────────────────────────┐│
│  │  Database           │ │  Redis                  ││
│  │  Status: ✅ OK      │ │  Status: ✅ OK          ││
│  │  Latency: 12ms      │ │  Latency: 2ms           ││
│  │  Connections: 45/100 │ │  Memory: 128MB/512MB    ││
│  │  Storage: 2.3GB     │ │  Keys: 12,450           ││
│  └─────────────────────┘ └─────────────────────────┘│
│                                                     │
│  ┌─────────────────────┐ ┌─────────────────────────┐│
│  │  CPU Usage           │ │  Memory Usage           ││
│  │  ████████░░░░ 23%   │ │  ████████████░░ 67%    ││
│  │  Cores: 4           │ │  Used: 5.4GB / 8GB      ││
│  └─────────────────────┘ └─────────────────────────┘│
│                                                     │
│  ┌─────────────────────────────────────────────────┐│
│  │  Active Connections                             ││
│  │  WebSocket: 234 connected                      ││
│  │  HTTP Requests: 1,234/min                       ││
│  │  Average Response Time: 45ms                    ││
│  └─────────────────────────────────────────────────┘│
│                                                     │
│  ┌─────────────────────────────────────────────────┐│
│  │  Tenant Database Status                         ││
│  │  Total Databases: 156                           ││
│  │  Active Connections: 89                         ││
│  │  Largest: posmono_hotel_def (450MB)             ││
│  └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

### Step 3.5: Audit Log Page

**Features:**
- Filterable log viewer
- Filter by: user, tenant, action type, date range
- Export to CSV
- Real-time activity feed

---

## Phase 4: Infrastructure & DevOps

### Step 4.1: Enhanced Health Checks

**Backend:**
```typescript
// HealthChecker.ts
class HealthChecker {
  async checkDatabase(): Promise<{ status, latency, connections }>
  async checkRedis(): Promise<{ status, latency, memory }>
  async checkMemory(): Promise<{ used, total, percentage }>
  async checkDisk(): Promise<{ used, total, percentage }>
  async checkCPU(): Promise<{ usage, cores }>
  async getFullReport(): Promise<HealthReport>
}
```

**Docker:**
```yaml
# docker-compose.prod.yml
services:
  app:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health/live"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### Step 4.2: Rate Limiting

```typescript
// backend/src/@shared/interfaces/middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

// Platform admin routes: higher limit
export const platformRateLimiter = rateLimit({
  store: new RedisStore({ client: redisClient }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // 500 requests per window
});

// Public routes: lower limit
export const publicRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
```

### Step 4.3: Request ID & Correlation

```typescript
// backend/src/@shared/interfaces/middleware/requestId.ts
import { v4 as uuidv4 } from 'uuid';

export function requestId(req, res, next) {
  const id = req.headers['x-request-id'] || uuidv4();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}
```

### Step 4.4: Prometheus Metrics (Optional)

```typescript
// backend/src/@shared/infrastructure/monitoring/metrics.ts
import { Counter, Histogram, Gauge } from 'prom-client';

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
});

export const activeConnections = new Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
});

export const tenantCount = new Gauge({
  name: 'tenants_total',
  help: 'Total number of tenants',
  labelNames: ['status'],
});
```

---

## Implementation Timeline

| Phase | Step | Deliverable | Duration |
|-------|------|-------------|----------|
| **1.1** | Platform Admin Middleware | Auth, middleware, platform role | 2 days |
| **1.2** | Tenant Management API | List, create, suspend, modules | 3 days |
| **1.3** | Enhanced Health Check | DB, Redis, CPU, memory checks | 2 days |
| **1.4** | Audit Log System | Entity, schema, service, auto-capture | 3 days |
| **1.5** | Fix Permission System | Populate req.userPermissions | 1 day |
| **2.1** | Plan & Subscription | Domain, CRUD, assignment | 3 days |
| **2.2** | Cross-Tenant User Mgmt | List, impersonate, deactivate | 2 days |
| **2.3** | System Config | Config entity, feature flags | 2 days |
| **3.1** | Admin Layout & Router | Layout, route setup | 2 days |
| **3.2** | Admin Dashboard Page | Stats, health, activity feed | 3 days |
| **3.3** | Tenant Management Page | List, create wizard, detail | 4 days |
| **3.4** | System Health Page | Real-time monitoring UI | 3 days |
| **3.5** | Audit Log Page | Log viewer, filters, export | 2 days |
| **4.1** | Docker Health Checks | Healthcheck config | 1 day |
| **4.2** | Rate Limiting | Redis-backed rate limiter | 1 day |
| **4.3** | Request ID | Correlation ID middleware | 1 day |
| **Total** | | | **~38 days** |

---

## Priority Order

### MVP (Phase 1 + Partial Phase 3)
1. ✅ Platform admin middleware
2. ✅ Tenant list/create/suspend API
3. ✅ Enhanced health check
4. ✅ Admin layout + router
5. ✅ Admin dashboard page
6. ✅ Tenant management page

### Phase 2 (Important)
7. Audit log system
8. Fix permission system
9. Plan & subscription management
10. System health page

### Phase 3 (Nice to Have)
11. Cross-tenant user management
12. System configuration
13. Audit log page
14. Rate limiting
15. Request ID
16. Prometheus metrics

---

## File Structure Summary

### Backend (New Files)
```
backend/src/
  @shared/
    interfaces/middleware/
      requirePlatform.ts
      requestId.ts
      rateLimiter.ts
    infrastructure/
      monitoring/
        HealthChecker.ts
        SystemMetrics.ts
        metrics.ts
  core/
    platform/
      domain/
        AuditLog.ts
        SystemConfig.ts
      infrastructure/persistence/
        schemas/
          AuditLogSchema.ts
          SystemConfigSchema.ts
        MongoAuditLogRepository.ts
        MongoSystemConfigRepository.ts
      application/services/
        AuditLogService.ts
        SystemConfigService.ts
      interfaces/http/
        controllers/
          AuditLogController.ts
          SystemConfigController.ts
        routes/
          audit.routes.ts
          config.routes.ts
    billing/
      domain/
        Plan.ts
        Subscription.ts
      infrastructure/persistence/
        schemas/
          PlanSchema.ts
          SubscriptionSchema.ts
        MongoPlanRepository.ts
        MongoSubscriptionRepository.ts
      application/services/
        PlanService.ts
        SubscriptionService.ts
      interfaces/http/
        controllers/
          PlanController.ts
          SubscriptionController.ts
        routes/
          plan.routes.ts
          subscription.routes.ts
    tenant/
      (enhanced - add list, suspend, activate methods)
    identity/
      (enhanced - add platformRole to User)
```

### Frontend (New Files)
```
frontend/src/
  layouts/
    AdminLayout.tsx
  core/
    admin/
      pages/
        AdminDashboardPage.tsx
        TenantListPage.tsx
        TenantDetailPage.tsx
        UserListPage.tsx
        PlanListPage.tsx
        HealthPage.tsx
        AuditLogPage.tsx
        SystemConfigPage.tsx
      components/
        TenantCard.tsx
        TenantStatusBadge.tsx
        HealthStatusCard.tsx
        AuditLogTable.tsx
        PlanCard.tsx
        StatsCard.tsx
        ActivityFeed.tsx
        UserImpersonateModal.tsx
        CreateTenantWizard.tsx
```

---

## API Endpoints Summary

### Platform Admin (requires platform role)
```
# Tenant Management
GET    /api/admin/tenants
GET    /api/admin/tenants/stats
GET    /api/admin/tenants/:id
POST   /api/admin/tenants
PATCH  /api/admin/tenants/:id/status
PATCH  /api/admin/tenants/:id/modules
PATCH  /api/admin/tenants/:id/config

# User Management
GET    /api/admin/users
GET    /api/admin/users/stats
GET    /api/admin/users/:id
PATCH  /api/admin/users/:id/status
POST   /api/admin/users/:id/impersonate

# Plan Management
GET    /api/admin/plans
POST   /api/admin/plans
PUT    /api/admin/plans/:id
DELETE /api/admin/plans/:id

# Subscription Management
GET    /api/admin/subscriptions
GET    /api/admin/subscriptions/tenant/:tenantId
POST   /api/admin/subscriptions
PATCH  /api/admin/subscriptions/:id
PATCH  /api/admin/subscriptions/:id/status

# Audit Logs
GET    /api/admin/audit-logs
GET    /api/admin/audit-logs/tenant/:tenantId
GET    /api/admin/audit-logs/user/:userId

# System Health
GET    /health
GET    /health/ready
GET    /health/live

# System Config
GET    /api/admin/config
PATCH  /api/admin/config
GET    /api/admin/config/features
PATCH  /api/admin/config/features
```

---

## Security Considerations

1. **Platform admin routes must be protected** with `requirePlatformAdmin` middleware
2. **No tenant scoping** for platform admin routes (bypasses tenant isolation)
3. **Audit all platform operations** - every create/update/delete must be logged
4. **Impersonation tokens** should be short-lived (1 hour) and logged
5. **Rate limiting** on all admin endpoints
6. **IP whitelist** option for platform admin access
7. **Two-factor auth** recommended for super_admin role
