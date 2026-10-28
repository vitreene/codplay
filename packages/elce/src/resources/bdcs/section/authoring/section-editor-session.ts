import type { SectionContent } from '../domain/section-types'
import type { SectionSelection } from './section-selection-types'
import type { SectionTiptapAdapter } from './section-editor-tiptap-adapter'
import type { SectionToolbarState } from './section-editor-tiptap'

/** Owns Section editor instances and history selections for one Remix page editor. */
export class SectionEditorSession {
  public readonly adapters = new Map<string, SectionTiptapAdapter>()
  public readonly toolbarStates = new Map<string, SectionToolbarState>()

  /** Registers a mounted Section editor and replaces any prior adapter for its BDC. */
  public register(bdcId: string, adapter: SectionTiptapAdapter): void {
    const previous = this.adapters.get(bdcId)
    if (previous !== undefined && previous !== adapter) previous.destroy()
    this.adapters.set(bdcId, adapter)
  }

  /** Updates mounted Section NodeViews from the latest accepted document value. */
  public updateSection(bdcId: string, section: SectionContent): void {
    this.adapters.get(bdcId)?.updateSection(section)
  }

  /** Restores the history selection after its matching editor has rendered. */
  public restoreSelection(selection: SectionSelection): void {
    this.adapters.get(selection.sectionBdcId)?.restoreSelection(selection)
  }

  /** Removes and destroys one exact adapter when its Remix host unmounts. */
  public unregister(bdcId: string, adapter: SectionTiptapAdapter): void {
    if (this.adapters.get(bdcId) !== adapter) return
    this.adapters.delete(bdcId)
    this.toolbarStates.delete(bdcId)
    adapter.destroy()
  }

  /** Destroys every active Section editor when the containing page editor closes. */
  public destroy(): void {
    for (const adapter of this.adapters.values()) adapter.destroy()
    this.adapters.clear()
    this.toolbarStates.clear()
  }
}
