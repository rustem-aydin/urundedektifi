'use client'

/**
 * Kök hata sınırı: `(frontend)` düzeni de çökerse yalnız bu dosya render edilir.
 * Bu yüzden CSS, font ve bileşen bağımlılığı yoktur; palet satır içi tutulur ve
 * `prefers-color-scheme` ile koyu tema da karşılanır.
 */
const STYLES = `
  :root {
    color-scheme: light dark;
    --paper: #f7f4ee;
    --ink: #1c1b17;
    --card: #fcfbf7;
    --border: #d9d4c6;
    --muted: #6e6a5e;
    --stamp: #b3341e;
    --on-stamp: #f7f4ee;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --paper: #1c1b17;
      --ink: #f7f4ee;
      --card: #25241e;
      --border: #3d3a30;
      --muted: #a39e8e;
      --stamp: #d0553a;
      --on-stamp: #1c1b17;
    }
  }
  body {
    margin: 0;
    min-height: 100svh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px 16px;
    background: var(--paper);
    color: var(--ink);
    font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { width: 100%; max-width: 40rem; }
  .tag {
    display: inline-block;
    border: 1px solid color-mix(in srgb, var(--stamp) 50%, transparent);
    background: color-mix(in srgb, var(--stamp) 10%, transparent);
    color: var(--stamp);
    border-radius: 2px;
    padding: 2px 6px;
    font: 500 10px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  .card {
    margin-top: 24px;
    border: 1px solid var(--border);
    background: var(--card);
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 1px 3px color-mix(in srgb, var(--ink) 8%, transparent);
  }
  .eyebrow {
    margin: 0;
    color: var(--muted);
    font: 400 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
    letter-spacing: 0.3em;
    text-transform: uppercase;
  }
  h1 { margin: 8px 0 0; font-size: 24px; line-height: 1.25; font-weight: 600; }
  .lead { margin: 8px 0 0; color: var(--muted); font-size: 14px; line-height: 1.6; max-width: 36rem; }
  .digest {
    margin: 12px 0 0;
    color: var(--muted);
    font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
    word-break: break-all;
  }
  .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 24px; }
  .actions button, .actions a {
    box-sizing: border-box;
    height: 36px;
    padding: 0 16px;
    border-radius: 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font: 500 14px/1 ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
    text-decoration: none;
    cursor: pointer;
  }
  .actions button { background: var(--stamp); color: var(--on-stamp); border: 1px solid transparent; }
  .actions button:hover { opacity: 0.85; }
  .actions a { background: var(--paper); color: var(--ink); border: 1px solid var(--border); }
  .actions a:hover { background: var(--border); }
  .actions :focus-visible { outline: 2px solid var(--stamp); outline-offset: 2px; }
`

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="tr">
      <body>
        <style>{STYLES}</style>
        <div className="wrap">
          <span className="tag">DOSYA AÇILAMADI</span>
          <div className="card">
            <p className="eyebrow">Beklenmeyen hata</p>
            <h1>Bir şeyler ters gitti</h1>
            <p className="lead">
              Uygulama bu dosyayı açarken beklenmeyen bir sorunla karşılaştı. Tekrar deneyebilir;
              sorun sürerse ana sayfaya dönebilirsin.
            </p>
            {error.digest && <p className="digest">Hata kodu: {error.digest}</p>}
            <div className="actions">
              <button type="button" onClick={() => reset()}>
                Tekrar dene
              </button>
              {/* Kök hata sınırında tam sayfa yenileme bilinçli: istemci yönlendirmesi çökmüş olabilir. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/">Ana sayfa</a>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
