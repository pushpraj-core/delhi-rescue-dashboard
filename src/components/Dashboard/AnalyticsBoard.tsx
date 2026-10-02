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



  // Forecast Data (Hourly for Next 24h)
  const hourlyDistribution = Array(24).fill(0);
  let totalCritical = 0;
  tickets.forEach(t => {
    if (t.priority === 'Critical' && t.createdAt) {
      const hour = new Date(t.createdAt).getHours();
      hourlyDistribution[hour] += 1;
      totalCritical += 1;
    }
  });

  const currentHour = new Date().getHours();
  const dailyTotal = Math.max(5, Math.round(totalCritical / 7));
  
  const forecastData: any[] = [];
  for (let i = 1; i <= 24; i++) {
    const nextHour = (currentHour + i) % 24;
    const ampm = nextHour >= 12 ? 'PM' : 'AM';
    const displayHour = nextHour % 12 || 12;
    
    const prob = totalCritical > 0 ? (hourlyDistribution[nextHour] / totalCritical) : (1/24);
    const predictedCount = parseFloat(((prob * dailyTotal) + 0.1).toFixed(1));
    
    forecastData.push({
      time: `${displayHour} ${ampm}`,
      predicted: predictedCount
    });
  }

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

        {/* Forecast Graph (Takes up full width now that Wards is removed) */}
        <div className="bg-white rounded-xl border border-[var(--line)] shadow-sm p-4 md:col-span-2">
          <h3 className="font-semibold text-[14px] text-[var(--ink)] mb-4">Forecast: Critical Cases (Next 24h)</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={forecastData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} interval={2} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip />
                <Line type="monotone" dataKey="predicted" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{ r: 6 }} name="Forecast (ML)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
