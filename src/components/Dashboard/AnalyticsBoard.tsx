import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../utils/apiClient';
import { BarChart, Activity, AlertTriangle, Clock, Map, TrendingUp } from 'lucide-react';

interface Forecast {
  h3_index: string;
  expected_incidents: number;
}

export const AnalyticsBoard = ({ tickets }: { tickets: any[] }) => {
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchForecasts();
  }, []);

  const fetchForecasts = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/analytics/hotspot-forecast');
      if (data.forecast) setForecasts(data.forecast);
    } catch (e) {
      console.error('Failed to load forecast', e);
    } finally {
      setLoading(false);
    }
  };

  const total = tickets.length;
  const critical = tickets.filter(t => t.priority === 'Critical').length;
  const breached = tickets.filter(t => t.escalated).length;
  const rescued = tickets.filter(t => ['RESCUED', 'CWC_PRODUCED', 'REHAB_FOLLOWUP', 'CLOSED'].includes(t.status)).length;
  
  const rescueRate = total > 0 ? Math.round((rescued / total) * 100) : 0;

  return (
    <div className="p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-display font-bold text-[var(--ink)] flex items-center gap-2">
          <BarChart className="w-5 h-5 text-[var(--teal)]" />
          Analytics & ML Intelligence
        </h2>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-[var(--line)] shadow-sm">
          <div className="text-[11px] font-mono font-bold text-[var(--ink-soft)] uppercase tracking-wider mb-1">Total Incidents</div>
          <div className="text-3xl font-display font-bold text-[var(--ink)]">{total}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-[var(--stamp)]/30 shadow-sm">
          <div className="text-[11px] font-mono font-bold text-[var(--stamp)] uppercase tracking-wider mb-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Critical Cases
          </div>
          <div className="text-3xl font-display font-bold text-[var(--stamp)]">{critical}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-[var(--line)] shadow-sm">
          <div className="text-[11px] font-mono font-bold text-[var(--ink-soft)] uppercase tracking-wider mb-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-[var(--teal)]" /> Rescue Rate
          </div>
          <div className="text-3xl font-display font-bold text-[var(--teal)]">{rescueRate}%</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-[var(--stamp)]/30 shadow-sm relative overflow-hidden">
          <div className="text-[11px] font-mono font-bold text-[var(--stamp)] uppercase tracking-wider mb-1 flex items-center gap-1">
            <Clock className="w-3 h-3" /> SLA Breached
          </div>
          <div className="text-3xl font-display font-bold text-[var(--stamp)]">{breached}</div>
          {breached > 0 && <div className="absolute top-0 right-0 w-2 h-full bg-[var(--stamp)] animate-pulse"></div>}
        </div>
      </div>

      {/* ML Hotspot Forecast */}
      <div className="bg-white rounded-xl border border-[var(--line)] shadow-sm overflow-hidden">
        <div className="p-4 border-b border-[var(--line)] bg-[var(--teal)]/5 flex justify-between items-center">
          <h3 className="font-semibold text-[14px] flex items-center gap-2 text-[var(--ink)]">
            <Map className="w-4 h-4 text-[var(--teal)]" />
            Predicted Hotspots (Next 24h)
          </h3>
          <span className="text-[10px] font-mono bg-white px-2 py-1 rounded-md border border-[var(--line)] text-[var(--ink-soft)]">
            Powered by LightGBM
          </span>
        </div>
        <div className="p-4">
          {loading ? (
            <div className="text-center text-[12px] text-[var(--ink-soft)] py-8 animate-pulse">Loading ML Forecasts...</div>
          ) : forecasts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {forecasts.slice(0, 10).map((f, i) => (
                <div key={f.h3_index} className="flex justify-between items-center p-3 bg-[var(--sand)] rounded-lg border border-[var(--line)]">
                  <div className="flex items-center gap-3">
                    <span className="text-[14px] font-bold text-[var(--ink-soft)] w-4">{i + 1}.</span>
                    <span className="font-mono text-[12px] text-[var(--ink)]">{f.h3_index}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase text-[var(--stamp)]">
                      {f.expected_incidents} expected
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-[12px] text-[var(--ink-soft)] py-8">No hotspot data available. Start the ML service.</div>
          )}
        </div>
      </div>
    </div>
  );
};
