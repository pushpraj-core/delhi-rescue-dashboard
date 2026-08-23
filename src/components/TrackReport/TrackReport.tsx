import React, { useState } from 'react';
import { Search, Loader2, AlertCircle, ShieldCheck, MapPin, Calendar, Clock, Info, Users } from 'lucide-react';

export const TrackReport: React.FC = () => {
  const [trackingId, setTrackingId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticketData, setTicketData] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  React.useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('raksha_recent_reports') || '[]');
      setHistory(saved);
    } catch(e) {}
  }, []);

  const handleSearch = async (e: React.FormEvent, overrideId?: string) => {
    e?.preventDefault();
    const targetId = overrideId || trackingId;
    
    if (!targetId || targetId.length < 5) {
      setError('Please enter a valid Tracking ID.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setTicketData(null);
    setTrackingId(targetId);

    // Normalize for local offline tracking prefix
    if (targetId.toUpperCase().startsWith('OFFLINE-')) {
      setError('This report was saved offline. Please connect to the internet and open the app to sync it before tracking.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/tickets/track/${targetId.trim().toUpperCase()}`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Report not found.');
      }

      const data = await response.json();
      setTicketData(data.ticket);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'New Reports':
      case 'Under Review':
        return 'text-orange-600 bg-orange-100 border-orange-200';
      case 'Field Team Dispatched':
        return 'text-blue-600 bg-blue-100 border-blue-200';
      case 'Case Closed (CWC)':
        return 'text-gray-600 bg-gray-100 border-gray-200';
      default:
        return 'text-teal-600 bg-teal-100 border-teal-200';
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12 p-6 bg-white min-h-[400px] flex flex-col rounded-2xl shadow-xl border border-gray-100">
      
      {/* Search Header */}
      <div className="flex flex-col items-center mb-8 text-center">
        <div className="w-12 h-12 bg-teal-50 rounded-full flex items-center justify-center mb-4">
          <Search className="w-6 h-6 text-teal-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">Track Report Status</h2>
        <p className="text-sm text-gray-500 mt-2">Enter your anonymous 6-digit Tracking ID to check the current status of your report securely.</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          type="text"
          value={trackingId}
          onChange={(e) => setTrackingId(e.target.value)}
          placeholder="e.g. A7B2X9"
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono uppercase tracking-widest text-lg"
          maxLength={15}
        />
        <button
          type="submit"
          disabled={isLoading || !trackingId}
          className="px-6 py-3 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors flex items-center justify-center"
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Search'}
        </button>
      </form>

      {history.length > 0 && !ticketData && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Your Recent Reports</p>
          <div className="flex flex-col gap-2">
            {history.map((item, idx) => (
              <button
                key={idx}
                onClick={(e) => handleSearch(e, item.id)}
                className="flex justify-between items-center p-3 rounded-lg border border-gray-200 hover:border-teal-300 hover:bg-teal-50 transition text-left"
              >
                <div>
                  <div className="font-mono font-bold text-gray-800">{item.id}</div>
                  <div className="text-xs text-gray-500 mt-1">{new Date(item.date).toLocaleDateString()} • {item.category}</div>
                </div>
                {item.isOffline && <span className="text-xs font-semibold text-orange-600 bg-orange-100 px-2 py-0.5 rounded">Offline</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {ticketData && (
        <div className="border border-gray-200 rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
            <span className="font-mono font-bold text-gray-800">ID: {ticketData.trackingId}</span>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${getStatusColor(ticketData.status)}`}>
              {ticketData.status}
            </span>
          </div>
          <div className="p-4 flex flex-col gap-4">
            {ticketData.isEmergency && (
              <div className="flex items-center gap-2 text-sm text-red-600 font-semibold bg-red-50 p-2 rounded border border-red-100">
                <AlertCircle className="w-4 h-4" /> Flagged as Immediate Danger
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-gray-500 flex items-center gap-1 mb-1"><Calendar className="w-3 h-3" /> Date</span>
                <span className="text-sm font-medium text-gray-800">{new Date(ticketData.createdAt).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 flex items-center gap-1 mb-1"><Clock className="w-3 h-3" /> Time</span>
                <span className="text-sm font-medium text-gray-800">{new Date(ticketData.createdAt).toLocaleTimeString()}</span>
              </div>
            </div>

            <div>
              <span className="text-xs text-gray-500 flex items-center gap-1 mb-1"><MapPin className="w-3 h-3" /> Assignee</span>
              <span className="text-sm font-medium text-gray-800">DCPU {ticketData.district_id !== 'UNASSIGNED' ? ticketData.district_id : 'Processing Unit'}</span>
            </div>

            {ticketData.assigned_team && (
              <div className="flex items-center gap-2 p-2.5 bg-teal-50 border border-teal-200 rounded-lg">
                <Users className="w-4 h-4 text-teal-600" />
                <div>
                  <span className="text-xs text-teal-700 font-semibold block">Team Dispatched</span>
                  <span className="text-sm font-medium text-teal-800">{ticketData.assigned_team}</span>
                </div>
              </div>
            )}

            <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded-lg flex gap-2">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800">
                To protect privacy, no images or exact coordinates are displayed here. Authorities handle the case securely behind closed doors.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
