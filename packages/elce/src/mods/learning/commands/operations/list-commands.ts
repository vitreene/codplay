import { BDC_TYPE } from '../../learning-definition'
import { LearningDocument } from '../../document/learning-document'
import type { LearningDocumentCommand } from '../learning-document-command-types'
import { findBdc } from '../../../../core/document/content-placement-service'
import { ListService } from '../../../../resources/list/domain/list-service'
import { LIST_PRESET_ID } from '../../../../resources/list/list-config'
import { CARD_PRESET_ID } from '../../../../resources/bdcs/card/card-config'
import type { RichTextNode } from '../../../../core/document/rich-text-types'
import { fail } from './command-helpers'
import type { LearningCommandResourceServices } from '../learning-command-resource-services'

const listService: ListService = new ListService()

/** Creates a List BDC and updates its owning rich-text field in one document command. */
export function insertListBdc(
  document: LearningDocument,
  command: Extract<LearningDocumentCommand, { type: 'bdc.list.insert' }>,
  resources: LearningCommandResourceServices,
): LearningDocument {
  if (document.bdcs.some((bdc) => bdc.id === command.bdcId)) fail(`BDC déjà présent : ${command.bdcId}`)
  listService.assertValid(command.list)
  if (countListReferences(command.content, command.bdcId) !== 1) {
    fail(`La référence au BDC Liste ${command.bdcId} doit apparaître une seule fois dans son champ.`)
  }
  const owner = findBdc(document.bdcs, command.ownerBdcId)
  const updatedOwner = (() => {
    if (owner.type === BDC_TYPE.CARD && owner.card != null) {
      if (owner.presetId !== CARD_PRESET_ID.TEXT_SHORT && owner.presetId !== CARD_PRESET_ID.TEXT_IMAGE) {
        fail('Une Liste en flux ne peut être insérée que dans le message d’une Carte texte.')
      }
      const card = { ...owner.card, message: command.content }
      resources.cardService.assertValid(card)
      return { ...owner, card }
    }
    if (owner.type === BDC_TYPE.SECTION && owner.section != null && command.markup !== undefined) {
      return { ...owner, section: { ...owner.section, content: command.content, markup: command.markup } }
    }
    fail('Une Liste en flux doit appartenir au message d’une Carte texte ou au contenu d’une Section.')
  })()
  const listBdc = {
    id: command.bdcId,
    type: BDC_TYPE.LIST,
    presetId: LIST_PRESET_ID,
    pageId: null,
    parentBdcId: owner.id,
    section: null,
    question: null,
    evaluationResult: null,
    carousel: null,
    card: null,
    statisticalGraph: null,
    list: command.list,
  } as const
  return new LearningDocument({
    ...document.data,
    bdcs: [...document.bdcs.map((bdc) => bdc.id === owner.id ? updatedOwner : bdc), listBdc],
  })
}

/** Updates the List payload while retaining its reference and parent identity. */
export function updateListBdc(
  document: LearningDocument,
  command: Extract<LearningDocumentCommand, { type: 'bdc.list.update' }>,
): LearningDocument {
  const bdc = findBdc(document.bdcs, command.bdcId)
  if (bdc.type !== BDC_TYPE.LIST || bdc.list == null) fail(`Le BDC ${command.bdcId} n’est pas une Liste.`)
  listService.assertValid(command.list)
  return new LearningDocument({
    ...document.data,
    bdcs: document.bdcs.map((candidate) => candidate.id === bdc.id ? { ...bdc, list: command.list } : candidate),
  })
}

/** Counts exact list reference nodes throughout one rich-text document. */
function countListReferences(nodes: readonly RichTextNode[] | { readonly content: readonly RichTextNode[] }, bdcId: string): number {
  const children = 'content' in nodes ? nodes.content : nodes
  return children.reduce((count, node) => count
    + (node.type === 'listBdc' && node.attrs?.bdcId === bdcId ? 1 : 0)
    + (node.content === undefined ? 0 : countListReferences(node.content, bdcId)), 0)
}
