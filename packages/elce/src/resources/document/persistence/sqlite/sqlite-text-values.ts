import type { RichTextDocument } from '../../rich-text-types'
import type { ElceTextValue } from '../../rich-text-types'

const SQLITE_RICH_TEXT_PREFIX = '__elce-rich-text-v1__:'

/** Decodes promoted Tiptap JSON while preserving ordinary authored text. */
export function decodeSqliteText(value: string): ElceTextValue {
  if (!value.startsWith(SQLITE_RICH_TEXT_PREFIX)) return value
  let parsed: unknown
  try {
    parsed = JSON.parse(value.slice(SQLITE_RICH_TEXT_PREFIX.length))
  } catch {
    throw new Error('Valeur Tiptap invalide en base.')
  }
  if (typeof parsed === 'string') return parsed
  if (typeof parsed === 'object' && parsed !== null && 'type' in parsed && parsed.type === 'doc'
    && 'content' in parsed && Array.isArray(parsed.content)) return parsed as RichTextDocument
  throw new Error('Valeur Tiptap invalide en base.')
}

/** Encodes rich authored text and keeps ordinary strings readable in SQLite. */
export function encodeSqliteText(value: ElceTextValue): string {
  if (typeof value === 'string') {
    return value.startsWith(SQLITE_RICH_TEXT_PREFIX)
      ? `${SQLITE_RICH_TEXT_PREFIX}${JSON.stringify(value)}`
      : value
  }
  return `${SQLITE_RICH_TEXT_PREFIX}${JSON.stringify(value)}`
}

/** Maps an empty optional authored string to SQLite NULL. */
export function encodeNullableSqliteText(value: ElceTextValue): string | null {
  return typeof value === 'string' && value.length === 0 ? null : encodeSqliteText(value)
}
