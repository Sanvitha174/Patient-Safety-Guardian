import * as tf from '@tensorflow/tfjs';
import { PoseData, RiskDetection, Keypoint } from '../types';

/**
 * LSTM-based Risk Detection
 * Uses sequence analysis of pose keypoints to detect risks
 * Complements rule-based detection with pattern recognition
 */

interface PoseSequence {
  frames: number[][];
  timestamps: number[];
}

const sequenceLength = 15; // Use last 15 frames (~500ms at 30 FPS)
const poseSequence: PoseSequence = {
  frames: [],
  timestamps: [],
};

let model: tf.LayersModel | null = null;

/**
 * Initialize LSTM model (load pre-trained or create simple classifier)
 */
export async function initializeLSTMDetector(): Promise<void> {
  try {
    // Create a simple sequential model for risk classification
    // In production, load a pre-trained model trained on your data
    model = tf.sequential({
      layers: [
        tf.layers.lstm({
          units: 64,
          inputShape: [sequenceLength, 33 * 3], // 33 keypoints × (x, y, score)
          activation: 'relu',
          returnSequences: false,
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 5, activation: 'softmax' }), // 5 risk classes
      ],
    });

    console.log('✅ LSTM Risk Detector initialized');
  } catch (error) {
    console.error('Failed to initialize LSTM:', error);
    throw error;
  }
}

/**
 * Add pose to sequence buffer
 */
export function addPoseToSequence(pose: PoseData): void {
  const flattenedKeypoints = pose.keypoints.flatMap(kp => [kp.x, kp.y, kp.score]);
  
  poseSequence.frames.push(flattenedKeypoints);
  poseSequence.timestamps.push(Date.now());

  // Keep only recent frames
  if (poseSequence.frames.length > sequenceLength) {
    poseSequence.frames.shift();
    poseSequence.timestamps.shift();
  }
}

/**
 * Detect risks using LSTM on pose sequence
 */
export async function detectLSTMRisks(pose: PoseData): Promise<RiskDetection[]> {
  if (!model || poseSequence.frames.length < sequenceLength) {
    return []; // Not enough data yet
  }

  try {
    // Prepare input: [1, sequenceLength, 33*3]
    const input = tf.tensor3d([poseSequence.frames.slice(-sequenceLength)]);

    // Get predictions
    const predictions = model.predict(input) as tf.Tensor;
    const probabilities = await predictions.data();

    input.dispose();
    predictions.dispose();

    const risks: RiskDetection[] = [];
    const riskClasses = ['fall', 'wandering', 'aggression', 'emotion', 'normal'];
    const riskSeverities = ['critical', 'high', 'high', 'medium', 'low'];

    // Check each risk class
    for (let i = 0; i < riskClasses.length - 1; i++) {
      const confidence = probabilities[i];
      const threshold = 0.5;

      if (confidence > threshold) {
        risks.push({
          type: riskClasses[i] as 'fall' | 'wandering' | 'aggression' | 'emotion' | 'vitals',
          severity: riskSeverities[i] as 'low' | 'medium' | 'high' | 'critical',
          confidence,
          description: `${riskClasses[i]} detected by LSTM classifier (${Math.round(confidence * 100)}% confidence)`,
        });
      }
    }

    return risks;
  } catch (error) {
    console.error('LSTM prediction error:', error);
    return [];
  }
}

/**
 * Extract movement metrics from pose sequence
 */
export function analyzeMovementPatterns(pose: PoseData): {
  movementLevel: number;
  stability: number;
  avgVelocity: number;
} {
  if (poseSequence.frames.length < 2) {
    return { movementLevel: 0, stability: 1, avgVelocity: 0 };
  }

  const recent = poseSequence.frames.slice(-5); // Last 5 frames
  let totalDistance = 0;

  for (let i = 1; i < recent.length; i++) {
    const prevFrame = recent[i - 1];
    const currFrame = recent[i];

    for (let j = 0; j < prevFrame.length; j += 3) {
      const dx = currFrame[j] - prevFrame[j];
      const dy = currFrame[j + 1] - prevFrame[j + 1];
      totalDistance += Math.sqrt(dx * dx + dy * dy);
    }
  }

  const avgVelocity = totalDistance / (recent.length - 1);
  const movementLevel = Math.min(100, avgVelocity / 2); // Normalize to 0-100
  const stability = Math.max(0, 1 - movementLevel / 100); // Higher stability = less movement

  return { movementLevel, stability, avgVelocity };
}

/**
 * Clear LSTM state and sequences
 */
export function clearLSTMState(): void {
  poseSequence.frames = [];
  poseSequence.timestamps = [];
}
