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
  { name: 'Örnek Çikolata 80 g', rating: 'ŞÜPHELİ', color: '#8a6a12' },
]

const Chip: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = COLORS.faded }) => (
  <span
    style={{
      display: 'inline-block',
      border: `1px solid ${color}`,
      color,
      fontFamily: FONT.mono,
      fontSize: 10,
      letterSpacing: '0.18em',
      padding: '4px 8px',
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
      width: 26,
      height: 26,
      borderTop: dy < 0 ? `2px solid ${color}` : undefined,
      borderBottom: dy > 0 ? `2px solid ${color}` : undefined,
      borderLeft: dx < 0 ? `2px solid ${color}` : undefined,
      borderRight: dx > 0 ? `2px solid ${color}` : undefined,
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
  const shake = frame >= 168 && frame < 182 ? Math.sin((frame - 168) * 2.6) * 3 : 0
  const stageScale = interpolate(frame, [0, 300], [1, 1.02])

  const phoneIn = enter(4)
  const skeletonIn = enter(26)
  const skeletonOut = interpolate(frame, [76, 86], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const dossierIn = enter(80)
  const stampIn = spring({ frame: frame - 166, fps, config: { damping: 11, mass: 0.9, stiffness: 180 } })

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.paper, fontFamily: FONT.sans, color: COLORS.ink }}>
      <AbsoluteFill
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(28,27,23,0.075) 1px, transparent 1px)',
          backgroundSize: '26px 26px',
          opacity: 0.55,
        }}
      />
      <AbsoluteFill style={{ transform: `scale(${stageScale}) translate(${shake}px, ${shake * 0.4}px)` }}>
        {/* Telefon: barkod okuma akışı */}
        <div
          style={{
            position: 'absolute',
            left: 106,
            top: 70,
            width: 340,
            height: 580,
            borderRadius: 26,
            border: `1px solid ${COLORS.border}`,
            background: COLORS.card,
            boxShadow: '0 18px 40px rgba(28,27,23,0.12)',
            padding: 14,
            opacity: phoneIn,
            transform: `translateY(${(1 - phoneIn) * 40}px)`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px 12px' }}>
            <span style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: '0.2em', color: COLORS.faded }}>
              BARKOD TARA
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={{ width: 5, height: 5, borderRadius: 99, background: i === 0 ? COLORS.stamp : COLORS.border }}
                />
              ))}
            </div>
          </div>

          <div
            style={{
              position: 'relative',
              height: 288,
              borderRadius: 14,
              border: `1px solid ${COLORS.border}`,
              background: '#fffdf8',
              overflow: 'hidden',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Barcode value={EAN} width={244} height={96} color={COLORS.ink} opacity={locked ? 0.9 : 1} />
            <Corner x={36} y={54} dx={-1} dy={-1} color={locked ? COLORS.evidence : COLORS.stamp} />
            <Corner x={278} y={54} dx={1} dy={-1} color={locked ? COLORS.evidence : COLORS.stamp} />
            <Corner x={36} y={208} dx={-1} dy={1} color={locked ? COLORS.evidence : COLORS.stamp} />
            <Corner x={278} y={208} dx={1} dy={1} color={locked ? COLORS.evidence : COLORS.stamp} />

            {!locked && (
              <div
                style={{
                  position: 'absolute',
                  left: 32,
                  right: 32,
                  top: 22 + scanProgress * 240,
                  height: 2,
                  background: `linear-gradient(90deg, transparent, ${COLORS.stamp}, transparent)`,
                  boxShadow: `0 0 14px ${COLORS.stamp}`,
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
                fontSize: 10,
                letterSpacing: '0.16em',
                padding: '3px 7px',
                borderRadius: 3,
              }}
            >
              OKUNDU
            </div>
          </div>

          <div style={{ padding: '14px 6px 0' }}>
            <div style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: '0.14em', color: COLORS.faded }}>EAN-13</div>
            <div style={{ fontFamily: FONT.mono, fontSize: 19, fontWeight: 700, letterSpacing: '0.06em', marginTop: 4 }}>
              {EAN}
            </div>
          </div>

          <div style={{ marginTop: 16, padding: '0 6px' }}>
            <div style={{ fontFamily: FONT.mono, fontSize: 9.5, letterSpacing: '0.2em', color: COLORS.faded }}>
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
                  padding: '9px 0',
                  marginTop: 8,
                }}
              >
                <span style={{ fontSize: 12.5, color: COLORS.ink }}>{item.name}</span>
                <span style={{ fontFamily: FONT.mono, fontSize: 9, letterSpacing: '0.12em', color: item.color }}>
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
            left: 474,
            top: 70,
            width: 700,
            height: 580,
            borderRadius: 12,
            border: `1px solid ${COLORS.border}`,
            background: COLORS.card,
            boxShadow: '0 18px 40px rgba(28,27,23,0.06)',
            padding: 26,
            opacity: skeletonIn * skeletonOut,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Chip>Ürün Dosyası</Chip>
            <span style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: '0.16em', color: COLORS.faded }}>
              BARKOD SORGULANIYOR…
            </span>
          </div>
          {[0, 1, 2, 3, 4].map((index) => (
            <div
              key={index}
              style={{
                marginTop: index === 0 ? 26 : 22,
                height: index === 0 ? 30 : 16,
                width: index === 0 ? '62%' : `${86 - index * 9}%`,
                borderRadius: 4,
                background: COLORS.border,
                opacity: 0.55 + 0.25 * Math.sin(frame * 0.22 + index),
              }}
            />
          ))}
        </div>

        {/* Ürün dosyası: deliller ve hüküm */}
        <div
          style={{
            position: 'absolute',
            left: 474,
            top: 70,
            width: 700,
            height: 580,
            borderRadius: 12,
            border: `1px solid ${COLORS.border}`,
            background: COLORS.card,
            boxShadow: '0 18px 40px rgba(28,27,23,0.10)',
            padding: 26,
            opacity: dossierIn,
            transform: `translateX(${(1 - dossierIn) * 34}px)`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Chip color={COLORS.stamp}>Ürün Dosyası</Chip>
            <Chip>Örnek Kayıt</Chip>
          </div>

          <div style={{ fontFamily: FONT.display, fontSize: 32, marginTop: 14, lineHeight: 1.15 }}>Örnek Ürün 500 g</div>
          <div style={{ fontFamily: FONT.mono, fontSize: 11.5, letterSpacing: '0.1em', color: COLORS.faded, marginTop: 8 }}>
            {EAN} · ÖRNEK MARKA · 500 g
          </div>

          <div style={{ height: 1, background: COLORS.border, margin: '18px 0 4px' }} />

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
                  gap: 14,
                  height: 76,
                  borderBottom: `1px dashed ${COLORS.border}`,
                  opacity: rowIn,
                  transform: `translateY(${(1 - rowIn) * 16}px)`,
                }}
              >
                <span style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: '0.16em', color: COLORS.faded, width: 92 }}>
                  {item.topic}
                </span>
                <span style={{ flex: 1, fontSize: 15.5, color: COLORS.ink }}>{item.reason}</span>
                <span
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 10.5,
                    letterSpacing: '0.14em',
                    color: item.color,
                    background: item.tint,
                    border: `1px solid ${item.color}`,
                    borderRadius: 999,
                    padding: '4px 10px',
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
              marginTop: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 18,
              border: `1px solid ${COLORS.border}`,
              background: COLORS.paper,
              borderRadius: 8,
              padding: '14px 18px',
              opacity: enter(150),
            }}
          >
            <div>
              <div style={{ fontFamily: FONT.mono, fontSize: 9.5, letterSpacing: '0.2em', color: COLORS.faded }}>
                TOPLAM HÜKÜM · 3 DELİL
              </div>
              <div style={{ fontFamily: FONT.display, fontSize: 21, marginTop: 5 }}>Dikkatli tüket</div>
            </div>
            <div
              style={{
                border: `3px solid ${COLORS.stamp}`,
                color: COLORS.stamp,
                padding: '8px 16px 6px',
                transform: `rotate(${-14 + 5 * stampIn}deg) scale(${0.7 + 0.3 * stampIn})`,
                opacity: Math.min(1, stampIn * 1.6),
                textAlign: 'center',
              }}
            >
              <div style={{ fontFamily: FONT.display, fontSize: 24, letterSpacing: '0.12em', lineHeight: 1 }}>HÜKÜM</div>
              <div style={{ fontFamily: FONT.mono, fontSize: 8.5, letterSpacing: '0.22em', marginTop: 4 }}>2 UZMAN KURALI</div>
            </div>
          </div>

          {/* Dosyanın kapsadığı bölümler: uygulamanın ürün dosyasında ne sunduğunu gösterir. */}
          <div
            style={{
              position: 'absolute',
              left: 26,
              bottom: 22,
              display: 'flex',
              gap: 8,
              opacity: enter(190),
            }}
          >
            {['İçindekiler', 'Besin', 'Alerjen', 'Menşe', 'Fiyat'].map((label) => (
              <Chip key={label}>{label}</Chip>
            ))}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
