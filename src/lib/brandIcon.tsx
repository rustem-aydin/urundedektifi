/** Site simgesinin ortak çizimi: koyu zemin, kırmızı çerçeve, barkod çubukları. */
const BARS = [26, 10, 18, 8, 30, 10, 22, 8, 26]

export function BrandIcon({ size }: { size: number }) {
  const scale = size / 512
  const px = (value: number) => Math.max(1, Math.round(value * scale))

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1c1b17',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: px(12),
          padding: `${px(48)}px ${px(40)}px`,
          border: `${px(12)}px solid #b3341e`,
          background: '#f7f4ee',
        }}
      >
        {BARS.map((width, index) => (
          <div
            key={index}
            style={{
              width: px(width),
              height: px(220),
              background: index % 3 === 0 ? '#b3341e' : '#1c1b17',
            }}
          />
        ))}
      </div>
    </div>
  )
}
