import { RiskDetection } from '../types';

export interface SmartBedData {
  heartRate: number;
  isInBed: boolean;
  temperature: number;
  respiratoryRate: number;
}

let baseHeartRate = 75;
let baseTemp = 37.0;
let baseRespRate = 16;

export function generateSmartBedData(
  isInBed: boolean,
  hasAggression: boolean,
  hasDistress: boolean
): SmartBedData {
  let heartRate = baseHeartRate + Math.random() * 10 - 5;
  let temperature = baseTemp + Math.random() * 0.4 - 0.2;
  let respiratoryRate = baseRespRate + Math.random() * 4 - 2;

  if (hasAggression) {
    heartRate += 30;
    respiratoryRate += 8;
  }

  if (hasDistress) {
    heartRate += 15;
    respiratoryRate += 5;
  }

  if (!isInBed) {
    heartRate += 10;
    respiratoryRate += 3;
  }

  return {
    heartRate: Math.round(Math.max(50, Math.min(150, heartRate))),
    isInBed,
    temperature: Number(Math.max(36.0, Math.min(39.0, temperature)).toFixed(1)),
    respiratoryRate: Math.round(Math.max(10, Math.min(30, respiratoryRate))),
  };
}

export function checkVitalsRisk(bedData: SmartBedData): RiskDetection | null {
  if (bedData.heartRate > 120 || bedData.heartRate < 50) {
    return {
      type: 'vitals',
      severity: bedData.heartRate > 140 || bedData.heartRate < 45 ? 'critical' : 'high',
      confidence: 0.95,
      description: `Abnormal heart rate: ${bedData.heartRate} bpm`,
    };
  }

  if (bedData.temperature > 38.5 || bedData.temperature < 36.0) {
    return {
      type: 'vitals',
      severity: bedData.temperature > 39.0 || bedData.temperature < 35.5 ? 'critical' : 'medium',
      confidence: 0.95,
      description: `Abnormal temperature: ${bedData.temperature}°C`,
    };
  }

  if (bedData.respiratoryRate > 24 || bedData.respiratoryRate < 12) {
    return {
      type: 'vitals',
      severity: bedData.respiratoryRate > 28 || bedData.respiratoryRate < 10 ? 'critical' : 'medium',
      confidence: 0.95,
      description: `Abnormal respiratory rate: ${bedData.respiratoryRate} breaths/min`,
    };
  }

  return null;
}
