import React, { useState, useEffect } from 'react';
import { Shield, Key, Eye, Lock, MapPin, AlertCircle } from 'lucide-react';
import type { EncryptedPayload } from '../../utils/crypto';
import { decryptImagePayload } from '../../utils/crypto';
import { demoPrivateKey } from '../../utils/demoKeys';

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
}

export const AuthorityDashboard: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [privateKeyInput, setPrivateKeyInput] = useState(JSON.stringify(demoPrivateKey, null, 2));
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [decryptedImages, setDecryptedImages] = useState<Record<string, string>>({});
  const [decryptingIds, setDecryptingIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isAuthenticated) {
      fetchTickets();
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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Basic validation that it is valid JSON
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
      const privateKeyJwk = JSON.parse(privateKeyInput);
      const blobUrl = await decryptImagePayload(ticket.encryptedPayload, privateKeyJwk);
      setDecryptedImages(prev => ({ ...prev, [ticket._id]: blobUrl }));
    } catch (err: any) {
      setError(`Decryption failed for ticket ${ticket._id}: Invalid Key or Corrupted Data.`);
    } finally {
      setDecryptingIds(prev => ({ ...prev, [ticket._id]: false }));
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

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg w-full text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="w-full flex flex-col gap-4">
          <textarea
            value={privateKeyInput}
            onChange={(e) => setPrivateKeyInput(e.target.value)}
            className="w-full h-48 p-4 font-mono text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Paste JWK Private Key JSON here..."
            required
          />
          <button
            type="submit"
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Key className="w-5 h-5" />
            Authenticate & Access Dashboard
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white min-h-[800px] rounded-2xl shadow-xl border border-gray-100 mt-10">
      <div className="flex justify-between items-center mb-8 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-600" />
            Authority Triage Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-1">End-to-End Encrypted Data Access</p>
        </div>
        <button 
          onClick={fetchTickets}
          className="text-blue-600 font-medium hover:underline text-sm"
        >
          Refresh Feed
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-gray-500">Loading secure tickets...</div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-20 text-gray-500">No active incidents found in your jurisdiction.</div>
      ) : (
        <div className="grid gap-6">
          {tickets.map(ticket => (
            <div key={ticket._id} className="border border-gray-200 rounded-xl p-5 flex flex-col md:flex-row gap-6 hover:shadow-md transition-shadow bg-gray-50">
              
              {/* Secure Image Vault */}
              <div className="w-full md:w-48 h-48 bg-gray-900 rounded-lg overflow-hidden flex flex-col items-center justify-center relative shrink-0">
                {decryptedImages[ticket._id] ? (
                  <img src={decryptedImages[ticket._id]} alt="Decrypted Evidence" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <Lock className="w-8 h-8 text-gray-500 mb-2" />
                    <p className="text-xs text-gray-400 font-medium text-center px-4">Encrypted AES-GCM Payload</p>
                    <button
                      onClick={() => handleDecrypt(ticket)}
                      disabled={decryptingIds[ticket._id]}
                      className="absolute bottom-4 px-4 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700 transition flex items-center gap-1 disabled:opacity-50"
                    >
                      {decryptingIds[ticket._id] ? 'Decrypting...' : <><Eye className="w-3 h-3" /> View Evidence</>}
                    </button>
                  </>
                )}
              </div>

              {/* Metadata */}
              <div className="flex-1 flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                    ticket.status === 'Low-Confidence / Manual Review Required' ? 'bg-orange-100 text-orange-700' :
                    ticket.status === 'High Priority' ? 'bg-red-100 text-red-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {ticket.status}
                  </span>
                  <span className="text-xs text-gray-500 font-mono">ID: {ticket._id.slice(-6)}</span>
                </div>
                
                <h3 className="text-lg font-bold text-gray-800 mt-1">{ticket.user_category}</h3>
                
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">AI Confidence</p>
                    <p className="text-sm font-medium">{ticket.confidence_score}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Multiple Reports</p>
                    <p className="text-sm font-medium">{ticket.reportCount} nearby matching case(s)</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">District</p>
                    <p className="text-sm font-medium">{ticket.district_id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">GPS Coordinates</p>
                    <p className="text-sm font-medium flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-blue-500" />
                      {ticket.location.coordinates[1].toFixed(4)}, {ticket.location.coordinates[0].toFixed(4)}
                    </p>
                  </div>
                </div>

                <div className="mt-auto pt-4 flex gap-2">
                  <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded transition">
                    Dispatch Team
                  </button>
                  <button className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-semibold rounded transition">
                    Dismiss (False Positive)
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
