/**
 * Exercise detector registry.
 * Import and export all exercise detectors here for easy access.
 */

export type { ExerciseDetector, ExerciseConfig, ExerciseState } from '../types';

export { SquatDetector } from './SquatDetector';
export type { SquatConfig } from './SquatDetector';

export { PushUpDetector } from './PushUpDetector';
export type { PushUpConfig } from './PushUpDetector';

export { PlankDetector } from './PlankDetector';
export type { PlankConfig } from './PlankDetector';

export { JumpingJackDetector } from './JumpingJackDetector';
export type { JumpingJackConfig } from './JumpingJackDetector';

export { ArmHoldDetector } from './ArmHoldDetector';
export type { ArmHoldConfig } from './ArmHoldDetector';

export { WallSitDetector } from './WallSitDetector';
export type { WallSitConfig } from './WallSitDetector';

export { OverheadPressDetector } from './OverheadPressDetector';
export type { OverheadPressConfig } from './OverheadPressDetector';

export { LungeDetector } from './LungeDetector';
export type { LungeConfig } from './LungeDetector';

export { HighKneesDetector } from './HighKneesDetector';
export type { HighKneesConfig } from './HighKneesDetector';

export { FrontRaiseDetector } from './FrontRaiseDetector';
export type { FrontRaiseConfig } from './FrontRaiseDetector';
