import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Clock, Users, AlertTriangle, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Alert, Patient } from '../types';

export function Dashboard() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    try {
      const [alertsResponse, patientsResponse] = await Promise.all([
        supabase
          .from('alerts')
          .select(`
            *,
            patient:patients(
              id,
              name,
              age,
              room_id,
              risk_level,
              status,
              created_at,
              room:rooms(*)
            )
          `)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('patients')
          .select(`
            *,
            room:rooms(*)
          `)
          .eq('status', 'active'),
      ]);

      if (alertsResponse.data) {
        setAlerts(alertsResponse.data as any);
      }

      if (patientsResponse.data) {
        setPatients(patientsResponse.data as any);
      }

      setLoading(false);
    } catch (error) {
      console.error('Failed to load data:', error);
      setLoading(false);
    }
  }

  async function acknowledgeAlert(alertId: string) {
    try {
      await supabase
        .from('alerts')
        .update({
          status: 'acknowledged',
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', alertId);
      loadData();
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  }

  async function resolveAlert(alertId: string) {
    try {
      await supabase
        .from('alerts')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', alertId);
      loadData();
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  }

  const activeAlerts = alerts.filter(a => a.status === 'active');
  const acknowledgedAlerts = alerts.filter(a => a.status === 'acknowledged');
  const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');

  // Filter alerts based on selected filters
  const filteredAlerts = alerts.filter(alert => {
    const typeMatch = filterType === 'all' || alert.alert_type === filterType;
    const severityMatch = filterSeverity === 'all' || alert.severity === filterSeverity;
    return typeMatch && severityMatch;
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-700 text-red-50 border-red-600';
      case 'high':
        return 'bg-orange-600 text-orange-50 border-orange-500';
      case 'medium':
        return 'bg-yellow-500 text-slate-900 border-yellow-400';
      default:
        return 'bg-cyan-700 text-cyan-50 border-cyan-600';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'fall':
        return '⚠️';
      case 'wandering':
        return '🚶';
      case 'aggression':
        return '⚡';
      case 'emotion':
        return '😟';
      case 'vitals':
        return '❤️';
      default:
        return '📋';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
          <p className="text-slate-300">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6 text-slate-100">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-100 mb-2">
            Patient Safety Guardian Dashboard
          </h1>
          <p className="text-slate-400">
            Real-time patient monitoring system
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800 rounded-lg shadow p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-300 text-sm font-medium">Active Patients</p>
                <p className="text-3xl font-bold text-slate-100 mt-1">{patients.length}</p>
              </div>
              <Users className="w-12 h-12 text-cyan-400" />
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg shadow p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-300 text-sm font-medium">Critical Alerts</p>
                <p className="text-3xl font-bold text-red-400 mt-1">{criticalAlerts.length}</p>
              </div>
              <AlertCircle className="w-12 h-12 text-red-400" />
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg shadow p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-300 text-sm font-medium">Active Alerts</p>
                <p className="text-3xl font-bold text-orange-400 mt-1">{activeAlerts.length}</p>
              </div>
              <AlertTriangle className="w-12 h-12 text-orange-400" />
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg shadow p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-300 text-sm font-medium">Under Review</p>
                <p className="text-3xl font-bold text-yellow-400 mt-1">{acknowledgedAlerts.length}</p>
              </div>
              <Clock className="w-12 h-12 text-yellow-400" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-slate-800 rounded-lg shadow border border-slate-700">
              <div className="p-6 border-b border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-slate-100">Recent Alerts</h2>
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-slate-300">Alert Type:</label>
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="all">All Types</option>
                      <option value="fall">Fall</option>
                      <option value="wandering">Wandering</option>
                      <option value="aggression">Aggression</option>
                      <option value="emotion">Emotion</option>
                      <option value="vitals">Vitals</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-slate-300">Severity:</label>
                    <select
                      value={filterSeverity}
                      onChange={(e) => setFilterSeverity(e.target.value)}
                      className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="all">All Levels</option>
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-slate-700 max-h-[600px] overflow-y-auto">
                {alerts.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-3 glow-green" />
                    <p className="text-lg font-medium">No alerts</p>
                    <p className="text-sm">All patients are safe</p>
                  </div>
                ) : filteredAlerts.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <AlertCircle className="w-16 h-16 text-cyan-400 mx-auto mb-3 glow-cyan" />
                    <p className="text-lg font-medium">No matching alerts</p>
                    <p className="text-sm">Try adjusting your filters</p>
                  </div>
                ) : (
                  filteredAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-4 transition-colors border-b border-slate-700 ${
                        alert.status === 'active' ? 'bg-red-900/30 border-l-4 border-red-500' : 'hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-2xl">{getAlertIcon(alert.alert_type)}</span>
                            <div>
                              <h3 className="font-semibold text-slate-100">
                                {alert.patient?.name || 'Unknown Patient'}
                              </h3>
                              <p className="text-sm text-slate-400">
                                Room {alert.patient?.room?.room_number || 'N/A'} • {alert.patient?.age} years old
                              </p>
                            </div>
                          </div>
                          <div className="ml-11">
                            <div className="flex items-center gap-2 mb-2">
                              <span
                                className={"px-3 py-1 rounded-full text-xs font-semibold border " + getSeverityColor(alert.severity) + " shadow-sm"}
                              >
                                {alert.severity.toUpperCase()}
                              </span>
                              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-700 text-slate-200 border border-slate-600">
                                {alert.alert_type.toUpperCase()}
                              </span>
                              <span className="text-xs text-slate-400">
                                {Math.round(alert.confidence * 100)}% confidence
                              </span>
                            </div>
                            <p className="text-slate-200 mb-2">{alert.description}</p>
                            <p className="text-xs text-slate-400">
                              {new Date(alert.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 ml-4">
                          {alert.status === 'active' && (
                            <>
                              <button
                                onClick={() => acknowledgeAlert(alert.id)}
                                className="px-4 py-2 bg-yellow-400 text-slate-900 rounded-lg hover:bg-yellow-300 text-sm font-medium transition-colors shadow-md glow-yellow"
                              >
                                Acknowledge
                              </button>
                              <button
                                onClick={() => resolveAlert(alert.id)}
                                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-400 text-sm font-medium transition-colors shadow-md glow-green"
                              >
                                Resolve
                              </button>
                            </>
                          )}
                          {alert.status === 'acknowledged' && (
                            <button
                              onClick={() => resolveAlert(alert.id)}
                              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-400 text-sm font-medium transition-colors shadow-md glow-green"
                            >
                              Resolve
                            </button>
                          )}
                          {alert.status === 'resolved' && (
                            <span className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium text-center border border-slate-600">
                              Resolved
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="bg-slate-800 rounded-lg shadow border border-slate-700">
              <div className="p-6 border-b border-slate-700">
                <h2 className="text-xl font-bold text-slate-100">Active Patients</h2>
              </div>
              <div className="divide-y divide-slate-700 max-h-[600px] overflow-y-auto">
                {patients.map((patient) => {
                  const patientAlerts = activeAlerts.filter(
                    (a) => a.patient_id === patient.id
                  );
                  const hasCritical = patientAlerts.some((a) => a.severity === 'critical');

                  return (
                    <div
                      key={patient.id}
                      className={`p-4 transition-colors ${
                        hasCritical ? 'bg-red-900/20 border-l-4 border-red-500' : 'hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-slate-100">{patient.name}</h3>
                          <p className="text-sm text-slate-400">
                            Room {patient.room?.room_number || 'N/A'}
                          </p>
                        </div>
                        {hasCritical && (
                          <span className="flex items-center gap-1 text-red-400 text-sm font-semibold">
                            <AlertCircle className="w-4 h-4 text-red-400 glow-red" />
                            CRITICAL
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            patient.risk_level === 'high'
                              ? 'bg-red-700 text-red-50 border border-red-600'
                              : patient.risk_level === 'medium'
                              ? 'bg-yellow-500 text-slate-900 border border-yellow-400'
                              : 'bg-green-700 text-green-50 border border-green-600'
                          }`}
                        >
                          {patient.risk_level.toUpperCase()} RISK
                        </span>
                        {patientAlerts.length > 0 && (
                          <span className="text-xs text-slate-400">
                            {patientAlerts.length} active alert{patientAlerts.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg shadow-lg p-6 text-white border border-slate-700">
              <TrendingUp className="w-10 h-10 mb-3 text-cyan-300 glow-cyan" />
              <h3 className="text-lg font-bold mb-2 text-slate-100">AI Guardian Active</h3>
              <p className="text-sm text-slate-300">
                Real-time pose detection and risk analysis protecting your patients 24/7
              </p>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse"></div>
                  <span>Fall Detection</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse"></div>
                  <span>Wandering Prevention</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse"></div>
                  <span>Aggression Detection</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse"></div>
                  <span>Emotional Monitoring</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
