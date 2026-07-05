// Minimal dependency-free ZIP writer (STORE / no compression).
// Good enough for bundling small text source files for download.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(bytes) {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function dosDateTime(d = new Date()) {
  const time = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((d.getSeconds() / 2) & 0x1f)
  const date = (((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0xf) << 5) | (d.getDate() & 0x1f)
  return { time, date }
}

/**
 * Build a ZIP Blob from { "path/name.ext": "text content", ... }.
 */
export function buildZip(files) {
  const enc = new TextEncoder()
  const { time, date } = dosDateTime()
  const chunks = []
  const central = []
  let offset = 0

  const u16 = (n) => [n & 0xff, (n >>> 8) & 0xff]
  const u32 = (n) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]

  for (const rawName of Object.keys(files)) {
    // Strip the leading slash and neutralise any ".." traversal so a poisoned
    // path (e.g. "/../../etc/passwd") can't escape the extraction directory.
    const name = rawName.replace(/^\//, '').split('/').filter((seg) => seg && seg !== '..').join('/')
    if (!name) continue
    const nameBytes = enc.encode(name)
    const data = enc.encode(typeof files[rawName] === 'string' ? files[rawName] : JSON.stringify(files[rawName]))
    const crc = crc32(data)

    const local = [
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0),
      ...u16(time), ...u16(date),
      ...u32(crc), ...u32(data.length), ...u32(data.length),
      ...u16(nameBytes.length), ...u16(0),
    ]
    chunks.push(new Uint8Array(local), nameBytes, data)

    central.push([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0),
      ...u16(time), ...u16(date),
      ...u32(crc), ...u32(data.length), ...u32(data.length),
      ...u16(nameBytes.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(0), ...u32(offset),
      ...Array.from(nameBytes),
    ])
    offset += local.length + nameBytes.length + data.length
  }

  const centralStart = offset
  let centralSize = 0
  const centralChunks = central.map((arr) => { centralSize += arr.length; return new Uint8Array(arr) })

  const end = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(central.length), ...u16(central.length),
    ...u32(centralSize), ...u32(centralStart), ...u16(0),
  ])

  return new Blob([...chunks, ...centralChunks, end], { type: 'application/zip' })
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
