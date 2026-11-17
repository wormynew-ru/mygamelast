/**
 * ScriptedPoseSource - Deterministic 33-landmark synthetic pose generator.
 *
 * Generates realistic, anatomically proportioned 2D/3D landmarks at any timestamp
 * for all 10 supported exercises so camera-free tests and interactive demos run
 * through the exact same PoseTracker + ExerciseDetector pipeline.
 *
 * ZERO dependencies on React, Zustand, or game logic.
 */

import type { Landmark, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { PoseLandmark } from './types';

export interface ScriptedPoseFrame {
  landmarks: NormalizedLandmark[];
  worldLandmarks: Landmark[];
}

export type ScriptedPoseGenerator = (timestampMs: number) => ScriptedPoseFrame;

function createBasePose(): NormalizedLandmark[] {
  const landmarks: NormalizedLandmark[] = Array(33)
    .fill(null)
    .map(() => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.98 }));

  // Face
  landmarks[PoseLandmark.NOSE] = { x: 0.5, y: 0.16, z: 0, visibility: 0.98 };
  landmarks[PoseLandmark.LEFT_EYE] = { x: 0.485, y: 0.145, z: 0, visibility: 0.98 };
  landmarks[PoseLandmark.RIGHT_EYE] = { x: 0.515, y: 0.145, z: 0, visibility: 0.98 };
  landmarks[PoseLandmark.LEFT_EAR] = { x: 0.47, y: 0.155, z: 0, visibility: 0.98 };
  landmarks[PoseLandmark.RIGHT_EAR] = { x: 0.53, y: 0.155, z: 0, visibility: 0.98 };
  landmarks[PoseLandmark.MOUTH_LEFT] = { x: 0.49, y: 0.18, z: 0, visibility: 0.98 };
  landmarks[PoseLandmark.MOUTH_RIGHT] = { x: 0.51, y: 0.18, z: 0, visibility: 0.98 };

  // Shoulders
  landmarks[PoseLandmark.LEFT_SHOULDER] = { x: 0.43, y: 0.27, z: 0, visibility: 0.98 };
  landmarks[PoseLandmark.RIGHT_SHOULDER] = { x: 0.57, y: 0.27, z: 0, visibility: 0.98 };

  // Arms hanging neutrally
  landmarks[PoseLandmark.LEFT_ELBOW] = { x: 0.4, y: 0.41, z: 0, visibility: 0.98 };
  landmarks[PoseLandmark.RIGHT_ELBOW] = { x: 0.6, y: 0.41, z: 0, visibility: 0.98 };
  landmarks[PoseLandmark.LEFT_WRIST] = { x: 0.39, y: 0.54, z: 0, visibility: 0.98 };
  landmarks[PoseLandmark.RIGHT_WRIST] = { x: 0.61, y: 0.54, z: 0, visibility: 0.98 };
  landmarks[PoseLandmark.LEFT_PINKY] = { x: 0.385, y: 0.56, z: 0, visibility: 0.98 };
  landmarks[PoseLandmark.RIGHT_PINKY] = { x: 0.615, y: 0.56, z: 0, visibility: 0.98 };
  landmarks[PoseLandmark.LEFT_INDEX] = { x: 0.395, y: 0.565, z: 0, visibility: 0.98 };
  landmarks[PoseLandmark.RIGHT_INDEX] = { x: 0.605, y: 0.565, z: 0, visibility: 0.98 };
  landmarks[PoseLandmark.LEFT_THUMB] = { x: 0.4, y: 0.555, z: 0, visibility: 0.98 };
  landmarks[PoseLandmark.RIGHT_THUMB] = { x: 0.6, y: 0.555, z: 0, visibility: 0.98 };

  // Hips
  landmarks[PoseLandmark.LEFT_HIP] = { x: 0.45, y: 0.52, z: 0, visibility: 0.98 };
  landmarks[PoseLandmark.RIGHT_HIP] = { x: 0.55, y: 0.52, z: 0, visibility: 0.98 };

  // Legs standing straight (~176 deg)
  landmarks[PoseLandmark.LEFT_KNEE] = { x: 0.45, y: 0.71, z: 0, visibility: 0.98 };
  landmarks[PoseLandmark.RIGHT_KNEE] = { x: 0.55, y: 0.71, z: 0, visibility: 0.98 };
  landmarks[PoseLandmark.LEFT_ANKLE] = { x: 0.45, y: 0.9, z: 0, visibility: 0.98 };
  landmarks[PoseLandmark.RIGHT_ANKLE] = { x: 0.55, y: 0.9, z: 0, visibility: 0.98 };
  landmarks[PoseLandmark.LEFT_HEEL] = { x: 0.445, y: 0.92, z: 0, visibility: 0.98 };
  landmarks[PoseLandmark.RIGHT_HEEL] = { x: 0.555, y: 0.92, z: 0, visibility: 0.98 };
  landmarks[PoseLandmark.LEFT_FOOT_INDEX] = { x: 0.46, y: 0.93, z: 0, visibility: 0.98 };
  landmarks[PoseLandmark.RIGHT_FOOT_INDEX] = { x: 0.54, y: 0.93, z: 0, visibility: 0.98 };

  return landmarks;
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function smoothWave(elapsedMs: number, periodMs: number): number {
  const phase = ((elapsedMs % periodMs) + periodMs) % periodMs / periodMs;
  return 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
}

function buildSideBodyPose(bodyAngleDeg: number, elbowAngleDeg: number): NormalizedLandmark[] {
  const lm = createBasePose();
  // Occlude right side slightly so side-view detectors cleanly pick left side consistently
  const rightJoints = [
    PoseLandmark.RIGHT_SHOULDER,
    PoseLandmark.RIGHT_ELBOW,
    PoseLandmark.RIGHT_WRIST,
    PoseLandmark.RIGHT_HIP,
    PoseLandmark.RIGHT_KNEE,
    PoseLandmark.RIGHT_ANKLE,
  ];
  for (const idx of rightJoints) {
    lm[idx].visibility = 0.25;
  }

  // Horizontal torso plank/push-up posture facing left
  const shoulder = { x: 0.34, y: 0.48, z: 0, visibility: 0.98 };
  const hip = { x: 0.55, y: 0.48, z: 0, visibility: 0.98 };
  const bodyBendRad = degToRad(180 - bodyAngleDeg);
  const legLen = 0.24;
  const knee = {
    x: hip.x + legLen * 0.5 * Math.cos(bodyBendRad),
    y: hip.y + legLen * 0.5 * Math.sin(bodyBendRad),
    z: 0,
    visibility: 0.98,
  };
  const ankle = {
    x: hip.x + legLen * Math.cos(bodyBendRad),
    y: hip.y + legLen * Math.sin(bodyBendRad),
    z: 0,
    visibility: 0.98,
  };

  // Arm from shoulder -> elbow -> wrist forming elbowAngleDeg
  const upperArm = 0.14;
  const forearm = 0.14;
  const halfFlex = degToRad((180 - elbowAngleDeg) * 0.5);
  const elbow = {
    x: shoulder.x + upperArm * Math.sin(halfFlex),
    y: shoulder.y + upperArm * Math.cos(halfFlex),
    z: 0,
    visibility: 0.98,
  };
  const wrist = {
    x: elbow.x - forearm * Math.sin(halfFlex),
    y: elbow.y + forearm * Math.cos(halfFlex),
    z: 0,
    visibility: 0.98,
  };

  lm[PoseLandmark.NOSE] = { x: 0.26, y: 0.45, z: 0, visibility: 0.98 };
  lm[PoseLandmark.LEFT_SHOULDER] = shoulder;
  lm[PoseLandmark.LEFT_ELBOW] = elbow;
  lm[PoseLandmark.LEFT_WRIST] = wrist;
  lm[PoseLandmark.LEFT_HIP] = hip;
  lm[PoseLandmark.LEFT_KNEE] = knee;
  lm[PoseLandmark.LEFT_ANKLE] = ankle;
  return lm;
}

/**
 * Generates a single deterministic synthetic pose frame for the specified exercise at elapsedMs.
 */
export function generateScriptedPoseFrame(exerciseId: string, elapsedMs: number): ScriptedPoseFrame {
  const lm = createBasePose();
  const safeElapsed = Math.max(0, elapsedMs);

  switch (exerciseId) {
    case 'SQUAT': {
      const wave = smoothWave(safeElapsed, 1800);
      const kneeAngle = lerp(170, 82, wave);
      const rad = degToRad(180 - kneeAngle);
      const thigh = 0.19;
      const shin = 0.19;
      const hipDrop = wave * 0.14;

      const setLeg = (
        hipIdx: PoseLandmark,
        kneeIdx: PoseLandmark,
        ankleIdx: PoseLandmark,
        baseX: number,
        outward: number
      ) => {
        const knee = { x: baseX + outward * 0.02 * wave, y: 0.68, z: 0, visibility: 0.98 };
        const hip = {
          x: knee.x - thigh * Math.sin(rad * 0.5) * outward,
          y: 0.49 + hipDrop,
          z: 0,
          visibility: 0.98,
        };
        const ankle = {
          x: knee.x + shin * Math.sin(rad),
          y: knee.y + shin * Math.cos(rad),
          z: 0,
          visibility: 0.98,
        };
        lm[hipIdx] = hip;
        lm[kneeIdx] = knee;
        lm[ankleIdx] = ankle;
      };
      // Build exact hip-knee-ankle geometry with hip vertical above knee and ankle angled
      const kneeY = 0.68;
      const lKnee = { x: 0.45, y: kneeY, z: 0, visibility: 0.98 };
      const rKnee = { x: 0.55, y: kneeY, z: 0, visibility: 0.98 };
      void setLeg;
      lm[PoseLandmark.LEFT_HIP] = { x: 0.45, y: kneeY - thigh, z: 0, visibility: 0.98 };
      lm[PoseLandmark.RIGHT_HIP] = { x: 0.55, y: kneeY - thigh, z: 0, visibility: 0.98 };
      lm[PoseLandmark.LEFT_KNEE] = lKnee;
      lm[PoseLandmark.RIGHT_KNEE] = rKnee;
      lm[PoseLandmark.LEFT_ANKLE] = {
        x: lKnee.x + shin * Math.sin(rad),
        y: lKnee.y + shin * Math.cos(rad),
        z: 0,
        visibility: 0.98,
      };
      lm[PoseLandmark.RIGHT_ANKLE] = {
        x: rKnee.x + shin * Math.sin(rad),
        y: rKnee.y + shin * Math.cos(rad),
        z: 0,
        visibility: 0.98,
      };
      lm[PoseLandmark.LEFT_SHOULDER].y = 0.27 + hipDrop;
      lm[PoseLandmark.RIGHT_SHOULDER].y = 0.27 + hipDrop;
      lm[PoseLandmark.NOSE].y = 0.16 + hipDrop;
      break;
    }

    case 'PUSH_UP': {
      const wave = smoothWave(safeElapsed, 1800);
      const elbowAngle = lerp(172, 78, wave);
      const pushLm = buildSideBodyPose(178, elbowAngle);
      return { landmarks: pushLm, worldLandmarks: pushLm };
    }

    case 'PLANK': {
      // Rock-steady plank hold
      const plankLm = buildSideBodyPose(176, 95);
      return { landmarks: plankLm, worldLandmarks: plankLm };
    }

    case 'JUMPING_JACK': {
      const wave = smoothWave(safeElapsed, 1400);
      const armAngleDeg = lerp(18, 152, wave);
      const armRad = degToRad(armAngleDeg);
      const armLen = 0.26;
      const spreadRatio = lerp(0.9, 2.05, wave);
      const hipWidth = 0.1; // 0.55 - 0.45
      const halfSpread = (hipWidth * spreadRatio) * 0.5;

      // hip -> shoulder -> wrist angle = armAngleDeg
      // Since hip is directly below shoulder, vector shoulder->hip is straight down (0, +1).
      // Wrist relative to shoulder: horizontal = armLen*sin(armRad), vertical = armLen*cos(armRad).
      const lShoulder = lm[PoseLandmark.LEFT_SHOULDER];
      const rShoulder = lm[PoseLandmark.RIGHT_SHOULDER];
      lm[PoseLandmark.LEFT_WRIST] = {
        x: lShoulder.x - armLen * Math.sin(armRad),
        y: lShoulder.y + armLen * Math.cos(armRad),
        z: 0,
        visibility: 0.98,
      };
      lm[PoseLandmark.RIGHT_WRIST] = {
        x: rShoulder.x + armLen * Math.sin(armRad),
        y: rShoulder.y + armLen * Math.cos(armRad),
        z: 0,
        visibility: 0.98,
      };
      lm[PoseLandmark.LEFT_ELBOW] = {
        x: lerp(lShoulder.x, lm[PoseLandmark.LEFT_WRIST].x, 0.5),
        y: lerp(lShoulder.y, lm[PoseLandmark.LEFT_WRIST].y, 0.5),
        z: 0,
        visibility: 0.98,
      };
      lm[PoseLandmark.RIGHT_ELBOW] = {
        x: lerp(rShoulder.x, lm[PoseLandmark.RIGHT_WRIST].x, 0.5),
        y: lerp(rShoulder.y, lm[PoseLandmark.RIGHT_WRIST].y, 0.5),
        z: 0,
        visibility: 0.98,
      };

      lm[PoseLandmark.LEFT_ANKLE] = { x: 0.5 - halfSpread, y: 0.9, z: 0, visibility: 0.98 };
      lm[PoseLandmark.RIGHT_ANKLE] = { x: 0.5 + halfSpread, y: 0.9, z: 0, visibility: 0.98 };
      break;
    }

    case 'ARM_HOLD': {
      // Steady lateral T-pose: hip-shoulder-wrist = 90 deg, elbow = 178 deg
      lm[PoseLandmark.LEFT_ELBOW] = { x: 0.29, y: 0.27, z: 0, visibility: 0.98 };
      lm[PoseLandmark.RIGHT_ELBOW] = { x: 0.71, y: 0.27, z: 0, visibility: 0.98 };
      lm[PoseLandmark.LEFT_WRIST] = { x: 0.16, y: 0.27, z: 0, visibility: 0.98 };
      lm[PoseLandmark.RIGHT_WRIST] = { x: 0.84, y: 0.27, z: 0, visibility: 0.98 };
      break;
    }

    case 'WALL_SIT': {
      // Side-facing steady isometric sit: knee = 90 deg, hip = 95 deg
      const sitLm = createBasePose();
      sitLm[PoseLandmark.RIGHT_SHOULDER].visibility = 0.25;
      sitLm[PoseLandmark.RIGHT_HIP].visibility = 0.25;
      sitLm[PoseLandmark.RIGHT_KNEE].visibility = 0.25;
      sitLm[PoseLandmark.RIGHT_ANKLE].visibility = 0.25;

      sitLm[PoseLandmark.LEFT_SHOULDER] = { x: 0.42, y: 0.34, z: 0, visibility: 0.98 };
      sitLm[PoseLandmark.LEFT_HIP] = { x: 0.42, y: 0.58, z: 0, visibility: 0.98 };
      sitLm[PoseLandmark.LEFT_KNEE] = { x: 0.62, y: 0.58, z: 0, visibility: 0.98 };
      sitLm[PoseLandmark.LEFT_ANKLE] = { x: 0.62, y: 0.82, z: 0, visibility: 0.98 };
      return { landmarks: sitLm, worldLandmarks: sitLm };
    }

    case 'OVERHEAD_PRESS': {
      const wave = smoothWave(safeElapsed, 1600);
      const elbowAngle = lerp(90, 170, wave);
      // Keep wrists strictly overhead (shoulder.y - wrist.y >= 0.04)
      const rad = degToRad(elbowAngle);
      const upper = 0.11;
      const forearm = 0.12;
      // Place elbows out to the side slightly above shoulder so wrists always clear overhead check
      const lShoulder = lm[PoseLandmark.LEFT_SHOULDER];
      const rShoulder = lm[PoseLandmark.RIGHT_SHOULDER];
      const lElbow = { x: lShoulder.x - upper * 0.9, y: lShoulder.y - 0.03, z: 0, visibility: 0.98 };
      const rElbow = { x: rShoulder.x + upper * 0.9, y: rShoulder.y - 0.03, z: 0, visibility: 0.98 };
      // Forearm rotates outward/upward around elbow to form elbowAngle between elbow->shoulder and elbow->wrist
      const lDirToShoulderX = lShoulder.x - lElbow.x;
      const lDirToShoulderY = lShoulder.y - lElbow.y;
      const baseAngleL = Math.atan2(lDirToShoulderY, lDirToShoulderX);
      const wristAngleL = baseAngleL + rad;
      lm[PoseLandmark.LEFT_ELBOW] = lElbow;
      lm[PoseLandmark.LEFT_WRIST] = {
        x: lElbow.x + forearm * Math.cos(wristAngleL),
        y: Math.min(lShoulder.y - 0.05, lElbow.y + forearm * Math.sin(wristAngleL)),
        z: 0,
        visibility: 0.98,
      };
      // Symmetric right side mirrored
      const dxOffset = lShoulder.x - lm[PoseLandmark.LEFT_WRIST].x;
      lm[PoseLandmark.RIGHT_ELBOW] = rElbow;
      lm[PoseLandmark.RIGHT_WRIST] = {
        x: rShoulder.x + dxOffset,
        y: lm[PoseLandmark.LEFT_WRIST].y,
        z: 0,
        visibility: 0.98,
      };
      // Ensure overhead press exact elbow angle = elbowAngle:
      // Compute clean vertical-press geometry when arm goes from 90 deg bend above shoulder to 170 deg lockout
      const elbowY = lerp(lShoulder.y - 0.02, lShoulder.y - 0.11, wave);
      const elbowXOffset = lerp(0.11, 0.04, wave);
      const lE = { x: lShoulder.x - elbowXOffset, y: elbowY, z: 0, visibility: 0.98 };
      const rE = { x: rShoulder.x + elbowXOffset, y: elbowY, z: 0, visibility: 0.98 };
      const vX = lShoulder.x - lE.x;
      const vY = lShoulder.y - lE.y;
      const aBase = Math.atan2(vY, vX);
      const aWristL = aBase + degToRad(elbowAngle);
      lm[PoseLandmark.LEFT_ELBOW] = lE;
      lm[PoseLandmark.LEFT_WRIST] = {
        x: lE.x + forearm * Math.cos(aWristL),
        y: lE.y + forearm * Math.sin(aWristL),
        z: 0,
        visibility: 0.98,
      };
      const vRX = rShoulder.x - rE.x;
      const vRY = rShoulder.y - rE.y;
      const aBaseR = Math.atan2(vRY, vRX);
      const aWristR = aBaseR - degToRad(elbowAngle);
      lm[PoseLandmark.RIGHT_ELBOW] = rE;
      lm[PoseLandmark.RIGHT_WRIST] = {
        x: rE.x + forearm * Math.cos(aWristR),
        y: rE.y + forearm * Math.sin(aWristR),
        z: 0,
        visibility: 0.98,
      };
      break;
    }

    case 'LUNGE': {
      const wave = smoothWave(safeElapsed, 1800);
      const leadKneeAngle = lerp(170, 84, wave);
      const rad = degToRad(180 - leadKneeAngle);
      const shin = 0.2;
      const lKnee = { x: 0.42, y: 0.67, z: 0, visibility: 0.98 };
      lm[PoseLandmark.LEFT_HIP] = { x: 0.42, y: 0.47, z: 0, visibility: 0.98 };
      lm[PoseLandmark.LEFT_KNEE] = lKnee;
      lm[PoseLandmark.LEFT_ANKLE] = {
        x: lKnee.x + shin * Math.sin(rad),
        y: lKnee.y + shin * Math.cos(rad),
        z: 0,
        visibility: 0.98,
      };
      // Trailing leg straightish
      lm[PoseLandmark.RIGHT_HIP] = { x: 0.56, y: 0.5, z: 0, visibility: 0.98 };
      lm[PoseLandmark.RIGHT_KNEE] = { x: 0.58, y: 0.71, z: 0, visibility: 0.98 };
      lm[PoseLandmark.RIGHT_ANKLE] = { x: 0.6, y: 0.91, z: 0, visibility: 0.98 };
      break;
    }

    case 'HIGH_KNEES': {
      // 1600ms full cycle: first half lifts left leg, second half lifts right leg
      const cycle = ((safeElapsed % 1600) + 1600) % 1600 / 1600;
      const leftLift = cycle < 0.5 ? smoothWave(cycle * 2 * 1000, 1000) : 0;
      const rightLift = cycle >= 0.5 ? smoothWave((cycle - 0.5) * 2 * 1000, 1000) : 0;

      const setHipLift = (
        shoulderIdx: PoseLandmark,
        hipIdx: PoseLandmark,
        kneeIdx: PoseLandmark,
        ankleIdx: PoseLandmark,
        baseX: number,
        liftWave: number
      ) => {
        const angleDeg = lerp(172, 84, liftWave);
        const rad = degToRad(180 - angleDeg);
        const thigh = 0.2;
        lm[shoulderIdx] = { x: baseX, y: 0.27, z: 0, visibility: 0.98 };
        lm[hipIdx] = { x: baseX, y: 0.52, z: 0, visibility: 0.98 };
        const knee = {
          x: baseX + thigh * Math.sin(rad),
          y: 0.52 + thigh * Math.cos(rad),
          z: 0,
          visibility: 0.98,
        };
        lm[kneeIdx] = knee;
        lm[ankleIdx] = { x: knee.x, y: knee.y + 0.19, z: 0, visibility: 0.98 };
      };

      setHipLift(
        PoseLandmark.LEFT_SHOULDER,
        PoseLandmark.LEFT_HIP,
        PoseLandmark.LEFT_KNEE,
        PoseLandmark.LEFT_ANKLE,
        0.44,
        leftLift
      );
      setHipLift(
        PoseLandmark.RIGHT_SHOULDER,
        PoseLandmark.RIGHT_HIP,
        PoseLandmark.RIGHT_KNEE,
        PoseLandmark.RIGHT_ANKLE,
        0.56,
        rightLift
      );
      break;
    }

    case 'FRONT_RAISE': {
      const wave = smoothWave(safeElapsed, 1600);
      const angleDeg = lerp(15, 96, wave);
      const rad = degToRad(angleDeg);
      const armLen = 0.26;
      const setArm = (
        shoulderIdx: PoseLandmark,
        hipIdx: PoseLandmark,
        elbowIdx: PoseLandmark,
        wristIdx: PoseLandmark,
        baseX: number,
        sign: number
      ) => {
        const shoulder = { x: baseX, y: 0.28, z: 0, visibility: 0.98 };
        lm[shoulderIdx] = shoulder;
        lm[hipIdx] = { x: baseX, y: 0.53, z: 0, visibility: 0.98 };
        const wrist = {
          x: shoulder.x + sign * armLen * Math.sin(rad),
          y: shoulder.y + armLen * Math.cos(rad),
          z: 0,
          visibility: 0.98,
        };
        lm[wristIdx] = wrist;
        lm[elbowIdx] = {
          x: lerp(shoulder.x, wrist.x, 0.5),
          y: lerp(shoulder.y, wrist.y, 0.5),
          z: 0,
          visibility: 0.98,
        };
      };
      setArm(
        PoseLandmark.LEFT_SHOULDER,
        PoseLandmark.LEFT_HIP,
        PoseLandmark.LEFT_ELBOW,
        PoseLandmark.LEFT_WRIST,
        0.43,
        -1
      );
      setArm(
        PoseLandmark.RIGHT_SHOULDER,
        PoseLandmark.RIGHT_HIP,
        PoseLandmark.RIGHT_ELBOW,
        PoseLandmark.RIGHT_WRIST,
        0.57,
        1
      );
      break;
    }

    default:
      break;
  }

  return {
    landmarks: lm,
    worldLandmarks: lm.map((p) => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility })),
  };
}

/**
 * Stateful scripted driver anchored to an initial start timestamp so cycles
 * always start from resting position cleanly.
 */
export function createScriptedPoseGenerator(exerciseId: string): ScriptedPoseGenerator {
  let startTimeMs: number | null = null;
  return (timestampMs: number) => {
    if (startTimeMs === null) {
      startTimeMs = timestampMs;
    }
    return generateScriptedPoseFrame(exerciseId, timestampMs - startTimeMs);
  };
}
