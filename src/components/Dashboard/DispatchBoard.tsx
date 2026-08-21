import React, { useState, useEffect } from 'react';
import { MapPin, AlertCircle, Clock, ChevronRight } from 'lucide-react';

interface Ticket {
  _id: string;
  district_id: string;
  user_category: string;
  status: string;
  confidence_score: number;
}

const STATUSES = ['New Reports', 'Under Review', 'Field Team Dispatched', 'Case Closed (CWC)'];

const normalizeStatus = (status: string) => {
  if (STATUSES.includes(status)) return status;
  return 'New Reports';
};

const TicketCard = ({ ticket, onClick, onStatusChange }: { ticket: Ticket, onClick: () => void, onStatusChange: (id: string, status: string) => void }) => {
  return (
    <div className="bg-white/90 backdrop-blur p-4 rounded-xl border border-[var(--line)] shadow-sm hover:shadow-md hover:-translate-y-[1px] transition-all flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-start mb-3" onClick={onClick}>
          <span className="text-[10px] font-mono font-bold text-[var(--ink-soft)] bg-[var(--line)]/10 px-1.5 py-0.5 rounded-md">ID: {ticket._id.slice(-6)}</span>
          {ticket.confidence_score < 60 && (
            <AlertCircle className="w-4 h-4 text-[var(--stamp)]" />
          )}
        </div>
        <h4 className="font-display font-semibold text-[var(--ink)] text-[15px] mb-3 leading-tight cursor-pointer" onClick={onClick}>{ticket.user_category}</h4>
      </div>
      
      <div className="flex justify-between items-center mt-3 pt-3 border-t border-[var(--line)]">
        <div className="flex items-center gap-1 text-[11px] font-semibold text-[var(--ink-soft)] tracking-wider cursor-pointer" onClick={onClick}>
          <MapPin className="w-3 h-3 text-[var(--teal)]" />
          DCPU {ticket.district_id}
        </div>
        <select
          value={ticket.status}
          onChange={(e) => onStatusChange(ticket._id, e.target.value)}
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

export const DispatchBoard = ({ rawTickets, onTicketUpdate, onTicketClick }: { rawTickets: Ticket[], onTicketUpdate: (id: string, status: string) => void, onTicketClick: (ticket: Ticket) => void }) => {
  const [activeStatus, setActiveStatus] = useState<string>('New Reports');
  const [tickets, setTickets] = useState<Ticket[]>([]);

  useEffect(() => {
    setTickets(rawTickets.map(t => ({ ...t, status: normalizeStatus(t.status) })));
  }, [rawTickets]);

  const displayedTickets = tickets.filter(t => t.status === activeStatus);

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
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
