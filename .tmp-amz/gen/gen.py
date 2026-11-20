# -*- coding: utf-8 -*-
import json, os, shutil, sys
from pathlib import Path

sys.path.insert(0, "gen")
from data_a import PRODUCTS_A
from data_b import PRODUCTS_B
from data_c import PRODUCTS_C
from data_d import PRODUCTS_D

PRODUCTS = PRODUCTS_A + PRODUCTS_B + PRODUCTS_C + PRODUCTS_D

BRANDS = {
    "lipton": 'id: 152, name: "Lipton", slug: "lipton"',
    "ahmad": 'id: 2086, name: "Ahmad Tea", slug: "ahmad-tea"',
    "caykur": 'id: 162, name: "Çaykur", slug: "caykur"',
    "beta": 'id: 1873, name: "Beta Tea", slug: "beta-tea"',
    "dogadan": 'id: 198, name: "Doğadan", slug: "dogadan-1289"',
    "greenlife": 'id: 1762, name: "Greenlife", slug: "greenlife"',
    "teekanne": 'name: "Teekanne", slug: "teekanne", country: "Almanya"',
    "mimandmore": 'name: "Mim and More", slug: "mim-and-more", country: "Türkiye"',
}

NUTRIENTS = {
    "energyKj": 1, "energyKcal": 2, "fat": 4, "saturatedFat": 5,
    "carbohydrate": 7, "sugars": 8, "fiber": 18, "protein": 19, "salt": 20,
}

IMG_SRC = Path("img")
IMG_OUT = Path("../.seed-images")


def esc(s):
    return (
        s.replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("\r", "")
        .replace("\n", "\\n")
    )


FALLBACK = {'lipton': 'Ekaterra Gıda Satış ve Pazarlama A.Ş.', 'ahmad': 'Ahmad Tea', 'caykur': 'Çaykur (Çay İşletmeleri Genel Müdürlüğü)', 'beta': 'BETA GIDA SANAYİ VE TİCARET A.Ş.', 'dogadan': 'Doğadan Gıda Ürünleri San. ve Paz. A.Ş.', 'greenlife': 'Noor Asia Gıda San. ve Tic. A.Ş.', 'teekanne': 'FERSAN Fermantasyon Ürünleri San. ve Tic. A.Ş.', 'mimandmore': 'Mim and More'}


def manufacturer_of(p):
    if p.get("manufacturer"):
        return p["manufacturer"]
    for k, v in p["specs"]:
        if k == "Üretici":
            return v
    return FALLBACK.get(p["brand"], "")


def copy_media(p):
    d = IMG_OUT / p["slug"]
    d.mkdir(parents=True, exist_ok=True)
    media = []
    picks = [("front", p["front"], "Ön yüz")]
    for n, (idx, caption) in enumerate(p.get("extras", []), start=1):
        picks.append((f"ek{n}", idx, caption))
    out = []
    for key, idx, caption in picks:
        src = IMG_SRC / f"{p['asin']}-{idx}.jpg"
        if not src.exists():
            print("MISSING IMAGE", src)
            continue
        dest_name = f"{p['slug']}-{key}.jpg"
        dest = d / dest_name
        shutil.copyfile(src, dest)
        out.append((key, dest_name, f"{p['name']} — {caption}"))
    return out


def emit_products():
    lines = []
    for p in PRODUCTS:
        media = copy_media(p)
        items = []
        for slug, name, iid in p["items"]:
            if iid:
                items.append(f'      {{ id: {iid}, name: "{esc(name)}" }},')
            else:
                items.append(f'      {{ name: "{esc(name)}", slug: "{slug}" }},')
        specs = "\n".join(
            f'      {{ key: "{esc(k)}", value: "{esc(v)}" }},' for k, v in p["specs"]
        )
        warn = p.get("warnings") or []
        warn_txt = "\n".join(
            f'      {{ severity: "{sev}", text: "{esc(t)}" }},' for sev, t in warn
        )
        media_lines = "\n".join(
            f'      {{ key: "{k}", file: "{f}", alt: "{esc(alt)}" }},' for k, f, alt in media
        )
        extras = p.get("extras", [])
        extra_refs = []
        for n, (idx, caption) in enumerate(extras, start=1):
            key = f"ek{n}"
            if any(k == key for k, _, _ in media):
                extra_refs.append(f'      {{ key: "{key}", caption: "{esc(caption)}" }},')
        nut = p.get("nutrition")
        nut_ts = "undefined"
        if nut:
            rows = []
            for label, amount, unit in nut["items"]:
                rows.append(
                    f'          {{ nutrient: {NUTRIENTS[label]}, amount: {amount}, unit: "{unit}" }},'
                )
            nut_ts = "{\n        per: \"" + nut["per"] + "\" as const,\n        items: [\n" + "\n".join(rows) + "\n        ],\n      }"

        lines.append(f'''  {{
    asin: "{p['asin']}",
    barcode: "{p['barcode']}",
    name: "{esc(p['name'])}",
    slug: "{p['slug']}",
    size: "{esc(p['size'])}",
    packaging: "{esc(p['packaging'])}",
    price: {p['price']},
    description: "{esc(p['desc'])}",
    brand: {{ {BRANDS[p['brand']]} }},
    manufacturer: "{esc(manufacturer_of(p))}",
    items: [
{chr(10).join(items)}
    ],
    labels: {json.dumps(p.get('labels', []), ensure_ascii=False)},
    storage: "{esc(p.get('storage', ''))}",
    usage: "{esc(p.get('usage', ''))}",
    specifications: [
{specs}
    ],
    warnings: [
{warn_txt}
    ],
    nutrition: {nut_ts},
    media: [
{media_lines}
    ],
    frontKey: "front",
    additional: [
{chr(10).join(extra_refs)}
    ],
  }},''')
    return "\n".join(lines)


HEADER = '''import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Amazon.com.tr "Çaylar" kategorisinden (node 22380529031) barkodu doğrulanmış
 * ürünleri UZAK Payload REST API'sine yazar.
 *
 * Barkod kaynağı: ambalaj görselinden ZXing ile okunan EAN-13, ya da Amazon ürün
 * bilgilerindeki "Üretici Referansı" / "Ürün Model Numarası" alanı. Her barkodun
 * kontrol hanesi doğrulandı; görseldeki barkod ile Türkiye barkodu farklıysa
 * Türkiye barkodu ana kayıt yapıldı, diğeri specifications'a yazıldı.
 *
 * Idempotent: marka/içindekiler ad+slug ile, medya alt metni ile, ürün barkod ile upsert edilir.
 *
 * Kullanım:
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-caylar-kategori-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const IMAGE_ROOT = path.join(process.cwd(), '.seed-images')
const CATEGORY_ID = 13 // Kahve & Çay
const COUNTRY_ID = 1 // Türkiye
const PRICE_DATE = '2026-11-20T00:00:00.000Z'

type IngredientRef = { id?: number; name: string; slug?: string }
type BrandRef = { id?: number; name: string; slug: string; country?: string }

type ProductSeed = {
  asin: string
  barcode: string
  name: string
  slug: string
  size: string
  packaging: string
  price: number
  description: string
  brand: BrandRef
  manufacturer: string
  items: IngredientRef[]
  labels: string[]
  storage: string
  usage: string
  specifications: { key: string; value: string }[]
  warnings: { severity: 'low' | 'medium' | 'high'; text: string }[]
  nutrition?: { per: '100g' | '100ml' | 'serving'; items: { nutrient: number; amount: number; unit: string }[] }
  media: { key: string; file: string; alt: string }[]
  frontKey: string
  additional: { key: string; caption: string }[]
}

const PRODUCTS: ProductSeed[] = [
'''

FOOTER = '''
function assertEan13(code: string): void {
  if (!/^\\d{13}$/.test(code)) throw new Error(`EAN-13 13 hane olmali: ${code}`)
  const digits = code.split('').map(Number)
  const sum = digits.slice(0, 12).reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0)
  const expected = (10 - (sum % 10)) % 10
  if (expected !== digits[12]) {
    throw new Error(`EAN-13 kontrol hanesi hatali: ${code} (beklenen ${expected})`)
  }
}

async function assertIngredient(client: PayloadClient, id: number, name: string) {
  const doc = await client.find('ingredients', { where: { id: { equals: id } }, limit: 1 })
  const found = doc.docs[0] as { name?: string } | undefined
  if (!found) throw new Error(`Icindekiler kaydi yok: ${id}`)
  if (String(found.name).toLocaleLowerCase('tr') !== name.toLocaleLowerCase('tr')) {
    throw new Error(`Icindekiler adi uyusmuyor: ${id} -> ${String(found.name)} != ${name}`)
  }
}

async function ensureBrand(client: PayloadClient, brand: BrandRef): Promise<number> {
  if (brand.id) {
    const doc = await client.find('brands', { where: { id: { equals: brand.id } }, limit: 1 })
    const found = doc.docs[0] as { name?: string } | undefined
    if (!found) throw new Error(`Marka kaydi yok: ${brand.id}`)
    if (String(found.name).toLocaleLowerCase('tr') !== brand.name.toLocaleLowerCase('tr')) {
      throw new Error(`Marka adi uyusmuyor: ${brand.id} -> ${String(found.name)} != ${brand.name}`)
    }
    return brand.id
  }
  const bySlug = await client.findOne('brands', { slug: { equals: brand.slug } })
  if (bySlug) return bySlug.id
  const byName = await client.findOne('brands', { name: { equals: brand.name } })
  if (byName) return byName.id
  const created = await client.create('brands', {
    name: brand.name,
    slug: brand.slug,
    country: brand.country ?? 'Türkiye',
  })
  console.log(`  + marka: ${brand.name} (${created.id})`)
  return created.id
}

async function ensureIngredient(client: PayloadClient, ref: IngredientRef): Promise<number> {
  if (ref.id) {
    await assertIngredient(client, ref.id, ref.name)
    return ref.id
  }
  const byName = await client.findOne('ingredients', { name: { equals: ref.name } })
  if (byName) return byName.id
  if (ref.slug) {
    const bySlug = await client.findOne('ingredients', { slug: { equals: ref.slug } })
    if (bySlug) return bySlug.id
  }
  const created = await client.create('ingredients', {
    name: ref.name,
    slug: ref.slug,
  })
  console.log(`  + icindekiler: ${ref.name} (${created.id})`)
  return created.id
}

async function ensureMedia(client: PayloadClient, seed: ProductSeed): Promise<Record<string, number>> {
  const ids: Record<string, number> = {}
  for (const image of seed.media) {
    const existing = await client.findOne('media', { alt: { equals: image.alt } })
    if (existing) {
      ids[image.key] = existing.id
      continue
    }
    const created = await client.upload('media', path.join(IMAGE_ROOT, seed.slug, image.file), {
      alt: image.alt,
    })
    console.log(`  + medya: ${image.file} (${created.id})`)
    ids[image.key] = created.id
  }
  return ids
}

async function seedProduct(client: PayloadClient, seed: ProductSeed): Promise<void> {
  assertEan13(seed.barcode)
  console.log(`\\n== ${seed.name} (${seed.barcode})`)

  const brandId = await ensureBrand(client, seed.brand)
  const itemIds: number[] = []
  for (const item of seed.items) itemIds.push(await ensureIngredient(client, item))
  const media = await ensureMedia(client, seed)

  const data: Record<string, unknown> = {
    barcode: seed.barcode,
    name: seed.name,
    description: seed.description,
    brand: brandId,
    category: CATEGORY_ID,
    manufacturer: seed.manufacturer,
    country: COUNTRY_ID,
    size: seed.size,
    packaging: seed.packaging,
    items: itemIds.map((id) => ({ ingredients: id })),
    additives: [],
    labels: seed.labels,
    specifications: seed.specifications,
    warnings: seed.warnings,
    storage: seed.storage,
    usage: seed.usage,
    model: seed.asin,
    sku: `AMZ-${seed.asin}`,
    prices: [{ amount: seed.price, date: PRICE_DATE }],
    frontImage: media[seed.frontKey],
    additionalImages: seed.additional.map((entry) => ({
      image: media[entry.key],
      caption: entry.caption,
    })),
    status: 'published' as const,
  }
  if (seed.nutrition) data.nutrition = seed.nutrition

  const existing = await client.findOne('products', { barcode: { equals: seed.barcode } })
  const product = existing
    ? await client.update('products', existing.id, data)
    : await client.create('products', data)

  console.log(`  ${existing ? 'guncellendi' : 'olusturuldu'}: id ${product.id}`)
  console.log(`  https://barkoddedektifi.com/urun/${seed.barcode}`)
}

async function main(): Promise<void> {
  const client = createPayloadClient({ api: API, email: EMAIL, password: PASSWORD, token: TOKEN })
  await client.login()
  console.log(`API: ${API}`)

  let ok = 0
  const failed: string[] = []
  for (const seed of PRODUCTS) {
    try {
      await seedProduct(client, seed)
      ok++
    } catch (error) {
      failed.push(`${seed.barcode} ${seed.name}: ${String(error).slice(0, 300)}`)
      console.error(`  !! HATA: ${String(error).slice(0, 300)}`)
    }
  }
  console.log(`\\nBitti: ${ok}/${PRODUCTS.length} basarili`)
  if (failed.length) {
    console.log('Basarisizlar:')
    for (const f of failed) console.log(' -', f)
    process.exitCode = 1
  }
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
'''

if __name__ == "__main__":
    body = emit_products()
    ts = HEADER + body + "\n]\n" + FOOTER
    out = Path("../scripts/seed-caylar-kategori-prod.ts")
    out.write_text(ts, encoding="utf-8")
    print("products:", len(PRODUCTS), "->", out, len(ts), "chars")
