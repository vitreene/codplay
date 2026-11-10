import type { ListContent, ListPrefix, ListRow } from './list-types'

/** Owns List defaults, immutable row operations and module invariants. */
export class ListService {
  /** Creates the default one-row List configuration. */
  public createDefault(rowId: string): ListContent {
    return {
      rows: [{ id: rowId, text: '', delayMs: null }],
      prefix: 'disc',
      intervalMs: 0,
      start: 1,
      customMarker: '•',
    }
  }

  /** Changes a List-wide presentation value without altering rows. */
  public setPresentation(list: ListContent, values: Partial<Pick<ListContent, 'prefix' | 'intervalMs' | 'start' | 'customMarker'>>): ListContent {
    return { ...list, ...values }
  }

  /** Changes one row's plain text without changing its identity or order. */
  public setRowText(list: ListContent, rowId: string, text: string): ListContent {
    return { ...list, rows: list.rows.map((row) => row.id === rowId ? { ...row, text } : row) }
  }

  /** Sets or clears a row's delay override. */
  public setRowDelay(list: ListContent, rowId: string, delayMs: number | null): ListContent {
    return { ...list, rows: list.rows.map((row) => row.id === rowId ? { ...row, delayMs } : row) }
  }

  /** Inserts an empty row after the requested row, or appends when no row is supplied. */
  public addRow(list: ListContent, rowId: string, afterRowId?: string): ListContent {
    const afterIndex = afterRowId === undefined ? -1 : list.rows.findIndex((row) => row.id === afterRowId)
    const index = afterRowId === undefined || afterIndex < 0 ? list.rows.length : afterIndex + 1
    return { ...list, rows: [...list.rows.slice(0, index), { id: rowId, text: '', delayMs: null }, ...list.rows.slice(index)] }
  }

  /** Removes a row while retaining the identity and order of every neighbor. */
  public removeRow(list: ListContent, rowId: string): ListContent {
    return { ...list, rows: list.rows.filter((row) => row.id !== rowId) }
  }

  /** Moves one row before the row at the requested index. */
  public moveRow(list: ListContent, rowId: string, index: number): ListContent {
    const sourceIndex = list.rows.findIndex((row) => row.id === rowId)
    if (sourceIndex < 0) return list
    const rows = [...list.rows]
    const [row] = rows.splice(sourceIndex, 1)
    if (row === undefined) return list
    rows.splice(Math.max(0, Math.min(index, rows.length)), 0, row)
    return { ...list, rows }
  }

  /** Replaces one row with pasted values and keeps the target ID on the first value. */
  public replaceRowText(list: ListContent, rowId: string, texts: readonly string[], createId: () => string): ListContent {
    const index = list.rows.findIndex((row) => row.id === rowId)
    if (index < 0 || texts.length === 0) return list
    const target = list.rows[index]
    if (target === undefined) return list
    const replacement = texts.map((text, itemIndex): ListRow => ({
      id: itemIndex === 0 ? target.id : createId(),
      text,
      delayMs: null,
    }))
    return { ...list, rows: [...list.rows.slice(0, index), ...replacement, ...list.rows.slice(index + 1)] }
  }

  /** Validates List values before they cross the owning document boundary. */
  public assertValid(value: unknown): asserts value is ListContent {
    const prefixes: readonly ListPrefix[] = ['none', 'disc', 'square', 'dash', 'lower-alpha', 'decimal', 'lower-roman', 'custom']
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Objet Liste attendu.')
    const list = value as Record<string, unknown>
    if (typeof list.prefix !== 'string' || !prefixes.includes(list.prefix as ListPrefix)) throw new Error(`Préfixe de Liste inconnu : ${String(list.prefix)}`)
    if (typeof list.intervalMs !== 'number' || !Number.isFinite(list.intervalMs) || list.intervalMs < 0) {
      throw new Error('L’intervalle de Liste doit être positif ou nul.')
    }
    if (typeof list.start !== 'number' || !Number.isInteger(list.start) || list.start < 1) {
      throw new Error('Le début de numérotation doit être un entier positif.')
    }
    if (typeof list.customMarker !== 'string') throw new Error('Le marqueur personnalisé doit être du texte.')
    if (!Array.isArray(list.rows) || list.rows.some((row) => {
      if (typeof row !== 'object' || row === null || Array.isArray(row)) return true
      const candidate = row as Record<string, unknown>
      const validDelay = candidate.delayMs === null || typeof candidate.delayMs === 'number'
        && Number.isFinite(candidate.delayMs) && candidate.delayMs >= 0
      return typeof candidate.id !== 'string' || candidate.id.length === 0
        || typeof candidate.text !== 'string' || !validDelay
    })) {
      throw new Error('Une ligne de Liste possède un identifiant ou un délai invalide.')
    }
    const rows = list.rows as readonly ListRow[]
    if (new Set(rows.map((row) => row.id)).size !== rows.length) throw new Error('Les identifiants des lignes de Liste doivent être uniques.')
    if (list.prefix === 'custom' && graphemes(list.customMarker).length !== 1) {
      throw new Error('Le marqueur personnalisé doit contenir un seul caractère.')
    }
  }
}

/** Splits text into user-perceived characters for custom marker validation. */
function graphemes(value: string): readonly string[] {
  if (typeof Intl.Segmenter === 'function') return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value), (part) => part.segment)
  return Array.from(value)
}
