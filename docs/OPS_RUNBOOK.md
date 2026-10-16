# Ops Runbook — Kuire POS (POSMono)

> Dokumen operasional harian (benahi soal "sudah hidup"): monitoring, backup & restore, update/rollback, smoke test, troubleshooting.
> Versi draf — berlaku setelah deploy (lihat `docs/DEPLOYMENT.md`). Container di sini memakai nama dari `docker/docker-compose.prod.yml`.

---

## 1. Komponen & lokasi

| Hal | Nilai |
|-----|-------|
| App | container `posmono-app`, port internal :3000 |
| DB | container `posmono-mongodb`, volume `mongodb_data`, **`--auth` aktif** (user root di `admin`) |
| Cache | container `posmono-redis`, volume `redis_data` |
| Reverse proxy | kontainer `caddy` (TLS otomatis) |
| Compose file | `/home/deploy/kuire/docker/docker-compose.prod.yml` |
| Env (app) | `/home/deploy/kuire/backend/.env` (JWT_SECRET dkk — **bukan** kredensial DB) |
| Env (compose) | `/home/deploy/kuire/docker/.env` (DOMAIN, ACME_EMAIL, `MONGO_INITDB_ROOT_*`, `MONGO_DATABASE`) — satu-satunya sumber kredensial Mongo |

---

## 2. Monitoring

### Uptime — UptimeRobot (gratis)
1. UptimeRobot → Add New Monitor → *HTTP(s)* Server
2. URL: `https://pos.domain/api/health`
3. Interval: 5 menit · alert contact: email
4. Harapkan respons JSON `{"status":"ok",...}` (endpoint `/api/health` — bagian Fase A kode)
5. Tambah monitor kedua untuk `stage.pos.domain` bila staging dipakai terus-menerus.

### Log
Semua log dari Docker (`json-file` driver otomatis). Lihat real-time:

```bash
docker logs -f posmono-app           # log app
docker logs -n 200 posmono-app       # 200 baris terakhir
```

Batas ukuran log (set agar tidak penuh disk):

```bash
# di /etc/docker/daemon.json
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }
sudo systemctl restart docker
```

Logrotate untuk file host (`/etc/logrotate.d/docker`):

```
/var/lib/docker/containers/*/*.log {
  rotate 30
  daily
  compress
  missingok
  notifempty
}
```

---

## 3. Backup (harian, otomatis)

Jadwal: **1× sehari**, `mongodump --gzip` → file host → rclone ke offsite (R2/S3/GDrive), retensi 30 hari. Backup menyertakan DB **dan** uploads.

### 3.1 Install rclone + konfigurasi (sekali)

```bash
sudo curl https://rclone.org/install.sh | sudo bash
rclone config        # pilih backend:  Amazon S3 / Cloudflare R2 / Google Drive / dll
```

### 3.2 Script backup

Buat `/home/deploy/kuire/scripts/backup.sh` (mark executable):

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/home/deploy/backups"
RETENTION_DAYS="30"
STAMP="$(date +%Y%m%d-%H%M%S)"
NAME="posmono-${STAMP}"

mkdir -p "${BACKUP_DIR}"

# 1. Dump database. Sejak Mongo ber-`--auth`, dump WAJIB memakai kredensial.
#    `docker exec` mewarisi env container, jadi MONGO_INITDB_ROOT_* terbaca di dalamnya.
#    `--db` membatasi dump ke database aplikasi saja: dump seluruh instance ikut membawa
#    user `admin` dan akan bentrok (duplicate key) saat restore ke volume baru.
docker exec posmono-mongodb sh -c 'mongodump \
  --quiet --gzip --archive \
  --db "$MONGO_INITDB_DATABASE" \
  --username "$MONGO_INITDB_ROOT_USERNAME" \
  --password "$MONGO_INITDB_ROOT_PASSWORD" \
  --authenticationDatabase admin' > "${BACKUP_DIR}/${NAME}.mongodump.gz"
#   ^ bila image tidak punya mongodump: aktifkan service helper mongodump (lihat 3.4)
#   ^ butuh dump seluruh instance? ganti `--db "$MONGO_INITDB_DATABASE"` dengan `--authenticationDatabase admin` saja

# 2. Uploads + env (saldo safety)
mkdir -p "${BACKUP_DIR}/${NAME}-files"
# Path WAJIB sama dengan mount `uploads_data` di docker-compose.prod.yml
# (/app/backend/dist/uploads, bukan /app/backend/uploads — UPLOAD_DIR resolve
# relatif ke file terkompilasi). Path salah = backup kosong tanpa error.
docker cp posmono-app:/app/backend/dist/uploads "${BACKUP_DIR}/${NAME}-files/uploads"
test -d "${BACKUP_DIR}/${NAME}-files/uploads" || { echo "FATAL: uploads tidak ter-backup"; exit 1; }
cp /home/deploy/kuire/backend/.env "${BACKUP_DIR}/${NAME}-files/.env"
tar -czf "${BACKUP_DIR}/${NAME}-files.tar.gz" -C "${BACKUP_DIR}" "${NAME}-files"
rm -rf "${BACKUP_DIR}/${NAME}-files"

# 3. Kirim ke offsite
rclone copy "${BACKUP_DIR}" "remote:posmono-backup" --include "*.gz"

# 4. Retensi lokal + remote
find "${BACKUP_DIR}" -name "*.gz" -mtime +"${RETENTION_DAYS}" -delete
rclone delete "remote:posmono-backup" --min-age "${RETENTION_DAYS}d" --drive-use-trash=false --s3-use-trash=false 2>/dev/null || true

echo "backup ok: ${NAME}"
```

### 3.3 Cron

```bash
crontab -e   # user deploy
# 03:00 tiap hari
0 3 * * * /home/deploy/kuire/scripts/backup.sh >> /home/deploy/backup.log 2>&1
```

### 3.4 Kalau image mongo:7 tidak menyertakan mongodump

Gunakan helper container di compose (atau jalankan ad-hoc). Kredensial + nama DB dibaca
dari `docker/.env` supaya tidak ada password yang ditempel di perintah:

```bash
set -a; . /home/deploy/kuire/docker/.env; set +a
MONGO_URI="mongodb://${MONGO_INITDB_ROOT_USERNAME}:${MONGO_INITDB_ROOT_PASSWORD}@posmono-mongodb:27017/${MONGO_DATABASE:-posmono}?authSource=admin"

docker run --rm --network kuire -v /home/deploy/backups:/backup mongo:7 \
  mongodump --uri "$MONGO_URI" \
  --gzip --archive > /home/deploy/backups/posmono-manual.mongodump.gz
```

---

## 4. Restore (uji 1× sebelum cutover!)

Prosedur ini **wajib diuji satu kali** pada tahap staging sebelum aplikasi resmi dipakai — supaya saat darurat tidak ada kejutan.

```bash
# 1. Hentikan app agar tidak menulis ke DB selama restore
docker stop posmono-app

# 2. Restore dari arsip dump terbaru (kredensial diwarisi dari container; `-i` untuk stdin)
docker exec -i posmono-mongodb sh -c 'mongorestore \
  --quiet --gzip --archive \
  --username "$MONGO_INITDB_ROOT_USERNAME" \
  --password "$MONGO_INITDB_ROOT_PASSWORD" \
  --authenticationDatabase admin' < /home/deploy/backups/posmono-<STAMP>.mongodump.gz

# 3. Restore uploads (bila hilang)
docker cp /home/deploy/backups/posmono-<STAMP>-files.tar.gz posmono-app:/tmp/
docker exec posmono-app sh -c 'tar -xzf /tmp/posmono-<STAMP>-files.tar.gz -C /tmp && cp -r /tmp/posmono-<STAMP>-files/uploads/. /app/backend/dist/uploads/'

# 4. Nyalakan lagi
docker start posmono-app
curl -fsS https://pos.domain/api/health
```

> **Restore ke volume baru (DR total):** user root dibuat otomatis oleh image Mongo saat
> boot pertama volume kosong, jadi kredensial di `docker/.env` tetap berlaku. Karena dump
> sudah dibatasi `--db`, isinya tidak membawa user `admin` — restore tidak akan bentrok.
> Bila volume **lama** dipakai ulang, kredensialnya adalah yang lama: samakan
> `docker/.env` dengan kredensial itu, atau reset volumenya (lihat §6).

**Catatan:** file dump bersifat *point-in-time*. Data baru setelah dump terakhir akan hilang — frekuensi backup bisa dinaikkan (mis. 6 jam) bila bisnis sensitif.

---

## 5. Update aplikasi (deploy rilis baru)

```bash
cd /home/deploy/kuire
git pull --ff-only            # ambil kode terbaru (bila deploy via source)
docker compose -f docker/docker-compose.prod.yml build   # bila build lokal
# ATAU (deploy via image): docker compose -f docker/docker-compose.prod.yml pull
docker compose -f docker/docker-compose.prod.yml up -d
curl -fsS https://pos.domain/api/health   # cek sehat

# Caddy tidak ikut ter-update bersama app; cukup recreate bila docker/Caddyfile berubah:
docker compose --env-file docker/.env -f docker/docker-compose.caddy.yml up -d --force-recreate
```

### Rollback

Rilis lama tetap tersedia sebagai image bertag (`:vX.Y.Z`).

```bash
docker compose -f docker/docker-compose.prod.yml down
# ubah image: di compose ke tag yang ingin dikembalikan
docker compose -f docker/docker-compose.prod.yml up -d
```

> Jalankan backfill (mis. `pnpm backfill:cost`, `backfill:payment`) **setelah** update bila rilis menyertakan perubahan skema data. Backfill TIDAK destructive, tapi jadikan satu sesi dengan update di jam low-traffic.

---

## 6. Troubleshooting

| Gejala | Cek | Solusi |
|--------|-----|--------|
| `posmono-app` restart-loop | `docker logs posmono-app` | paling sering: `MONGO_URI` salah / mongo belum sehat → pastikan A5 (healthcheck + `depends_on`); di produksi URI dirangkai dari `docker/.env` (wajib `?authSource=admin`) |
| `ECONNREFUSED mongodb` | `docker exec posmono-mongodb mongosh -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --eval "db.runCommand({ping:1})"` | service mongo restart / volume rusak |
| `Authentication failed` (log app / mongosh) | `docker exec posmono-mongodb env \| grep MONGO_INITDB` lalu bandingkan dengan `docker/.env` | password `docker/.env` berbeda dari yang dipakai membuat user (volume sudah ter-init) → samakan nilainya, atau reset volume (§6b di bawah) |
| `mongodb` tidak pernah `healthy` | `docker inspect --format '{{json .State.Health}}' posmono-mongodb` | healthcheck WAJIB ber-kredensial sejak `--auth` aktif — jangan hapus `--username/--password` di compose |
| container `mongodb` gagal start: `belum diset di docker/.env` | `ls docker/.env` | compose sengaja fail-fast bila kredensial kosong → `cp docker/.env.example docker/.env` lalu isi (§DEPLOYMENT §4) |
| `Environment validation failed` saat boot | `docker logs posmono-app \| tail -50` | `JWT_SECRET` masih memakai nilai contoh `.env.example` / < 32 karakter / `NODE_ENV` tidak valid → `openssl rand -hex 32` lalu isi `backend/.env` (checklist §8) |
| `jwt expired` setelah kemarin | `JWT_EXPIRES_IN` di `.env` | set ulang 8h/<sesuai>; token lama invalid (wajar) |
| tenant "User not found" | data sesi vs DB | biasanya token dari DB lama setelah restore point-in-time — login ulang |
| `heap limit` / lambat | `free -h`, `docker stats` | tambah swap (DEPLOY §3); naikkan RAM bila mongo aktif |
| disk penuh | `df -h`, `docker system df` | jalankan `docker system prune -af` (hati-hati: hapus image lama), bersih backup lama |
| SSL/tidak bisa HTTPS | `docker logs caddy` | DNS A record harus sudah mengarah ke IP **dan** port 80 terbuka (ACME HTTP-01); cek `DOMAIN`/`ACME_EMAIL` di `docker/.env`; Caddy renew otomatis |
| Caddy `name resolution` / `502` | `docker exec caddy wget -qO- http://app:3000/api/health` | `app` belum di network `kuire` — pastikan `docker network create kuire` + service app/mongo/redis punya `networks: [kuire]` |
| QRIS invoice tak jalan | config tenant > QRIS Gateway | sengaja menunjuk simulator `http://host.docker.internal:3334`; integrasi asli ditunda |

Healthcheck manual:

```bash
curl -fsS https://pos.domain/api/health          # {"status":"ok",...}
curl -fsS https://pos.domain/api/health -w '\n%{http_code}\n'
```

### 6b. Kredensial Mongo: hanya dibuat saat volume masih kosong

Image `mongo` membuat user root **hanya pada boot pertama dengan volume kosong**
(`docker-entrypoint.sh` melewati initdb bila `/data/db` sudah berisi). Jadi volume yang
dibuat **sebelum** auth diaktifkan tidak punya user, sementara mongod kini selalu start
dengan `--auth` → app gagal connect dan tidak ada kredensial yang cocok.

Satu-satunya jalur bersih (data ikut dipulihkan):

```bash
cd /home/deploy/kuire

# 1. Backup dulu — langkah ini menghapus volume. Dump TANPA kredensial (belum ada user):
docker exec posmono-mongodb sh -c 'mongodump --quiet --gzip --archive --db posmono' \
  > /home/deploy/backups/pre-auth.mongodump.gz

# 2. Turunkan stack & hapus volume DB (volume uploads/logs TIDAK disentuh)
docker compose -f docker/docker-compose.prod.yml down
docker volume rm kuire_mongodb_data          # cek nama: `docker volume ls | grep mongodb`

# 3. Naikkan lagi: volume kosong → user root dibuat dari docker/.env
docker compose -f docker/docker-compose.prod.yml up -d

# 4. Restore data (perintah ber-kredensial di §4)
```

> Alternatif tanpa menghapus volume: `mongod` mengizinkan pembuatan user pertama dari
> localhost tanpa autentikasi (*localhost exception*), jadi user root bisa dibuat manual
> via `docker exec -it posmono-mongodb mongosh admin`. Hapus volume tetap lebih
> deterministik dan sudah teruji.

---

## 7. Smoke test checklist (staging, sebelum cutover)

Jalankan berurutan di `stage.pos.domain` (kasir + owner):

- [ ] Login owner → dashboard
- [ ] Buka shift (opening balance)
- [ ] Buat produk + stock-in (catat qty awal)
- [ ] Transaksi tunai → struk tampil benar (subtotal, pajak, pembulatan, kembalian)
- [ ] Pay-cash kedua → stok berkurang sesuai qty
- [ ] Hold bill → Tutup shift → shift baru → carried bills tampil → bayar → close-bill
- [ ] Void transaksi paid → stok kembali
- [ ] Laporan: kasir/shift, invoice A4, rekonsiliasi pembayaran, P&L
- [ ] Print ulang struk (WebUSB / TCP printer asli — satu kali dicek)
- [ ] Dashboard: summary + recent orders ikut ter-update
- [ ] Isolasi: user Cashier hanya bisa `/pos` (halaman lain 403)
- [ ] UptimeRobot menandai monitor OK

---

## 8. Checklist keamanan (app-level)

- [ ] `JWT_SECRET` = nilai random (`openssl rand -hex 32`), bukan default
- [ ] `docker/.env` terisi: `MONGO_INITDB_ROOT_PASSWORD` panjang & aman-URL (password DB tidak pernah masuk repo)
- [ ] `MONGO_INITDB_ROOT_PASSWORD` hanya ada di `docker/.env` (bukan disalin ke `backend/.env`, chat, atau tiket)
- [ ] Password seeding `--prod` kuat; user demo (`admin@demo.com/admin123`) **tidak** di-seed ke produksi
- [ ] Firewall VPS hanya 80/443/SSH; port 3000 tidak diekspos publik
- [ ] `helmet` aktif (sudah di `server.ts`) — CSP dimatikan karena SPA, disengaja
- [ ] Akses SSH hanya via key, user `deploy` non-root
- [ ] Backup encrypsi bila berisi data sensitif (opsional: rclone `--crypt`)