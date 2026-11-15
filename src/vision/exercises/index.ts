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

// Future detectors:
// export { JumpingJackDetector } from './JumpingJackDetector';
