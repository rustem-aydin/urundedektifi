import { serializeJsonLd, type JsonLdNode } from '@/lib/seo'

/**
 * Schema.org yapılandırılmış verisi.
 *
 * Sunucu bileşenidir: JSON, React ağacına metin olarak girmez; `<script>` içine
 * kaçışlanmış (bkz. serializeJsonLd) tek bir gövde olarak yazılır.
 */
export function JsonLd({ data }: { data: JsonLdNode | JsonLdNode[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  )
}
