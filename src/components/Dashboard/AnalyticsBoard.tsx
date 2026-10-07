import React, { useEffect, useState } from 'react';
import { BarChart, Activity, AlertTriangle, Clock, TrendingUp } from 'lucide-react';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { apiFetch } from '../../utils/apiClient';

export const AnalyticsBoard = ({ tickets }: { tickets: any[] }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await apiFetch('/api/analytics/summary');
        setData(response);
      } catch (err: any) {
        setError(err.message || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [tickets]); // refetch when tickets update

  if (loading) return <div className="p-10 text-center text-sm font-mono uppercase">Loading analytics...</div>;
  if (error) return <div className="p-10 text-center text-[rgba(162,59,46,1)]">{error}</div>;
  if (!data) return null;

  const { total, critical, breached, rescueRate, byJurisdiction, byCategory, funnel, hourlyDistribution } = data;

  const categoryData = Object.entries(byCategory || {}).map(([name, value]) => ({ name, value }));

  const funnelOrder = ['REPORTED', 'DISPATCHED', 'RESCUED', 'CLOSED', 'REJECTED'];
  const funnelData = funnelOrder.map(status => ({
    status,
    count: funnel[status] || 0
  })).filter(item => item.count > 0);

  const jurisdictionData = Object.entries(byJurisdiction || {})
    .map(([jurisdiction, total]) => ({ jurisdiction, total }))
    .sort((a, b) => (b.total as number) - (a.total as number))
    .slice(0, 10);

  const hourlyData = (hourlyDistribution || []).map((count: number, hour: number) => {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return { time: `${displayHour}${ampm}`, reports: count };
  });

  const COLORS = ['#14b8a6', '#f59e0b', '#3b82f6', '#a23b2e', '#8b5cf6'];

  return (
    <div className="p-4 space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-display font-bold text-[var(--ink)] flex items-center gap-2 tracking-tight">
          <BarChart className="w-5 h-5 text-[var(--teal)]" />
          Analytics Intelligence (Live)
        </h2>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-[var(--line)] shadow-sm">
          <div className="text-[11px] font-mono font-bold text-[var(--ink-soft)] uppercase tracking-wider mb-1">Total Incidents</div>
          <div className="text-3xl font-display font-bold text-[var(--ink)]">{total}</div>
        </div>
        <div className="bg-[rgba(162,59,46,0.05)] p-4 rounded-xl border border-[var(--stamp)]/30 shadow-sm">
          <div className="text-[11px] font-mono font-bold text-[var(--stamp)] uppercase tracking-wider mb-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Critical Cases
          </div>
          <div className="text-3xl font-display font-bold text-[var(--stamp)]">{critical}</div>
        </div>
        <div className="bg-[var(--teal)]/5 p-4 rounded-xl border border-[var(--teal)]/30 shadow-sm">
          <div className="text-[11px] font-mono font-bold text-[var(--teal)] uppercase tracking-wider mb-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-[var(--teal)]" /> Rescue Rate
          </div>
          <div className="text-3xl font-display font-bold text-[var(--teal)]">{rescueRate}%</div>
        </div>
        <div className="bg-[rgba(162,59,46,0.05)] p-4 rounded-xl border border-[var(--stamp)]/30 shadow-sm relative overflow-hidden">
          <div className="text-[11px] font-mono font-bold text-[var(--stamp)] uppercase tracking-wider mb-1 flex items-center gap-1">
            <Clock className="w-3 h-3" /> SLA Breaches
          </div>
          <div className="text-3xl font-display font-bold text-[var(--stamp)]">{breached}</div>
          {breached > 0 && <div className="absolute top-0 right-0 w-2 h-full bg-[var(--stamp)] animate-pulse"></div>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <div className="bg-white rounded-xl border border-[var(--line)] shadow-sm p-4 hover:shadow-md transition-shadow">
          <h3 className="font-semibold text-[14px] text-[var(--ink)] mb-4">Incidents by Category</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip cursor={{ fill: 'rgba(20, 184, 166, 0.05)' }} contentStyle={{ borderRadius: '8px', border: '1px solid var(--line)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Funnel */}
        <div className="bg-white rounded-xl border border-[var(--line)] shadow-sm p-4 hover:shadow-md transition-shadow">
          <h3 className="font-semibold text-[14px] text-[var(--ink)] mb-4">Rescue Funnel</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart data={funnelData} margin={{ top: 0, right: 20, left: -20, bottom: 0 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" stroke="#94a3b8" fontSize={10} />
                <YAxis dataKey="status" type="category" stroke="#94a3b8" fontSize={10} width={80} />
                <Tooltip cursor={{ fill: 'rgba(20, 184, 166, 0.05)' }} contentStyle={{ borderRadius: '8px', border: '1px solid var(--line)' }} />
                <Bar dataKey="count" fill="#14b8a6" radius={[0, 4, 4, 0]} />
              </RechartsBarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Incidents by Jurisdiction */}
        <div className="bg-white rounded-xl border border-[var(--line)] shadow-sm p-4 hover:shadow-md transition-shadow">
          <h3 className="font-semibold text-[14px] text-[var(--ink)] mb-4">Incidents by Jurisdiction</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart data={jurisdictionData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="jurisdiction" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip cursor={{ fill: 'rgba(20, 184, 166, 0.05)' }} contentStyle={{ borderRadius: '8px', border: '1px solid var(--line)' }} />
                <Bar dataKey="total" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </RechartsBarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hourly Pattern */}
        <div className="bg-white rounded-xl border border-[var(--line)] shadow-sm p-4 hover:shadow-md transition-shadow">
          <h3 className="font-semibold text-[14px] text-[var(--ink)] mb-2">Hourly Pattern of Critical Reports</h3>
          <p className="text-[10px] text-[var(--ink-soft)] mb-3 font-mono">Historical distribution — not a prediction</p>
          <div className="h-[230px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourlyData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={9} interval={2} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid var(--line)' }} />
                <Line type="monotone" dataKey="reports" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 5 }} name="Critical reports" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
