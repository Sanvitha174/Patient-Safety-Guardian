/*
  # Patient Safety Guardian Database Schema

  1. New Tables
    - `rooms`
      - `id` (uuid, primary key)
      - `room_number` (text, unique) - Room identifier
      - `floor` (text) - Floor location
      - `created_at` (timestamp)
    
    - `patients`
      - `id` (uuid, primary key)
      - `name` (text) - Patient name
      - `age` (integer) - Patient age
      - `room_id` (uuid, foreign key) - Associated room
      - `risk_level` (text) - low, medium, high
      - `status` (text) - active, discharged
      - `created_at` (timestamp)
    
    - `alerts`
      - `id` (uuid, primary key)
      - `patient_id` (uuid, foreign key) - Patient who triggered alert
      - `alert_type` (text) - fall, wandering, aggression, emotion
      - `severity` (text) - low, medium, high, critical
      - `description` (text) - Alert details
      - `status` (text) - active, acknowledged, resolved
      - `confidence` (numeric) - AI confidence score
      - `acknowledged_at` (timestamp)
      - `resolved_at` (timestamp)
      - `created_at` (timestamp)
    
    - `monitoring_sessions`
      - `id` (uuid, primary key)
      - `patient_id` (uuid, foreign key)
      - `heart_rate` (integer) - Simulated sensor data
      - `is_in_bed` (boolean) - Bed occupancy
      - `movement_level` (numeric) - Movement intensity 0-100
      - `pose_data` (jsonb) - Skeleton keypoints data
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for public access (for demo purposes)
    
  3. Indexes
    - Index on patient_id for faster alert queries
    - Index on created_at for time-based queries
*/

-- Create rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number text UNIQUE NOT NULL,
  floor text NOT NULL DEFAULT '1',
  created_at timestamptz DEFAULT now()
);

-- Create patients table
CREATE TABLE IF NOT EXISTS patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  age integer NOT NULL,
  room_id uuid REFERENCES rooms(id) ON DELETE SET NULL,
  risk_level text DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high')),
  status text DEFAULT 'active' CHECK (status IN ('active', 'discharged')),
  created_at timestamptz DEFAULT now()
);

-- Create alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  alert_type text NOT NULL CHECK (alert_type IN ('fall', 'wandering', 'aggression', 'emotion', 'vitals')),
  severity text DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description text NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
  confidence numeric DEFAULT 0.0 CHECK (confidence >= 0 AND confidence <= 1),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create monitoring sessions table
CREATE TABLE IF NOT EXISTS monitoring_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  heart_rate integer DEFAULT 75,
  is_in_bed boolean DEFAULT true,
  movement_level numeric DEFAULT 0 CHECK (movement_level >= 0 AND movement_level <= 100),
  pose_data jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_alerts_patient_id ON alerts(patient_id);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_monitoring_patient_id ON monitoring_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_created_at ON monitoring_sessions(created_at DESC);

-- Enable RLS
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies (public access for demo)
CREATE POLICY "Allow public read access to rooms"
  ON rooms FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to rooms"
  ON rooms FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public read access to patients"
  ON patients FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to patients"
  ON patients FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update to patients"
  ON patients FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public read access to alerts"
  ON alerts FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to alerts"
  ON alerts FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update to alerts"
  ON alerts FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public read access to monitoring"
  ON monitoring_sessions FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to monitoring"
  ON monitoring_sessions FOR INSERT
  TO public
  WITH CHECK (true);

-- Insert sample data
INSERT INTO rooms (room_number, floor) VALUES
  ('101', '1'),
  ('102', '1'),
  ('201', '2'),
  ('202', '2')
ON CONFLICT (room_number) DO NOTHING;

INSERT INTO patients (name, age, room_id, risk_level, status)
SELECT 
  'Demo Patient',
  72,
  id,
  'medium',
  'active'
FROM rooms
WHERE room_number = '101'
ON CONFLICT DO NOTHING;