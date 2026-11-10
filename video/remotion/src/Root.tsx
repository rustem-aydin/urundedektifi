import { Composition } from 'remotion'
import { HeroDemo } from './HeroDemo'
import type { ThemeName } from './theme'

export const RemotionRoot: React.FC = () => {
  const props: { theme: ThemeName } = { theme: 'light' }
  return (
    <Composition
      id="HeroDemo"
      component={HeroDemo}
      durationInFrames={300}
      fps={30}
      width={1280}
      height={720}
      defaultProps={props}
    />
  )
}
