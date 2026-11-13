import { sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'

const minimumPayloadBytes = 512 * 1024
const minimumChunkLength = 128
const maximumChunkLength = 4096

export function snapshotPayloadForInsert(payload: string): string | SQL<string> {
  const originalBytes = Buffer.byteLength(payload)
  if (originalBytes < minimumPayloadBytes) return payload

  // Anchor chunks to line content so repeated parts of the journal share boundaries.
  const dictionary: string[] = []
  const positions: number[] = []
  const indexes = new Map<string, number>()
  let chunkStart = 0
  let lineHash = 2166136261

  function addChunk(end: number) {
    const chunk = payload.slice(chunkStart, end)
    let index = indexes.get(chunk)
    if (index === undefined) {
      dictionary.push(chunk)
      index = dictionary.length // PostgreSQL arrays are one-based.
      indexes.set(chunk, index)
    }
    positions.push(index)
    chunkStart = end
  }

  for (let offset = 0; offset < payload.length; offset++) {
    const character = payload.charCodeAt(offset)
    if (character !== 10) {
      lineHash = Math.imul(lineHash ^ character, 16777619)
      continue
    }
    const length = offset + 1 - chunkStart
    if (length >= maximumChunkLength || (length >= minimumChunkLength && (lineHash & 15) === 0)) {
      addChunk(offset + 1)
    }
    lineHash = 2166136261
  }
  if (chunkStart < payload.length) addChunk(payload.length)

  // A node-postgres text[] literal adds quotes, separators and escapes, just like JSON here.
  const dictionaryBytes = Buffer.byteLength(JSON.stringify(dictionary))
  const template = positions.map(position => '%' + position + '$s').join('')
  if (dictionaryBytes + Buffer.byteLength(template) >= originalBytes) return payload

  // Reassemble the original text before the existing column constraints run.
  return sql<string>`format(${template}::text, VARIADIC ${sql.param(dictionary)}::text[])`
}
