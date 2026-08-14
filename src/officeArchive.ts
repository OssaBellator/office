const EOCD_SIGNATURE = 0x06054b50
const CENTRAL_SIGNATURE = 0x02014b50
const LOCAL_SIGNATURE = 0x04034b50

function asBytes(input: ArrayBuffer | Uint8Array) {
  return input instanceof Uint8Array ? input : new Uint8Array(input)
}

async function inflateRaw(input: Uint8Array) {
  if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot decompress Office files yet')
  const stream = new Blob([input]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function readOfficeZip(input: ArrayBuffer | Uint8Array): Promise<Map<string, Uint8Array>> {
  const bytes = asBytes(input)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const decoder = new TextDecoder()
  const minimumOffset = Math.max(0, bytes.length - 0xffff - 22)
  let endOfCentralDirectory = -1
  for (let offset = bytes.length - 22; offset >= minimumOffset; offset -= 1) {
    if (view.getUint32(offset, true) === EOCD_SIGNATURE) { endOfCentralDirectory = offset; break }
  }
  if (endOfCentralDirectory < 0) throw new Error('Not a valid Office ZIP package')

  const entries = view.getUint16(endOfCentralDirectory + 10, true)
  let offset = view.getUint32(endOfCentralDirectory + 16, true)
  const result = new Map<string, Uint8Array>()
  for (let index = 0; index < entries; index += 1) {
    if (view.getUint32(offset, true) !== CENTRAL_SIGNATURE) throw new Error('Invalid Office ZIP central directory')
    const method = view.getUint16(offset + 10, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const fileNameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const localOffset = view.getUint32(offset + 42, true)
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + fileNameLength))
    if (view.getUint32(localOffset, true) !== LOCAL_SIGNATURE) throw new Error(`Invalid Office ZIP entry: ${name}`)
    const localNameLength = view.getUint16(localOffset + 26, true)
    const localExtraLength = view.getUint16(localOffset + 28, true)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    const compressed = bytes.subarray(dataStart, dataStart + compressedSize)
    if (!name.endsWith('/')) {
      if (method === 0) result.set(name, compressed.slice())
      else if (method === 8) result.set(name, await inflateRaw(compressed))
      else throw new Error(`Unsupported Office ZIP compression method ${method} for ${name}`)
    }
    offset += 46 + fileNameLength + extraLength + commentLength
  }
  return result
}

export function readOfficeXml(entries: Map<string, Uint8Array>, path: string) {
  const value = entries.get(path)
  return value ? new TextDecoder().decode(value) : null
}
