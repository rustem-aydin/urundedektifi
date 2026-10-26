import fs from 'fs'
import readline from 'node:readline'
import zlib from 'node:zlib'

/**
 * Open Food Facts resmî dökümünü (jsonl.gz, ~13 GB / 4,8 M ürün) Türkiye
 * ürünlerine indirger. Satırlar JSON'a çevrilmeden önce `en:turkey` etiketiyle
 * süzülür; 11,5 bin kayıt birkaç saniyede ayrılır.
 *
 * Kullanım:
 *   node --import tsx/esm scripts/off-dump-filter.ts <kaynak.jsonl.gz> <hedef.jsonl>
 */

const [, , source, target] = process.argv

if (!source || !target) {
  console.error('Kullanım: off-dump-filter.ts <kaynak.jsonl.gz> <hedef.jsonl>')
  process.exit(1)
}

const COUNTRY_TAG = '"en:turkey"'

async function main(): Promise<void> {
  const output = fs.createWriteStream(target)
  const lines = readline.createInterface({
    input: fs.createReadStream(source).pipe(zlib.createGunzip()),
    crlfDelay: Infinity,
  })

  let scanned = 0
  let kept = 0

  for await (const line of lines) {
    scanned++
    if (!line.includes(COUNTRY_TAG)) continue
    output.write(line)
    output.write('\n')
    kept++
    if (kept % 1000 === 0) console.log(`  ${kept} Türkiye kaydı (${scanned} satır tarandı)`)
  }

  output.end()
  await new Promise<void>((resolve, reject) => {
    output.on('finish', () => resolve())
    output.on('error', reject)
  })
  console.log(`Tamamlandı: ${scanned} satır tarandı, ${kept} Türkiye ürünü ${target} dosyasına yazıldı.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
