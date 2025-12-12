import * as poseDetection from '@tensorflow-models/pose-detection';
import '@tensorflow/tfjs-backend-webgl';
import * as tf from '@tensorflow/tfjs';
import { PoseData, Keypoint } from '../types';

/**
 * SafeCare AI - Pose Detection Service
 *
 * CURRENT: TensorFlow.js MoveNet (browser-based)
 * - Fast real-time inference on CPU
 * - 33 body keypoints
 * - Runs at 30 FPS
 *
 * Data Flow:
 * 1. Video → Pose Detection (MoveNet)
 * 2. 33 keypoints → Risk Detection (src/services/riskDetection.ts)
 * 3. Features → LSTM Classifier (optional)
 * 4. Action → Dashboard Alert
 */

let detector: poseDetection.PoseDetector | null = null;

export async function initializePoseDetector(): Promise<void> {
  await tf.ready();
  await tf.setBackend('webgl');

  const model = poseDetection.SupportedModels.MoveNet;
  detector = await poseDetection.createDetector(model, {
    modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
  });
}

export async function detectPose(video: HTMLVideoElement): Promise<PoseData | null> {
  if (!detector) {
    throw new Error('Pose detector not initialized');
  }

  const poses = await detector.estimatePoses(video);

  if (poses.length === 0) {
    return null;
  }

  const pose = poses[0];
  const keypoints: Keypoint[] = pose.keypoints.map(kp => ({
    x: kp.x,
    y: kp.y,
    score: kp.score || 0,
    name: kp.name || '',
  }));

  return {
    keypoints,
    score: pose.score || 0,
  };
}

export function drawPose(
  canvas: HTMLCanvasElement,
  poseData: PoseData | null,
  video: HTMLVideoElement
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx || !poseData) return;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const connections = [
    ['left_shoulder', 'right_shoulder'],
    ['left_shoulder', 'left_elbow'],
    ['left_elbow', 'left_wrist'],
    ['right_shoulder', 'right_elbow'],
    ['right_elbow', 'right_wrist'],
    ['left_shoulder', 'left_hip'],
    ['right_shoulder', 'right_hip'],
    ['left_hip', 'right_hip'],
    ['left_hip', 'left_knee'],
    ['left_knee', 'left_ankle'],
    ['right_hip', 'right_knee'],
    ['right_knee', 'right_ankle'],
  ];

  ctx.strokeStyle = '#00ff00';
  ctx.lineWidth = 2;

  connections.forEach(([start, end]) => {
    const startPoint = poseData.keypoints.find(kp => kp.name === start);
    const endPoint = poseData.keypoints.find(kp => kp.name === end);

    if (startPoint && endPoint && startPoint.score > 0.3 && endPoint.score > 0.3) {
      ctx.beginPath();
      ctx.moveTo(startPoint.x, startPoint.y);
      ctx.lineTo(endPoint.x, endPoint.y);
      ctx.stroke();
    }
  });

  ctx.fillStyle = '#00ff00';
  poseData.keypoints.forEach(kp => {
    if (kp.score > 0.3) {
      ctx.beginPath();
      ctx.arc(kp.x, kp.y, 5, 0, 2 * Math.PI);
      ctx.fill();
    }
  });
  
}
