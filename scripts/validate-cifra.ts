/**
 * Validador de cifras para importação automática (skill cifras-chordpro).
 *
 * Uso:
 *   npx vite-node scripts/validate-cifra.ts caminho/para/cifra.json
 *
 * O JSON deve seguir o contrato da skill:
 *   { title, artist, original_key, bpm, time_signature, themes, content }
 *
 * Exit code: 0 = sem erros (avisos podem existir), 1 = erros, 2 = uso/IO.
 *
 * A validação em si fica em `src/features/songs/validation.ts` e é a mesma
 * usada pelo botão **Importar JSON** do app — assim o relatório da tela e o
 * deste script nunca divergem.
 */
import { readFileSync } from 'node:fs'

import { validateCifra } from '@/features/songs/validation'

function main(): void {
  const file = process.argv[2]
  if (!file) {
    console.error('Uso: npx vite-node scripts/validate-cifra.ts <cifra.json>')
    process.exit(2)
  }

  let json: unknown
  try {
    // BOM (arquivos salvos no Windows) quebra o JSON.parse
    json = JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
  } catch (cause) {
    console.error(`Não foi possível ler/interpretar "${file}": ${String(cause)}`)
    process.exit(2)
  }

  const report = validateCifra(json)
  const title =
    typeof (json as { title?: unknown }).title === 'string' &&
    (json as { title: string }).title.trim()
      ? (json as { title: string }).title.trim()
      : '(sem título)'

  console.log(`\nCifra: ${title}`)

  for (const message of report.warnings) console.log(`  AVISO  ${message}`)
  for (const message of report.errors) console.log(`  ERRO   ${message}`)

  if (report.preview) {
    const { sections, lyricLines, chordLines, inlineChords } = report.summary
    console.log(
      `\nResumo: ${sections} seção(ões), ${lyricLines} linha(s) de letra, ${chordLines} linha(s) só de acordes, ${inlineChords} acorde(s) inline.`,
    )
    console.log('\n--- Prévia (acordes acima da letra) ---\n')
    console.log(report.preview)
  }

  console.log('')
  if (report.errors.length > 0) {
    console.log(
      `Resultado: ${report.errors.length} erro(s), ${report.warnings.length} aviso(s).`,
    )
    process.exit(1)
  }
  console.log(
    `Resultado: OK${report.warnings.length > 0 ? ` (${report.warnings.length} aviso(s))` : ''}.`,
  )
}

main()
