/**
 * Generate MiniClaws app icon — snappy lobster face
 * Outputs a 512x512 PNG to resources/icon.png
 *
 * Uses raw pixel buffer → BMP → wraps in minimal PNG via zlib.
 * No external image libraries needed.
 */

const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const SIZE = 512
const CX = SIZE / 2
const CY = SIZE / 2
const RADIUS = SIZE * 0.42    // face radius
const CENTER = CX              // alias for horizontal center

// ── Colors (Snappy lobster) ──────────────────────────────────
const SHELL     = [0xd4, 0x40, 0x30]
const SHELL_DARK= [0xa0, 0x28, 0x20]
const CLAW      = [0xe8, 0x50, 0x40]
const WHITE     = [0xff, 0xff, 0xff]
const PUPIL     = [0x1a, 0x08, 0x08]
const MOUTH     = [0x2a, 0x08, 0x08]
const BLUSH     = [0xe0, 0x70, 0x60]
const HIGHLIGHT = [0xff, 0xff, 0xff]

// Create RGBA buffer
const buf = Buffer.alloc(SIZE * SIZE * 4, 0) // all transparent

function setPixel(x, y, r, g, b, a = 255) {
  x = Math.round(x)
  y = Math.round(y)
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return
  const i = (y * SIZE + x) * 4
  if (a < 255 && buf[i + 3] > 0) {
    // Alpha blend
    const srcA = a / 255
    const dstA = buf[i + 3] / 255
    const outA = srcA + dstA * (1 - srcA)
    buf[i]     = Math.round((r * srcA + buf[i] * dstA * (1 - srcA)) / outA)
    buf[i + 1] = Math.round((g * srcA + buf[i + 1] * dstA * (1 - srcA)) / outA)
    buf[i + 2] = Math.round((b * srcA + buf[i + 2] * dstA * (1 - srcA)) / outA)
    buf[i + 3] = Math.round(outA * 255)
  } else {
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a
  }
}

function dist(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2)
}

function fillCircle(cx, cy, r, color, alpha = 255) {
  const [cr, cg, cb] = color
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      const d = dist(x, y, cx, cy)
      if (d <= r) {
        setPixel(x, y, cr, cg, cb, alpha)
      } else if (d <= r + 1) {
        // Anti-alias edge
        const aa = Math.round((1 - (d - r)) * alpha)
        if (aa > 0) setPixel(x, y, cr, cg, cb, aa)
      }
    }
  }
}

function fillEllipse(cx, cy, rx, ry, color, alpha = 255) {
  const [cr, cg, cb] = color
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
      if (d <= 1) {
        setPixel(x, y, cr, cg, cb, alpha)
      } else if (d <= 1.08) {
        const aa = Math.round((1 - (d - 1) / 0.08) * alpha)
        if (aa > 0) setPixel(x, y, cr, cg, cb, aa)
      }
    }
  }
}

function fillRoundedRect(x1, y1, x2, y2, r, color, alpha = 255) {
  const [cr, cg, cb] = color
  for (let y = Math.floor(y1); y <= Math.ceil(y2); y++) {
    for (let x = Math.floor(x1); x <= Math.ceil(x2); x++) {
      let inside = false
      if (x >= x1 + r && x <= x2 - r) inside = true
      else if (y >= y1 + r && y <= y2 - r) inside = true
      else {
        // Check corner circles
        const corners = [
          [x1 + r, y1 + r], [x2 - r, y1 + r],
          [x1 + r, y2 - r], [x2 - r, y2 - r]
        ]
        for (const [cx, cy] of corners) {
          if (dist(x, y, cx, cy) <= r) { inside = true; break }
        }
      }
      if (inside) setPixel(x, y, cr, cg, cb, alpha)
    }
  }
}

// ── Draw the lobster face ────────────────────────────────────

// Antennae (behind head) — two stalks with tips
const antennaBaseY = CY - RADIUS * 0.75
// Left antenna
for (let i = 0; i < 60; i++) {
  const t = i / 60
  const ax = CX - RADIUS * 0.25 - t * RADIUS * 0.35
  const ay = antennaBaseY - t * RADIUS * 0.55
  fillCircle(ax, ay, 8 - t * 3, SHELL)
}
fillCircle(CX - RADIUS * 0.6, antennaBaseY - RADIUS * 0.55, 16, SHELL_DARK)
// Right antenna
for (let i = 0; i < 60; i++) {
  const t = i / 60
  const ax = CX + RADIUS * 0.25 + t * RADIUS * 0.35
  const ay = antennaBaseY - t * RADIUS * 0.55
  fillCircle(ax, ay, 8 - t * 3, SHELL)
}
fillCircle(CX + RADIUS * 0.6, antennaBaseY - RADIUS * 0.55, 16, SHELL_DARK)

// Claws (behind body, to the sides)
const clawY = CY + RADIUS * 0.15

// Left arm
for (let i = 0; i < 30; i++) {
  const t = i / 30
  const ax = CX - RADIUS * 0.85 - t * RADIUS * 0.4
  const ay = clawY + t * RADIUS * 0.1
  fillCircle(ax, ay, 18, SHELL)
}
// Left claw palm
const lClawX = CX - RADIUS * 1.25
fillCircle(lClawX, clawY + RADIUS * 0.05, 36, CLAW)
// Left claw top finger
fillEllipse(lClawX - 25, clawY - 18, 28, 12, CLAW)
// Left claw bottom finger
fillEllipse(lClawX - 25, clawY + 28, 26, 11, CLAW)

// Right arm
for (let i = 0; i < 30; i++) {
  const t = i / 30
  const ax = CX + RADIUS * 0.85 + t * RADIUS * 0.4
  const ay = clawY + t * RADIUS * 0.1
  fillCircle(ax, ay, 18, SHELL)
}
// Right claw palm
const rClawX = CX + RADIUS * 1.25
fillCircle(rClawX, clawY + RADIUS * 0.05, 36, CLAW)
// Right claw top finger
fillEllipse(rClawX + 25, clawY - 18, 28, 12, CLAW)
// Right claw bottom finger
fillEllipse(rClawX + 25, clawY + 28, 26, 11, CLAW)

// Legs (behind body, at bottom)
const legY = CY + RADIUS * 0.85
// Left leg
for (let i = 0; i < 20; i++) {
  const t = i / 20
  fillCircle(CX - RADIUS * 0.35, legY + t * RADIUS * 0.4, 16, SHELL)
}
fillEllipse(CX - RADIUS * 0.35, legY + RADIUS * 0.45, 20, 10, SHELL_DARK)
// Right leg
for (let i = 0; i < 20; i++) {
  const t = i / 20
  fillCircle(CX + RADIUS * 0.35, legY + t * RADIUS * 0.4, 16, SHELL)
}
fillEllipse(CX + RADIUS * 0.35, legY + RADIUS * 0.45, 20, 10, SHELL_DARK)

// Main body — big circle
fillCircle(CX, CY, RADIUS, SHELL)

// Eyes — white circles
const eyeY = CY - RADIUS * 0.12
const eyeSpacing = RADIUS * 0.32
const eyeR = RADIUS * 0.2
fillCircle(CX - eyeSpacing, eyeY, eyeR, WHITE)
fillCircle(CX + eyeSpacing, eyeY, eyeR, WHITE)

// Pupils — dark circles
const pupilR = eyeR * 0.58
fillCircle(CX - eyeSpacing, eyeY, pupilR, PUPIL)
fillCircle(CX + eyeSpacing, eyeY, pupilR, PUPIL)

// Pupil highlights — tiny white circles
const hlR = pupilR * 0.3
fillCircle(CX - eyeSpacing - pupilR * 0.25, eyeY - pupilR * 0.25, hlR, HIGHLIGHT)
fillCircle(CX + eyeSpacing - pupilR * 0.25, eyeY - pupilR * 0.25, hlR, HIGHLIGHT)

// Mouth — dark oval
const mouthY = CY + RADIUS * 0.3
fillEllipse(CX, mouthY, RADIUS * 0.18, RADIUS * 0.08, MOUTH)

// Cheek blush
fillCircle(CX - RADIUS * 0.55, CY + RADIUS * 0.12, RADIUS * 0.12, BLUSH, 60)
fillCircle(CX + RADIUS * 0.55, CY + RADIUS * 0.12, RADIUS * 0.12, BLUSH, 60)

// ── Encode as PNG ────────────────────────────────────────────

function writePNG(width, height, rgba) {
  // Build raw scanlines (filter byte 0 = None for each row)
  const rawLen = height * (1 + width * 4)
  const raw = Buffer.alloc(rawLen)
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4)
    raw[rowStart] = 0 // filter: None
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4)
  }

  const compressed = zlib.deflateSync(raw, { level: 9 })

  function chunk(type, data) {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const typeData = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const crc = crc32(typeData)
    const crcBuf = Buffer.alloc(4)
    crcBuf.writeUInt32BE(crc >>> 0)
    return Buffer.concat([len, typeData, crcBuf])
  }

  // CRC32
  function crc32(buf) {
    let c = 0xffffffff
    for (let i = 0; i < buf.length; i++) {
      c = (c >>> 8) ^ crcTable[(c ^ buf[i]) & 0xff]
    }
    return (c ^ 0xffffffff) >>> 0
  }
  const crcTable = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    crcTable[n] = c >>> 0
  }

  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 6  // RGBA
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ])
}

const png = writePNG(SIZE, SIZE, buf)
const outPath = path.join(__dirname, '..', 'resources', 'icon.png')
fs.writeFileSync(outPath, png)
console.log(`✓ Icon written to ${outPath} (${png.length} bytes)`)
