import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Activity, Heart } from 'lucide-react';
import { initializePoseDetector, detectPose, drawPose } from '../services/poseDetection';
import { analyzeRisks, clearPoseHistory } from '../services/riskDetection';
import { generateSmartBedData, checkVitalsRisk } from '../services/smartBedSimulation';
import { supabase } from '../lib/supabase';
import { Patient, RiskDetection } from '../types';

interface PatientMonitorProps {
  patient: Patient;
}

export function PatientMonitor({ patient }: PatientMonitorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentRisks, setCurrentRisks] = useState<RiskDetection[]>([]);
  const [heartRate, setHeartRate] = useState(75);
  const [isInBed, setIsInBed] = useState(true);
  const [temperature, setTemperature] = useState(37.0);
  const [skeletonOnly, setSkeletonOnly] = useState(true);
  const animationFrameRef = useRef<number>();

  const bedArea = {
    x: 200,
    y: 150,
    width: 400,
    height: 300,
  };

  useEffect(() => {
    let stream: MediaStream | null = null;

    async function setupCamera() {
      try {
        setIsLoading(true);
        
        // Start camera and pose detector initialization in parallel
        const [cameraStream] = await Promise.all([
          navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 },
            audio: false,
          }),
          initializePoseDetector(),
        ]);

        stream = cameraStream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Set autoplay-friendly attributes so browsers allow immediate playback
          videoRef.current.muted = true;
          // @ts-ignore - playsInline exists on HTMLVideoElement in browsers
          videoRef.current.playsInline = true;
          videoRef.current.autoplay = true;

          // Try to play immediately without blocking on loadedmetadata.
          // Some browsers require user gesture; catching errors avoids breaking flow.
          const playPromise = videoRef.current.play();
          if (playPromise && typeof playPromise.then === 'function') {
            playPromise.catch(() => {
              // ignore autoplay rejection; video will start after user gesture
            });
          }
        }

        // Show UI quickly and start detection loop; video may start playing shortly.
        setIsLoading(false);
        startDetection();
      } catch (err) {
        setError('Failed to access camera. Please ensure camera permissions are granted.');
        setIsLoading(false);
      }
    }

    setupCamera();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      clearPoseHistory();
      // LSTM state cleared when LSTM detector was in use; removed in revert
    };
  }, []);

  async function startDetection() {
    async function detectFrame() {
      if (!videoRef.current || !canvasRef.current) return;

      try {
        const pose = await detectPose(videoRef.current);

        if (pose && canvasRef.current) {
          drawPose(canvasRef.current, pose, videoRef.current);

          // Get risks from rule-based detection
          const ruleBasedRisks = analyzeRisks(pose, bedArea);
          const allRisks = [...ruleBasedRisks];
          setCurrentRisks(allRisks);

          // Check if patient is actually in bed by looking at hip position
          const leftHip = pose.keypoints.find(kp => kp.name === 'left_hip');
          const rightHip = pose.keypoints.find(kp => kp.name === 'right_hip');
          
          let patientInBed = false;
          if (leftHip && rightHip && leftHip.score > 0.3 && rightHip.score > 0.3) {
            const hipX = (leftHip.x + rightHip.x) / 2;
            const hipY = (leftHip.y + rightHip.y) / 2;
            
            patientInBed =
              hipX >= bedArea.x &&
              hipX <= bedArea.x + bedArea.width &&
              hipY >= bedArea.y &&
              hipY <= bedArea.y + bedArea.height;
          }

          const hasAggression = allRisks.some(r => r.type === 'aggression');
          const hasDistress = allRisks.some(r => r.type === 'emotion');

          const bedData = generateSmartBedData(patientInBed, hasAggression, hasDistress);
          setHeartRate(bedData.heartRate);
          setIsInBed(bedData.isInBed);
          setTemperature(bedData.temperature);

          const vitalsRisk = checkVitalsRisk(bedData);
          if (vitalsRisk) {
            allRisks.push(vitalsRisk);
          }

          if (allRisks.length > 0) {
            for (const risk of allRisks) {
              await saveAlert(risk);
            }
          }

          await saveMonitoringSession(pose, bedData);
        }
      } catch (err) {
        console.error('Detection error:', err);
      }

      animationFrameRef.current = requestAnimationFrame(detectFrame);
    }

    detectFrame();
  }

  async function saveAlert(risk: RiskDetection) {
    try {
      const { data: existingAlerts } = await supabase
        .from('alerts')
        .select('*')
        .eq('patient_id', patient.id)
        .eq('alert_type', risk.type)
        .eq('status', 'active')
        .gte('created_at', new Date(Date.now() - 5000).toISOString());

      if (existingAlerts && existingAlerts.length > 0) {
        return;
      }

      await supabase.from('alerts').insert({
        patient_id: patient.id,
        alert_type: risk.type,
        severity: risk.severity,
        description: risk.description,
        confidence: risk.confidence,
        status: 'active',
      });
    } catch (err) {
      console.error('Failed to save alert:', err);
    }
  }

  async function saveMonitoringSession(pose: any, bedData: any) {
    try {
      await supabase.from('monitoring_sessions').insert({
        patient_id: patient.id,
        heart_rate: bedData.heartRate,
        is_in_bed: bedData.isInBed,
        movement_level: 50,
        pose_data: pose,
      });
    } catch (err) {
      console.error('Failed to save monitoring session:', err);
    }
  }

  const getRiskColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-300 bg-red-900 border-red-500 border-2';
      case 'high':
        return 'text-orange-300 bg-orange-900 border-orange-500 border-2';
      case 'medium':
        return 'text-yellow-300 bg-yellow-900 border-yellow-500 border-2';
      default:
        return 'text-cyan-300 bg-slate-800 border-cyan-500 border-2';
    }
  };

  if (error) {
    return (
      <div className="bg-red-900 border-2 border-red-500 rounded-lg p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-red-300 mx-auto mb-3" />
        <p className="text-red-200">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 rounded-lg shadow-lg p-6">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-slate-100 mb-1">
          Patient Monitoring - {patient.name}
        </h2>
        <p className="text-slate-400">
          Room {patient.room?.room_number} | Age: {patient.age}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="relative bg-black rounded-lg overflow-hidden">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
                <div className="text-slate-100 text-center">
                  <Activity className="w-12 h-12 animate-pulse mx-auto mb-2" />
                  <p>Initializing AI System...</p>
                </div>
              </div>
            )}
            <div className="absolute top-2 right-2 z-20">
              <button
                onClick={() => setSkeletonOnly(prev => !prev)}
                className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-slate-950 rounded-md text-sm font-semibold shadow-lg shadow-cyan-500/50"
              >
                {skeletonOnly ? 'Skeleton Only' : 'Show Video'}
              </button>
            </div>
            <video
              ref={videoRef}
              className={skeletonOnly ? 'hidden' : 'w-full h-auto'}
              style={{ maxHeight: '480px' }}
            />
            <canvas
              ref={canvasRef}
              className={skeletonOnly ? 'block w-full h-[480px]' : 'absolute top-0 left-0 w-full h-full'}
              style={skeletonOnly ? { background: '#000000' } : undefined}
            />
          </div>

          <div className="mt-4 p-4 bg-slate-800 rounded-lg border border-slate-700">
            <h3 className="font-semibold text-slate-100 mb-2">Smart Bed Vitals</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <Heart className="w-6 h-6 text-red-400 mx-auto mb-1" />
                <p className="text-2xl font-bold text-slate-100">{heartRate}</p>
                <p className="text-sm text-slate-400">Heart Rate</p>
              </div>
              <div className="text-center">
                <Activity className="w-6 h-6 text-cyan-400 mx-auto mb-1" />
                <p className="text-2xl font-bold text-slate-100">{temperature}°C</p>
                <p className="text-sm text-slate-400">Temperature</p>
              </div>
              <div className="text-center">
                <div className={`w-6 h-6 rounded-full mx-auto mb-1 ${isInBed ? 'bg-green-400' : 'bg-orange-400'}`} />
                <p className="text-2xl font-bold text-slate-100">{isInBed ? 'Yes' : 'No'}</p>
                <p className="text-sm text-slate-400">In Bed</p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <h3 className="font-semibold text-slate-100 mb-3 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-orange-400" />
              Active Risks
            </h3>
            {currentRisks.length === 0 ? (
              <p className="text-slate-400 text-center py-8">
                No risks detected
              </p>
            ) : (
              <div className="space-y-3">
                {currentRisks.map((risk, index) => (
                  <div
                    key={index}
                    className={`border rounded-lg p-3 ${getRiskColor(risk.severity)}`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <span className="font-semibold uppercase text-sm">
                        {risk.type}
                      </span>
                      <span className="text-xs font-medium">
                        {Math.round(risk.confidence * 100)}%
                      </span>
                    </div>
                    <p className="text-sm">{risk.description}</p>
                    <div className="mt-2 text-xs font-semibold">
                      Severity: {risk.severity.toUpperCase()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 bg-slate-800 border border-cyan-500 rounded-lg p-4 shadow-lg shadow-cyan-500/20">
            <h4 className="font-semibold text-cyan-300 mb-2">AI Status</h4>
            <div className="space-y-1 text-sm text-cyan-300">
              <p>✓ Pose Detection Active</p>
              <p>✓ Risk Analysis Running</p>
              <p>✓ Privacy Protected (No Face Data)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
