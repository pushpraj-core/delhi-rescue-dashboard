import React, { useState, useEffect } from 'react';
import { Shield, Key, Eye, Lock, MapPin, AlertCircle, Map, LayoutDashboard, List, Activity, UserCheck, Users, MessageSquare, Send } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import type { EncryptedPayload } from '../../utils/crypto';
import { decryptImagePayload } from '../../utils/crypto';
import { demoPrivateKey } from '../../utils/demoKeys';

import { MapViewer } from './MapViewer';
import { DispatchBoard } from './DispatchBoard';
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
  assigned_team?: string | null;
  notes?: { text: string; author: string; createdAt: string }[];
}

export const AuthorityDashboard: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [hotspots, setHotspots] = useState<[number, number, number][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [privateKeyInput, setPrivateKeyInput] = useState(JSON.stringify(demoPrivateKey, null, 2));
  const [isGoogleAuthenticated, setIsGoogleAuthenticated] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [googleAuthError, setGoogleAuthError] = useState<string | null>(null);
  const [decryptedImages, setDecryptedImages] = useState<Record<string, string>>({});
  const [decryptingIds, setDecryptingIds] = useState<Record<string, boolean>>({});
  const [khoyaPayaResults, setKhoyaPayaResults] = useState<Record<string, any>>({});
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  
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

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      setGoogleAuthError(null);
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: credentialResponse.credential })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failed');
      
      // Store the token (optional for now, as we don't strictly protect the tickets endpoint yet)
      localStorage.setItem('gov_token', data.token);
      setIsGoogleAuthenticated(true);
    } catch (err: any) {
      setGoogleAuthError(err.message);
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

  const handleTeamAssign = async (id: string, team: string) => {
    try {
      // Optimistic update
      setTickets(prev => prev.map(t => t._id === id ? { ...t, assigned_team: team || null } : t));

      const res = await fetch(`/api/tickets/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Field Team Dispatched', assigned_team: team || null })
      });
      if (!res.ok) throw new Error('Failed to assign team');
    } catch (err) {
      console.error(err);
      fetchTickets();
    }
  };

  if (!isGoogleAuthenticated) {
    return (
      <div className="bg-dotted-paper min-h-[calc(100vh-64px)] flex flex-col justify-center items-center font-body text-[var(--ink)] pb-10">
        <div className="w-full max-w-xl mx-auto p-8 bg-white/60 backdrop-blur-md rounded-xl border border-[var(--line)] shadow-sm text-center">
          <UserCheck className="w-16 h-16 text-[#4285F4] mb-6 mx-auto" />
          <h2 className="text-[24px] font-display font-bold text-[var(--ink)] mb-2 tracking-tight">Government Single Sign-On</h2>
          <p className="text-[14px] text-[var(--ink-soft)] mb-8">
            Please authenticate using your authorized government email account.
          </p>
          {googleAuthError && <div className="mb-6 p-3 border border-[rgba(162,59,46,0.2)] bg-[rgba(162,59,46,0.05)] backdrop-blur text-[var(--stamp)] rounded-xl text-[13px]">{googleAuthError}</div>}
          
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => {
                setGoogleAuthError('Google Login Failed. Please try again.');
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="bg-dotted-paper min-h-[calc(100vh-64px)] flex flex-col justify-center items-center font-body text-[var(--ink)] pb-10">
        <div className="w-full max-w-xl mx-auto p-8 bg-white/60 backdrop-blur-md rounded-xl border border-[var(--line)] shadow-sm">
          <Shield className="w-16 h-16 text-[var(--teal)] mb-6" />
          <h2 className="text-[24px] font-display font-bold text-[var(--ink)] mb-2 tracking-tight">Secure Vault Decryption</h2>
          <p className="text-[14px] text-[var(--ink-soft)] mb-8">
            Provide your RSA Private Key to decrypt the E2EE Encrypted Incident Dashboard.
          </p>
          {error && <div className="mb-4 p-3 border border-[rgba(162,59,46,0.2)] bg-[rgba(162,59,46,0.05)] backdrop-blur text-[var(--stamp)] rounded-xl text-[13px]">{error}</div>}
          <form onSubmit={handleLogin} className="w-full flex flex-col gap-5">
            <textarea
              value={privateKeyInput}
              onChange={(e) => setPrivateKeyInput(e.target.value)}
              className="w-full h-48 p-4 font-mono text-[11px] bg-white/80 border border-[var(--line)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--teal)] transition-shadow"
              placeholder="Paste JWK Private Key JSON here..."
              required
            />
            <button type="submit" className="w-full py-3 bg-[var(--ink)] hover:bg-[var(--ink-soft)] text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm">
              <Key className="w-5 h-5" /> Decrypt & Access Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-dotted-paper min-h-[calc(100vh-64px)] font-body text-[var(--ink)] pb-16 pt-8">
      <div className="max-w-[1200px] mx-auto px-6">
        
        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 bg-white/40 backdrop-blur-md p-5 border border-[var(--line)] rounded-xl shadow-sm">
          <div>
            <h1 className="text-[22px] font-display font-bold flex items-center gap-2 tracking-tight">
              <Shield className="w-6 h-6 text-[var(--teal)]" /> Nodal Operations Center
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <div className="font-mono text-[10px] bg-white/60 border border-[var(--line)] px-2 py-0.5 rounded-full text-[var(--ink-soft)] uppercase tracking-wider">
                End-to-End Encrypted
              </div>
              <div className="font-mono text-[10px] bg-[var(--teal)]/10 text-[var(--teal)] border border-[var(--teal)]/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                JJ Act Compliant
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <ReportGenerator tickets={tickets} />
            <button onClick={fetchTickets} className="px-4 py-2 bg-white/60 backdrop-blur border border-[var(--line)] text-[13px] font-semibold rounded-lg hover:bg-white transition shadow-sm flex items-center gap-2">
              <Activity className="w-4 h-4" /> Sync Data
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[var(--line-strong)] mb-8 gap-1">
          <button
            onClick={() => setActiveTab('board')}
            className={`px-5 py-3 font-semibold text-[14px] flex items-center gap-2 border-b-[2px] transition-colors ${activeTab === 'board' ? 'border-[var(--teal)] text-[var(--ink)]' : 'border-transparent text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--line)]'}`}
          >
            <LayoutDashboard className="w-4 h-4" /> Dispatch Board
          </button>
          <button
            onClick={() => setActiveTab('map')}
            className={`px-5 py-3 font-semibold text-[14px] flex items-center gap-2 border-b-[2px] transition-colors ${activeTab === 'map' ? 'border-[var(--teal)] text-[var(--ink)]' : 'border-transparent text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--line)]'}`}
          >
            <Map className="w-4 h-4" /> Live Heatmap
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`px-5 py-3 font-semibold text-[14px] flex items-center gap-2 border-b-[2px] transition-colors ${activeTab === 'list' ? 'border-[var(--teal)] text-[var(--ink)]' : 'border-transparent text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--line)]'}`}
          >
            <List className="w-4 h-4" /> Evidence Vault
          </button>
        </div>

        {/* Main Content Area */}
        {error && <div className="mb-6 p-4 border border-[rgba(162,59,46,0.2)] bg-[rgba(162,59,46,0.05)] backdrop-blur text-[var(--stamp)] rounded-xl flex items-center gap-2 text-[13px]"><AlertCircle className="w-5 h-5" />{error}</div>}
        
        {loading ? (
          <div className="flex justify-center items-center py-20 font-mono text-[12px] text-[var(--ink-soft)] uppercase tracking-wider">
            <div className="w-4 h-4 border-2 border-[var(--ink)] border-t-[var(--teal)] rounded-full animate-spin mr-3"></div>
            Loading secure network data...
          </div>
        ) : (
          <div className="animate-in fade-in duration-300">
            
            {/* TAB 1: Dispatch Board */}
            {activeTab === 'board' && (
              <DispatchBoard 
                rawTickets={tickets} 
                onTicketUpdate={handleStatusUpdate}
                onTicketClick={() => setActiveTab('list')}
                onTeamAssign={handleTeamAssign}
              />
            )}

            {/* TAB 2: Live Heatmap */}
            {activeTab === 'map' && (
              <div className="bg-white/40 backdrop-blur-md p-5 rounded-xl border border-[var(--line)] shadow-sm">
                <h3 className="font-display font-semibold text-[18px] mb-5 flex items-center gap-2 tracking-tight">
                  <MapPin className="w-5 h-5 text-[var(--stamp)]"/> Real-time Interactive Hotspots
                </h3>
                <MapViewer tickets={tickets} />
              </div>
            )}

            {/* TAB 3: Evidence Vault (List View) */}
            {activeTab === 'list' && (
              <div className="grid gap-6">
                {tickets.length === 0 ? <p className="font-mono text-[12px] text-[var(--ink-soft)] text-center py-10 uppercase tracking-widest">No active incidents.</p> : null}
                {tickets.map(ticket => (
                  <div key={ticket._id} className="bg-white/60 backdrop-blur-sm border border-[var(--line)] rounded-xl p-5 flex flex-col md:flex-row gap-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                    
                    {/* Secure Image Vault */}
                    <div className="w-full md:w-56 h-56 bg-[#0d1420] bg-camera-grid rounded-xl overflow-hidden flex flex-col items-center justify-center relative shrink-0 border border-[var(--ink)]">
                      {decryptedImages[ticket._id] ? (
                        <>
                          <img src={decryptedImages[ticket._id]} alt="Decrypted Evidence" className="w-full h-full object-cover" />
                          {!khoyaPayaResults[ticket._id] ? (
                            <button 
                              onClick={() => checkKhoyaPaya(ticket._id)}
                              className="absolute bottom-2 left-2 right-2 px-2 py-2 bg-[var(--ink)]/80 backdrop-blur text-white text-[11px] font-semibold rounded-lg hover:bg-[var(--ink)] transition"
                            >
                              Check Khoya Paya DB
                            </button>
                          ) : (
                            <div className={`absolute bottom-0 left-0 right-0 p-2 text-[11px] font-semibold text-center backdrop-blur ${khoyaPayaResults[ticket._id].matchFound ? 'bg-[var(--teal)]/90 text-white' : 'bg-black/80 text-white'}`}>
                              {khoyaPayaResults[ticket._id].matchFound ? `Match: ${khoyaPayaResults[ticket._id].confidence}% (${khoyaPayaResults[ticket._id].matchedProfileId})` : 'No Match Found'}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <Lock className="w-8 h-8 text-[var(--teal)]/60 mb-3" />
                          <p className="font-mono text-[10px] text-white/50 tracking-widest text-center px-4 mb-4">AES-GCM ENCRYPTED</p>
                          <button
                            onClick={() => handleDecrypt(ticket)}
                            disabled={decryptingIds[ticket._id]}
                            className="px-4 py-2 bg-white/10 backdrop-blur border border-white/20 text-white text-[11px] font-semibold rounded-lg hover:bg-white/20 transition flex items-center gap-2 disabled:opacity-50"
                          >
                            {decryptingIds[ticket._id] ? 'DECRYPTING...' : <><Eye className="w-3 h-3" /> VIEW EVIDENCE</>}
                          </button>
                        </>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="flex-1 flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div className="flex gap-2 items-center">
                          <select
                            value={ticket.status}
                            onChange={(e) => handleStatusUpdate(ticket._id, e.target.value)}
                            className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-[2px] border-[1.5px] outline-none cursor-pointer appearance-none ${
                              ticket.status.includes('Closed') ? 'bg-[var(--paper-2)] text-[var(--ink-soft)] border-[var(--line-strong)]' 
                              : ticket.status.includes('High') || ticket.isEmergency ? 'bg-[rgba(162,59,46,0.1)] text-[var(--stamp)] border-[rgba(162,59,46,0.5)]' 
                              : 'bg-[var(--teal-light)] text-white border-[var(--teal)]'
                            }`}
                          >
                            <option value="New Reports">New Reports</option>
                            <option value="Under Review">Under Review</option>
                            <option value="Field Team Dispatched">Field Team Dispatched</option>
                            <option value="Case Closed (CWC)">Case Closed (CWC)</option>
                          </select>
                          {ticket.isEmergency && <span className="px-2 py-1 bg-[var(--stamp)] text-white text-[10px] font-bold uppercase tracking-wider rounded-[2px] flex items-center gap-1 border-[1.5px] border-[var(--ink)]"><AlertCircle className="w-3 h-3"/> Emergency</span>}
                        </div>
                        <span className="text-[12px] text-[var(--ink-soft)] font-mono font-semibold bg-[var(--paper-2)] border border-[var(--line-strong)] px-2 py-0.5 rounded-[2px]">ID: {ticket._id.slice(-6)}</span>
                      </div>
                      
                      <h3 className="text-[18px] font-display font-bold text-[var(--ink)] mt-1">{ticket.user_category}</h3>

                      {ticket.assigned_team && (
                        <div className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 rounded-[3px] bg-[var(--teal)]/10 border-[1.5px] border-[var(--teal)]/30 w-fit">
                          <Users className="w-3.5 h-3.5 text-[var(--teal)]" />
                          <span className="text-[12px] font-semibold text-[var(--teal)]">{ticket.assigned_team}</span>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-auto bg-[var(--paper)] p-4 rounded-[3px] border-[1.5px] border-[var(--line-strong)]">
                        <div>
                          <p className="font-mono text-[10px] text-[var(--teal)] font-bold tracking-widest uppercase mb-1">AI Score</p>
                          <p className="text-[15px] font-bold text-[var(--ink)]">{ticket.confidence_score}%</p>
                        </div>
                        <div>
                          <p className="font-mono text-[10px] text-[var(--teal)] font-bold tracking-widest uppercase mb-1">District</p>
                          <p className="text-[15px] font-bold text-[var(--ink)]">{ticket.district_id}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="font-mono text-[10px] text-[var(--teal)] font-bold tracking-widest uppercase mb-1">GPS Coordinates</p>
                          <p className="text-[13px] font-mono font-medium text-[var(--ink)]">
                            {ticket.location.coordinates[1].toFixed(5)}, {ticket.location.coordinates[0].toFixed(5)}
                          </p>
                        </div>
                      </div>

                      {/* Internal Notes */}
                      <div className="mt-4 border-[1.5px] border-[var(--line-strong)] rounded-[3px] overflow-hidden">
                        <div className="bg-[var(--paper-2)] px-3 py-2 flex items-center gap-2 border-b border-[var(--line-strong)]">
                          <MessageSquare className="w-3.5 h-3.5 text-[var(--ink-soft)]" />
                          <span className="font-mono text-[10px] font-bold text-[var(--ink-soft)] uppercase tracking-widest">Case Notes ({ticket.notes?.length || 0})</span>
                        </div>
                        <div className="max-h-[150px] overflow-y-auto">
                          {(ticket.notes && ticket.notes.length > 0) ? ticket.notes.map((note, idx) => (
                            <div key={idx} className="px-3 py-2 border-b border-[var(--line)] last:border-b-0 bg-white/50">
                              <p className="text-[12px] text-[var(--ink)] leading-relaxed">{note.text}</p>
                              <p className="text-[10px] text-[var(--ink-soft)] mt-1 font-mono">{note.author} · {new Date(note.createdAt).toLocaleString()}</p>
                            </div>
                          )) : (
                            <p className="px-3 py-3 text-[11px] text-[var(--ink-soft)] italic">No notes yet.</p>
                          )}
                        </div>
                        <div className="flex border-t border-[var(--line-strong)]">
                          <input
                            type="text"
                            value={noteInputs[ticket._id] || ''}
                            onChange={(e) => setNoteInputs(prev => ({ ...prev, [ticket._id]: e.target.value }))}
                            placeholder="Add a case note..."
                            className="flex-1 px-3 py-2 text-[12px] bg-white/80 outline-none placeholder:text-[var(--ink-soft)]/50"
                            onKeyDown={async (e) => {
                              if (e.key === 'Enter' && noteInputs[ticket._id]?.trim()) {
                                try {
                                  const res = await fetch(`/api/tickets/${ticket._id}/notes`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ text: noteInputs[ticket._id] })
                                  });
                                  if (res.ok) {
                                    const data = await res.json();
                                    setTickets(prev => prev.map(t => t._id === ticket._id ? { ...t, notes: data.notes } : t));
                                    setNoteInputs(prev => ({ ...prev, [ticket._id]: '' }));
                                  }
                                } catch (err) { console.error(err); }
                              }
                            }}
                          />
                          <button
                            onClick={async () => {
                              if (!noteInputs[ticket._id]?.trim()) return;
                              try {
                                const res = await fetch(`/api/tickets/${ticket._id}/notes`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ text: noteInputs[ticket._id] })
                                });
                                if (res.ok) {
                                  const data = await res.json();
                                  setTickets(prev => prev.map(t => t._id === ticket._id ? { ...t, notes: data.notes } : t));
                                  setNoteInputs(prev => ({ ...prev, [ticket._id]: '' }));
                                }
                              } catch (err) { console.error(err); }
                            }}
                            className="px-3 py-2 bg-[var(--ink)] text-white hover:bg-[var(--ink-soft)] transition-colors"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
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
    </div>
  );
};
