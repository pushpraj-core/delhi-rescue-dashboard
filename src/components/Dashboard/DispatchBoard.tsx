import React, { useState, useEffect } from 'react';
import { MapPin, AlertCircle, Clock, ChevronRight, Users, Search, Filter } from 'lucide-react';

interface Ticket {
  _id: string;
  district_id: string;
  user_category: string;
  status: string;
  confidence_score: number;
  assigned_team?: string | null;
  priority?: string;
  isEmergency?: boolean;
  createdAt: string;
  slaBreachAt?: string;
  escalated?: boolean;
  trackingId?: string;
}

const STATUSES = ['REPORTED', 'DISPATCHED', 'RESCUED', 'CLOSED', 'REJECTED'];

// TEAMS are now fetched from API

const normalizeStatus = (status: string) => {
  if (['VERIFIED'].includes(status)) return 'REPORTED';
  if (['CWC_PRODUCED', 'REHAB_FOLLOWUP'].includes(status)) return 'RESCUED';
  if (['DUPLICATE'].includes(status)) return 'REJECTED';
  if (STATUSES.includes(status)) return status;
  return 'REPORTED';
};

const timeAgo = (dateStr: string) => {
  if (!dateStr) return '';
  const seconds = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + "y ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + "m ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + "d ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + "h ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + "m ago";
  return Math.floor(seconds) + "s ago";
};

const TicketCard = ({ ticket, onClick, onStatusChange, onTeamAssign, availableTeams }: { ticket: Ticket, onClick: () => void, onStatusChange: (id: string, status: string) => void, onTeamAssign: (id: string, team: string) => void, availableTeams: any[] }) => {
  const isDispatched = ticket.status === 'DISPATCHED';

  let slaWarning = false;
  let slaText = '';
  
  if (ticket.slaBreachAt) {
    const msLeft = new Date(ticket.slaBreachAt).getTime() - Date.now();
    if (msLeft <= 0) {
      slaWarning = true;
      slaText = 'BREACHED';
    } else {
      const hours = Math.floor(msLeft / 3600000);
      const minutes = Math.floor((msLeft % 3600000) / 60000);
      slaText = `${hours}h ${minutes}m left`;
      if (hours < 1) slaWarning = true;
    }
  }

  return (
    <div className={`bg-white/90 backdrop-blur p-4 rounded-xl border ${slaWarning && !['CLOSED', 'REJECTED', 'DUPLICATE'].includes(ticket.status) ? 'border-[var(--stamp)] shadow-[0_0_8px_rgba(162,59,46,0.3)]' : 'border-[var(--line)]'} shadow-sm hover:shadow-md hover:-translate-y-[1px] transition-all flex flex-col justify-between`}>
      <div>
        <div className="flex justify-between items-start mb-3" onClick={onClick}>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[10px] font-mono font-bold text-[var(--ink-soft)] bg-[var(--line)]/10 px-1.5 py-0.5 rounded-md">ID: {ticket.trackingId || ticket._id.slice(-6)}</span>
            <span className="text-[10px] font-mono font-bold text-[var(--ink-soft)] bg-[var(--line)]/10 px-1.5 py-0.5 rounded-md flex items-center gap-1"><Clock className="w-3 h-3"/> {timeAgo(ticket.createdAt)}</span>
            {ticket.slaBreachAt && !['CLOSED', 'REJECTED', 'DUPLICATE'].includes(ticket.status) && (
               <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1 ${slaWarning ? 'bg-[var(--stamp)]/10 text-[var(--stamp)]' : 'bg-orange-100 text-orange-800'}`}>
                 SLA: {slaText}
               </span>
            )}
            {ticket.escalated && (
               <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-[var(--stamp)] text-white animate-pulse">
                 ESCALATED
               </span>
            )}
          </div>
          {ticket.confidence_score < 60 && (
            <AlertCircle className="w-4 h-4 text-[var(--stamp)]" />
          )}
        </div>
        <h4 className="font-display font-semibold text-[var(--ink)] text-[15px] mb-3 leading-tight cursor-pointer" onClick={onClick}>{ticket.user_category}</h4>
      </div>

      {/* NGO / Field Handoff Pipeline */}
      <div className="mb-3">
        <div className="flex items-center gap-1.5 mb-1 text-[10px] font-mono font-bold text-[var(--ink-soft)] uppercase tracking-wider">
          <Users className="w-3 h-3" /> Handoff / Assign
        </div>
        <select
          value={ticket.assigned_team || ''}
          onChange={(e) => onTeamAssign(ticket._id, e.target.value)}
          className={`w-full text-[11px] font-semibold p-1.5 rounded-lg border ${ticket.assigned_team ? 'bg-[var(--teal)]/10 text-[var(--teal)] border-[var(--teal)]/30' : 'bg-white/50 text-[var(--ink)] border-[var(--line)]'} outline-none cursor-pointer transition-colors`}
        >
          <option value="">-- Unassigned --</option>
          {availableTeams.map((team, idx) => (
            <option key={team._id || idx} value={team.name}>
              {team.name} ({team.type})
            </option>
          ))}
        </select>
      </div>
      
      <div className="flex justify-between items-center mt-3 pt-3 border-t border-[var(--line)]">
        <div className="flex items-center gap-1 text-[11px] font-semibold text-[var(--ink-soft)] tracking-wider cursor-pointer" onClick={onClick}>
          <MapPin className="w-3 h-3 text-[var(--teal)]" />
          DCPU {ticket.district_id}
        </div>
        <select
          value={ticket.status}
          onChange={(e) => {
            const newStatus = e.target.value;
            if (newStatus === 'CLOSED') {
              if (window.confirm('Are you sure you want to close this case? Ensure all CWC proceedings are complete.')) {
                onStatusChange(ticket._id, newStatus);
              }
            } else {
              onStatusChange(ticket._id, newStatus);
            }
          }}
          className="text-[11px] font-semibold p-1.5 rounded-lg border border-[var(--line)] bg-white/50 text-[var(--ink)] outline-none cursor-pointer w-[130px] uppercase tracking-wider focus:border-[var(--teal)] hover:bg-white transition-colors"
        >
          {STATUSES.map(status => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      </div>
    </div>
  );
};

export const DispatchBoard = ({ rawTickets, onTicketUpdate, onTicketClick, onTeamAssign }: { rawTickets: Ticket[], onTicketUpdate: (id: string, status: string) => void, onTicketClick: (ticket: Ticket) => void, onTeamAssign: (id: string, team: string) => void }) => {
  const [activeStatus, setActiveStatus] = useState<string>('REPORTED');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterEmergencyOnly, setFilterEmergencyOnly] = useState(false);

  useEffect(() => {
    setTickets(rawTickets.map(t => ({ ...t, status: normalizeStatus(t.status) })));
  }, [rawTickets]);

  useEffect(() => {
    import('../../utils/apiClient').then(({ apiFetch }) => {
      apiFetch('/api/teams').then(data => setTeams(data.teams || [])).catch(console.error);
    });
  }, []);

  const districts = [...new Set(tickets.map(t => t.district_id))].sort();
  const categories = [...new Set(tickets.map(t => t.user_category))].sort();

  const displayedTickets = tickets.filter(t => {
    if (t.status !== activeStatus) return false;
    if (searchQuery && !t._id.toLowerCase().includes(searchQuery.toLowerCase()) && !t.user_category.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterDistrict && t.district_id !== filterDistrict) return false;
    if (filterCategory && t.user_category !== filterCategory) return false;
    if (filterEmergencyOnly && !t.isEmergency) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Sub-Navigation for Statuses */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-white/40 backdrop-blur-md rounded-xl border border-[var(--line)] shadow-sm">
        {STATUSES.map(status => {
          const count = tickets.filter(t => t.status === status).length;
          const isActive = activeStatus === status;
          return (
            <button
              key={status}
              onClick={() => setActiveStatus(status)}
              className={`flex-1 min-w-[120px] py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all font-semibold text-[13px] ${
                isActive 
                  ? 'bg-[var(--teal)] text-white shadow-sm' 
                  : 'text-[var(--ink-soft)] hover:bg-white/50'
              }`}
            >
              {status}
              <span className={`text-[10px] py-0.5 px-2 rounded-full font-bold ${
                isActive ? 'bg-white/20 text-white' : 'bg-[var(--line)]/10 text-[var(--ink)]'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-2 items-center p-2 bg-white/30 backdrop-blur-md rounded-xl border border-[var(--line)]">
        <div className="flex items-center gap-1.5 flex-1 min-w-[180px] bg-white/60 border border-[var(--line)] rounded-lg px-2.5 py-1.5">
          <Search className="w-3.5 h-3.5 text-[var(--ink-soft)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ID or category..."
            className="bg-transparent outline-none text-[12px] w-full text-[var(--ink)] placeholder:text-[var(--ink-soft)]/50"
          />
        </div>
        <select value={filterDistrict} onChange={(e) => setFilterDistrict(e.target.value)} className="text-[11px] font-semibold py-1.5 px-2 rounded-lg border border-[var(--line)] bg-white/60 text-[var(--ink)] outline-none cursor-pointer">
          <option value="">All Districts</option>
          {districts.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="text-[11px] font-semibold py-1.5 px-2 rounded-lg border border-[var(--line)] bg-white/60 text-[var(--ink)] outline-none cursor-pointer">
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--stamp)] cursor-pointer bg-white/60 border border-[var(--line)] rounded-lg px-2.5 py-1.5">
          <input type="checkbox" checked={filterEmergencyOnly} onChange={(e) => setFilterEmergencyOnly(e.target.checked)} className="w-3 h-3 accent-[var(--stamp)]" />
          Emergency Only
        </label>
      </div>

      {/* Ticket Grid */}
      <div className="bg-white/30 backdrop-blur-md border border-[var(--line)] rounded-xl p-6 min-h-[400px]">
        {displayedTickets.length === 0 ? (
          <div className="h-[300px] flex flex-col items-center justify-center text-[var(--ink-soft)] text-center">
            <div className="w-16 h-16 rounded-full bg-[var(--line)]/10 flex items-center justify-center mb-4">
               <AlertCircle className="w-8 h-8 opacity-50" />
            </div>
            <p className="font-mono text-[12px] uppercase tracking-widest font-bold">No {activeStatus}</p>
            <p className="text-[13px] mt-2 opacity-80">Tickets with this status will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {displayedTickets.map(ticket => (
              <TicketCard 
                key={ticket._id} 
                ticket={ticket} 
                onClick={() => onTicketClick(ticket)} 
                onStatusChange={onTicketUpdate}
                onTeamAssign={onTeamAssign}
                availableTeams={teams}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
