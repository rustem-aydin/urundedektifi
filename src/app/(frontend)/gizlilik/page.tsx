import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Gizlilik Politikası',
  description:
    'Şeffaf Ürün uygulaması ve urundedektifi.com sitesi kişisel verilerinizi nasıl işler: ne toplar, neden toplar, kim görür.',
}

const VERILER = [
  {
    baslik: 'Hesap bilgileri',
    toplama: 'E-posta adresi, ad soyad, kullanıcı adı',
    amac: 'Kayıt ve giriş, uzman takibi, oy ve yorum yazma',
    guvenlik: "Şifreler Payload CMS kimlik doğrulaması ile karma (hash) olarak saklanır; düz metin tutulmaz.",
  },
  {
    baslik: 'Ürün etkileşimleri',
    toplama: 'Baktığınız ürün dosyaları, doğrulama oyları, yorumlar',
    amac: 'Ürün görüntülenme sayacı, topluluk doğrulaması ve yorum akışı',
    guvenlik: 'Oy ve yorumlar herkese açık olarak yayınlanır; yazarken hangi verinin görünür olacağı ekranda belirtilir.',
  },
  {
    baslik: 'Barkod taraması',
    toplama: 'Kamera görüntüsü işlenmez; yalnızca okutulan barkod numarası sunucuya gönderilir',
    amac: 'Ürün dosyasını bulmak ve açmak',
    guvenlik: 'Kamera görüntüsü cihazdan çıkmaz, kaydedilmez.',
  },
  {
    baslik: 'Cihaz ve günlük kayıtları',
    toplama: 'IP adresi, tarayıcı/uygulama türü, hata kayıtları',
    amac: 'Hizmet güvenliği, hata teşhisi ve kötüye kullanımın engellenmesi',
    guvenlik: 'Standart sunucu günlükleridir; pazarlama amacıyla kullanılmaz.',
  },
]

export default function GizlilikPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <p className="font-mono text-[0.65rem] tracking-[0.2em] text-faded uppercase">
        DOSYA NO: ŞÜ-KVKK
      </p>
      <h1 className="mt-2 font-display text-3xl tracking-wide">Gizlilik Politikası</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Bu politika, Şeffaf Ürün mobil uygulaması ve urundedektifi.com web sitesi (&quot;hizmet&quot;)
        üzerinden işlenen kişisel veriler için geçerlidir. 6698 sayılı Kişisel Verilerin Korunması
        Kanunu (KVKK) kapsamında veri sorumlusu Rustem Aydın&apos;dır.
      </p>

      <h2 className="mt-10 font-display text-xl tracking-wide">Ne topluyoruz, neden?</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-2 pr-4 font-medium">Veri</th>
              <th className="py-2 pr-4 font-medium">Toplanan bilgi</th>
              <th className="py-2 pr-4 font-medium">Amaç</th>
              <th className="py-2 font-medium">Görünürlük</th>
            </tr>
          </thead>
          <tbody>
            {VERILER.map((veri) => (
              <tr key={veri.baslik} className="border-b border-dashed border-border align-top">
                <td className="py-3 pr-4 font-medium">{veri.baslik}</td>
                <td className="py-3 pr-4 text-muted-foreground">{veri.toplama}</td>
                <td className="py-3 pr-4 text-muted-foreground">{veri.amac}</td>
                <td className="py-3 text-muted-foreground">{veri.guvenlik}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 font-display text-xl tracking-wide">Reklam ve üçüncü taraflar</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        Hizmet içinde reklam yoktur, izleyici analizi için üçüncü taraf SDK kullanılmaz. Veriler
        reklam amacıyla satılmaz veya paylaşılmaz. Uygulama, açık kaynaklı harici bir yapay zekâ
        sağlayıcısı seçme imkânı sunar; bu sağlayıcıya gönderilen anahtar yalnızca sizin cihazınızda
        saklanır.
      </p>

      <h2 className="mt-10 font-display text-xl tracking-wide">Saklama ve silme</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        Hesabınızı silmek istediğinizde talebiniz üzerine tüm kişisel verileriniz (hesap, oylar,
        yorumlar, takipler) kalıcı olarak silinir. Silme talebi için aşağıdaki iletişim adresine
        yazmanız yeterlidir.
      </p>

      <h2 className="mt-10 font-display text-xl tracking-wide">Haklarınız</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        KVKK kapsamında verilerinize erişme, düzeltme, silinmesini isteme ve işlemeye itiraz etme
        hakkınız vardır. Talepleriniz en geç 30 gün içinde yanıtlanır.
      </p>

      <h2 className="mt-10 font-display text-xl tracking-wide">İletişim</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        Gizlilik talepleri ve sorular için:{' '}
        <a
          href="mailto:rustemaydin.web@gmail.com"
          className="underline underline-offset-4 hover:text-foreground"
        >
          rustemaydin.web@gmail.com
        </a>
      </p>

      <p className="mt-10 font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
        SON GÜNCELLEME: 2026-10-29
      </p>
    </div>
  )
}
