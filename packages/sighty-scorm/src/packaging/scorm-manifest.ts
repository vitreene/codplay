import type { ScormVersion } from '../scorm-types'

/** Describes one launchable item for the internal SCORM manifest renderer. */
export interface ScormManifestSco {
  readonly id: string
  readonly identifier?: string
  readonly resourceIdentifier?: string
  readonly title: string
  readonly href: string | null
  readonly isVisible: boolean
  readonly dataFromLMS?: string | null
  readonly masteryScore?: number | null
}

/** Supplies manifest metadata without defining an Elcé or Sighty export format. */
export interface ScormManifestDefinition {
  readonly version: ScormVersion
  readonly title: string
  readonly withSummary: boolean
  readonly monoSco: boolean
  readonly allSco: readonly ScormManifestSco[]
  readonly manifestIdentifier?: string
  readonly organizationIdentifier?: string
  readonly createIdentifier?: () => string
}

interface XmlElement {
  readonly name: string
  readonly attributes?: Readonly<Record<string, string | number | boolean>>
  readonly text?: string
  readonly children?: readonly XmlElement[]
}

/** Renders a SCORM 1.2 or 2004 manifest with the reference generator's structure. */
export function buildScormManifest(definition: ScormManifestDefinition): string {
  const createIdentifier = definition.createIdentifier ?? (() => crypto.randomUUID())
  const identifier = (prefix: string): string => `${prefix}-${createIdentifier()}`
  const manifestIdentifier = definition.manifestIdentifier ?? identifier('MANIFEST')
  const organizationIdentifier = definition.organizationIdentifier ?? identifier('ORG')
  const items = definition.allSco
    .map((sco) => ({
      sco,
      identifier: sco.identifier ?? identifier('ITEM'),
      resourceIdentifier: sco.resourceIdentifier ?? identifier('RES'),
    }))
    .filter(({ sco }) => sco.href !== null)
  const isScorm12 = definition.version === '1.2'
  const schemaVersion = definition.version === '2004v3'
    ? '2004 3rd Edition'
    : definition.version === '2004v4'
      ? '2004 4th Edition'
      : '1.2'
  const rootAttributes: Readonly<Record<string, string | number | boolean>> = isScorm12
    ? {
        identifier: manifestIdentifier,
        'xmlns:adlcp': 'http://www.adlnet.org/xsd/adlcp_rootv1p2',
        xmlns: 'http://www.imsproject.org/xsd/imscp_rootv1p1p2',
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        'xsi:schemaLocation': 'http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd',
      }
    : {
        identifier: manifestIdentifier,
        'xmlns:lom': 'http://ltsc.ieee.org/xsd/LOM',
        'xmlns:adlnav': 'http://www.adlnet.org/xsd/adlnav_v1p3',
        xmlns: 'http://www.imsglobal.org/xsd/imscp_v1p1',
        'xmlns:adlseq': 'http://www.adlnet.org/xsd/adlseq_v1p3',
        'xmlns:imsss': 'http://www.imsglobal.org/xsd/imsss',
        'xmlns:adlcp': 'http://www.adlnet.org/xsd/adlcp_v1p3',
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        'xsi:schemaLocation': 'http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd http://ltsc.ieee.org/xsd/LOM lom.xsd http://www.adlnet.org/xsd/adlcp_v1p3 adlcp_v1p3.xsd http://www.adlnet.org/xsd/adlseq_v1p3 adlseq_v1p3.xsd http://www.adlnet.org/xsd/adlnav_v1p3 adlnav_v1p3.xsd http://www.imsglobal.org/xsd/imsss imsss_v1p0.xsd',
        version: '1.3',
      }

  const organizationAttributes: Readonly<Record<string, string | number | boolean>> = isScorm12
    ? { identifier: organizationIdentifier, structure: 'hierarchical' }
    : { identifier: organizationIdentifier }
  const organizationItems = items.map(({ sco, identifier: itemIdentifier, resourceIdentifier }) => {
    const itemChildren: XmlElement[] = [
      element('title', {}, sco.title),
      element(isScorm12 ? 'adlcp:datafromlms' : 'adlcp:dataFromLMS', {}, sco.dataFromLMS ?? ''),
    ]
    if (isScorm12) {
      itemChildren.push(element('adlcp:masteryscore', {}, sco.masteryScore == null ? '' : String(sco.masteryScore)))
    } else {
      const sequencing = buildSequencingElement(definition, sco)
      if (sequencing !== undefined) itemChildren.push(sequencing)
    }
    return element('item', {
      identifier: itemIdentifier,
      identifierref: resourceIdentifier,
      isvisible: sco.isVisible,
    }, undefined, itemChildren)
  })
  const resources = items.map(({ sco, resourceIdentifier }) => element('resource', {
    identifier: resourceIdentifier,
    type: 'webcontent',
    href: sco.href!,
    [isScorm12 ? 'adlcp:scormtype' : 'adlcp:scormType']: 'sco',
  }, undefined, [element('file', { href: sco.href! })]))

  const manifest = element('manifest', rootAttributes, undefined, [
    element('metadata', {}, undefined, [
      element('schema', {}, 'ADL SCORM'),
      element('schemaversion', {}, schemaVersion),
    ]),
    element('organizations', { default: organizationIdentifier }, undefined, [
      element('organization', organizationAttributes, undefined, [
        element('title', {}, definition.title),
        ...organizationItems,
      ]),
    ]),
    element('resources', {}, undefined, resources),
  ])

  return `<?xml version="1.0" encoding="UTF-8"?>\n${renderElement(manifest, 0)}\n`
}

/** Builds the source-equivalent sequencing metadata for one 2004 SCO. */
function buildSequencingElement(
  definition: ScormManifestDefinition,
  sco: ScormManifestSco,
): XmlElement | undefined {
  if (!definition.withSummary && !sco.masteryScore) return undefined

  const isSummary = sco.id === 'summary'
  const objectiveId = definition.withSummary ? `obj_${sco.id}` : 'primary_obj'
  const primaryObjectiveChildren = sco.masteryScore
    ? [element('imsss:minNormalizedMeasure', {}, String(sco.masteryScore / 100))]
    : []
  if (definition.withSummary && !isSummary) {
    primaryObjectiveChildren.push(element('imsss:mapInfo', {
      targetObjectiveID: `map_obj_${sco.id}`,
      readSatisfiedStatus: 'true',
      readNormalizedMeasure: 'true',
      writeSatisfiedStatus: 'true',
      writeNormalizedMeasure: 'true',
    }))
  }

  const objectives: XmlElement[] = [element('imsss:primaryObjective', {
    objectiveID: objectiveId,
    satisfiedByMeasure: sco.masteryScore ? 'true' : 'false',
  }, undefined, primaryObjectiveChildren)]
  if (definition.withSummary && isSummary) {
    for (const chapterSco of definition.allSco.filter((item) => item.id !== 'summary')) {
      const chapterObjectiveChildren: XmlElement[] = []
      if (chapterSco.masteryScore != null) {
        chapterObjectiveChildren.push(element('imsss:minNormalizedMeasure', {}, String(chapterSco.masteryScore / 100)))
      }
      if (!definition.monoSco) {
        chapterObjectiveChildren.push(element('imsss:mapInfo', {
          targetObjectiveID: `map_obj_${chapterSco.id}`,
          readSatisfiedStatus: 'true',
          readNormalizedMeasure: 'true',
          writeSatisfiedStatus: 'false',
          writeNormalizedMeasure: 'false',
        }))
      }
      objectives.push(element('imsss:objective', {
        objectiveID: `obj_${chapterSco.id}`,
        satisfiedByMeasure: chapterSco.masteryScore ? 'true' : 'false',
      }, undefined, chapterObjectiveChildren))
    }
  }

  const sequencingChildren = [element('imsss:objectives', {}, undefined, objectives)]
  if (definition.withSummary && !definition.monoSco && definition.version === '2004v4') {
    const mappedSco = isSummary
      ? definition.allSco.filter((item) => item.id !== 'summary')
      : [sco]
    sequencingChildren.push(element('adlseq:objectives', {}, undefined, mappedSco.map((mapped) => {
      const isReadOnly = isSummary
      return element('adlseq:objective', { objectiveID: `obj_${mapped.id}` }, undefined, [
        element('adlseq:mapInfo', {
          targetObjectiveID: `map_obj_${mapped.id}`,
          readRawScore: 'true',
          readMinScore: 'true',
          readMaxScore: 'true',
          readCompletionStatus: 'true',
          readProgressMeasure: 'true',
          writeRawScore: String(!isReadOnly),
          writeMinScore: String(!isReadOnly),
          writeMaxScore: String(!isReadOnly),
          writeCompletionStatus: String(!isReadOnly),
          writeProgressMeasure: String(!isReadOnly),
        }),
      ])
    })))
  }

  return element('imsss:sequencing', {}, undefined, sequencingChildren)
}

/** Creates one immutable XML element node for the manifest renderer. */
function element(
  name: string,
  attributes: XmlElement['attributes'] = {},
  text?: string,
  children?: readonly XmlElement[],
): XmlElement {
  return { name, attributes, ...(text === undefined ? {} : { text }), ...(children === undefined ? {} : { children }) }
}

/** Serializes a manifest node with deterministic indentation and escaped XML values. */
function renderElement(node: XmlElement, depth: number): string {
  const indentation = '  '.repeat(depth)
  const attributes = Object.entries(node.attributes ?? {})
    .map(([name, value]) => ` ${name}="${escapeXmlAttribute(String(value))}"`)
    .join('')
  const children = node.children ?? []
  if (children.length === 0 && (node.text === undefined || node.text.length === 0)) return `${indentation}<${node.name}${attributes}/>`
  if (children.length === 0) return `${indentation}<${node.name}${attributes}>${escapeXmlText(node.text ?? '')}</${node.name}>`
  const content = children.map((child) => renderElement(child, depth + 1)).join('\n')
  return `${indentation}<${node.name}${attributes}>\n${content}\n${indentation}</${node.name}>`
}

/** Escapes XML text content while retaining ordinary Unicode characters. */
function escapeXmlText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

/** Escapes XML attribute values, including quote characters. */
function escapeXmlAttribute(value: string): string {
  return escapeXmlText(value).replaceAll('"', '&quot;').replaceAll("'", '&apos;')
}
