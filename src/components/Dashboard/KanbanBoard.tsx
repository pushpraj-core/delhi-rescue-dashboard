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

const SortableTicketCard = ({ ticket, onClick }: { ticket: Ticket, onClick: () => void }) => {
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
      onClick={onClick}
      className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 cursor-grab active:cursor-grabbing hover:shadow-md mb-2"
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-mono text-gray-500">ID: {ticket._id.slice(-6)}</span>
        {ticket.confidence_score < 60 && (
          <AlertCircle className="w-4 h-4 text-orange-500" />
        )}
      </div>
      <h4 className="font-semibold text-gray-800 text-sm mb-2">{ticket.user_category}</h4>
      <div className="flex items-center gap-1 text-xs text-gray-600">
        <MapPin className="w-3 h-3 text-blue-500" />
        DCPU {ticket.district_id}
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
    <div className="flex gap-4 overflow-x-auto pb-4">
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        {COLUMNS.map(col => {
          const colTickets = tickets.filter(t => t.status === col);
          return (
            <div key={col} className="w-72 shrink-0 bg-gray-50 rounded-xl flex flex-col max-h-[600px]">
              <div className="p-3 border-b border-gray-200 bg-gray-100 rounded-t-xl flex justify-between items-center">
                <h3 className="font-semibold text-gray-700 text-sm">{col}</h3>
                <span className="bg-gray-200 text-gray-600 text-xs py-0.5 px-2 rounded-full font-bold">{colTickets.length}</span>
              </div>
              
              <div id={col} className="p-3 flex-1 overflow-y-auto">
                <SortableContext id={col} items={colTickets.map(t => t._id)} strategy={verticalListSortingStrategy}>
                  {colTickets.map(ticket => (
                    <SortableTicketCard key={ticket._id} ticket={ticket} onClick={() => onTicketClick(ticket)} />
                  ))}
                  {colTickets.length === 0 && (
                    <div className="h-20 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg text-gray-400 text-sm">
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
