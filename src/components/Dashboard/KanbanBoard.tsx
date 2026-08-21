import React, { useState, useEffect } from 'react';
import { DndContext, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MapPin, AlertCircle, Clock, CheckCircle } from 'lucide-react';

interface Ticket {
  _id: string;
  district_id: string;
  user_category: string;
  status: string;
  confidence_score: number;
}

const COLUMNS = ['New Reports', 'Under Review', 'Field Team Dispatched', 'Case Closed (CWC)'];

// Normalizing raw DB status to Board Columns for MVP
const normalizeStatus = (status: string) => {
  if (COLUMNS.includes(status)) return status;
  return 'New Reports';
};

const SortableTicketCard = ({ ticket, onClick, onStatusChange }: { ticket: Ticket, onClick: () => void, onStatusChange: (id: string, status: string) => void }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: ticket._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white/90 backdrop-blur p-3 rounded-xl border border-[var(--line)] shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md hover:-translate-y-[1px] transition-all mb-3"
    >
      <div className="flex justify-between items-start mb-2" onClick={onClick}>
        <span className="text-[10px] font-mono font-bold text-[var(--ink-soft)] bg-[var(--line)]/10 px-1.5 py-0.5 rounded-md">ID: {ticket._id.slice(-6)}</span>
        {ticket.confidence_score < 60 && (
          <AlertCircle className="w-4 h-4 text-[var(--stamp)]" />
        )}
      </div>
      <h4 className="font-display font-semibold text-[var(--ink)] text-[14px] mb-2 leading-tight" onClick={onClick}>{ticket.user_category}</h4>
      <div className="flex justify-between items-center mt-3 pt-3 border-t border-[var(--line)]">
        <div className="flex items-center gap-1 text-[11px] font-semibold text-[var(--ink-soft)] tracking-wider" onClick={onClick}>
          <MapPin className="w-3 h-3 text-[var(--teal)]" />
          DCPU {ticket.district_id}
        </div>
        <select
          value={ticket.status}
          onChange={(e) => onStatusChange(ticket._id, e.target.value)}
          onClick={(e) => e.stopPropagation()} // Prevent dragging when clicking dropdown
          onPointerDown={(e) => e.stopPropagation()} // Prevent dnd-kit from intercepting pointer
          className="text-[10px] font-semibold p-1 rounded-md border border-[var(--line)] bg-white text-[var(--ink)] outline-none cursor-pointer w-[110px] uppercase tracking-wider"
        >
          {COLUMNS.map(col => (
            <option key={col} value={col}>{col}</option>
          ))}
        </select>
      </div>
    </div>
  );
};

export const KanbanBoard = ({ rawTickets, onTicketUpdate, onTicketClick }: { rawTickets: Ticket[], onTicketUpdate: (id: string, status: string) => void, onTicketClick: (ticket: Ticket) => void }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);

  useEffect(() => {
    setTickets(rawTickets.map(t => ({ ...t, status: normalizeStatus(t.status) })));
  }, [rawTickets]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeTicket = tickets.find(t => t._id === activeId);
    if (!activeTicket) return;

    // Check if dropping on a column
    if (COLUMNS.includes(overId)) {
      if (activeTicket.status !== overId) {
        updateTicketStatus(activeId, overId);
      }
      return;
    }

    // Dropping on another card
    const overTicket = tickets.find(t => t._id === overId);
    if (overTicket && activeTicket.status !== overTicket.status) {
      updateTicketStatus(activeId, overTicket.status);
    }
  };

  const updateTicketStatus = (id: string, newStatus: string) => {
    setTickets(prev => prev.map(t => t._id === id ? { ...t, status: newStatus } : t));
    onTicketUpdate(id, newStatus);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 pt-2 px-2 -mx-2">
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        {COLUMNS.map(col => {
          const colTickets = tickets.filter(t => t.status === col);
          return (
            <div key={col} className="w-72 shrink-0 bg-white/40 backdrop-blur-md border border-[var(--line)] shadow-sm rounded-xl flex flex-col max-h-[600px]">
              <div className="p-3 border-b border-[var(--line)] bg-white/50 rounded-t-xl flex justify-between items-center">
                <h3 className="font-display font-semibold text-[var(--ink)] text-[14px]">{col}</h3>
                <span className="bg-[var(--teal)]/10 text-[var(--teal)] text-[10px] py-0.5 px-2 rounded-full font-bold">{colTickets.length}</span>
              </div>
              
              <div id={col} className="p-3 flex-1 overflow-y-auto">
                <SortableContext id={col} items={colTickets.map(t => t._id)} strategy={verticalListSortingStrategy}>
                  {colTickets.map(ticket => (
                    <SortableTicketCard key={ticket._id} ticket={ticket} onClick={() => onTicketClick(ticket)} onStatusChange={updateTicketStatus} />
                  ))}
                  {colTickets.length === 0 && (
                    <div className="h-20 flex items-center justify-center border-2 border-dashed border-[var(--line)] rounded-xl text-[var(--ink-soft)] text-[11px] font-bold uppercase tracking-wider">
                      Drop here
                    </div>
                  )}
                </SortableContext>
              </div>
            </div>
          );
        })}
      </DndContext>
    </div>
  );
};
