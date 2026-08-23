import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import QRCode from 'qrcode'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 5000)
const API_KEY = process.env.QRIS_API_KEY || '12345678'
const MERCHANT_ID = process.env.QRIS_MERCHANT_ID || '123456'
const MERCHANT_NAME = process.env.QRIS_MERCHANT_NAME || 'POSMONO DEMO STORE'
const MERCHANT_CITY = process.env.QRIS_MERCHANT_CITY || 'JAKARTA'
const EXPIRY_MINUTES = Number(process.env.QRIS_EXPIRY_MINUTES || 15)
const STATIC_QRIS = process.env.QRIS_STATIC || ''
const DATA_FILE = path.join(__dirname, 'data', 'invoices.json')

const invoices = new Map(loadPersisted())

function loadPersisted() {
  try {
    const rows = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
    return rows.map((r) => [r.cliTrxNumber, r])
  } catch {
    return []
  }
}

function persist() {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true })
    fs.writeFileSync(DATA_FILE, JSON.stringify([...invoices.values()], null, 2))
  } catch {}
}

function tlv(id, value) {
  return id + String(value.length).padStart(2, '0') + value
}

function crc16(payload) {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

function parseTlv(payload) {
  const tags = new Map()
  let i = 0
  while (i + 4 <= payload.length) {
    const id = payload.slice(i, i + 2)
    const len = parseInt(payload.slice(i + 2, i + 4), 10)
    if (Number.isNaN(len) || i + 4 + len > payload.length) break
    tags.set(id, payload.slice(i + 4, i + 4 + len))
    i += 4 + len
  }
  return tags
}

function buildDynamicQris(amount, mid, trxNumber) {
  if (STATIC_QRIS) {
    const tags = parseTlv(STATIC_QRIS.replace(/6304.{4}$/i, ''))
    tags.delete('63')
    tags.set('01', '12')
    tags.set('54', String(amount))
    let raw = ''
    for (const [id, val] of tags) raw += tlv(id, val)
    raw += tlv('62', tlv('05', String(trxNumber).slice(0, 25)))
    raw += '6304'
    return raw + crc16(raw)
  }
  const pan = ('93600914' + String(mid)).slice(0, 18).padEnd(15, '0')
  const mai = tlv('00', 'ID.CO.QRIS.WWW') + tlv('01', pan) + tlv('02', 'UMI')
  let raw =
    tlv('00', '01') +
    tlv('01', '12') +
    tlv('26', mai) +
    tlv('52', '5812') +
    tlv('53', '360') +
    tlv('54', String(amount)) +
    tlv('58', 'ID') +
    tlv('59', MERCHANT_NAME.slice(0, 25)) +
    tlv('60', MERCHANT_CITY.slice(0, 15)) +
    tlv('62', tlv('05', String(trxNumber).slice(0, 25))) +
    '6304'
  return raw + crc16(raw)
}

function effectiveStatus(inv) {
  if (inv.status === 'pending' && Date.now() > inv.expiredAt) return 'expired'
  return inv.status
}

function publicView(inv) {
  return { ...inv, status: effectiveStatus(inv) }
}

function sendJson(res, code, body) {
  const data = JSON.stringify(body)
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    'Access-Control-Allow-Origin': '*',
  })
  res.end(data)
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch {
        resolve(Object.fromEntries(new URLSearchParams(raw)))
      }
    })
  })
}

function fail(res, code, message) {
  sendJson(res, code, { status: 'error', message })
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`)
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': '*',
    })
    return res.end()
  }

  if (!/^\/restapi\/qris\/show_qris\.php$/.test(url.pathname)) {
    return fail(res, 404, 'Endpoint tidak ditemukan. Gunakan /restapi/qris/show_qris.php')
  }

  const body = req.method === 'POST' ? await readBody(req) : {}
  const p = (k) => url.searchParams.get(k) ?? body[k] ?? ''
  const action = p('do')

  const apiKey = p('apikey')
  if (!apiKey || apiKey !== API_KEY) return fail(res, 401, 'API key tidak valid')
  const mID = p('mID')
  if (mID && mID !== MERCHANT_ID) return fail(res, 400, `Merchant ID tidak dikenal (harus ${MERCHANT_ID})`)

  if (action === 'create-invoice') {
    const cliTrxNumber = String(p('cliTrxNumber')).trim()
    const cliTrxAmount = Number(p('cliTrxAmount'))
    if (!cliTrxNumber) return fail(res, 400, 'Parameter cliTrxNumber wajib diisi')
    if (!Number.isInteger(cliTrxAmount) || cliTrxAmount <= 0)
      return fail(res, 400, 'cliTrxAmount harus angka bulat > 0')

    const now = Date.now()
    const existing = invoices.get(cliTrxNumber)
    if (existing && effectiveStatus(existing) === 'pending') {
      return sendJson(res, 200, {
        status: 'success',
        message: 'Invoice sudah ada (masih pending)',
        data: await withQrImage(publicView(existing)),
      })
    }

    const qris = buildDynamicQris(cliTrxAmount, MERCHANT_ID, cliTrxNumber)
    const invoice = {
      mID: MERCHANT_ID,
      merchantName: MERCHANT_NAME,
      cliTrxNumber,
      cliTrxAmount,
      fee: 0,
      total: cliTrxAmount,
      qris,
      status: 'pending',
      createdAt: now,
      expiredAt: now + EXPIRY_MINUTES * 60_000,
      paidAt: null,
      paymentMethod: null,
    }
    invoices.set(cliTrxNumber, invoice)
    persist()
    return sendJson(res, 200, {
      status: 'success',
      message: 'Invoice berhasil dibuat',
      data: await withQrImage(invoice),
    })
  }

  if (action === 'check-status' || action === 'status') {
    const inv = invoices.get(String(p('cliTrxNumber')).trim())
    if (!inv) return fail(res, 404, 'Invoice tidak ditemukan')
    persist()
    return sendJson(res, 200, {
      status: 'success',
      data: {
        cliTrxNumber: inv.cliTrxNumber,
        amount: inv.total,
        status: effectiveStatus(inv),
        createdAt: new Date(inv.createdAt).toISOString(),
        expiredAt: new Date(inv.expiredAt).toISOString(),
        paidAt: inv.paidAt ? new Date(inv.paidAt).toISOString() : null,
        paymentMethod: inv.paymentMethod,
      },
    })
  }

  if (action === 'pay') {
    const inv = invoices.get(String(p('cliTrxNumber')).trim())
    if (!inv) return fail(res, 404, 'Invoice tidak ditemukan')
    if (effectiveStatus(inv) === 'expired') return fail(res, 400, 'Invoice sudah kedaluwarsa')
    if (effectiveStatus(inv) === 'paid') {
      return sendJson(res, 200, { status: 'success', message: 'Invoice sudah dibayar', data: publicView(inv) })
    }
    inv.status = 'paid'
    inv.paidAt = Date.now()
    inv.paymentMethod = p('method') || 'qris_simulator'
    persist()
    console.log(`[PAID] ${inv.cliTrxNumber} Rp${inv.total} (${new Date().toISOString()})`)
    return sendJson(res, 200, { status: 'success', message: 'Pembayaran berhasil disimulasikan', data: publicView(inv) })
  }

  if (action === 'void' || action === 'cancel') {
    const inv = invoices.get(String(p('cliTrxNumber')).trim())
    if (!inv) return fail(res, 404, 'Invoice tidak ditemukan')
    inv.status = 'cancelled'
    persist()
    return sendJson(res, 200, { status: 'success', message: 'Invoice dibatalkan', data: publicView(inv) })
  }

  if (action === 'list') {
    persist()
    return sendJson(res, 200, {
      status: 'success',
      data: [...invoices.values()].map(publicView).map(({ qris, ...rest }) => rest),
    })
  }

  return fail(res, 400, `Action "${action}" tidak dikenal. Gunakan: create-invoice | check-status | pay | void | list`)
}

async function withQrImage(inv) {
  const qrImage = await QRCode.toDataURL(inv.qris, { width: 512, margin: 1 })
  return { ...inv, qrImage }
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error(err)
    if (!res.headersSent) fail(res, 500, 'Internal server error')
  })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`QRIS Simulator listening on http://0.0.0.0:${PORT}`)
  console.log(`  Merchant ID : ${MERCHANT_ID}`)
  console.log(`  API Key     : ${API_KEY}`)
})
