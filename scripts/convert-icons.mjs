import sharp from 'sharp'
import { writeFileSync, renameSync } from 'fs'
import { join } from 'path'

const src = join(process.cwd(), 'resources', 'icon.png')
const outDir = join(process.cwd(), 'resources')

function createIco(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)

  const directory = []
  let dataOffset = 6 + images.length * 16

  for (const img of images) {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(img.size === 256 ? 0 : img.size, 0)
    entry.writeUInt8(img.size === 256 ? 0 : img.size, 1)
    entry.writeUInt8(0, 2)
    entry.writeUInt8(0, 3)
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(img.buffer.length, 8)
    entry.writeUInt32LE(dataOffset, 12)
    dataOffset += img.buffer.length
    directory.push(entry)
  }

  return Buffer.concat([header, ...directory, ...images.map(i => i.buffer)])
}

async function main() {
  await sharp(src)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(outDir, 'icon-512.png'))
  renameSync(join(outDir, 'icon-512.png'), join(outDir, 'icon.png'))
  console.log('Created icon.png (512x512)')

  const sizes = [16, 32, 48, 256]
  const pngBuffers = await Promise.all(
    sizes.map(async (size) => {
      const buf = await sharp(src)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
      return { size, buffer: buf }
    })
  )

  const ico = createIco(pngBuffers)
  writeFileSync(join(outDir, 'icon.ico'), ico)
  console.log('Created icon.ico (16/32/48/256)')

  const icnsSizes = [16, 32, 64, 128, 256, 512, 1024]
  const icnsEntries = []

  for (const size of icnsSizes) {
    const pngBuf = await sharp(src)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()

    const typeMap = {
      16: 'icp4',
      32: 'icp5',
      64: 'icp6',
      128: 'ic07',
      256: 'ic08',
      512: 'ic09',
      1024: 'ic10'
    }

    const type = typeMap[size]
    if (type) {
      const entry = Buffer.alloc(8 + pngBuf.length)
      entry.write(type, 0, 4, 'ascii')
      entry.writeUInt32BE(8 + pngBuf.length, 4)
      pngBuf.copy(entry, 8)
      icnsEntries.push(entry)
    }
  }

  const totalLength = 8 + icnsEntries.reduce((sum, e) => sum + e.length, 0)
  const icns = Buffer.alloc(totalLength)
  icns.write('icns', 0, 4, 'ascii')
  icns.writeUInt32BE(totalLength, 4)
  let offset = 8
  for (const entry of icnsEntries) {
    entry.copy(icns, offset)
    offset += entry.length
  }

  writeFileSync(join(outDir, 'icon.icns'), icns)
  console.log('Created icon.icns (16-1024)')
}

main().catch(console.error)
