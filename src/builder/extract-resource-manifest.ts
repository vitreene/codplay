import type { Perso, ResourceManifest, ResourceManifestEntry, SceneDef } from './types'

type ResourceType = ResourceManifestEntry['type']

const TYPE_BY_EXT: Record<string, ResourceType> = {
  '.mp4': 'video', '.webm': 'video', '.ogv': 'video',
  '.mp3': 'audio', '.wav': 'audio', '.ogg': 'audio', '.aac': 'audio',
  '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.webp': 'image',
  '.gif': 'image', '.svg': 'image', '.avif': 'image',
  '.woff': 'font', '.woff2': 'font', '.ttf': 'font', '.otf': 'font',
  '.css': 'css',
}

function inferType(url: string): ResourceType | null {
  const ext = url.includes('?') ? url.slice(0, url.indexOf('?')) : url
  const dot = ext.lastIndexOf('.')
  if (dot === -1) return null
  return TYPE_BY_EXT[ext.slice(dot).toLowerCase()] ?? null
}

function collectPersoSrcs(perso: Perso): string[] {
  const srcs: string[] = []
  if (typeof perso.initial?.src === 'string') {
    srcs.push(perso.initial.src)
  }
  for (const action of Object.values(perso.actions)) {
    if (action !== null && typeof action === 'object' && !Array.isArray(action)) {
      const src = (action as Record<string, unknown>).src
      if (typeof src === 'string') srcs.push(src)
    }
  }
  return srcs
}

export function extractResourceManifest(scene: SceneDef, existing?: ResourceManifest): ResourceManifest {
  const existingByUrl = new Map(existing?.entries.map((e) => [e.url, e]) ?? [])
  const collected = new Map<string, ResourceManifestEntry>()

  for (const story of Object.values(scene.stories)) {
    for (const perso of story.persos) {
      for (const src of collectPersoSrcs(perso)) {
        if (collected.has(src)) continue
        if (existingByUrl.has(src)) {
          collected.set(src, existingByUrl.get(src)!)
          continue
        }
        const type = inferType(src)
        if (type === null) continue
        collected.set(src, {
          url: src,
          type,
          policy: { cache: 'default', priority: 'normal' }
        })
      }
    }
  }

  return { entries: [...collected.values()] }
}
