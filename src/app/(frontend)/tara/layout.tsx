import type { Metadata } from 'next'

import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Barkod tara',
  description:
    'Barkodu kameraya göster ya da numarasını yaz; ürün dosyasını ve uzmanların boykot, sağlık ve helal hükümlerini anında gör.',
  path: '/tara',
})

export default function TaraLayout({ children }: { children: React.ReactNode }) {
  return children
}
