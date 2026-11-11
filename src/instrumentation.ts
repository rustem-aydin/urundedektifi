/**
 * Sunucu açılış kancası: Payload'ı bağlar ve ürün Dosyası önbelleğini ısıtır.
 *
 * Neden: soğuk konteynerde ilk tarama, kural setinin yüklenmesini (3.900+ kural,
 * ~8 sayfalık okuma) ve Dosya kurulumunu kendisi ödüyordu; prod ölçümünde bu
 * kuyruk 1,5–16 sn'ye çıkabiliyor. Isınma açılışa taşınınca istek yolu yalnız
 * önbellek isabeti görür.
 *
 * `register` Next tarafından bir kez, sunucu istek almaya başlamadan çağrılır;
 * burada beklenen her iş hazır-olma süresini geciktirir (prod'da bekleyen
 * migration'lar dahil). Bu yüzden ısınma bilerek beklemeden başlatılır: Payload
 * ilk istekle aynı `initPromise`'i paylaşır, ısınma biterse istek önbellekle
 * karşılaşır, bitmezse davranış eskisi gibidir.
 */
export async function register() {
  // Yalnız Node sunucusu; edge runtime'da Payload/postgres yok.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  // Derleme sırasında veritabanına dokunma.
  if (process.env.NEXT_PHASE === 'phase-production-build') return
  // Geliştirmede her yeniden başlatma 40 Dosya kurmasın.
  if (process.env.NODE_ENV !== 'production') return

  void (async () => {
    try {
      const [{ getPayload }, { default: config }, { warmProductCaseCache }] = await Promise.all([
        import('payload'),
        import('@/payload.config'),
        import('@/lib/productCase'),
      ])
      const payload = await getPayload({ config })
      await warmProductCaseCache(payload)
    } catch (error) {
      // DB geçici olarak yoksa sunucu yine açılır; ilk istek eskisi gibi soğuk çalışır.
      console.error('[ısınma] Payload başlatılamadı', error)
    }
  })()
}
