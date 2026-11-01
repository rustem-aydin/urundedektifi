# ADR 0028 — Katkı anında arka plan etiket okuması

- Durum: Kabul edildi
- Tarih: 2026-11-01
- İlgili: ADR 0026 (tek katkı kapısı), ADR 0027 (inceleme tek ekran), ADR 0021 (tek YZ sağlayıcı),
  `src/lib/aiAnalysis.ts`, `src/lib/contributionFlow.ts`, `src/collections/Products.ts`,
  `src/globals/AiSettings.ts`, `src/components/wizard/ReviewWizard.tsx`

## Bağlam

ADR 0027 incelemeyi tek ekrana indirdi ama analiz hâlâ **inceleme anında** yapılıyordu: panel rolü
"Analiz et" düğmesine basıyor, 30-60 saniye bekliyordu. Katkıyı yapan kişi ise hiçbir zaman analiz
görmüyordu. Sonuç: her taslak için tekrar eden bir bekleme ve düğme; ayrıca analiz yalnız panel
rolünün oturum jetonuyla çalışabildiği için (vekil uç) arka planda yapılamıyordu.

## Karar

### 1. Analiz katkı anında başlar

`submitContribution` ürünü oluşturduktan sonra `queueProductAnalysis` çağırır ve **yanıtı beklemez**:
katkı uç noktası 100-150 ms'de döner, etiket okuması Node sürecinde arka planda sürer. Dokploy'da
Next sunucusu uzun ömürlü olduğu için istek bittikten sonra da çalışır.

### 2. Sonuç üründe saklanır

İki yeni alan (ikisi de `access: { create: () => false, update: () => false }`, yalnız
`overrideAccess` ile sunucudan yazılır):

- `products.aiStatus`: `none | running | done | failed` (select, varsayılan `none`, indeksli).
- `products.aiAnalysis`: JSON — `{ extraction, usage, model, repaired, degraded, analyzedAt,
  photoCount, error?, failedAt? }`.

`extraction` alanı istemcideki zod şemasıyla doğrulanır (`analysisExtraction`); bozuk/eski biçim
sessizce yok sayılır, ekran elle doldurmaya düşer.

### 3. Aynı prompt, iki taşıyıcı

`src/lib/wizard/ai.ts` içindeki `analyzeProduct` artık bir `ChatEndpoint` alır:

- tarayıcı: `proxyChatEndpoint(token)` → `/api/globals/ai-settings/chat` (mevcut yol, değişmedi);
- sunucu: `providerChatEndpoint(payload)` (`src/globals/AiSettings.ts`) → sağlayıcıya doğrudan,
  `Authorization: Bearer <apiKey>` ve `x-opencode-session` başlıklarıyla.

Prompt, JSON şeması, onarım turu ve SSE çözümlemesi tek koddan gelir; iki yol ayrışamaz.

### 4. Görseller sunucuda hazırlanır

Ürünün fotoğrafları inceleme ekranıyla aynı sırada toplanır (ön yüz → içindekiler → besin →
geri dönüşüm → ek), medya adresi göreliyse sunucunun kendisine mutlaklaştırılır, `sharp` ile uzun
kenar 1600 px JPEG'e indirilir. İstemcideki `preparePhoto` ile aynı sınır.

### 5. İnceleme ekranı analiz düğmesi taşımaz

- `running`: "ETİKET OKUMASI SÜRÜYOR…" + 4 saniyelik yoklama; bitince taslak, kullanıcı hiçbir alanı
  elle değiştirmediyse analizle tazelenir, değiştirdiyse yazılanlar korunur ve yalnız bildirim çıkar.
- `done`: alanlar dolu gelir, analiz düğmesi **yok**.
- `none`/`failed` (eski taslaklar, sağlayıcı hatası): yalnız kurtarma için "Analizi başlat /
  yeniden başlat" düğmesi (`POST /api/products/:id/analyze`, admin+editör).
- "Analiz olmadan elle doldur" yalnız analiz çıktısı yokken görünür.

### 6. Kuyruk düğmesi "Analiz et" değil "İncele"

Analiz artık inceleme ekranında yapılmadığı için kuyruk kartındaki düğmenin adı da değişti.

## Sonuçlar

- Katkı sahibi de panel rolü de analiz için beklemez; inceleme ekranı dolu açılır.
- Arka plan işi süreç içidir (queue değil). Sunucu yeniden başlarsa `running` kalan satır kendiliğinden
  `failed` olmaz; inceleme ekranı "sürüyor" gösterir ve "Analizi yeniden başlat" ile toparlanır.
  Bilinçli kabul: ayrı bir iş kuyruğu (Payload jobs) altyapı ve şema maliyeti getirirdi.
- Yeni kolonlar için migration: `20261101_140000_product_ai_analysis` (idempotent DDL, enum + jsonb +
  indeks). Prod'da `payload migrate` ile uygulanır; migration betiği boş bir veritabanında uçtan uca
  çalıştırılarak doğrulandı.
- Mobil katkı akışı aynı uç noktayı kullandığı için o da otomatik analizden yararlanır; mobil inceleme
  ekranı `aiAnalysis` alanını henüz okumaz (ayrı iş).
