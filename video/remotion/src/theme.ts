import { loadFont } from '@remotion/fonts'
import { staticFile } from 'remotion'

// Marka tipografisi sitenin kendisiyle aynı: Special Elite (daktilo), Inter, JetBrains Mono.
loadFont({ family: 'Special Elite', url: staticFile('fonts/special-elite-latin.woff2'), weight: '400' })
loadFont({ family: 'Inter', url: staticFile('fonts/inter-latin.woff2'), weight: '400 800' })
loadFont({ family: 'JetBrains Mono', url: staticFile('fonts/jetbrains-mono-latin.woff2'), weight: '500 700' })

export type ThemeName = 'light' | 'dark'

export type Palette = {
  paper: string
  card: string
  camera: string
  ink: string
  border: string
  faded: string
  stamp: string
  tape: string
  evidence: string
  flash: string
  flashOpacity: number
  doubt: string
  onClean: string
  onRisk: string
  onDoubt: string
  gridDot: string
  shadow: string
  shadowSoft: string
}

// Sitenin index.css paletiyle birebir: light :root, dark .dark bloğu.
export const PALETTES: Record<ThemeName, Palette> = {
  light: {
    paper: '#f7f4ee',
    card: '#fcfbf7',
    camera: '#fffdf8',
    ink: '#1c1b17',
    border: '#d9d4c6',
    faded: '#6e6a5e',
    stamp: '#b3341e',
    tape: '#e8b93c',
    evidence: '#2e6b4f',
    flash: '#fffdf8',
    flashOpacity: 0.9,
    doubt: '#e8b93c',
    onClean: '#f7f4ee',
    onRisk: '#f7f4ee',
    onDoubt: '#1c1b17',
    gridDot: 'rgba(28,27,23,0.075)',
    shadow: '0 18px 40px rgba(28,27,23,0.12)',
    shadowSoft: '0 18px 40px rgba(28,27,23,0.10)',
  },
  dark: {
    paper: '#1c1b17',
    card: '#25241e',
    camera: '#201f1a',
    ink: '#f7f4ee',
    border: '#3d3a30',
    faded: '#a39e8e',
    stamp: '#d0553a',
    tape: '#e8b93c',
    evidence: '#5aa37f',
    flash: '#f7f4ee',
    flashOpacity: 0.55,
    doubt: '#e8b93c',
    onClean: '#0f2419',
    onRisk: '#1c1b17',
    onDoubt: '#1c1b17',
    gridDot: 'rgba(247,244,238,0.09)',
    shadow: '0 18px 40px rgba(0,0,0,0.55)',
    shadowSoft: '0 18px 40px rgba(0,0,0,0.45)',
  },
}

export const FONT = {
  display: '"Special Elite", "JetBrains Mono", monospace',
  sans: 'Inter, ui-sans-serif, system-ui, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
} as const
