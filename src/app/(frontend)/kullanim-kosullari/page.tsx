import type { Metadata } from 'next'
import Link from 'next/link'

import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Kullanım Koşulları',
  description:
    'Barkod Dedektifi web sitesi ve mobil uygulamasının kullanım koşulları: hizmetin niteliği, kullanıcı içeriği, sorumluluk ve düzeltme kanalı.',
  path: '/kullanim-kosullari',
})

export default function KullanimKosullariPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <p className="font-mono text-[0.65rem] tracking-[0.2em] text-faded uppercase">
        DOSYA NO: BD-KULLANIM
      </p>
      <h1 className="mt-2 font-display text-3xl tracking-wide">Kullanım Koşulları</h1>

      <h2 className="mt-10 font-display text-xl tracking-wide">Taraflar ve kapsam</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        Bu koşullar, barkoddedektifi.com sitesi ile Barkod Dedektifi mobil uygulamasını
        (&quot;Hizmet&quot;) kullanan herkes ile Hizmeti sunan Rustem Aydın
        (&quot;Sağlayıcı&quot;) arasında geçerlidir. Hizmeti kullanarak bu koşulları kabul etmiş
        sayılırsınız; kabul etmiyorsanız Hizmeti kullanmayın.
      </p>

      <h2 className="mt-10 font-display text-xl tracking-wide">Hizmetin niteliği</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        Hizmet; barkodla sorgulanan ürünlere ilişkin kamuya açık bilgileri ve uzmanların kendi
        yazdığı kurallara dayanan görüşlerini bir araya getiren bağımsız bir bilgi platformudur.
        Hizmet üzerinden satış yapılmaz, sipariş alınmaz, aracılık edilmez. Görüşler resmî tespit,
        bilirkişi raporu, sertifikasyon kararı veya satın alma tavsiyesi değildir. Bilgilerin
        doğruluğu, güncelliği ve eksiksizliği garanti edilmez; satın alma kararından önce ürün
        etiketini kontrol edin.
      </p>

      <h2 className="mt-10 font-display text-xl tracking-wide">Kaynaklar ve üçüncü taraf içerik</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        Ürün bilgileri ambalaj, üretici beyanı, Open Food Facts ve kamuya açık kaynaklardan; fiyat
        bilgileri pazaryeri listelerinden derlenir. Uzman görüşleri, görüşü yazan uzmanın
        kurallarına ve gösterilen kaynaklara dayanır. Üçüncü taraf sitelere bağlantı verilebilir; bu
        sitelerin içeriğinden ilgili taraf sorumludur.
      </p>

      <h2 className="mt-10 font-display text-xl tracking-wide">Hesap</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        Bazı özellikler hesap gerektirir. 18 yaşından küçükler hesap açamaz. Hesap bilgilerinin
        doğruluğundan kullanıcı sorumludur. Hesap, profil ekranından veya e-posta yoluyla
        silinebilir.
      </p>

      <h2 className="mt-10 font-display text-xl tracking-wide">Kullanıcı içeriği</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        Yorum, doğrulama oyu veya fotoğraf yüklediğinizde içeriğin size ait olduğunu ya da
        yayınlamaya yetkili olduğunuzu ve üçüncü kişilerin haklarını ihlal etmediğini beyan
        edersiniz. İçeriği Hizmette göstermek, çoğaltmak, biçimlendirmek ve alt lisanslamak için
        Sağlayıcıya dünya çapında, ücretsiz, süresiz bir kullanım lisansı verirsiniz; içeriğin
        telif hakkı sizde kalır. Hakaret, iftira, nefret söylemi, kişisel veri paylaşımı, reklam
        veya spam, yanıltıcı bilgi, başkasına ait fotoğraf ve hukuka aykırı içerik yasaktır.
        Bildirim üzerine en geç 48 saat içinde içerik incelenir; gerekirse kaldırılır veya hesap
        kısıtlanır.
      </p>

      <h2 className="mt-10 font-display text-xl tracking-wide">Marka sahipleri ve düzeltme</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        Hakkınızda yayınlanan bir görüşün dayanağını yetersiz buluyorsanız ürün/marka, görüş ve
        dayanak bilgisiyle birlikte{' '}
        <a
          href="mailto:rustemaydinnn@gmail.com"
          className="underline underline-offset-4 hover:text-foreground"
        >
          rustemaydinnn@gmail.com
        </a>{' '}
        adresine yazın. Talep en geç 5 iş günü içinde incelenir; dayanak yetersizse kayıt düzeltilir
        veya kaldırılır. Bu kanal, hukuka aykırı içerik bildirimleri için de kullanılır.
      </p>

      <h2 className="mt-10 font-display text-xl tracking-wide">Fikrî mülkiyet</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        Site tasarımı, metinleri, veri derlemesi ve yazılımı Sağlayıcıya aittir. Üçüncü taraf marka
        ve görselleri sahiplerine aittir ve yalnız bilgilendirme amacıyla gösterilir. Kaynak
        gösterilmeden toplu kopyalama, kazıma ve yeniden yayın yasaktır.
      </p>

      <h2 className="mt-10 font-display text-xl tracking-wide">Sorumluluk</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        Hizmet &quot;olduğu gibi&quot; sunulur. Sağlayıcı, kasıt ve ağır kusur hâlleri hariç,
        bilgilerin kullanımından doğan dolaylı zararlardan sorumlu değildir. 6098 sayılı Türk
        Borçlar Kanunu&apos;nun 115. maddesi uyarınca ağır kusura ilişkin sorumluluk
        sınırlandırılamaz. Sağlık ve alerjen risklerinde ürün ambalajı ve üretici talimatı esastır.
      </p>

      <h2 className="mt-10 font-display text-xl tracking-wide">Kişisel veriler</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        Kişisel verilerin işlenmesine ilişkin aydınlatma{' '}
        <Link href="/gizlilik" className="underline underline-offset-4 hover:text-foreground">
          /gizlilik
        </Link>{' '}
        sayfasındadır.
      </p>

      <h2 className="mt-10 font-display text-xl tracking-wide">
        Değişiklik ve uygulanacak hukuk
      </h2>
      <p className="mt-3 text-sm text-muted-foreground">
        Koşullar güncellenebilir; önemli değişiklikler sitede duyurulur. Uyuşmazlıklarda Türkiye
        Cumhuriyeti hukuku uygulanır; tüketici işlemlerinde 6502 sayılı Kanun&apos;un zorunlu
        hükümleri saklıdır. İletişim:{' '}
        <a
          href="mailto:rustemaydinnn@gmail.com"
          className="underline underline-offset-4 hover:text-foreground"
        >
          rustemaydinnn@gmail.com
        </a>
      </p>

      <p className="mt-10 font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
        SON GÜNCELLEME: 2026-11-23
      </p>
    </div>
  )
}
