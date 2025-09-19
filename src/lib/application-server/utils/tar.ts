const BLOCK_SIZE = 512

const TYPEFLAGS = {
  NORMAL_FILE: '0',
  NORMAL_FILE_ALT: '\0',
  DIRECTORY: '5',
} as const

type TarTypeFlag = typeof TYPEFLAGS[keyof typeof TYPEFLAGS]

export interface TarEntry {
  name: string
  size: number
  type: 'file' | 'directory'
  data: ArrayBuffer
}

const decoder = new TextDecoder()

function getString(view: Uint8Array, offset: number, length: number): string {
  const slice = view.subarray(offset, offset + length)
  let end = 0
  while (end < slice.length && slice[end] !== 0) {
    end += 1
  }
  if (end === 0) return ''
  return decoder.decode(slice.subarray(0, end)).replace(/\0+$/, '')
}

function parseOctal(view: Uint8Array, offset: number, length: number): number {
  let str = getString(view, offset, length)
  str = str.replace(/[^0-7]/g, '')
  if (!str) return 0
  return parseInt(str, 8)
}

function isZeroBlock(block: Uint8Array): boolean {
  for (let i = 0; i < block.length; i += 1) {
    if (block[i] !== 0) return false
  }
  return true
}

export function extractTar(buffer: ArrayBuffer): TarEntry[] {
  const bytes = new Uint8Array(buffer)
  const entries: TarEntry[] = []
  let offset = 0

  while (offset + BLOCK_SIZE <= bytes.length) {
    const header = bytes.subarray(offset, offset + BLOCK_SIZE)
    offset += BLOCK_SIZE

    if (isZeroBlock(header)) {
      break
    }

    const name = getString(header, 0, 100)
    if (!name) {
      continue
    }

    const size = parseOctal(header, 124, 12)
    const typeFlag = String.fromCharCode(header[156]) as TarTypeFlag
    const dataBlockSize = Math.ceil(size / BLOCK_SIZE) * BLOCK_SIZE
    const dataBytes = bytes.subarray(offset, offset + dataBlockSize)
    const fileData = dataBytes.subarray(0, size)

    if (typeFlag === TYPEFLAGS.NORMAL_FILE || typeFlag === TYPEFLAGS.NORMAL_FILE_ALT) {
      entries.push({
        name,
        size,
        type: 'file',
        data: fileData.slice().buffer,
      })
    } else if (typeFlag === TYPEFLAGS.DIRECTORY) {
      entries.push({
        name: name.endsWith('/') ? name : `${name}/`,
        size,
        type: 'directory',
        data: new ArrayBuffer(0),
      })
    }

    offset += dataBlockSize
  }

  return entries
}
