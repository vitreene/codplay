import { createHash } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

/** Copies compiled CSS dependencies and writes one relocated stylesheet into the staged package. */
export async function packageStyleSheet({ compiledStyleSheet, stageDirectory }) {
  if (compiledStyleSheet === undefined || compiledStyleSheet.cssText.trim() === '') return undefined
  const assetDirectory = path.join(stageDirectory, 'scene', 'assets')
  await mkdir(assetDirectory, { recursive: true })
  const packagedResources = new Map()
  const fontFaces = compiledStyleSheet.fontFaces.map((fontFace) => ({ ...fontFace }))
  let cssText = compiledStyleSheet.cssText

  for (const resource of compiledStyleSheet.resources) {
    const bytes = await readFile(resource.sourcePath)
    const extension = path.extname(resource.sourcePath).toLowerCase()
    const digest = createHash('sha256').update(resource.sourcePath).digest('hex').slice(0, 20)
    const fileName = `${digest}${extension}`
    const absoluteFile = path.join(assetDirectory, fileName)
    const existing = await access(absoluteFile).then(() => true, () => false)
    if (existing) {
      const existingBytes = await readFile(absoluteFile)
      if (!existingBytes.equals(bytes)) throw new Error(`CSS package asset collides with a different file: ${fileName}`)
    } else {
      await writeFile(absoluteFile, bytes, { flag: 'wx' })
    }

    const suffix = resource.suffix ?? ''
    const sceneUrl = `assets/${fileName}${suffix}`
    const tokenUrl = `url(${JSON.stringify(resource.token)})`
    const replacementUrl = `url(${JSON.stringify(sceneUrl)})`
    if (!cssText.includes(tokenUrl)) {
      throw new Error(`Compiled CSS resource token is missing from its stylesheet: ${resource.token}`)
    }
    cssText = cssText.replaceAll(tokenUrl, replacementUrl)
    for (const fontFace of fontFaces) fontFace.src = fontFace.src.replaceAll(tokenUrl, replacementUrl)
    const existingResource = packagedResources.get(sceneUrl)
    if (existingResource !== undefined && existingResource.type !== resource.type) {
      throw new Error(`CSS asset has conflicting resource types: ${sceneUrl}`)
    }
    if (existingResource === undefined) {
      packagedResources.set(sceneUrl, {
        tokens: [resource.token],
        sceneUrl,
        file: `scene/assets/${fileName}`,
        suffix,
        type: resource.type,
      })
    } else {
      existingResource.tokens.push(resource.token)
    }
  }

  await writeFile(path.join(stageDirectory, 'scene/style.css'), cssText)
  if (fontFaces.some((fontFace) => /url\(["']?codplay-resource-\d+/i.test(fontFace.src))) {
    throw new Error('Compiled CSS font face retains an unresolved resource token.')
  }
  return {
    file: 'scene/style.css',
    classNames: compiledStyleSheet.classNames,
    resources: [...packagedResources.values()],
    fontFaces,
  }
}
