/**
 * Lexical gövde → markdown.
 *
 * Yazıların kanonik biçimi Lexical JSON'dur (admin editörü). `bodyMarkdown` alanı bu
 * dosyadaki dönüştürücüyle türetilir; istemciler ve SEO tüketicileri markdown'ı hazır alır.
 * Desteklenen düğüm kümesi bilinçli olarak dardır: paragraf, h2/h3, kalın/eğik/üstü çizili,
 * satır içi kod, link, madde/numaralı liste, alıntı, kod bloğu, yatay çizgi, görsel.
 *
 * Bilinmeyen düğümler sessizce atlanmaz: alt düğümleri varsa içerikleri korunarak basılır.
 */

type LexicalNode = {
  type?: string
  children?: LexicalNode[]
  text?: string
  format?: number | string
  tag?: string
  listType?: string
  url?: string
  fields?: { url?: string; newTab?: boolean }
  value?: unknown
  language?: string
}

type RichText = { root?: LexicalNode } | string | null | undefined

const FORMAT_BOLD = 1
const FORMAT_ITALIC = 2
const FORMAT_STRIKE = 4
const FORMAT_INLINE_CODE = 16

const MEDIA_PLACEHOLDER = /\{\{media:([^}]+)\}\}/g

/** Metin kaçışı: markdown tüketicileri düz metni biçim sanmasın. */
function escapeText(value: string): string {
  return value.replace(/([\\`*_[\]])/g, '\\$1')
}

function renderText(node: LexicalNode): string {
  const raw = typeof node.text === 'string' ? node.text : ''
  if (!raw) return ''
  const format = typeof node.format === 'number' ? node.format : 0
  if (format & FORMAT_INLINE_CODE) {
    // Kod içinde kaçış yok; tek ters tırnağı da kapsayacak şekilde çit uzunluğu seçilir.
    const fence = raw.includes('`') ? '``' : '`'
    return `${fence}${raw}${fence}`
  }
  let out = escapeText(raw)
  if (format & FORMAT_BOLD) out = `**${out}**`
  if (format & FORMAT_ITALIC) out = `*${out}*`
  if (format & FORMAT_STRIKE) out = `~~${out}~~`
  return out
}

function renderChildren(node: LexicalNode): string {
  return (node.children ?? []).map(renderNode).join('')
}

function indentBlock(value: string, prefix: string): string {
  return value
    .split('\n')
    .map((line) => (line ? `${prefix}${line}` : line))
    .join('\n')
}

function renderNode(node: LexicalNode): string {
  switch (node.type) {
    case 'text':
      return renderText(node)
    case 'linebreak':
      return '  \n'
    case 'tab':
      return '    '
    case 'paragraph':
      return `${renderChildren(node)}\n\n`
    case 'heading': {
      const tag = typeof node.tag === 'string' ? node.tag : 'h2'
      const level = Number(tag.replace('h', '')) || 2
      return `${'#'.repeat(Math.min(Math.max(level, 1), 6))} ${renderChildren(node).trim()}\n\n`
    }
    case 'quote':
      return `${indentBlock(renderChildren(node).trimEnd(), '> ')}\n\n`
    case 'list': {
      const ordered = node.listType === 'number'
      const items = (node.children ?? []).map((item, index) => {
        const body = (item.children ?? []).map(renderNode).join('').trimEnd()
        const marker = ordered ? `${index + 1}. ` : '- '
        const continuation = ' '.repeat(marker.length)
        return body
          .split('\n')
          .map((line, lineIndex) => (lineIndex === 0 ? `${marker}${line}` : line ? `${continuation}${line}` : line))
          .join('\n')
      })
      return `${items.join('\n')}\n\n`
    }
    case 'listitem':
      return renderChildren(node)
    case 'link': {
      const url = node.fields?.url ?? node.url ?? ''
      const label = renderChildren(node).trim() || url
      return url ? `[${label}](${url})` : label
    }
    case 'upload': {
      const id = typeof node.value === 'number' || typeof node.value === 'string' ? String(node.value) : ''
      // Medya URL'i hook tarafında çözülür; yer tutucu bırakılır.
      return id ? `{{media:${id}}}` : ''
    }
    case 'horizontalrule':
      return '---\n\n'
    case 'code':
      return `\`\`\`${node.language ?? ''}\n${renderChildren(node).trimEnd()}\n\`\`\`\n\n`
    case 'root':
      return renderChildren(node)
    default:
      return renderChildren(node)
  }
}

/**
 * Lexical gövdeyi markdown'a çevirir.
 * `resolveMediaUrl` verilirse görsel yer tutucuları `![alt](url)` olarak çözülür.
 */
export async function lexicalToMarkdown(
  body: RichText,
  resolveMediaUrl?: (id: string) => Promise<{ url: string; alt: string } | null>,
): Promise<string> {
  if (!body || typeof body === 'string') return typeof body === 'string' ? body : ''
  const root = body.root
  if (!root) return ''

  let markdown = renderNode({ ...root, type: 'root' }).replace(/\n{3,}/g, '\n\n').trim()

  if (!resolveMediaUrl) return markdown

  const ids = Array.from(new Set(Array.from(markdown.matchAll(MEDIA_PLACEHOLDER)).map((match) => match[1])))
  if (!ids.length) return markdown

  const resolved = new Map<string, { url: string; alt: string } | null>()
  for (const id of ids) resolved.set(id, await resolveMediaUrl(id))

  markdown = markdown.replace(MEDIA_PLACEHOLDER, (_match, id: string) => {
    const media = resolved.get(id)
    if (!media?.url) return ''
    return `![${media.alt.replace(/[[\]]/g, '')}](${media.url})`
  })

  return markdown.replace(/\n{3,}/g, '\n\n').trim()
}
