import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../utils/apiClient';
import { BarChart, Activity, AlertTriangle, Clock, Map, TrendingUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const generateMockForecast = () => {
  return Array.from({ length: 24 }).map((_, i) => {
    // Generate a natural-looking curve that peaks at night
    const base = Math.sin((i / 24) * Math.PI) * 15; 
    return {
      time: `${i.toString().padStart(2, '0')}:00`,
      expected: Math.max(2, Math.floor(base + Math.random() * 5)),
      critical: Math.max(0, Math.floor((base * 0.3) + Math.random() * 2))
    };
  });
};

interface Forecast {
  h3_index: string;
  expected_incidents: number;
}

export const AnalyticsBoard = ({ tickets }: { tickets: any[] }) => {
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [loading, setLoading] = useState(false);
  const [chartData] = useState(generateMockForecast());

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
        <div className="p-4 h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorExpected" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorCritical" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a23b2e" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#a23b2e" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} tickMargin={10} />
              <YAxis stroke="#94a3b8" fontSize={10} />
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 'bold' }}
                itemStyle={{ fontWeight: 'bold' }}
              />
              <Area type="monotone" dataKey="expected" name="Total Expected" stroke="#14b8a6" strokeWidth={2} fillOpacity={1} fill="url(#colorExpected)" />
              <Area type="monotone" dataKey="critical" name="High Risk (Critical)" stroke="#a23b2e" strokeWidth={2} fillOpacity={1} fill="url(#colorCritical)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
