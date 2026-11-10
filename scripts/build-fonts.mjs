/**
 * Yazı tipi alt kümelerini üretir: `next/font/local` ile servis edilen üç woff2.
 *
 * Neden: `next/font/google` aileleri `latin` + `latin-ext` olarak indiriyor; Türkçe
 * için gereken altı harf (Ğ ğ İ ı Ş ş) yüzünden Inter'in latin-ext dosyası tek
 * başına 85 KB geliyordu. Üç aile toplamı 267 KB (ölçüldü) → ilk boya öncesi
 * baytların yarısı. Google Fonts'un `text=` parametresi tam istediğimiz harf
 * kümesini sunucu tarafında alt kümeleyip tek woff2 döndürüyor; üç dosya
 * 126 KB'a iniyor.
 *
 * Kullanım: `node scripts/build-fonts.mjs`
 * Çıktı dosyaları repoda tutulur (`src/app/(frontend)/fonts/`), çünkü build
 * sırasında ağa çıkmak istemiyoruz. Harf kümesi değişirse bu betiği çalıştırıp
 * dosyaları commit'leyin.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const OUT_DIR = path.join('src', 'app', '(frontend)', 'fonts')
// Google Fonts, woff2 sunabilen modern bir tarayıcı istiyor.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/** Gövde/arayüz metni: ASCII + Latin-1 + Türkçe harfler + tipografik işaretler. */
const BODY = [
  ...range(0x20, 0x7e), // ASCII
  ...range(0xa0, 0xff), // Latin-1: ° ± × µ ¼ ½ ¾ ve Türkçe Ç ç Ö ö Ü ü
  0x11e, 0x11f, 0x130, 0x131, 0x15e, 0x15f, // Ğ ğ İ ı Ş ş
  0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2026, 0x2039, 0x203a,
  0x20ac, 0x20ba, 0x2122, 0x2190, 0x2192, 0x2191, 0x2193, 0x2212, 0x2264, 0x2265,
  0x25cf, 0x2713, 0x2032, 0x2033, 0x2116, 0x2117, 0x2020, 0x2021, 0x2044, 0x2113,
]

/** Sergi (display) ailesi yalnız başlıklarda: ölçü/sayı sembolleri kısıtlı tutulur. */
const DISPLAY = [
  ...range(0x20, 0x7e),
  0xc0, 0xc2, 0xc7, 0xc9, 0xca, 0xce, 0xd4, 0xd6, 0xdb, 0xdc,
  0xe0, 0xe2, 0xe7, 0xe9, 0xea, 0xee, 0xf4, 0xf6, 0xfb, 0xfc,
  0x11e, 0x11f, 0x130, 0x131, 0x15e, 0x15f,
  // Başlıklarda geçebilen ölçü/sayı işaretleri: ° ± × ÷ µ ¼ ½ ¾ ² ³ ¹ ‰
  0xb0, 0xb1, 0xd7, 0xf7, 0xb5, 0xbc, 0xbd, 0xbe, 0xb2, 0xb3, 0xb9, 0x2030,
  0xb7, 0x2026, 0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2039, 0x203a, 0x2122, 0x20ba, 0x20ac,
]

function range(start, end) {
  const out = []
  for (let code = start; code <= end; code++) out.push(code)
  return out
}

const toText = (codepoints) => codepoints.map((code) => String.fromCodePoint(code)).join('')

const TARGETS = [
  { file: 'inter-variable.woff2', family: 'Inter:wght@100..900', text: toText(BODY) },
  // Mono yalnız 400–700 aralığında kullanılıyor; dar eksen dosyayı 10 KB küçültüyor.
  { file: 'jetbrains-mono-variable.woff2', family: 'JetBrains+Mono:wght@400..700', text: toText(BODY) },
  { file: 'special-elite.woff2', family: 'Special+Elite', text: toText(DISPLAY) },
]

async function fontUrl(family, text) {
  const url = `https://fonts.googleapis.com/css2?family=${family}&text=${encodeURIComponent(text)}&display=swap`
  const response = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!response.ok) throw new Error(`CSS ${response.status}: ${family}`)
  const css = await response.text()
  const match = css.match(/https:\/\/fonts\.gstatic\.com\/[^)]+/)
  if (!match) throw new Error(`woff2 adresi bulunamadı: ${family}`)
  return match[0]
}

await mkdir(OUT_DIR, { recursive: true })
let total = 0
for (const target of TARGETS) {
  const url = await fontUrl(target.family, target.text)
  const response = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!response.ok) throw new Error(`woff2 ${response.status}: ${target.family}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.subarray(0, 4).toString('latin1') !== 'wOF2') {
    throw new Error(`woff2 imzası yok: ${target.family}`)
  }
  await writeFile(path.join(OUT_DIR, target.file), bytes)
  total += bytes.byteLength
  console.log(`${target.file.padEnd(32)} ${(bytes.byteLength / 1024).toFixed(1)} KB`)
}
console.log(`toplam ${(total / 1024).toFixed(1)} KB`)
