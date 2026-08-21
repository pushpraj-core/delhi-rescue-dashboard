import React, { useState, useEffect } from 'react';
import { Shield, Key, Eye, Lock, MapPin, AlertCircle, Map, LayoutDashboard, List, Activity } from 'lucide-react';
import type { EncryptedPayload } from '../../utils/crypto';
import { decryptImagePayload } from '../../utils/crypto';
import { demoPrivateKey } from '../../utils/demoKeys';

import { MapViewer } from './MapViewer';
import { KanbanBoard } from './KanbanBoard';
import { ReportGenerator } from './ReportGenerator';

interface Ticket {
  _id: string;
  district_id: string;
  confidence_score: number;
  user_category: string;
  status: string;
  createdAt: string;
  reportCount: number;
  location: { coordinates: [number, number] };
  encryptedPayload: EncryptedPayload;
  isEmergency?: boolean;
}

export const AuthorityDashboard: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [hotspots, setHotspots] = useState<[number, number, number][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [privateKeyInput, setPrivateKeyInput] = useState(JSON.stringify(demoPrivateKey, null, 2));
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [decryptedImages, setDecryptedImages] = useState<Record<string, string>>({});
  const [decryptingIds, setDecryptingIds] = useState<Record<string, boolean>>({});
  const [khoyaPayaResults, setKhoyaPayaResults] = useState<Record<string, any>>({});
  
  const [activeTab, setActiveTab] = useState<'map' | 'board' | 'list'>('board');

  useEffect(() => {
    if (isAuthenticated) {
      fetchTickets();
      fetchHotspots();
    }
  }, [isAuthenticated]);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tickets');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTickets(data.tickets || []);
    } catch (err: any) {
      setError('Failed to fetch tickets. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const fetchHotspots = async () => {
    try {
      const res = await fetch('/api/tickets/hotspots');
      const data = await res.json();
      if (res.ok) {
        setHotspots(data.hotspots || []);
      }
    } catch (e) {
      console.error('Failed to fetch hotspots', e);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      JSON.parse(privateKeyInput);
      setIsAuthenticated(true);
    } catch (err) {
      setError('Invalid Private Key JSON format');
    }
  };

  const handleDecrypt = async (ticket: Ticket) => {
    setDecryptingIds(prev => ({ ...prev, [ticket._id]: true }));
    setError(null);
    try {
      // Log decryption securely for JJ Act compliance
      await fetch(`/api/tickets/${ticket._id}/audit-decrypt`, { method: 'POST' });

      const privateKeyJwk = JSON.parse(privateKeyInput);
      const blobUrl = await decryptImagePayload(ticket.encryptedPayload, privateKeyJwk);
      setDecryptedImages(prev => ({ ...prev, [ticket._id]: blobUrl }));
    } catch (err: any) {
      setError(`Decryption failed for ticket ${ticket._id}: Invalid Key or Corrupted Data.`);
    } finally {
      setDecryptingIds(prev => ({ ...prev, [ticket._id]: false }));
    }
  };

  const checkKhoyaPaya = async (ticketId: string) => {
    try {
      const res = await fetch('/api/tickets/verify-khoya-paya', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId })
      });
      const data = await res.json();
      setKhoyaPayaResults(prev => ({ ...prev, [ticketId]: data }));
    } catch (err) {
      console.error('Failed to check database', err);
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      // Optimistic update
      setTickets(prev => prev.map(t => t._id === id ? { ...t, status: newStatus } : t));
      
      const res = await fetch(`/api/tickets/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error('Failed to update status');
    } catch (err) {
      console.error(err);
      fetchTickets(); // Revert on failure
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-xl mx-auto p-8 bg-white min-h-[500px] flex flex-col justify-center items-center rounded-2xl shadow-xl border border-gray-100 mt-10">
        <Shield className="w-16 h-16 text-blue-600 mb-6" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Secure Nodal Officer Login</h2>
        <p className="text-gray-500 mb-8 text-center text-sm">
          Provide your RSA Private Key to access the E2EE Encrypted Incident Dashboard.
        </p>
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg w-full text-sm">{error}</div>}
        <form onSubmit={handleLogin} className="w-full flex flex-col gap-4">
          <textarea
            value={privateKeyInput}
            onChange={(e) => setPrivateKeyInput(e.target.value)}
            className="w-full h-48 p-4 font-mono text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Paste JWK Private Key JSON here..."
            required
          />
          <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors">
            <Key className="w-5 h-5" /> Authenticate & Access Dashboard
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 mt-6">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-600" /> Nodal Operations Center
          </h1>
          <p className="text-sm text-gray-500 mt-1">End-to-End Encrypted Data Access • JJ Act Compliant</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <ReportGenerator tickets={tickets} />
          <button onClick={fetchTickets} className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-sm font-medium transition flex items-center gap-2">
            <Activity className="w-4 h-4" /> Sync Data
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('board')}
          className={`px-6 py-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'board' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <LayoutDashboard className="w-4 h-4" /> Dispatch Board
        </button>
        <button
          onClick={() => setActiveTab('map')}
          className={`px-6 py-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'map' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <Map className="w-4 h-4" /> Live Heatmap
        </button>
        <button
          onClick={() => setActiveTab('list')}
          className={`px-6 py-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'list' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <List className="w-4 h-4" /> Evidence Vault
        </button>
      </div>

      {/* Main Content Area */}
      {error && <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2"><AlertCircle className="w-5 h-5" />{error}</div>}
      
      {loading ? (
        <div className="flex justify-center items-center py-20 text-gray-500 font-medium">Loading secure network data...</div>
      ) : (
        <div className="animate-in fade-in duration-300">
          
          {/* TAB 1: Kanban Board */}
          {activeTab === 'board' && (
            <KanbanBoard 
              rawTickets={tickets} 
              onTicketUpdate={handleStatusUpdate}
              onTicketClick={() => setActiveTab('list')}
            />
          )}

          {/* TAB 2: Live Heatmap */}
          {activeTab === 'map' && (
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><MapPin className="w-5 h-5 text-red-500"/> Real-time Interactive Hotspots</h3>
              <MapViewer tickets={tickets} />
            </div>
          )}

          {/* TAB 3: Evidence Vault (List View) */}
          {activeTab === 'list' && (
            <div className="grid gap-6">
              {tickets.length === 0 ? <p className="text-gray-500 text-center py-10">No active incidents.</p> : null}
              {tickets.map(ticket => (
                <div key={ticket._id} className="border border-gray-200 rounded-xl p-5 flex flex-col md:flex-row gap-6 hover:shadow-md transition-shadow bg-white">
                  
                  {/* Secure Image Vault */}
                  <div className="w-full md:w-56 h-56 bg-gray-900 rounded-xl overflow-hidden flex flex-col items-center justify-center relative shrink-0">
                    {decryptedImages[ticket._id] ? (
                      <>
                        <img src={decryptedImages[ticket._id]} alt="Decrypted Evidence" className="w-full h-full object-cover" />
                        {!khoyaPayaResults[ticket._id] ? (
                          <button 
                            onClick={() => checkKhoyaPaya(ticket._id)}
                            className="absolute bottom-2 left-2 right-2 px-2 py-1.5 bg-indigo-600/90 backdrop-blur text-white text-xs font-semibold rounded hover:bg-indigo-700 transition"
                          >
                            Check Khoya Paya DB
                          </button>
                        ) : (
                          <div className={`absolute bottom-0 left-0 right-0 p-2 text-xs font-bold text-center backdrop-blur ${khoyaPayaResults[ticket._id].matchFound ? 'bg-green-600/90 text-white' : 'bg-gray-800/90 text-gray-300'}`}>
                            {khoyaPayaResults[ticket._id].matchFound ? `Match: ${khoyaPayaResults[ticket._id].confidence}% (${khoyaPayaResults[ticket._id].matchedProfileId})` : 'No Match Found'}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <Lock className="w-8 h-8 text-gray-500 mb-2" />
                        <p className="text-xs text-gray-400 font-medium text-center px-4 mb-4">AES-GCM Payload</p>
                        <button
                          onClick={() => handleDecrypt(ticket)}
                          disabled={decryptingIds[ticket._id]}
                          className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition flex items-center gap-1 disabled:opacity-50"
                        >
                          {decryptingIds[ticket._id] ? 'Decrypting...' : <><Eye className="w-3 h-3" /> View Evidence</>}
                        </button>
                      </>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-2 items-center">
                        <select
                          value={ticket.status}
                          onChange={(e) => handleStatusUpdate(ticket._id, e.target.value)}
                          className={`px-3 py-1 text-xs font-bold rounded-full border outline-none cursor-pointer appearance-none ${
                            ticket.status.includes('Closed') ? 'bg-gray-100 text-gray-700 border-gray-300' 
                            : ticket.status.includes('High') || ticket.isEmergency ? 'bg-red-100 text-red-700 border-red-300' 
                            : 'bg-teal-100 text-teal-800 border-teal-300'
                          }`}
                        >
                          <option value="New Reports">New Reports / Pending</option>
                          <option value="Under Review">Under Review</option>
                          <option value="Field Team Dispatched">Field Team Dispatched</option>
                          <option value="Case Closed (CWC)">Case Closed (CWC)</option>
                          <option value="Rejected">Dismissed (False Positive)</option>
                        </select>
                        {ticket.isEmergency && <span className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Emergency</span>}
                      </div>
                      <span className="text-xs text-gray-500 font-mono">ID: {ticket._id.slice(-6)}</span>
                    </div>
                    
                    <h3 className="text-lg font-bold text-gray-800 mt-1">{ticket.user_category}</h3>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2 bg-gray-50 p-3 rounded-lg border border-gray-100">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">AI Confidence</p>
                        <p className="text-sm font-medium">{ticket.confidence_score}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">District</p>
                        <p className="text-sm font-medium">{ticket.district_id}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">GPS Coordinates</p>
                        <p className="text-sm font-medium font-mono">
                          {ticket.location.coordinates[1].toFixed(5)}, {ticket.location.coordinates[0].toFixed(5)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      )}
    </div>
  );
};
