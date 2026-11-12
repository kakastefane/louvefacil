/**
 * Camada de serviço de setlists (T040): orquestra o repositório
 * read-through. Reordenação/duplicação são atômicas via RPC.
 */
export {
  listSetlists,
  getSetlist,
  createSetlist,
  updateSetlist,
  deleteSetlist,
  listItems,
  addItem,
  removeItem,
  setItemTranspose,
  reorderItems,
  duplicateSetlist,
} from '@/db/repos/setlists'
