// EAN-13 çubuklarını gerçek kodlama tablosuyla üretir; çizim rastgele değil.
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111']
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100']
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL']

const encodeEan13 = (value: string): string => {
  const digits = value.replace(/\D/g, '').padStart(13, '0').slice(0, 13)
  const parity = PARITY[Number(digits[0])]
  let bits = '101'
  for (let i = 1; i <= 6; i++) {
    bits += (parity[i - 1] === 'L' ? L : G)[Number(digits[i])]
  }
  bits += '01010'
  for (let i = 7; i <= 12; i++) {
    bits += R[Number(digits[i])]
  }
  return `${bits}101`
}

export const Barcode: React.FC<{
  value: string
  width: number
  height: number
  color: string
  /** 0-1 arası, soldan sağa açılan çubuk oranı (çizim animasyonu için). */
  reveal?: number
  opacity?: number
}> = ({ value, width, height, color, reveal = 1, opacity = 1 }) => {
  const bits = encodeEan13(value)
  const moduleWidth = width / bits.length
  const bars = []
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] !== '1') continue
    const x = i * moduleWidth
    if (x > width * reveal) continue
    const w = Math.min(moduleWidth, Math.max(0.4, width * reveal - x))
    bars.push(<rect key={i} x={x} y={0} width={w} height={height} fill={color} />)
  }
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ opacity, display: 'block' }}>
      {bars}
    </svg>
  )
}
