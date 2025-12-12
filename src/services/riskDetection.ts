import { PoseData, RiskDetection, Keypoint } from '../types';

interface PoseHistory {
  poses: PoseData[];
  maxHistory: number;
}

const poseHistory: PoseHistory = {
  poses: [],
  maxHistory: 30,
};

export function addPoseToHistory(pose: PoseData): void {
  poseHistory.poses.push(pose);
  if (poseHistory.poses.length > poseHistory.maxHistory) {
    poseHistory.poses.shift();
  }
}

function getKeypoint(pose: PoseData, name: string): Keypoint | undefined {
  return pose.keypoints.find(kp => kp.name === name && kp.score > 0.3);
}

function calculateDistance(p1: Keypoint, p2: Keypoint): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

function detectFall(pose: PoseData): RiskDetection | null {
  const nose = getKeypoint(pose, 'nose');
  const leftHip = getKeypoint(pose, 'left_hip');
  const rightHip = getKeypoint(pose, 'right_hip');
  const leftShoulder = getKeypoint(pose, 'left_shoulder');
  const rightShoulder = getKeypoint(pose, 'right_shoulder');

  if (!nose || !leftHip || !rightHip || !leftShoulder || !rightShoulder) {
    return null;
  }

  const hipY = (leftHip.y + rightHip.y) / 2;
  const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
  const bodyHeight = Math.abs(hipY - shoulderY);

  const hipX = (leftHip.x + rightHip.x) / 2;
  const shoulderX = (leftShoulder.x + rightShoulder.x) / 2;
  const bodyWidth = Math.abs(hipX - shoulderX);

  const aspectRatio = bodyWidth / (bodyHeight + 1);

  if (aspectRatio > 1.5 && nose.y > shoulderY) {
    const confidence = Math.min(aspectRatio / 2, 1);
    return {
      type: 'fall',
      severity: 'critical',
      confidence,
      description: 'Patient appears to have fallen - body is horizontal',
    };
  }

  return null;
}

function detectWandering(pose: PoseData, bedArea: { x: number; y: number; width: number; height: number }): RiskDetection | null {
  const leftHip = getKeypoint(pose, 'left_hip');
  const rightHip = getKeypoint(pose, 'right_hip');

  if (!leftHip || !rightHip) {
    return null;
  }

  const hipX = (leftHip.x + rightHip.x) / 2;
  const hipY = (leftHip.y + rightHip.y) / 2;

  const inBed =
    hipX >= bedArea.x &&
    hipX <= bedArea.x + bedArea.width &&
    hipY >= bedArea.y &&
    hipY <= bedArea.y + bedArea.height;

  if (!inBed && poseHistory.poses.length > 10) {
    const recentPoses = poseHistory.poses.slice(-10);
    const outOfBedCount = recentPoses.filter(p => {
      const lh = getKeypoint(p, 'left_hip');
      const rh = getKeypoint(p, 'right_hip');
      if (!lh || !rh) return false;
      const x = (lh.x + rh.x) / 2;
      const y = (lh.y + rh.y) / 2;
      return !(x >= bedArea.x && x <= bedArea.x + bedArea.width && y >= bedArea.y && y <= bedArea.y + bedArea.height);
    }).length;

    if (outOfBedCount > 7) {
      return {
        type: 'wandering',
        severity: 'high',
        confidence: outOfBedCount / 10,
        description: 'Patient has left the bed area',
      };
    }
  }

  return null;
}

function detectAggression(pose: PoseData): RiskDetection | null {
  if (poseHistory.poses.length < 5) {
    return null;
  }

  const recentPoses = poseHistory.poses.slice(-5);
  const leftWrist = getKeypoint(pose, 'left_wrist');
  const rightWrist = getKeypoint(pose, 'right_wrist');

  if (!leftWrist || !rightWrist) {
    return null;
  }

  let totalMovement = 0;
  for (let i = 1; i < recentPoses.length; i++) {
    const prevLeftWrist = getKeypoint(recentPoses[i - 1], 'left_wrist');
    const prevRightWrist = getKeypoint(recentPoses[i - 1], 'right_wrist');
    const currLeftWrist = getKeypoint(recentPoses[i], 'left_wrist');
    const currRightWrist = getKeypoint(recentPoses[i], 'right_wrist');

    if (prevLeftWrist && currLeftWrist) {
      totalMovement += calculateDistance(prevLeftWrist, currLeftWrist);
    }
    if (prevRightWrist && currRightWrist) {
      totalMovement += calculateDistance(prevRightWrist, currRightWrist);
    }
  }

  const avgMovement = totalMovement / 5;

  if (avgMovement > 100) {
    return {
      type: 'aggression',
      severity: 'high',
      confidence: Math.min(avgMovement / 200, 1),
      description: 'Rapid arm movements detected - possible aggressive behavior',
    };
  }

  return null;
}

function detectEmotionalDistress(pose: PoseData): RiskDetection | null {
  const leftShoulder = getKeypoint(pose, 'left_shoulder');
  const rightShoulder = getKeypoint(pose, 'right_shoulder');
  const leftHip = getKeypoint(pose, 'left_hip');
  const rightHip = getKeypoint(pose, 'right_hip');
  const nose = getKeypoint(pose, 'nose');

  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip || !nose) {
    return null;
  }

  const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
  const hipY = (leftHip.y + rightHip.y) / 2;

  const shoulderSlope = Math.abs(leftShoulder.y - rightShoulder.y);
  const bodyLength = Math.abs(hipY - shoulderY);

  if (shoulderSlope > bodyLength * 0.3 && nose.y < shoulderY) {
    return {
      type: 'emotion',
      severity: 'medium',
      confidence: 0.6,
      description: 'Unusual posture detected - possible emotional distress',
    };
  }

  return null;
}

export function analyzeRisks(
  pose: PoseData,
  bedArea: { x: number; y: number; width: number; height: number }
): RiskDetection[] {
  const risks: RiskDetection[] = [];

  addPoseToHistory(pose);

  const fallRisk = detectFall(pose);
  if (fallRisk) risks.push(fallRisk);

  const wanderingRisk = detectWandering(pose, bedArea);
  if (wanderingRisk) risks.push(wanderingRisk);

  const aggressionRisk = detectAggression(pose);
  if (aggressionRisk) risks.push(aggressionRisk);

  const emotionRisk = detectEmotionalDistress(pose);
  if (emotionRisk) risks.push(emotionRisk);

  return risks;
}

export function clearPoseHistory(): void {
  poseHistory.poses = [];
}
