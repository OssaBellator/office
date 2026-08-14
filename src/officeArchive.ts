const EOCD_SIGNATURE = 0x06054b50
const CENTRAL_SIGNATURE = 0x02014b50
const LOCAL_SIGNATURE = 0x04034b50

const MAX_PACKAGE_BYTES = 128 * 1024 * 1024
const MAX_ENTRIES = 20_000
const MAX_XML_ENTRY_BYTES = 32 * 1024 * 1024
const MAX_XML_TOTAL_BYTES = 96 * 1024 * 1024

function asBytes(input: ArrayBuffer | Uint8Array) {
  return input instanceof Uint8Array ? input : new Uint8Array(input)
}

function ensureRange(length: number, offset: number, size: number, label: string) {
  if (offset < 0 || size < 0 || offset + size > length) throw new Error(`Invalid Office ZIP ${label}`)
}

function shouldMaterialize(name: string) {
  return /(?:^|\/)[^/]+\.(?:xml|rels)$/i.test(name) || name === '[Content_Types].xml'
}

async function inflateRaw(input: Uint8Array, expectedSize: number, name: string) {
  if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot decompress Office files yet')
  if (expectedSize > MAX_XML_ENTRY_BYTES) throw new Error(`Office XML entry is too large to import safely: ${name}`)
  const copy = new Uint8Array(input.byteLength)
  copy.set(input)
  const stream = new Blob([copy.buffer]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  const result = new Uint8Array(await new Response(stream).arrayBuffer())
  if (result.byteLength > MAX_XML_ENTRY_BYTES) throw new Error(`Office XML entry expanded beyond the safe import limit: ${name}`)
  if (expectedSize !== result.byteLength) throw new Error(`Office ZIP entry size mismatch: ${name}`)
  return result
}

export async function readOfficeZip(input: ArrayBuffer | Uint8Array): Promise<Map<string, Uint8Array>> {
  const bytes = asBytes(input)
  if (bytes.byteLength > MAX_PACKAGE_BYTES) throw new Error('Office file is too large to import safely in the browser')
  if (bytes.byteLength < 22) throw new Error('Not a valid Office ZIP package')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const decoder = new TextDecoder()
  const minimumOffset = Math.max(0, bytes.length - 0xffff - 22)
  let endOfCentralDirectory = -1
  for (let offset = bytes.length - 22; offset >= minimumOffset; offset -= 1) {
    if (view.getUint32(offset, true) === EOCD_SIGNATURE) { endOfCentralDirectory = offset; break }
  }
  if (endOfCentralDirectory < 0) throw new Error('Not a valid Office ZIP package')

  ensureRange(bytes.length, endOfCentralDirectory, 22, 'end-of-central-directory record')
  const diskNumber=view.getUint16(endOfCentralDirectory + 4,true)
  const centralDisk=view.getUint16(endOfCentralDirectory + 6,true)
  if(diskNumber!==0||centralDisk!==0)throw new Error('Multi-disk Office ZIP packages are not supported')
  const entries = view.getUint16(endOfCentralDirectory + 10, true)
  if(entries>MAX_ENTRIES)throw new Error('Office file contains too many package entries to import safely')
  let offset = view.getUint32(endOfCentralDirectory + 16, true)
  if(offset===0xffffffff)throw new Error('ZIP64 Office packages are not supported yet')
  const result = new Map<string, Uint8Array>()
  let materializedBytes=0
  for (let index = 0; index < entries; index += 1) {
    ensureRange(bytes.length,offset,46,'central directory entry')
    if (view.getUint32(offset, true) !== CENTRAL_SIGNATURE) throw new Error('Invalid Office ZIP central directory')
    const flags=view.getUint16(offset+8,true)
    if(flags&1)throw new Error('Password-protected Office files are not supported')
    const method = view.getUint16(offset + 10, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const uncompressedSize=view.getUint32(offset+24,true)
    if(compressedSize===0xffffffff||uncompressedSize===0xffffffff)throw new Error('ZIP64 Office entries are not supported yet')
    const fileNameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const localOffset = view.getUint32(offset + 42, true)
    ensureRange(bytes.length,offset+46,fileNameLength+extraLength+commentLength,'central directory metadata')
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + fileNameLength))
    ensureRange(bytes.length,localOffset,30,`local header for ${name}`)
    if (view.getUint32(localOffset, true) !== LOCAL_SIGNATURE) throw new Error(`Invalid Office ZIP entry: ${name}`)
    const localNameLength = view.getUint16(localOffset + 26, true)
    const localExtraLength = view.getUint16(localOffset + 28, true)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    ensureRange(bytes.length,dataStart,compressedSize,`payload for ${name}`)
    const compressed = bytes.subarray(dataStart, dataStart + compressedSize)
    if (!name.endsWith('/')) {
      if(!shouldMaterialize(name)) result.set(name,new Uint8Array())
      else {
        if(uncompressedSize>MAX_XML_ENTRY_BYTES)throw new Error(`Office XML entry is too large to import safely: ${name}`)
        let value:Uint8Array
        if (method === 0) {
          if(compressedSize!==uncompressedSize)throw new Error(`Office ZIP entry size mismatch: ${name}`)
          value=compressed.slice()
        } else if (method === 8) value=await inflateRaw(compressed,uncompressedSize,name)
        else throw new Error(`Unsupported Office ZIP compression method ${method} for ${name}`)
        materializedBytes+=value.byteLength
        if(materializedBytes>MAX_XML_TOTAL_BYTES)throw new Error('Office XML content expands beyond the safe import limit')
        result.set(name,value)
      }
    }
    offset += 46 + fileNameLength + extraLength + commentLength
  }
  return result
}

export function readOfficeXml(entries: Map<string, Uint8Array>, path: string) {
  const value = entries.get(path)
  return value && value.byteLength ? new TextDecoder().decode(value) : null
}
