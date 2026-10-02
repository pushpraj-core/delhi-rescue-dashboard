import React, { useState, useEffect } from 'react';
import { Shield, Key, Eye, Lock, MapPin, AlertCircle, Map, LayoutDashboard, List, Activity, UserCheck, Users, MessageSquare, Send, FileText, History, CheckCircle, Clock } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { decryptImagePayload, getOrCreateOfficerKeys } from '../../utils/crypto';
import { apiFetch, setAuthToken } from '../../utils/apiClient';

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
  priority?: string;
  trackingId?: string;
}

interface AuditLogEntry {
  _id: string;
  action: string;
  ticketId: string;
  officerId: string;
  details: any;
  timestamp: string;
}

export const AuthorityDashboard: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [hotspots, setHotspots] = useState<[number, number, number][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isGoogleAuthenticated, setIsGoogleAuthenticated] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [googleAuthError, setGoogleAuthError] = useState<string | null>(null);
  const [decryptedImages, setDecryptedImages] = useState<Record<string, string>>({});
  const [decryptingIds, setDecryptingIds] = useState<Record<string, boolean>>({});
  const [khoyaPayaResults, setKhoyaPayaResults] = useState<Record<string, any>>({});
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [toast, setToast] = useState<{message: string, type: 'success'|'error'} | null>(null);

  const showToast = (message: string, type: 'success'|'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  
  const [activeTab, setActiveTab] = useState<'map' | 'board' | 'list' | 'audit'>('board');

  useEffect(() => {
    if (isAuthenticated) {
      fetchTickets();
      fetchHotspots();
      fetchAuditLogs();

      import('socket.io-client').then(({ io }) => {
        const token = localStorage.getItem('token') || 'dev-bypass-token';
        const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
          auth: { token }
        });

        socket.on('ticket_created', (newTicket: Ticket) => {
          setTickets(prev => [newTicket, ...prev]);
          showToast(`New Incident Reported: ${newTicket.user_category}`);
        });

        socket.on('ticket_updated', (updatedTicket: Ticket) => {
          setTickets(prev => prev.map(t => t._id === updatedTicket._id ? updatedTicket : t));
        });

        socket.on('sla_escalation', (data: any) => {
          showToast(`🚨 ${data.count} tickets escalated to Admin due to SLA breach!`, 'error');
          fetchTickets();
        });

        return () => {
          socket.disconnect();
        };
      });
    }
  }, [isAuthenticated]);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/tickets');
      setTickets(data.tickets || []);
    } catch (err: any) {
      setError('Failed to fetch tickets. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const fetchHotspots = async () => {
    try {
      const data = await apiFetch('/api/tickets/hotspots');
      setHotspots(data.hotspots || []);
    } catch (e) {
      console.error('Failed to fetch hotspots', e);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const data = await apiFetch('/api/tickets/audit-log');
      setAuditLogs(data.logs || []);
    } catch (err) {
      console.error(err);
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
      
      setAuthToken(data.token);
      
      // Upload public key
      const keys = await getOrCreateOfficerKeys();
      await apiFetch('/api/auth/keys/upload', {
        method: 'POST',
        body: JSON.stringify({ publicKeyJwk: keys.publicKey })
      });

      setIsGoogleAuthenticated(true);
      setIsAuthenticated(true);
    } catch (err: any) {
      setGoogleAuthError(err.message);
    }
  };

  const handleDevBypass = async () => {
    try {
      setGoogleAuthError(null);
      const res = await fetch('/api/auth/dev-bypass', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Dev bypass failed');
      
      setAuthToken(data.token);
      const keys = await getOrCreateOfficerKeys();
      await apiFetch('/api/auth/keys/upload', {
        method: 'POST',
        body: JSON.stringify({ publicKeyJwk: keys.publicKey })
      });

      setIsGoogleAuthenticated(true);
      setIsAuthenticated(true);
    } catch (err: any) {
      setGoogleAuthError(err.message);
    }
  };

  const handleDecrypt = async (ticket: Ticket) => {
    setDecryptingIds(prev => ({ ...prev, [ticket._id]: true }));
    setError(null);
    try {
      await apiFetch(`/api/tickets/${ticket._id}/audit-decrypt`, { method: 'POST' });

      const keys = await getOrCreateOfficerKeys();
      const privateKeyJwk = keys.privateKey;
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
      const data = await apiFetch('/api/tickets/verify-khoya-paya', {
        method: 'POST',
        body: JSON.stringify({ ticketId })
      });
      setKhoyaPayaResults(prev => ({ ...prev, [ticketId]: data }));
    } catch (err) {
      console.error('Failed to check database', err);
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      // Don't optimistically update since server enforces state machine
      const data = await apiFetch(`/api/tickets/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      setTickets(prev => prev.map(t => t._id === id ? data.ticket : t));
      showToast(`Status updated to ${newStatus}`);
    } catch (err: any) {
      console.error(err);
      fetchTickets();
      showToast(err.message || 'Failed to update status', 'error');
    }
  };

  const handleTeamAssign = async (id: string, team: string) => {
    try {
      setTickets(prev => prev.map(t => t._id === id ? { ...t, assigned_team: team || null } : t));
      await apiFetch(`/api/tickets/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'DISPATCHED', assigned_team: team || null })
      });
      showToast(`Team assigned: ${team}`);
    } catch (err) {
      console.error(err);
      fetchTickets();
      showToast('Failed to assign team', 'error');
    }
  };

  const handlePriorityUpdate = async (id: string, priority: string) => {
    try {
      setTickets(prev => prev.map(t => t._id === id ? { ...t, priority } : t));
      await apiFetch(`/api/tickets/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ priority })
      });
      showToast(`Priority updated to ${priority}`);
    } catch (err) {
      console.error(err);
      fetchTickets();
      showToast('Failed to update priority', 'error');
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

  // Calculate stats
  const stats = {
    total: tickets.length,
    underReview: tickets.filter(t => t.status === 'VERIFIED').length,
    dispatched: tickets.filter(t => t.status === 'DISPATCHED').length,
    closed: tickets.filter(t => ['CLOSED', 'REJECTED', 'DUPLICATE'].includes(t.status)).length,
  };

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

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/60 backdrop-blur-md p-4 rounded-xl border border-[var(--line)] shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-[#4285F4]" />
              <h3 className="font-mono text-[10px] font-bold text-[#4285F4] uppercase tracking-widest">Total Cases</h3>
            </div>
            <p className="text-3xl font-display font-bold text-[var(--ink)]">{stats.total}</p>
          </div>
          <div className="bg-white/60 backdrop-blur-md p-4 rounded-xl border border-[var(--line)] shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-[var(--saffron)]" />
              <h3 className="font-mono text-[10px] font-bold text-[var(--saffron)] uppercase tracking-widest">Under Review</h3>
            </div>
            <p className="text-3xl font-display font-bold text-[var(--ink)]">{stats.underReview}</p>
          </div>
          <div className="bg-[var(--teal)]/10 backdrop-blur-md p-4 rounded-xl border border-[var(--teal)]/30 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-[var(--teal)]" />
              <h3 className="font-mono text-[10px] font-bold text-[var(--teal)] uppercase tracking-widest">Dispatched</h3>
            </div>
            <p className="text-3xl font-display font-bold text-[var(--teal)]">{stats.dispatched}</p>
          </div>
          <div className="bg-[var(--paper-2)] backdrop-blur-md p-4 rounded-xl border border-[var(--line-strong)] shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-[var(--ink-soft)]" />
              <h3 className="font-mono text-[10px] font-bold text-[var(--ink-soft)] uppercase tracking-widest">Closed</h3>
            </div>
            <p className="text-3xl font-display font-bold text-[var(--ink)]">{stats.closed}</p>
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
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-5 py-3 font-semibold text-[14px] flex items-center gap-2 border-b-[2px] transition-colors ${activeTab === 'audit' ? 'border-[var(--teal)] text-[var(--ink)]' : 'border-transparent text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--line)]'}`}
          >
            <History className="w-4 h-4" /> Audit Trail
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
                            onChange={(e) => {
                              const newStatus = e.target.value;
                              if (newStatus === 'CLOSED') {
                                if (window.confirm('Are you sure you want to close this case? Ensure all CWC proceedings are complete.')) {
                                  handleStatusUpdate(ticket._id, newStatus);
                                }
                              } else {
                                handleStatusUpdate(ticket._id, newStatus);
                              }
                            }}
                            className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-[2px] border-[1.5px] outline-none cursor-pointer appearance-none ${
                              ['CLOSED', 'REJECTED', 'DUPLICATE'].includes(ticket.status) ? 'bg-[var(--paper-2)] text-[var(--ink-soft)] border-[var(--line-strong)]' 
                              : ticket.status === 'REPORTED' || ticket.isEmergency ? 'bg-[rgba(162,59,46,0.1)] text-[var(--stamp)] border-[rgba(162,59,46,0.5)]' 
                              : 'bg-[var(--teal-light)] text-white border-[var(--teal)]'
                            }`}
                          >
                            <option value="REPORTED">Reported</option>
                            <option value="VERIFIED">Verified</option>
                            <option value="DISPATCHED">Dispatched</option>
                            <option value="RESCUED">Rescued</option>
                            <option value="CWC_PRODUCED">CWC Produced</option>
                            <option value="REHAB_FOLLOWUP">Rehab Followup</option>
                            <option value="CLOSED">Closed</option>
                            <option value="REJECTED">Rejected</option>
                            <option value="DUPLICATE">Duplicate</option>
                          </select>
                          {ticket.isEmergency && <span className="px-2 py-1 bg-[var(--stamp)] text-white text-[10px] font-bold uppercase tracking-wider rounded-[2px] flex items-center gap-1 border-[1.5px] border-[var(--ink)]"><AlertCircle className="w-3 h-3"/> Emergency</span>}
                          <select
                            value={ticket.priority || 'Medium'}
                            onChange={(e) => handlePriorityUpdate(ticket._id, e.target.value)}
                            className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-[2px] border-[1.5px] outline-none cursor-pointer appearance-none ${
                              ticket.priority === 'Critical' ? 'bg-[rgba(162,59,46,0.15)] text-[var(--stamp)] border-[rgba(162,59,46,0.5)]'
                              : ticket.priority === 'High' ? 'bg-[rgba(201,116,56,0.15)] text-[var(--saffron)] border-[var(--saffron)]'
                              : ticket.priority === 'Low' ? 'bg-[var(--paper-2)] text-[var(--ink-soft)] border-[var(--line-strong)]'
                              : 'bg-[var(--teal)]/10 text-[var(--teal)] border-[var(--teal)]/30'
                            }`}
                          >
                            <option value="Critical">Critical</option>
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                          </select>
                        </div>
                        <span className="text-[12px] text-[var(--ink-soft)] font-mono font-semibold bg-[var(--paper-2)] border border-[var(--line-strong)] px-2 py-0.5 rounded-[2px]">ID: {ticket.trackingId || ticket._id.slice(-6)}</span>
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
                                  const data = await apiFetch(`/api/tickets/${ticket._id}/notes`, {
                                    method: 'POST',
                                    body: JSON.stringify({ text: noteInputs[ticket._id] })
                                  });
                                  setTickets(prev => prev.map(t => t._id === ticket._id ? { ...t, notes: data.notes } : t));
                                  setNoteInputs(prev => ({ ...prev, [ticket._id]: '' }));
                                  showToast('Note added securely');
                                } catch (err) { 
                                  console.error(err);
                                  showToast('Failed to add note', 'error');
                                }
                              }
                            }}
                          />
                          <button
                            onClick={async () => {
                              if (!noteInputs[ticket._id]?.trim()) return;
                              try {
                                const data = await apiFetch(`/api/tickets/${ticket._id}/notes`, {
                                  method: 'POST',
                                  body: JSON.stringify({ text: noteInputs[ticket._id] })
                                });
                                setTickets(prev => prev.map(t => t._id === ticket._id ? { ...t, notes: data.notes } : t));
                                setNoteInputs(prev => ({ ...prev, [ticket._id]: '' }));
                                showToast('Note added securely');
                              } catch (err) { 
                                console.error(err);
                                showToast('Failed to add note', 'error');
                              }
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

            {/* Audit Trail View */}
            {activeTab === 'audit' && (
              <div className="bg-white/30 backdrop-blur border border-[var(--line-strong)] rounded-[3px] overflow-hidden">
                <div className="bg-[var(--paper-2)] px-4 py-3 border-b border-[var(--line-strong)] flex items-center gap-2">
                  <History className="w-4 h-4 text-[var(--ink)]" />
                  <h3 className="font-display font-bold text-[var(--ink)]">System Audit Log</h3>
                  <button 
                    onClick={async () => {
                      try {
                        const data = await apiFetch('/api/tickets/audit/verify');
                        if (data.isIntact) showToast(`Ledger Intact! ${data.count} records verified.`);
                        else showToast('WARNING: Ledger Integrity Compromised!', 'error');
                      } catch (err) {
                        showToast('Verification failed', 'error');
                      }
                    }}
                    className="ml-auto px-3 py-1 bg-[var(--teal)]/10 text-[var(--teal)] border border-[var(--teal)]/30 rounded text-[11px] font-bold uppercase hover:bg-[var(--teal)] hover:text-white transition"
                  >
                    Verify Ledger Integrity
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[var(--paper)] text-[10px] font-mono text-[var(--teal)] uppercase tracking-wider border-b border-[var(--line-strong)]">
                        <th className="px-4 py-3 font-bold">Timestamp</th>
                        <th className="px-4 py-3 font-bold">Action</th>
                        <th className="px-4 py-3 font-bold">Officer ID</th>
                        <th className="px-4 py-3 font-bold">Ticket Ref</th>
                        <th className="px-4 py-3 font-bold">IP Address</th>
                      </tr>
                    </thead>
                    <tbody className="text-[12px] text-[var(--ink)]">
                      {auditLogs.map((log) => (
                        <tr key={log._id} className="border-b border-[var(--line)] hover:bg-white/50 transition-colors">
                          <td className="px-4 py-2 font-mono whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-0.5 rounded-[2px] font-bold text-[10px] uppercase tracking-wider ${
                              log.action === 'STATUS_UPDATE' ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : log.action === 'EVIDENCE_DECRYPTED' ? 'bg-[var(--stamp)]/10 text-[var(--stamp)] border border-[var(--stamp)]/30'
                              : log.action === 'NOTE_ADDED' ? 'bg-green-100 text-green-800 border border-green-200'
                              : 'bg-gray-100 text-gray-800 border border-gray-200'
                            }`}>
                              {log.action.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-2 font-semibold">{log.officerId}</td>
                          <td className="px-4 py-2 font-mono text-[10px]">{log.ticketId?.slice(-6) || 'N/A'}</td>
                          <td className="px-4 py-2 font-mono text-[var(--ink-soft)]">{log.details?.ip || 'N/A'}</td>
                        </tr>
                      ))}
                      {auditLogs.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-[var(--ink-soft)] italic">No audit logs found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      {/* Global Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg border backdrop-blur-md flex items-center gap-2 z-50 animate-fade-in ${
          toast.type === 'error' ? 'bg-red-50 text-red-800 border-red-200' : 'bg-[var(--teal)] text-white border-[var(--teal)]/80'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          <span className="text-[13px] font-semibold">{toast.message}</span>
        </div>
      )}
    </div>
  );
};
