import React from 'react';
import { BarChart, Activity, AlertTriangle, Clock, TrendingUp } from 'lucide-react';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

export const AnalyticsBoard = ({ tickets }: { tickets: any[] }) => {
  const total = tickets.length;
  const critical = tickets.filter(t => t.priority === 'Critical').length;
  const breached = tickets.filter(t => t.escalated).length;
  const rescued = tickets.filter(t => ['RESCUED', 'CWC_PRODUCED', 'REHAB_FOLLOWUP', 'CLOSED'].includes(t.status)).length;
  
  const rescueRate = total > 0 ? Math.round((rescued / total) * 100) : 0;

  // Category counts
  const categoryCounts = tickets.reduce((acc: any, t) => {
    acc[t.user_category] = (acc[t.user_category] || 0) + 1;
    return acc;
  }, {});
  
  const categoryData = Object.entries(categoryCounts).map(([name, value]) => ({ name, value }));

  // Funnel Data (Status)
  const funnelCounts = tickets.reduce((acc: any, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {});

  const funnelOrder = ['REPORTED', 'VERIFIED', 'DISPATCHED', 'RESCUED', 'CLOSED'];
  const funnelData = funnelOrder.map(status => ({
    status,
    count: funnelCounts[status] || 0
  })).filter(item => item.count > 0);

  // Jurisdiction / District breakdown
  const jurisdictionCounts = tickets.reduce((acc: any, t) => {
    const jur = t.district_id || 'Unknown';
    acc[jur] = (acc[jur] || 0) + 1;
    return acc;
  }, {});

  const jurisdictionData = Object.entries(jurisdictionCounts)
    .map(([jurisdiction, total]) => ({ jurisdiction, total }))
    .sort((a, b) => (b.total as number) - (a.total as number))
    .slice(0, 10);

  // Hourly pattern of past critical reports (raw histogram, NOT a prediction)
  const hourlyDistribution = Array(24).fill(0);
  tickets.forEach(t => {
    if (t.priority === 'Critical' && t.createdAt) {
      const hour = new Date(t.createdAt).getHours();
      hourlyDistribution[hour] += 1;
    }
  });

  const hourlyData = hourlyDistribution.map((count, hour) => {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return { time: `${displayHour}${ampm}`, reports: count };
  });

  const COLORS = ['#14b8a6', '#f59e0b', '#3b82f6', '#a23b2e', '#8b5cf6'];

  return (
    <div className="p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-display font-bold text-[var(--ink)] flex items-center gap-2">
          <BarChart className="w-5 h-5 text-[var(--teal)]" />
          Analytics Intelligence
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <div className="bg-white rounded-xl border border-[var(--line)] shadow-sm p-4">
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
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Funnel */}
        <div className="bg-white rounded-xl border border-[var(--line)] shadow-sm p-4">
          <h3 className="font-semibold text-[14px] text-[var(--ink)] mb-4">Rescue Funnel</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart data={funnelData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" stroke="#94a3b8" fontSize={10} />
                <YAxis dataKey="status" type="category" stroke="#94a3b8" fontSize={10} width={80} />
                <Tooltip cursor={{ fill: 'rgba(20, 184, 166, 0.05)' }} />
                <Bar dataKey="count" fill="#14b8a6" radius={[0, 4, 4, 0]} />
              </RechartsBarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Incidents by Jurisdiction */}
        <div className="bg-white rounded-xl border border-[var(--line)] shadow-sm p-4">
          <h3 className="font-semibold text-[14px] text-[var(--ink)] mb-4">Incidents by Jurisdiction</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart data={jurisdictionData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="jurisdiction" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip cursor={{ fill: 'rgba(20, 184, 166, 0.05)' }} />
                <Bar dataKey="total" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </RechartsBarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hourly Pattern (honest, not a prediction) */}
        <div className="bg-white rounded-xl border border-[var(--line)] shadow-sm p-4">
          <h3 className="font-semibold text-[14px] text-[var(--ink)] mb-2">Hourly Pattern of Critical Reports</h3>
          <p className="text-[10px] text-[var(--ink-soft)] mb-3 font-mono">Historical distribution — not a prediction</p>
          <div className="h-[230px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourlyData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={9} interval={2} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip />
                <Line type="monotone" dataKey="reports" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 5 }} name="Critical reports" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
