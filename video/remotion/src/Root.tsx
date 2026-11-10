import { Composition } from 'remotion'
import { HeroDemo } from './HeroDemo'

export const RemotionRoot: React.FC = () => (
  <Composition id="HeroDemo" component={HeroDemo} durationInFrames={300} fps={30} width={1280} height={720} />
)
