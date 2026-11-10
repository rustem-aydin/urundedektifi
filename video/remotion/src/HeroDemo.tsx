import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { Barcode } from './Barcode'
import { FONT, PALETTES, type Palette, type ThemeName } from './theme'

const EAN = '8690123456789'

type Tone = 'clean' | 'risk' | 'doubt'

const EVIDENCE: { topic: string; reason: string; rating: string; tone: Tone }[] = [
  { topic: 'BOYKOT', reason: 'Marka kaydı temiz', rating: 'TEMİZ', tone: 'clean' },
  { topic: 'SAĞLIK', reason: 'Katkı: E621 (MSG)', rating: 'RİSKLİ', tone: 'risk' },
  { topic: 'HELAL', reason: 'Jelatin türevi', rating: 'ŞÜPHELİ', tone: 'doubt' },
]

const RECENT: { name: string; rating: string; tone: Tone }[] = [
  { name: 'Örnek Kraker 150 g', rating: 'RİSKLİ', tone: 'risk' },
  { name: 'Örnek Süt 1 L', rating: 'TEMİZ', tone: 'clean' },
]

const toneColor = (palette: Palette, tone: Tone) =>
  tone === 'clean' ? palette.evidence : tone === 'risk' ? palette.stamp : palette.doubt

const toneOn = (palette: Palette, tone: Tone) =>
  tone === 'clean' ? palette.onClean : tone === 'risk' ? palette.onRisk : palette.onDoubt

/** Dolu rozet: tint + ince çizgi yerine doygun zemin; video küçükte de okunur. */
const Badge: React.FC<{
  label: string
  bg: string
  fg: string
  size?: number
  padding?: string
  radius?: number
  style?: React.CSSProperties
}> = ({ label, bg, fg, size = 17, padding = '8px 18px', radius = 999, style }) => (
  <span
    style={{
      display: 'inline-block',
      background: bg,
      color: fg,
      fontFamily: FONT.mono,
      fontWeight: 700,
      fontSize: size,
      letterSpacing: '0.08em',
      lineHeight: 1,
      padding,
      borderRadius: radius,
      boxShadow: '0 2px 10px rgba(0,0,0,0.28)',
      ...style,
    }}
  >
    {label}
  </span>
)

const Chip: React.FC<{ children: React.ReactNode; color: string; solid?: boolean; text?: string }> = ({
  children,
  color,
  solid = false,
  text,
}) => (
  <span
    style={{
      display: 'inline-block',
      border: `${solid ? 2 : 1.5}px solid ${color}`,
      background: solid ? color : 'transparent',
      color: solid ? (text ?? '#f7f4ee') : color,
      fontFamily: FONT.mono,
      fontWeight: solid ? 700 : 600,
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

export const HeroDemo: React.FC<{ theme?: ThemeName }> = ({ theme = 'light' }) => {
  const p = PALETTES[theme]
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const enter = (delay: number, damping = 200) =>
    spring({ frame: frame - delay, fps, config: { damping, mass: 0.7, stiffness: 120 } })

  const scanProgress = interpolate(frame, [20, 76], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const locked = frame >= 78
  const flash = frame < 78 ? 0 : interpolate(frame, [78, 88], [p.flashOpacity, 0], { extrapolateRight: 'clamp' })
  const stageScale = interpolate(frame, [0, 300], [1, 1.02])

  const phoneIn = enter(4)
  const skeletonIn = enter(26)
  const skeletonOut = interpolate(frame, [76, 86], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const dossierIn = enter(80)
  const resultIn = enter(150)

  return (
    <AbsoluteFill style={{ backgroundColor: p.paper, fontFamily: FONT.sans, color: p.ink }}>
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(circle, ${p.gridDot} 1px, transparent 1px)`,
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
            border: `1px solid ${p.border}`,
            background: p.card,
            boxShadow: p.shadow,
            padding: 18,
            opacity: phoneIn,
            transform: `translateY(${(1 - phoneIn) * 40}px)`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px 14px' }}>
            <span style={{ fontFamily: FONT.mono, fontSize: 13, letterSpacing: '0.16em', color: p.faded }}>
              BARKOD TARA
            </span>
            <div style={{ display: 'flex', gap: 5 }}>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={{ width: 7, height: 7, borderRadius: 99, background: i === 0 ? p.stamp : p.border }}
                />
              ))}
            </div>
          </div>

          <div
            style={{
              position: 'relative',
              height: 306,
              borderRadius: 14,
              border: `1px solid ${p.border}`,
              background: p.camera,
              overflow: 'hidden',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Barcode value={EAN} width={260} height={120} color={p.ink} opacity={locked ? 0.9 : 1} />
            <Corner x={18} y={54} dx={-1} dy={-1} color={locked ? p.evidence : p.stamp} />
            <Corner x={292} y={54} dx={1} dy={-1} color={locked ? p.evidence : p.stamp} />
            <Corner x={18} y={224} dx={-1} dy={1} color={locked ? p.evidence : p.stamp} />
            <Corner x={292} y={224} dx={1} dy={1} color={locked ? p.evidence : p.stamp} />

            {!locked && (
              <div
                style={{
                  position: 'absolute',
                  left: 22,
                  right: 22,
                  top: 20 + scanProgress * 264,
                  height: 3,
                  background: `linear-gradient(90deg, transparent, ${p.stamp}, transparent)`,
                  boxShadow: `0 0 16px ${p.stamp}`,
                }}
              />
            )}

            <AbsoluteFill style={{ background: p.flash, opacity: flash }} />

            <div
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                opacity: locked ? Math.min(1, enter(80, 14) * 1.6) : 0,
                transform: `scale(${locked ? 0.7 + 0.3 * enter(80, 14) : 0.7})`,
              }}
            >
              <Badge label="OKUNDU" bg={p.evidence} fg={p.onClean} size={13} padding="5px 11px" radius={4} />
            </div>
          </div>

          <div style={{ padding: '20px 4px 0' }}>
            <div style={{ fontFamily: FONT.mono, fontSize: 13, letterSpacing: '0.14em', color: p.faded }}>EAN-13</div>
            <div style={{ fontFamily: FONT.mono, fontSize: 32, fontWeight: 700, letterSpacing: '0.03em', marginTop: 6 }}>
              {EAN}
            </div>
          </div>

          <div style={{ marginTop: 18, padding: '0 4px' }}>
            <div style={{ fontFamily: FONT.mono, fontSize: 13, letterSpacing: '0.16em', color: p.faded }}>
              SON TARAMALAR
            </div>
            {RECENT.map((item) => (
              <div
                key={item.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: `1px dashed ${p.border}`,
                  padding: '11px 0',
                  marginTop: 10,
                }}
              >
                <span style={{ fontSize: 18, color: p.ink }}>{item.name}</span>
                <Badge
                  label={item.rating}
                  bg={toneColor(p, item.tone)}
                  fg={toneOn(p, item.tone)}
                  size={11}
                  padding="4px 9px"
                  radius={999}
                />
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
            border: `1px solid ${p.border}`,
            background: p.card,
            boxShadow: p.shadowSoft,
            padding: 28,
            opacity: skeletonIn * skeletonOut,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Chip color={p.faded}>Ürün Dosyası</Chip>
            <span style={{ fontFamily: FONT.mono, fontSize: 14, letterSpacing: '0.12em', color: p.faded }}>
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
                background: p.border,
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
            border: `1px solid ${p.border}`,
            background: p.card,
            boxShadow: p.shadowSoft,
            padding: 28,
            opacity: dossierIn,
            transform: `translateX(${(1 - dossierIn) * 34}px)`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Chip color={p.stamp} solid text={p.onRisk}>
              Ürün Dosyası
            </Chip>
            <Chip color={p.faded}>Örnek Kayıt</Chip>
          </div>

          <div style={{ fontFamily: FONT.display, fontSize: 50, marginTop: 16, lineHeight: 1.1 }}>Örnek Ürün 500 g</div>
          <div style={{ fontFamily: FONT.mono, fontSize: 17, letterSpacing: '0.06em', color: p.faded, marginTop: 10 }}>
            {EAN} · ÖRNEK MARKA
          </div>

          <div style={{ height: 1, background: p.border, margin: '20px 0 4px' }} />

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
                  borderBottom: `1px dashed ${p.border}`,
                  opacity: rowIn,
                  transform: `translateY(${(1 - rowIn) * 16}px)`,
                }}
              >
                <span style={{ fontFamily: FONT.mono, fontSize: 16, letterSpacing: '0.12em', color: p.faded, width: 118 }}>
                  {item.topic}
                </span>
                <span style={{ flex: 1, fontSize: 30, color: p.ink }}>{item.reason}</span>
                <Badge
                  label={item.rating}
                  bg={toneColor(p, item.tone)}
                  fg={toneOn(p, item.tone)}
                  style={{
                    transform: `scale(${0.7 + 0.3 * pillIn}) rotate(${(1 - pillIn) * -8}deg)`,
                    opacity: Math.min(1, pillIn * 2),
                  }}
                />
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
              border: `1px solid ${p.border}`,
              background: p.paper,
              borderRadius: 8,
              padding: '18px 22px',
              opacity: resultIn,
              transform: `translateY(${(1 - resultIn) * 12}px)`,
            }}
          >
            <div>
              <div style={{ fontFamily: FONT.mono, fontSize: 13, letterSpacing: '0.16em', color: p.faded }}>
                SONUÇ · 3 DELİL
              </div>
              <div style={{ fontFamily: FONT.display, fontSize: 38, marginTop: 4 }}>Dikkatli tüket</div>
            </div>
            <Badge label="RİSKLİ" bg={p.stamp} fg={p.onRisk} size={18} padding="9px 20px" />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
