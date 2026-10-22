# Deployment Guide — Kuire POS (POSMono)

> Dokumen rencana & panduan deploy ke produksi. Status: **Fase A selesai (A1–A10b) + P1 container hardening** — sisa operator/VPS di Fase B+.
> Diterapkan pada: repo `kozinul/POSMONO` (branch `master`) · image `posmono` di Docker Hub · stack `docker/docker-compose.prod.yml` + `docker/docker-compose.caddy.yml`.

---

## 1. Arsitektur target

```
                       Internet (HTTPS 443)
                              │
                      ┌───────▼────────┐
                      │    Caddy       │  ← reverse-proxy + auto-TLS (Let's Encrypt)
                      │  dns: pos.domain
                      └───────┬────────┘
                              │ HTTP :3000 (internal network)
                      ┌───────▼────────┐
                      │  posmono-app   │  ← node:20-alpine, satu image berisi:
                      │  backend (API) │     backend dist + frontend/dist (static + SPA)
                      └──┬─────────┬───┘
              ┌──────────▼───┐  ┌──▼──────────┐
              │  posmono-    │  │ posmono-    │
              │  mongodb:7   │  │ redis:7     │
              │  (volume)    │  │ (volume)    │
              └──────────────┘  └─────────────┘
```

Fakta dari kode saat ini:
- Backend Express melayani `frontend/dist` (static + `GET *` SPA fallback) → satu container cukup. (`backend/src/bootstrap/server.ts`)
- `docker/docker-compose.prod.yml`: `mongodb` (volume `mongodb_data`, **`--auth` aktif** dari `MONGO_INITDB_ROOT_*` di `docker/.env`; initdb `docker/mongo-init/` membuat **user aplikasi least-privilege** `readWrite` pada `MONGO_DATABASE`), `redis` (volume `redis_data`), `app` (bind `127.0.0.1:3000`, `env_file: backend/.env` + `environment.MONGO_URI` memakai **user aplikasi**, bukan root), semua di network eksternal `kuire`.
- `docker/Dockerfile`: multi-stage `base → deps → builder → runner`, stage `runner` berjalan sebagai **`USER node`** (bukan root), punya `HEALTHCHECK` image-level ke `/api/health`, lalu `CMD node backend/dist/bootstrap/app.js` + `EXPOSE 3000`.
- TLS: `docker/docker-compose.caddy.yml` + `docker/Caddyfile` (Caddy, auto-TLS Let's Encrypt) — front-end publik 80/443.
- CI: `.github/workflows/ci.yml` (push/PR `master`, publish image multi-arch di `master` + tag `v*`).

---

## 2. Fase A — Persiapan repo (kode)

Daftar kerja kode yang harus selesai sebelum deploy. **Status: A1–A10 selesai 2026-10-15** (semua kecuali item VPS/operator di Fase B+).

| # | Item | File | Catatan |
|---|------|------|---------|
| A1 | Fix trigger CI | `.github/workflows/ci.yml` | ✅ `push` → `master` + tag `v*`, `pull_request` → `master` |
| A2 | Job test tanpa Docker service | `.github/workflows/ci.yml` | ✅ service `mongodb`/`redis` + `env.MONGO_URI` dihapus (pakai mongodb-memory-server); `pnpm test` root + `tsc --noEmit` kedua sisi |
| A3 | Ganti job `lint` (backend tanpa ESLint) | `.github/workflows/ci.yml` | **selesai 2026-09-30 (T0)**: `pnpm run lint` = `tsc --noEmit` per paket; job `docker` publish tetap di push `main` |
| A4 | Endpoint `GET /api/health` | `backend/src/bootstrap/routes.ts` + server | ✅ `{ status, mongo, uptime }` — **503** bila `mongoose.connection.readyState !== 1`; `/health` di-alias ke handler yang sama |
| A5 | Healthcheck di compose | `docker/docker-compose.prod.yml` | ✅ mongo `mongosh` ping · redis `redis-cli ping` · app `wget -qO- http://localhost:3000/api/health` · `depends_on.condition: service_healthy` · log rotation `json-file` 10m×5 |
| A6 | Volume `uploads/` + logs | `docker/docker-compose.prod.yml` | ✅ `uploads_data:/app/backend/dist/uploads` + `logs_data:/app/logs` (mencegah hilangnya gambar produk saat container diganti) |
| A7 | Prod seed aman | `backend/src/seed.ts` (flag `--prod`) | ✅ tanpa data demo & tanpa `dropDatabase`, idempotent; isi: tenant + roles + owner + platform admin (opsional) + plans + payment methods + templates |
| A8 | Lengkapi `.env.example` + README deploy | `backend/.env.example` | ✅ var runtime lengkap + blok komentar var seed `--prod` |
| A9 | Multi-arch + tag image | job docker | ✅ `linux/amd64,linux/arm64` (QEMU) + tag `:latest`/`:<semver>` via `docker/metadata-action` |
| A10 | **Kanari prod: app tidak pernah connect Mongo** | `backend/src/bootstrap/app.ts` | ✅ `await mongoose.connect(env.MONGO_URI)` sebelum `buildContainer()` — sebelumnya hanya `dev.ts`/script yang connect, jadi image produksi boot lalu buffering selamanya |
| A10b | **Image produksi tidak bisa resolve dependency** | `docker/Dockerfile` (`runner`) | ✅ stage `runner` dulu hanya menyalin `backend/node_modules` (symlink ke `/app/node_modules/.pnpm`) tanpa root `node_modules` dan tanpa `shared/package.json` → `Cannot find module 'mongoose'` |

> Catatan (diperbarui 2026-09-30, item T0): root `package.json` **sudah** jadi workspace POSMono
> (`pnpm-workspace.yaml` → `backend` · `frontend` · `shared`; paket `@posmono/*`). Filter lama
> `@kuire/*` dan jalur `infrastructure/docker/...` sudah dibuang karena tidak pernah ada di repo ini.
> CI memakai script root yang sama dengan yang dipakai manusia: `pnpm run test` & `pnpm run lint`.

> **A10/A10b ditemukan 2026-10-15 dengan menjalankan `node backend/dist/bootstrap/app.js`** (jalur
> persis yang dipakai `CMD` image) terhadap Mongo lokal — bukan dari review. Keduanya bug "hanya
> muncul di produksi": dev (`ts-node-dev` dari `src/`) dan test (`vitest` resolve `@posmono/shared`
> ke `src/`) tidak pernah menyentuh keduanya.
>
> Jebakan `@posmono/shared`: `shared/package.json` sengaja `main: src/index.ts` supaya ts-node/vitest/
> vite bisa mengkonsumsi source tanpa build step. Plain Node tidak bisa menjalankan TS, dan stage
> `runner` bahkan tidak menyalin `shared/src` — jadi Dockerfile me-rewrite `main`/`types` ke
> `dist/index.*` **di dalam image** (source of truth tetap di paket; dev tidak berubah).


---

## 3. Fase B — Provisioning VPS

Rekomendasi minimal & perintah setup (Ubuntu 22.04, 2GB RAM, 2 vCPU, 20GB disk).

```bash
# ssh sebagai root, lalu buat user deploy
adduser deploy
usermod -aG sudo deploy
mkdir /home/deploy/.ssh && cp ~/.ssh/authorized_keys /home/deploy/.ssh/ && chown -R deploy:deploy /home/deploy/.ssh
```

Instal Docker di user `deploy`:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update && sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo newgrp docker
```

Firewall (hanya 80/443 + SSH; app tidak diekspos publik — lewat Caddy saja):

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Penting sebelum lanjut: aktifkan **swap** supaya app + mongo nyaman di 2GB:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 4. DNS & TLS (Caddy)

Set DNS A record: `pos.<domain>` dan `stage.pos.<domain>` → IP VPS.

Konfigurasi TLS **sudah ada di repo** — tidak perlu menulis file manual di VPS:

| File | Fungsi |
|------|--------|
| `docker/Caddyfile` | site block domain + `reverse_proxy app:3000` + `encode zstd gzip` + header keamanan (HSTS/nosniff/referrer) |
| `docker/docker-compose.caddy.yml` | service `caddy` (`80`, `443`, `443/udp` untuk HTTP/3), volume `caddy_data`/`caddy_config`, network `kuire` |
| `docker/.env.example` | template `DOMAIN` & `ACME_EMAIL` (salin ke `docker/.env`, gitignored) |

Isi domain & email kontak ACME (di VPS):

```bash
cd /home/deploy/kuire
cp docker/.env.example docker/.env
# edit docker/.env:
#   DOMAIN=pos.domain.id
#   ACME_EMAIL=ops@domain.id
#   MONGO_INITDB_ROOT_USERNAME=posmono
#   MONGO_INITDB_ROOT_PASSWORD=<password panjang, aman-URL>
#   MONGO_DATABASE=posmono
#   MONGO_APP_USERNAME=posmono_app
#   MONGO_APP_PASSWORD=<password lain, panjang, aman-URL>
```

> `docker/.env` **wajib** ada: selain `DOMAIN`/`ACME_EMAIL`, `docker-compose.prod.yml`
> membaca kredensial Mongo dari file ini dan sengaja **gagal start** bila kosong
> (`${MONGO_INITDB_ROOT_USERNAME:?…}`). Ini yang membuat container `mongodb` jalan dengan
> `--auth` sejak boot pertama — tanpa auth, database terbuka bagi apa pun yang bisa
> menjangkau network `kuire`.
>
> Password ikut dirangkai ke `MONGO_URI`, jadi pakai karakter aman-URL (`-`, `_`); hindari
> `@ : / # ? & %`.
>
> User root dibuat **hanya saat volume `mongodb_data` masih kosong**. Bila VPS ini pernah
> menjalankan stack sebelum auth aktif, volume lama tidak punya user dan app akan gagal
> autentikasi — ikuti `docs/OPS_RUNBOOK.md` §6b (dump → hapus volume → up → restore).
>
> **User aplikasi (`MONGO_APP_*`) juga hanya dibuat saat volume kosong** oleh
> `docker/mongo-init/10-app-user.js` (role `readWrite` pada `MONGO_DATABASE`, bukan root).
> Service `app` memakai kredensial ini. Bila volume sudah terisi dari versi yang masih
> memakai root, tambahkan user-nya manual — `docs/OPS_RUNBOOK.md` §6c.

> Caddy otomatis meminta & memperpanjang sertifikat Let's Encrypt. Tidak ada config TLS manual.
> Service aplikasi (mongodb/redis/app) terhubung ke network eksternal `kuire` di
> `docker-compose.prod.yml`, sehingga Caddy bisa resolve `app:3000`; port app
> di-bind ke `127.0.0.1` saja (tidak diekspos publik — lihat `docs/OPS_RUNBOOK.md` §6).
> Domain staging: hidupkan blok komentar di `docker/Caddyfile` dan arahkan A record-nya.

---

## 5. Deploy aplikasi

Cara 1 — **build image di CI lalu pull** (rekomendasi). Di VPS:

```bash
cd /home/deploy
git clone https://github.com/kozinul/POSMONO.git kuire
cd kuire/backend
openssl rand -hex 32   # → JWT_SECRET (simpan!)
cp .env.example .env   # bagian Fase A: .env.example dilengkapi

# Isi JWT_SECRET (hasil openssl di atas) + var runtime lain di backend/.env.
# CATATAN: MONGO_URI di backend/.env DIABAIKAN oleh compose produksi — service `app`
# menimpanya dengan URI ber-auth yang dirangkai dari docker/.env, supaya password DB
# hanya tersimpan di satu file. Jalur non-Docker (dev/seed di host) tetap memakai nilai ini.
#   REDIS_URL=redis://redis:6379   (redis belum dipakai kode; aman dikosongkan)
```

Jalankan stack:

```bash
cd /home/deploy/kuire
docker network create kuire                      # sekali; dipakai app + Caddy (+ mongorestore OPS)
# docker/.env wajib sudah ada & terisi (DOMAIN, ACME_EMAIL, MONGO_INITDB_* — lihat §4)
docker compose -f docker/docker-compose.prod.yml up -d --pull always
docker compose --env-file docker/.env -f docker/docker-compose.caddy.yml up -d
```

Verifikasi:

```bash
curl -fsS https://pos.domain/api/health        # → {"status":"ok",...}
docker compose -f docker/docker-compose.prod.yml ps
docker logs caddy 2>&1 | tail -20              # pastikan sertifikat terbit tanpa error
```

> A5 (health endpoint + healthcheck) wajib selesai sebelum langkah ini; tanpa `wget` di image app, healthcheck gagal — pakai `wget -qO- https://pos.domain/api/health` dari VPS host sebagai alternatif.

Cara 2 — **build langsung di VPS** (tanpa CI docker push):

```bash
cd /home/deploy/kuire
sudo docker build -f docker/Dockerfile -t posmono-app:v0 . 
# lalu ubah image: di docker-compose.prod.yml dari build: menjadi image: posmono-app:v0
```

---

## 6. Data awal (first tenant)

Setelah app up, provisi tenant pertama (bagian Fase A A7 — `seed --prod`):

```bash
  docker exec -it posmono-app sh
  # (di dalam container) MONGO_URI sudah ber-auth — compose menimpanya dari docker/.env:
  ADMIN_EMAIL=owner@domain.id \
  ADMIN_PASSWORD='<password-kuat>' \
  NODE_ENV=production node backend/dist/seed.js --prod

```

> Tidak perlu menulis `MONGO_URI` lagi: service `app` sudah membawanya. Sebaliknya
> `MONGO_INITDB_ROOT_*` hanya ada di container `mongodb` — jangan dipakai di dalam
> container `app`.
>
> Port Mongo **tidak** dipublish ke host, jadi seed/backup/restore selalu dijalankan dari
> dalam container (`docker exec`) atau helper container di network `kuire`. Perintah
> `mongodump`/`mongorestore` ber-kredensial ada di `docs/OPS_RUNBOOK.md` §3–§4.

Atau melalui UI: app punya flow register + auto-create tenant (`admin@domain.id` login).

Checklist verifikasi tenant pertama:

- [ ] Login owner di `https://pos.domain`
- [ ] Program kasir: buat user Cashier → login kasir → POS
- [ ] Shift dibuka → transaksi tunai → struk
- [ ] QRIS tetap memakai config default (simulator `http://host.docker.internal:3334` — integrasi gateway asli ditunda)

---

## 7. Arsitektur file yang terlibat

```
docker/
  Dockerfile                     # multi-stage image app (runner: USER node + HEALTHCHECK)
  mongo-init/10-app-user.js      # initdb sekali: user aplikasi readWrite (bukan root)
  docker-compose.prod.yml        # mongo + redis + app (healthcheck, volume uploads, network kuire — Fase A)
  docker-compose.caddy.yml       # reverse proxy + TLS otomatis
  Caddyfile                      # site block domain + reverse_proxy app:3000
  .env.example                   # template DOMAIN/ACME_EMAIL untuk Caddy
  docker-compose.dev.yml
  docker-compose.yml
.github/workflows/ci.yml         # trigger master + tag v* + jobs (Fase A)
backend/
  .env.example                   # template env runtime + seed --prod (Fase A)
  src/seed.ts                    # seed --prod (Fase A)
docs/
  DEPLOYMENT.md                  # dokumen ini
  OPS_RUNBOOK.md                 # monitoring, backup, restore, update, troubleshooting
```

---

## 8. Release checklist (pra-cutover)

- [ ] A1–A10 selesai & CI hijau di `master` (A3 sudah hijau sejak 2026-09-30; A10/A10b diverifikasi lewat boot simulasi image 2026-10-15)

- [ ] Smoke test staging lengkap (lihat `docs/OPS_RUNBOOK.md` §7) di `stage.pos.domain`
- [ ] k6 drill ke staging: 10/25/50 VU — catat p95/p99
- [ ] Backup pertama berhasil & restore diuji sekali (OPS §3–4)
- [ ] UptimeRobot monitor `/api/health` aktif (500/503 dianggap DOWN)

- [ ] `JWT_SECRET` random di `backend/.env` (bukan default)
- [ ] `MONGO_APP_USERNAME`/`MONGO_APP_PASSWORD` terisi dan **berbeda** dari kredensial root
- [ ] Container `app` berjalan sebagai `node` (`docker exec posmono-app id -u` → `1000`)
- [ ] Firewall: hanya 80/443/SSH terbuka
- [ ] Domain `pos.domain` + TLS aktif via Caddy (`docker/.env` terisi, `docker compose --env-file docker/.env -f docker/docker-compose.caddy.yml up -d`)
- [ ] Tenant pertama provisi (`seed --prod`) + checklist §6