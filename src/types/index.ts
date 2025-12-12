export interface Patient {
  id: string;
  name: string;
  age: number;
  room_id: string | null;
  risk_level: 'low' | 'medium' | 'high';
  status: 'active' | 'discharged';
  created_at: string;
  room?: Room;
}

export interface Room {
  id: string;
  room_number: string;
  floor: string;
  created_at: string;
}

export interface Alert {
  id: string;
  patient_id: string;
  alert_type: 'fall' | 'wandering' | 'aggression' | 'emotion' | 'vitals';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  status: 'active' | 'acknowledged' | 'resolved';
  confidence: number;
  acknowledged_at: string | null;
  resolved_at: string | null;
  created_at: string;
  patient?: Patient;
}

export interface MonitoringSession {
  id: string;
  patient_id: string;
  heart_rate: number;
  is_in_bed: boolean;
  movement_level: number;
  pose_data: PoseData | null;
  created_at: string;
}

export interface PoseData {
  keypoints: Keypoint[];
  score: number;
}

export interface Keypoint {
  x: number;
  y: number;
  score: number;
  name: string;
}

export interface RiskDetection {
  type: 'fall' | 'wandering' | 'aggression' | 'emotion' | 'vitals';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  description: string;
}
