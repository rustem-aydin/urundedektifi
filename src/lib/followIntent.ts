/**
 * Web'de girişsiz "Takip et" niyeti.
 *
 * Düğme, giriş sayfasına yönlendirmeden önce hedef uzmanı `localStorage`'a yazar;
 * giriş/kayıt başarılı olunca oturum sağlayıcısı takibi kendiliğinden tamamlar (Q6 kararı).
 */

const KEY = 'ud.follow-intent'

export function requestFollow(expertId: string | number): void {
  try {
    window.localStorage.setItem(KEY, String(expertId))
  } catch {
    // Depolama kapalıysa niyet kaybolur; kullanıcı takibi profilden tekrar başlatabilir.
  }
}

export function consumeFollow(): string | null {
  try {
    const value = window.localStorage.getItem(KEY)
    if (value) window.localStorage.removeItem(KEY)
    return value
  } catch {
    return null
  }
}
