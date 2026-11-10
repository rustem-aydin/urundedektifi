import { loadFont } from '@remotion/fonts'
import { staticFile } from 'remotion'

// Marka tipografisi sitenin kendisiyle aynı: Special Elite (daktilo), Inter, JetBrains Mono.
loadFont({ family: 'Special Elite', url: staticFile('fonts/special-elite-latin.woff2'), weight: '400' })
loadFont({ family: 'Inter', url: staticFile('fonts/inter-latin.woff2'), weight: '400 800' })
loadFont({ family: 'JetBrains Mono', url: staticFile('fonts/jetbrains-mono-latin.woff2'), weight: '500 700' })

export const COLORS = {
  paper: '#f7f4ee',
  card: '#fcfbf7',
  ink: '#1c1b17',
  border: '#d9d4c6',
  faded: '#6e6a5e',
  stamp: '#b3341e',
  tape: '#e8b93c',
  evidence: '#2e6b4f',
} as const

export const FONT = {
  display: '"Special Elite", "JetBrains Mono", monospace',
  sans: 'Inter, ui-sans-serif, system-ui, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
} as const
