/**
 * Doğrulama oyunun hazır metinleri.
 *
 * Aynı ifade hem istemcide (diyalog varsayılanı, ipucu) hem sunucuda (boş notu
 * tamamlarken) yazıldığı için tek yerde tutulur; ikisi ayrışırsa yorum listesinde
 * iki farklı "doğrula" metni görünür.
 */

/** Boş notla gönderilen "doğrula" oyunun metni. */
export const DEFAULT_CONFIRM_TEXT = 'Bu bölümdeki bilgilerin doğru olduğunu onaylıyorum.'

/** "Doğru değil" oyunun metni bu ifadeyle başlar; kullanıcı yalnız nedeni yazar. */
export const REFUTE_PREFIX = 'Bu bölümdeki bilgiler yanlış çünkü '
