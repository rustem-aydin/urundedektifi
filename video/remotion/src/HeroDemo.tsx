import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { Barcode } from './Barcode'
import { COLORS, FONT } from './theme'

const EAN = '8690123456789'

const EVIDENCE = [
  {
    topic: 'BOYKOT',
    reason: 'Marka kaydı temiz',
    rating: 'TEMİZ',
    color: COLORS.evidence,
    tint: 'rgba(46,107,79,0.10)',
  },
  {
    topic: 'SAĞLIK',
    reason: 'Katkı: E621 (MSG)',
    rating: 'RİSKLİ',
    color: COLORS.stamp,
    tint: 'rgba(179,52,30,0.10)',
  },
  {
    topic: 'HELAL',
    reason: 'Jelatin türevi',
    rating: 'ŞÜPHELİ',
    color: '#8a6a12',
    tint: 'rgba(232,185,60,0.22)',
  },
]

const RECENT = [
  { name: 'Örnek Kraker 150 g', rating: 'RİSKLİ', color: COLORS.stamp },
  { name: 'Örnek Süt 1 L', rating: 'TEMİZ', color: COLORS.evidence },
]

const Chip: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = COLORS.faded }) => (
  <span
    style={{
      display: 'inline-block',
      border: `1px solid ${color}`,
      color,
      fontFamily: FONT.mono,
      fontSize: 14,
      letterSpacing: '0.14em',
      padding: '6px 12px',
      borderRadius: 3,
      textTransform: 'uppercase',
    }}
  >
    {children}
  </span>
)

const Corner: React.FC<{ x: number; y: number; dx: number; dy: number; color: string }> = ({ x, y, dx, dy, color }) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width: 30,
      height: 30,
      borderTop: dy < 0 ? `2.5px solid ${color}` : undefined,
      borderBottom: dy > 0 ? `2.5px solid ${color}` : undefined,
      borderLeft: dx < 0 ? `2.5px solid ${color}` : undefined,
      borderRight: dx > 0 ? `2.5px solid ${color}` : undefined,
    }}
  />
)

export const HeroDemo: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const enter = (delay: number, damping = 200) =>
    spring({ frame: frame - delay, fps, config: { damping, mass: 0.7, stiffness: 120 } })

  const scanProgress = interpolate(frame, [20, 76], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const locked = frame >= 78
  const flash = frame < 78 ? 0 : interpolate(frame, [78, 88], [0.9, 0], { extrapolateRight: 'clamp' })
  const stageScale = interpolate(frame, [0, 300], [1, 1.02])

  const phoneIn = enter(4)
  const skeletonIn = enter(26)
  const skeletonOut = interpolate(frame, [76, 86], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const dossierIn = enter(80)
  const resultIn = enter(150)

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.paper, fontFamily: FONT.sans, color: COLORS.ink }}>
      <AbsoluteFill
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(28,27,23,0.075) 1px, transparent 1px)',
          backgroundSize: '26px 26px',
          opacity: 0.55,
        }}
      />
      <AbsoluteFill style={{ transform: `scale(${stageScale})` }}>
        {/* Telefon: barkod okuma akışı */}
        <div
          style={{
            position: 'absolute',
            left: 84,
            top: 50,
            width: 340,
            height: 620,
            borderRadius: 26,
            border: `1px solid ${COLORS.border}`,
            background: COLORS.card,
            boxShadow: '0 18px 40px rgba(28,27,23,0.12)',
            padding: 18,
            opacity: phoneIn,
            transform: `translateY(${(1 - phoneIn) * 40}px)`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px 14px' }}>
            <span style={{ fontFamily: FONT.mono, fontSize: 13, letterSpacing: '0.16em', color: COLORS.faded }}>
              BARKOD TARA
            </span>
            <div style={{ display: 'flex', gap: 5 }}>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={{ width: 7, height: 7, borderRadius: 99, background: i === 0 ? COLORS.stamp : COLORS.border }}
                />
              ))}
            </div>
          </div>

          <div
            style={{
              position: 'relative',
              height: 306,
              borderRadius: 14,
              border: `1px solid ${COLORS.border}`,
              background: '#fffdf8',
              overflow: 'hidden',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Barcode value={EAN} width={260} height={120} color={COLORS.ink} opacity={locked ? 0.9 : 1} />
            <Corner x={18} y={54} dx={-1} dy={-1} color={locked ? COLORS.evidence : COLORS.stamp} />
            <Corner x={292} y={54} dx={1} dy={-1} color={locked ? COLORS.evidence : COLORS.stamp} />
            <Corner x={18} y={224} dx={-1} dy={1} color={locked ? COLORS.evidence : COLORS.stamp} />
            <Corner x={292} y={224} dx={1} dy={1} color={locked ? COLORS.evidence : COLORS.stamp} />

            {!locked && (
              <div
                style={{
                  position: 'absolute',
                  left: 22,
                  right: 22,
                  top: 20 + scanProgress * 264,
                  height: 3,
                  background: `linear-gradient(90deg, transparent, ${COLORS.stamp}, transparent)`,
                  boxShadow: `0 0 16px ${COLORS.stamp}`,
                }}
              />
            )}

            <AbsoluteFill style={{ background: '#fffdf8', opacity: flash }} />

            <div
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                opacity: locked ? Math.min(1, enter(80, 14) * 1.6) : 0,
                transform: `scale(${locked ? 0.7 + 0.3 * enter(80, 14) : 0.7})`,
                border: `1px solid ${COLORS.evidence}`,
                color: COLORS.evidence,
                background: 'rgba(46,107,79,0.08)',
                fontFamily: FONT.mono,
                fontSize: 13,
                letterSpacing: '0.14em',
                padding: '5px 10px',
                borderRadius: 3,
              }}
            >
              OKUNDU
            </div>
          </div>

          <div style={{ padding: '20px 4px 0' }}>
            <div style={{ fontFamily: FONT.mono, fontSize: 13, letterSpacing: '0.14em', color: COLORS.faded }}>EAN-13</div>
            <div style={{ fontFamily: FONT.mono, fontSize: 32, fontWeight: 700, letterSpacing: '0.03em', marginTop: 6 }}>
              {EAN}
            </div>
          </div>

          <div style={{ marginTop: 18, padding: '0 4px' }}>
            <div style={{ fontFamily: FONT.mono, fontSize: 13, letterSpacing: '0.16em', color: COLORS.faded }}>
              SON TARAMALAR
            </div>
            {RECENT.map((item) => (
              <div
                key={item.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: `1px dashed ${COLORS.border}`,
                  padding: '11px 0',
                  marginTop: 10,
                }}
              >
                <span style={{ fontSize: 18, color: COLORS.ink }}>{item.name}</span>
                <span style={{ fontFamily: FONT.mono, fontSize: 13, letterSpacing: '0.08em', color: item.color }}>
                  {item.rating}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Sorgu sürerken dosya iskeleti: sağ taraf boş kalmaz. */}
        <div
          style={{
            position: 'absolute',
            left: 456,
            top: 50,
            width: 740,
            height: 620,
            borderRadius: 12,
            border: `1px solid ${COLORS.border}`,
            background: COLORS.card,
            boxShadow: '0 18px 40px rgba(28,27,23,0.06)',
            padding: 28,
            opacity: skeletonIn * skeletonOut,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Chip>Ürün Dosyası</Chip>
            <span style={{ fontFamily: FONT.mono, fontSize: 14, letterSpacing: '0.12em', color: COLORS.faded }}>
              BARKOD SORGULANIYOR…
            </span>
          </div>
          {[0, 1, 2, 3, 4].map((index) => (
            <div
              key={index}
              style={{
                marginTop: index === 0 ? 34 : 26,
                height: index === 0 ? 40 : 22,
                width: index === 0 ? '64%' : `${88 - index * 9}%`,
                borderRadius: 4,
                background: COLORS.border,
                opacity: 0.55 + 0.25 * Math.sin(frame * 0.22 + index),
              }}
            />
          ))}
        </div>

        {/* Ürün dosyası: deliller ve sonuç */}
        <div
          style={{
            position: 'absolute',
            left: 456,
            top: 50,
            width: 740,
            height: 620,
            borderRadius: 12,
            border: `1px solid ${COLORS.border}`,
            background: COLORS.card,
            boxShadow: '0 18px 40px rgba(28,27,23,0.10)',
            padding: 28,
            opacity: dossierIn,
            transform: `translateX(${(1 - dossierIn) * 34}px)`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Chip color={COLORS.stamp}>Ürün Dosyası</Chip>
            <Chip>Örnek Kayıt</Chip>
          </div>

          <div style={{ fontFamily: FONT.display, fontSize: 50, marginTop: 16, lineHeight: 1.1 }}>Örnek Ürün 500 g</div>
          <div style={{ fontFamily: FONT.mono, fontSize: 17, letterSpacing: '0.06em', color: COLORS.faded, marginTop: 10 }}>
            {EAN} · ÖRNEK MARKA
          </div>

          <div style={{ height: 1, background: COLORS.border, margin: '20px 0 4px' }} />

          {EVIDENCE.map((item, index) => {
            const rowIn = enter(96 + index * 16)
            const pillIn = spring({
              frame: frame - (108 + index * 16),
              fps,
              config: { damping: 12, mass: 0.6, stiffness: 220 },
            })
            return (
              <div
                key={item.topic}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 18,
                  height: 96,
                  borderBottom: `1px dashed ${COLORS.border}`,
                  opacity: rowIn,
                  transform: `translateY(${(1 - rowIn) * 16}px)`,
                }}
              >
                <span style={{ fontFamily: FONT.mono, fontSize: 16, letterSpacing: '0.12em', color: COLORS.faded, width: 118 }}>
                  {item.topic}
                </span>
                <span style={{ flex: 1, fontSize: 30, color: COLORS.ink }}>{item.reason}</span>
                <span
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 15,
                    letterSpacing: '0.1em',
                    color: item.color,
                    background: item.tint,
                    border: `1.5px solid ${item.color}`,
                    borderRadius: 999,
                    padding: '6px 14px',
                    transform: `scale(${0.7 + 0.3 * pillIn}) rotate(${(1 - pillIn) * -8}deg)`,
                    opacity: Math.min(1, pillIn * 2),
                  }}
                >
                  {item.rating}
                </span>
              </div>
            )
          })}

          <div
            style={{
              marginTop: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 18,
              border: `1px solid ${COLORS.border}`,
              background: COLORS.paper,
              borderRadius: 8,
              padding: '18px 22px',
              opacity: resultIn,
              transform: `translateY(${(1 - resultIn) * 12}px)`,
            }}
          >
            <div>
              <div style={{ fontFamily: FONT.mono, fontSize: 13, letterSpacing: '0.16em', color: COLORS.faded }}>
                SONUÇ · 3 DELİL
              </div>
              <div style={{ fontFamily: FONT.display, fontSize: 38, marginTop: 4 }}>Dikkatli tüket</div>
            </div>
            <span
              style={{
                fontFamily: FONT.mono,
                fontSize: 16,
                letterSpacing: '0.1em',
                color: COLORS.stamp,
                background: 'rgba(179,52,30,0.08)',
                border: `2px solid ${COLORS.stamp}`,
                borderRadius: 999,
                padding: '8px 18px',
              }}
            >
              RİSKLİ
            </span>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
