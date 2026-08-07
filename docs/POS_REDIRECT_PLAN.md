# PLAN — Redirect Kasir Langsung ke POS (Role-Based Landing)

> Dokumen rencana (belum diimplementasikan). Dibuat 2026-08-07.
> Fokus: skema agar user ber-role **Cashier** diarahkan langsung ke dashboard POS (`/pos`)
> tanpa dashboard admin. Melengkapi `docs/ROLE_ACCESS_PLAN.md` (RBAC besar, Fase 3 frontend).

---

## 1. Tujuan

- Setelah login, **Cashier** langsung mendarat di **POS** (`/pos`).
- Owner/Manager mendarat di **dashboard admin** (`/dashboard`) seperti sekarang.
- Sidebar hanya menampilkan menu yang relevan per role (kasir tidak melihat menu admin).
- Konsisten lintas reload halaman (perlu session restore `/auth/me`).

---

## 2. Fakta Saat Ini (hasil recon, 2026-08-07)

### 2.1 Backend — data sudah tersedia

- **Login** (`backend/src/core/identity/interfaces/http/controllers/AuthController.ts:34-45`) sudah mengembalikan:
  ```json
  {
    "success": true,
    "data": {
      "accessToken": "...", "refreshToken": "...",
      "user": {
        "id": "usr_...", "email": "...", "displayName": "...",
        "role": "<roleId>",
        "roleName": "Cashier",
        "permissions": ["orders:read", "shifts:read", ...]
      }
    }
  }
  ```
  Catatan: field `role` berisi **roleId**; `roleName` & `permissions` di-resolve dari koleksi `Role` di `AuthService.execute` (`AuthService.ts:49-51`).

- **Endpoint `/auth/me` sudah ada** (`GET /api/auth/me`, `auth.routes.ts:13`; handler `AuthController.me:87-105`) — mengembalikan bentuk yang sama (`id, email, displayName, role, roleName, permissions, isActive, lastLoginAt`).

- **Role terseed** (`backend/src/seed.ts` & `backend/src/dev.ts`, nama Inggris):
  | Role | Permission utama |
  |---|---|
  | **Owner** | semua (termasuk `users:write`, `settings:write`, `reports:read`, dll.) |
  | **Manager** | `products:write`, `order:void`, `inventory:write`, `reports:read`, `settings:read`, dll. |
  | **Cashier** | `products:read`, `orders:read`, `orders:write`, `payments:read`, `payments:write`, `customers:read`, `customers:write`, `shifts:read`, `shifts:write` |

### 2.2 Frontend — belum ada logika role sama sekali

- **`LoginPage.tsx:30`** — selalu `navigate('/dashboard')`. Tidak ada cabang role.
- **`router.tsx:44`** — root `"/"` → `<Navigate to="/dashboard" replace />` (semua role).
- **`DashboardLayout.tsx:7-24`** — array `navigation[]` statis (Dashboard, POS, Orders, Products, Families, Categories, Members, Promotions, Payment, Inventory, Gudang, Templates, Reports, Shifts, Users, Settings) dirender penuh untuk semua user. Tidak ada filter.
- **`ProtectedRoute.tsx`** — hanya cek `isAuthenticated` (token di localStorage). Tidak ada guard role/permission.
- **`useAuth.ts`** — `hasPermission(user, perm)` membaca `user.permissions`. Dipakai hanya untuk void (`canVoidSelf`).

### 2.3 Gap kritis

1. **Tidak ada guard/redirect role** di router.
2. **Tidak ada filter menu** di sidebar.
3. **Session restore hilang**: frontend **tidak pernah memanggil `/auth/me`**. Saat reload, `isAuthenticated = true` (token ada) tapi `user = null` → `roleName`/`permissions` hilang, `hasPermission` jadi `false` (mis. kasir yang punya `order:void` via manager PIN tetap kena prompt PIN sampai login ulang).

---

## 3. Desain Target

### 3.1 Session restore di boot

Panggil `GET /auth/me` sekali saat app boot (mis. di `ProtectedRoute` atau efek init `AppRouter`) → `setUser(user)` di Zustand. Ini wajib agar redirect role & filter menu konsisten setelah reload.

- Tambahkan state `isRestoring` (loading) agar router tidak flash-ke `/login` atau ke dashboard admin sebelum role ter-resolve.

### 3.2 Landing setelah login berbasis role

- `LoginPage`: setelah login,
  - `roleName === 'Cashier'` → `navigate('/pos')`
  - selain itu → `navigate('/dashboard')`
- `router.tsx` root `"/"` → komponen `<HomeRedirect>` yang me-route dinamis (Cashier → `/pos`, lainnya → `/dashboard`).

### 3.3 Guard rute admin (optional tapi disarankan)

Tambahkan wrapper `RequirePermission`/`RoleRoute` di `router.tsx`:
- `requirePermission` = semua permission yang harus dimiliki.
- Cashier tanpa permission admin (`users:read`, `settings:read`, `reports:read`, dst.) yang mengetik `/users` manual → redirect ke `/pos` (atau halaman 403).

### 3.4 Sidebar role-aware

Filter array `navigation[]` di `DashboardLayout.tsx` berdasarkan permission:
- Setiap item diberi `permission?`.
- Tanpa `permission` → tampil untuk semua (mis. Dashboard, POS, Orders, Shifts).
- Cashier idealnya hanya melihat: **Dashboard, POS, Orders, Shifts** (menyesuaikan permission `orders:read`, `shifts:read`).
- Items admin (Products, Users, Reports, Settings, dst.) disembunyikan untuk cashier.

> Catatan: frontend hanya kosmetik/UX. Enforce keamanan tetap di backend (lihat `ROLE_ACCESS_PLAN.md` Fase 2 — `authorize()` saat ini masih stub).

---

## 4. Pertanyaan Terbuka

1. **Kriteria "kasir"**: cukup `roleName === 'Cashier'`, atau berbasis permission (mis. tidak punya `users:read`/`settings:read`/`reports:read`)? → cenderung berbasis permission agar fleksibel terhadap rename role.
2. **Akses manual ke `/dashboard`**: kasir yang mengetik `/dashboard` — diblokir redirect ke `/pos`, atau dibiarkan bisa lihat dashboard? → cenderung diblokir.
3. **Menu kasir**: set menu minimum — `Dashboard, POS, Orders, Shifts`? Items lain disembunyikan?
4. **Role lain (Manager)**: tetap dashboard admin penuh, atau filter menengah (tanpa Users/Settings)? → tetap penuh untuk MVP.

---

## 5. Urutan Implementasi

- [ ] **Session restore**: panggil `/auth/me` saat boot (`ProtectedRoute`/init effect), isi `useAuthStore.user`, tambah state `isRestoring`.
- [ ] **Login redirect**: cabang role di `LoginPage`.
- [ ] **Root redirect**: komponen `HomeRedirect` di `router.tsx`.
- [ ] **Guard admin**: wrapper `RequirePermission` di route admin (redirect `/pos`).
- [ ] **Sidebar filter**: `navigation[]` + `permission?` + filter di `DashboardLayout`.
- [ ] **Tes**: tsc frontend, vitest, build. Unit test `HomeRedirect`/login redirect per role.

---

## 6. Catatan / Risiko

- Saat ini `user.permissions` dari login **sudah** tersedia — tidak perlu ubah backend untuk frontend redirect.
- `authorize()` backend masih stub (`req.userPermissions = []`) — jangan anggap sidebar tersembunyi = aman. Enforce backend ada di roadmap `ROLE_ACCESS_PLAN.md` Fase 2.
- Reload halaman tanpa session restore membuat redirect berbasis role tidak konsisten → session restore adalah prasyarat.
