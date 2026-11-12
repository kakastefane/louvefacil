/**
 * Gera os ícones PNG do PWA a partir do SVG mestre (public/icons/icon.svg).
 * Uso: npm run icons   (requer devDependency `sharp`)
 * Saída em public/icons/: icon-192.png, icon-512.png, icon-maskable-192.png,
 * icon-maskable-512.png, apple-touch-icon.png (180).
 */
import { mkdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import sharp from 'sharp'

const root = fileURLToPath(new URL('..', import.meta.url))
const iconsDir = path.join(root, 'public', 'icons')
const master = path.join(iconsDir, 'icon.svg')

const MASKABLE_BG = '#4338ca' // fundo sólido para a zona segura maskable

/** Extrai os paths do símbolo (branco) do SVG mestre. */
function innerSymbol(svgText) {
  const matches = [...svgText.matchAll(/<g fill="#ffffff">([\s\S]*?)<\/g>/g)]
  const parts = matches.map((m) => m[1]).join('\n')
  if (parts.trim() === '') {
    throw new Error('SVG mestre sem símbolo reconhecível')
  }
  return parts
}

async function generate() {
  await mkdir(iconsDir, { recursive: true })
  const svgText = await readFile(master, 'utf8')

  // ícones "any": SVG inteiro com cantos arredondados próprios
  await sharp(master, { density: 300 })
    .resize(192, 192)
    .png()
    .toFile(path.join(iconsDir, 'icon-192.png'))

  await sharp(master, { density: 300 })
    .resize(512, 512)
    .png()
    .toFile(path.join(iconsDir, 'icon-512.png'))

  // maskable / apple-touch: símbolo em 62% (zona segura) sobre fundo sólido
  const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${MASKABLE_BG}"/>
  <g transform="translate(256 256) scale(0.62) translate(-256 -256)">
    ${innerSymbol(svgText)}
  </g>
</svg>`

  for (const size of [192, 512]) {
    await sharp(Buffer.from(maskableSvg), { density: 300 })
      .resize(size, size)
      .png()
      .toFile(path.join(iconsDir, `icon-maskable-${size}.png`))
  }

  await sharp(Buffer.from(maskableSvg), { density: 300 })
    .resize(180, 180)
    .png()
    .toFile(path.join(iconsDir, 'apple-touch-icon.png'))

  console.log('Ícones gerados em public/icons/')
}

generate().catch((error) => {
  console.error('Falha ao gerar ícones:', error)
  process.exit(1)
})
