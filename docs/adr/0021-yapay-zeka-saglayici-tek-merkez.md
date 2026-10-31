# Yapay zekâ sağlayıcısı tek merkezde: Payload global'i + sunucu vekili

Ekle sihirbazının etiket okuma adımı OpenAI uyumlu bir vision modeline gider. ADR 0008 sağlayıcıyı
**istemci başına** yapılandırıyordu: masaüstünde `sessionStorage`'da API anahtarı, mobilde
`expo-secure-store`'da. Sonuç: her tarayıcı sekmesi ve her telefon ayrı ayrı anahtar istiyordu; aynı
kurumdaki üç kişi üç anahtar giriyordu ve anahtar modeli değiştirmek için her cihazı tek tek dolaşmak
gerekiyordu.

## Karar

Sağlayıcı ayarı **tek yerde**: Payload panelindeki `ai-settings` global'i
(`src/globals/AiSettings.ts`). İstemciler (web + mobil) anahtarı hiç görmez; analiz isteği sunucudaki
vekil uçtan geçer.

### Veri modeli

`ai_settings` tablosu (migration `20261031_090000_ai_settings`, idempotent DDL):

| Sütun | Tip | Not |
|---|---|---|
| `base_url` | varchar NOT NULL | OpenAI uyumlu servis adresi (`.../v1` dahil) |
| `api_key` | varchar NOT NULL | Yalnız sunucuda kullanılır |
| `model` | varchar NOT NULL | Görsel destekli model |
| `updated_at`, `created_at` | timestamptz | Payload global'lerine otomatik eklenen alanlar |

Global tablosunda `id` + alan sütunları vardır; `timestamps: false` olsa da Payload `createdAt`/
`updatedAt` alanlarını global'lere zorunlu ekler, sütunlar da tabloda bulunur.

### Uçlar

Global uçları Payload'da `/api/globals/{slug}/...` altında yayınlanır (koleksiyon uçlarının
`/api/{slug}/...` kalıbı global'lerde geçerli değil — `/api/ai-settings/status` 404 döner):

- `GET /api/globals/ai-settings/status` → `{ configured, baseUrl, model }`; anahtar dönmez.
- `GET /api/globals/ai-settings/models` → sağlayıcının `GET {baseUrl}/models` yanıtı aynen geçer.
- `POST /api/globals/ai-settings/chat` → `POST {baseUrl}/chat/completions` vekili.

Vekil gelen gövdeden **modeli ezer** (sunucudaki model kullanılır) ve `Authorization: Bearer <anahtar>`
başlığını sunucuda ekler. Sağlayıcı yanıtı (durum kodu + gövde) olduğu gibi istemciye döner; böylece
istemcideki `json_schema` → `json_object` düşüşü ve tek onarım turu mantığı değişmeden çalışır.

### Yetki

- `chat`/`models`/`status`: **admin + editör**. Tüketici hesabı ve anonim istek 401 alır; aksi hâlde
  vekil ücretsiz bir LLM geçidi olurdu.
- Global `update`: **yalnız admin** — ayar tüm istemcileri etkilediği için tek elden değişir.
- `apiKey` alanının alan-seviyesi `read` erişimi **yalnız admin**: editör global'i okuyabilir ama
  anahtarı REST yanıtında görmez. Vekil uçlar global'i `overrideAccess: true` ile okur.

### İstemci tarafı

- Web: `src/lib/wizard/provider.ts` yalnız `fetchProviderStatus` sunar; anahtar/model yazımı kalktı.
  `src/lib/wizard/ai.ts` doğrudan sağlayıcıya değil vekile `Authorization: JWT <payload jetonu>` ile
  gider. `/saglayici` ekranı artık **durum** ekranıdır (hazır/hazır değil, adres, model).
- Mobil: aynı sözleşme (`src/lib/provider.ts`, `src/lib/ai.ts`); `expo-secure-store`'daki sağlayıcı
  anahtarı kaldırıldı, sağlayıcı ekranı durum gösterir.
- Reddedilen özellik notu (`json_schema`, `temperature`) artık süreç geneli tek bayrak: sağlayıcı tek
  olduğu için anahtar başına set tutmak gereksizdi.

## Sonuçlar

- Yönetici tek panelden sağlayıcıyı değiştirir; web ve mobil aynı anda yeni sağlayıcıyı kullanır.
- API anahtarı tarayıcıya/telefona inmez; cihaz kaybı anahtar sızıntısı değildir.
- Analiz trafiği sunucudan geçer: sağlayıcı anahtarı sunucuda olduğu için istemci sayısı sınırsız.
- Vekil, `chat/completions` gövdesini geçirdiği için sağlayıcıya özgü mantık eklenmedi; yeni gateway
  desteği panelden adres değiştirmekle gelir.

## Değerlendirilen seçenekler

- **Anahtarı `.env`'e koymak**: panelden değiştirilemez, her deploy'da yeniden başlatma ister; reddedildi.
- **İstemci başına anahtar (ADR 0008 hâli)**: çok cihaz/çok kişi kullanımında yönetilemez; reddedildi.
- **Anahtarı panelde tutup istemciye dağıtmak**: anahtar tarayıcıya iner, paylaşılan sır olur; reddedildi.
- **Sunucuda tam analiz (fotoğraf yükleme + vekil)**: fotoğraflar zaten multipart ile medyaya gidiyor,
  ama analiz istemcideki taslak/onay akışına bağlı; vekil yeterli, reddedildi.
