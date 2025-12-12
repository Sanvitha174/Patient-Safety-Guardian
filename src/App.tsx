import { useState, useEffect } from 'react';
import { Camera, LayoutDashboard } from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { PatientMonitor } from './components/PatientMonitor';
import { supabase } from './lib/supabase';
import { Patient } from './types';

type View = 'dashboard' | 'monitor';

function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  useEffect(() => {
    loadPatients();
  }, []);

  async function loadPatients() {
    const { data } = await supabase
      .from('patients')
      .select(`
        *,
        room:rooms(*)
      `)
      .eq('status', 'active');

    if (data && data.length > 0) {
      setPatients(data as any);
      setSelectedPatient(data[0] as any);
    }
  }

  const handleStartMonitoring = () => {
    if (patients.length > 0) {
      setCurrentView('monitor');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <nav className="bg-slate-800 shadow-sm border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-100">
                Virtual Patient Safety Guardian
              </h1>
              <p className="text-sm text-slate-400">Patient Monitoring System</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setCurrentView('dashboard')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentView === 'dashboard'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                }`}
              >
                <LayoutDashboard className="w-5 h-5" />
                Dashboard
              </button>
              <button
                onClick={handleStartMonitoring}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentView === 'monitor'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                }`}
              >
                <Camera className="w-5 h-5" />
                Live Monitor
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main>
        {currentView === 'dashboard' ? (
          <Dashboard />
        ) : selectedPatient ? (
          <div className="p-6">
            <PatientMonitor patient={selectedPatient} />
          </div>
        ) : (
          <div className="p-6 text-center text-gray-600">
            No patients available for monitoring
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
