# Ops Runbook — Kuire POS (POSMono)

> Dokumen operasional harian (benahi soal "sudah hidup"): monitoring, backup & restore, update/rollback, smoke test, troubleshooting.
> Versi draf — berlaku setelah deploy (lihat `docs/DEPLOYMENT.md`). Container di sini memakai nama dari `docker/docker-compose.prod.yml`.

---

## 1. Komponen & lokasi

| Hal | Nilai |
|-----|-------|
| App | container `posmono-app`, port internal :3000 |
| DB | container `posmono-mongodb`, volume `mongodb_data` |
| Cache | container `posmono-redis`, volume `redis_data` |
| Reverse proxy | kontainer `caddy` (TLS otomatis) |
| Compose file | `/home/deploy/kuire/docker/docker-compose.prod.yml` |
| Env | `/home/deploy/kuire/backend/.env` (JWT_SECRET dkk) |

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

# 1. Dump database (dari dalam container mongo, via kompatibel tools mongo:7)
docker exec posmono-mongodb mongodump \
  --quiet --gzip --archive > "${BACKUP_DIR}/${NAME}.mongodump.gz"
#   ^ bila image tidak punya mongodump: aktifkan service helper mongodump (lihat 3.4)

# 2. Uploads + env (saldo safety)
mkdir -p "${BACKUP_DIR}/${NAME}-files"
docker cp posmono-app:/app/backend/uploads "${BACKUP_DIR}/${NAME}-files/uploads" || true
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

Gunakan helper container di compose (atau jalankan ad-hoc):

```bash
docker run --rm --network kuire -v /home/deploy/backups:/backup mongo:7 \
  mongodump --uri "mongodb://posmono-mongodb:27017/posmono" \
  --gzip --archive > /home/deploy/backups/posmono-manual.mongodump.gz
```

---

## 4. Restore (uji 1× sebelum cutover!)

Prosedur ini **wajib diuji satu kali** pada tahap staging sebelum aplikasi resmi dipakai — supaya saat darurat tidak ada kejutan.

```bash
# 1. Hentikan app agar tidak menulis ke DB selama restore
docker stop posmono-app

# 2. Restore dari arsip dump terbaru
docker exec -i posmono-mongodb mongorestore --gzip --archive < /home/deploy/backups/posmono-<STAMP>.mongodump.gz

# 3. Restore uploads (bila hilang)
docker cp /home/deploy/backups/posmono-<STAMP>-files.tar.gz posmono-app:/tmp/
docker exec posmono-app sh -c 'tar -xzf /tmp/posmono-<STAMP>-files.tar.gz -C /tmp && cp -r /tmp/posmono-<STAMP>-files/uploads /app/backend/'

# 4. Nyalakan lagi
docker start posmono-app
curl -fsS https://pos.domain/api/health
```

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
| `posmono-app` restart-loop | `docker logs posmono-app` | paling sering: `MONGO_URI` salah / mongo belum sehat → pastikan A5 (healthcheck + `depends_on`) |
| `ECONNREFUSED mongodb` | `docker exec posmono-mongodb mongosh --eval "db.runCommand({ping:1})"` | service mongo restart / volume rusak |
| `jwt expired` setelah kemarin | `JWT_EXPIRES_IN` di `.env` | set ulang 8h/<sesuai>; token lama invalid (wajar) |
| tenant "User not found" | data sesi vs DB | biasanya token dari DB lama setelah restore point-in-time — login ulang |
| `heap limit` / lambat | `free -h`, `docker stats` | tambah swap (DEPLOY §3); naikkan RAM bila mongo aktif |
| disk penuh | `df -h`, `docker system df` | jalankan `docker system prune -af` (hati-hati: hapus image lama), bersih backup lama |
| SSL/tidak bisa HTTPS | `docker logs caddy` | pastikan DNS A record sudah mengarah ke IP; Caddy renew otomatis |
| QRIS invoice tak jalan | config tenant > QRIS Gateway | sengaja menunjuk simulator `http://host.docker.internal:3334`; integrasi asli ditunda |

Healthcheck manual:

```bash
curl -fsS https://pos.domain/api/health          # {"status":"ok",...}
curl -fsS https://pos.domain/api/health -w '\n%{http_code}\n'
```

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
- [ ] Password seeding `--prod` kuat; user demo (`admin@demo.com/admin123`) **tidak** di-seed ke produksi
- [ ] Firewall VPS hanya 80/443/SSH; port 3000 tidak diekspos publik
- [ ] `helmet` aktif (sudah di `server.ts`) — CSP dimatikan karena SPA, disengaja
- [ ] Akses SSH hanya via key, user `deploy` non-root
- [ ] Backup encrypsi bila berisi data sensitif (opsional: rclone `--crypt`)