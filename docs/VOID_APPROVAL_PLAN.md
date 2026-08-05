# RENCANA VOID — PERSETUJUAN MANAGER (PER-MANAGER PIN)

> Rencana implementasi fitur void untuk kasir dengan persetujuan manager. Cashier (role `Cashier`) wajib memasukkan alasan void + PIN manager untuk melakukan void order/item/payment/rollback. Manager/Owner bypass kode.
>
> Status: **RENCANA — belum diimplementasikan**.
> Last updated: 2026-08-05

---

## 1. Latar Belakang

- POS saat ini sudah punya mekanisme void di backend (`POST /orders/:id/void`, `/void-item`, `/void-payment`, `/void-rollback`) dan UI void di halaman admin Orders (`VoidItemModal`, `VoidOrderModal`, `VoidPayment` di `frontend/src/core/orders/components/`).
- **Terminal kasir (`PosPage.tsx`) belum punya UI void sama sekali**.
- Tidak ada kontrol role/permission: semua rute hanya pakai middleware `authenticate`; `authorize()` belum dipakai (dead code) dan JWT hanya membawa `roleId` (UUID), bukan `roleName`.
- `docs/POS_CURRENT_FEATURES.md` §D & §G sudah mencantumkan "dengan supervisor auth" untuk item-level dan full-order void, tapi belum diimplementasikan.

## 2. Keputusan (Hasil Diskusi 2026-08-05)

1. **Per-manager PIN** — tiap user manajer punya PIN pribadi (bukan kode satu-tenant). Hanya role `Manager`/`Owner` yang bisa punya PIN.
2. **Dua alur didukung** (backend dirancang agnostik metode):
   - **(a) Same-terminal**: manager yang hadir memasukkan PIN-nya di terminal yang sama saat approval.
   - **(b) Two-device**: kasir kirim request → manager setujui dari device manager (endpoint approve + event realtime).
3. **Buat UI void baru di terminal kasir (`PosPage`)** — dibangun dari nol.
4. **Manager/Owner bypass kode**; cashier wajib persetujuan.
5. **Perbaiki `authorize()` + role-name di JWT sebagai improvement terpisah** (prasyarat untuk gating role yang aman; didokumentasikan di sini, bukan bagian implementasi void inti).

## 3. Perubahan Data

### Backend — User
- `User` domain & `MongoUserSchema` (`backend/src/core/identity/infrastructure/persistence/schemas/UserSchema.ts`):
  - Tambah field opsional `pin?: string` (hash).
  - Hanya user ber-role `Manager`/`Owner` yang boleh mengatur PIN (lewat User management UI/service).
  - Cashier tidak punya PIN.

### Backend — Order
- `Order` domain + schema persist: tambahkan embedded `voidApprovals: VoidApproval[]`:
```ts
interface VoidApproval {
  voidType: 'order' | 'item' | 'payment';
  requestedBy: string;   // cashier user id
  reason: string;
  approverId: string;    // manager user id
  approverName: string;
  approvedAt: Date;
}
```

### Backend — JWT & auth
- `AuthService.login` / `/auth/me`: resolve role via `RoleRepository.findById(roleId)` → tambahkan `roleName` pada response & klaim JWT.
- `authenticate` middleware: isi `req.userRoleName` (dari klaim JWT).

## 4. Backend Design

### `VoidApprovalService` (baru, `backend/src/core/ordering/...`)
- `verifyApprover(userId, managerPin?)`:
  - Resolve role `userId` → `roleName`.
  - Role `Manager`/`Owner` → bypass (`requireManager = false`).
  - Role `Cashier` → wajib `managerPin`; cari user dengan hash PIN cocok **dan** role `Manager`/`Owner`; gagal → `ForbiddenError`.
  - Return `{ approverId, approverName, requireManager }`.
- `approvePendingVoid(tenantId, voidRequestId, managerPin)` (untuk alur 2b): validasi PIN manager, ubah status request `pending` → `approved`, trigger void + event.

### Endpoint void (perubahan payload)
```
POST /orders/:id/void          { reason, managerPin? }
POST /orders/:id/void-item     { itemIndex, reason, managerPin? }
POST /orders/:id/void-payment  { paymentIndex, reason, managerPin? }
POST /orders/:id/void-rollback { reason, managerPin? }
```
- Controller: `managerPin: z.string().optional()`; teruskan ke service.
- Service memanggil `VoidApprovalService`, menulis `approvedBy` dan `voidApprovals` ke order.
- Response menyertakan `voidApprovals` dan `approvalRequired`.
- Route tetap pakai `authenticate`; role check dilakukan di service via `req.userId`.

### Alur (a) same-terminal (utama)
Kasir klik Void di PosPage → modal Step 1: item + alasan → Step 2: *Manager Approval* (PIN manager dimasukkan oleh manager yang hadir) → submit. Backend validasi, void, append approval.

### Alur (b) two-device (future-friendly)
Kasir submit tanpa PIN → backend buat `void_requests` (collection baru: `{ id, orderId, voidType, reason, requestedBy, requestedByName, createdAt, status: 'pending' }`). Manager device fetch pending → `POST /void-requests/:id/approve { managerPin }` → approve → backend void + event realtime (`useRealtimeSync` socket) agar kasir melihat status.

## 5. Frontend Design

- `useAuth`: tambahkan `roleName` (dari `/me` / login).
- `PosPage.tsx` + `posStore`:
  - Tombol Void per item di cart (hanya untuk kasir; muncul tombol approval).
  - Store methods: `voidItemOnBill(itemIndex, reason, managerPin?)`, `voidBill(reason, managerPin?)`, `voidPayment(idx, reason, managerPin?)`.
  - Handle 403 → modal tampilkan "Kode manager salah".
- Modal baru `VoidItemModal` khusus POS, 2 step: (1) item + reason, (2) approval manager (field PIN). Untuk Manager/Owner, field PIN tidak ditampilkan (auto approve).

## 6. Pengelolaan PIN

- UI User/Edit User: field "PIN Manager" (masked, 4–6 digit + confirm) tampil **hanya** untuk role `Manager`/`Owner`.
- Simpan hash ke `User.pin`.
- Cashier tidak melihat PIN; PIN hanya dimasukkan saat approval.

## 7. Test Plan

### Backend (vitest)
- `VoidApprovalService`: cashier + PIN salah → throw Forbidden; PIN benar → approver resolved; Manager → bypass.
- `VoidItemService.execute` dengan `managerPin` salah → throw; benar → `order.voidedItems` terisi + `voidApprovals` berisi entry.
- `OrderController` void-item schema: `managerPin` optional, reason required; 403 saat verifikasi gagal.
- Event `ordering.order.voided` tetap fire; tambah `ordering.order.void-approved`.

### Frontend (vitest + Playwright)
- PosPage: tombol Void muncul hanya untuk role cashier.
- Void modal Step 2 memaksa PIN manager; tanpa PIN → invalid; PIN salah → error dari backend; benar → sukses.
- `posStore.voidItemOnBill` memanggil `POST /orders/:id/void-item` dengan `{ reason, managerPin }`.

## 8. Tasking (Todo)

1. Backend: `Order` tambah `voidApprovals[]` + schema persist.
2. Backend: `VoidApprovalService` (resolve role, validasi PIN manager, bypass manajer).
3. Backend: User tambah `pin` (hash) + repo method; User management UI atur PIN.
4. Backend: controller/service void (item/order/payment/rollback) terima `managerPin`; append approval.
5. Backend: JWT `roleName` + `authenticate` isi `req.userRoleName`; dokumentasikan improvement `authorize()`. **(terpisah)**
6. Backend: (opsional 2b) `VoidRequest` agg + approve endpoint + socket event.
7. Frontend: `useAuth` roleName; PosPage void button + store methods.
8. Frontend: PosPage `VoidItemModal` 2-step (reason → manager PIN).
9. Frontend: User edit form — field PIN hanya untuk Manager/Owner.
10. Docs: update `POS_CURRENT_FEATURES.md` §D/§G (status → implemented).
11. Tests (backend + frontend) per §7.

## 9. Batasan / Asumsi

- PIN 4–6 digit, di-hash (bcrypt).
- Role-name via lookup di login/me (1 DB hit/login — acceptable). JWT membawa `roleName`, bukan permissions.
- Manager bypass berdasarkan `roleName`, bukan permission (`authorize()` masih belum diaktifkan).
- Fokus void item/order/payment/rollback; void payment *refund* tidak termasuk.
