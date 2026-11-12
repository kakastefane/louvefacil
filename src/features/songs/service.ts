/**
 * Camada de serviço de cifras (T030): orquestra o repositório read-through.
 * `content` é a fonte única da verdade — nada aqui altera o texto-fonte.
 */
export {
  listSongs,
  getSong,
  createSong,
  updateSong,
  deleteSong,
} from '@/db/repos/songs'
