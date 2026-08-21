import React, { useState, useEffect } from 'react';
import { CitizenCapture } from './components/CitizenCapture/CitizenCapture';
import { AuthorityDashboard } from './components/Dashboard/AuthorityDashboard';
import { WifiOff, RefreshCw } from 'lucide-react';
import { syncOfflineReports } from './utils/db';

function App() {
  const [view, setView] = useState<'citizen' | 'authority'>('citizen');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOffline(false);
      setIsSyncing(true);
      try {
        const result = await syncOfflineReports();
        if (result.total > 0) {
          console.log(`Synced ${result.successful}/${result.total} reports.`);
        }
      } catch (err) {
        console.error('Failed to sync offline reports:', err);
      } finally {
        setIsSyncing(false);
      }
    };

    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check on mount just in case we started online with pending syncs
    if (navigator.onLine) {
      handleOnline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* PWA Offline / Syncing Banner */}
      {isOffline && (
        <div className="bg-orange-500 text-white text-xs font-semibold py-1.5 flex justify-center items-center gap-2">
          <WifiOff className="w-4 h-4" /> You are offline. Encrypted reports will be saved securely to this device.
        </div>
      )}
      {isSyncing && !isOffline && (
        <div className="bg-blue-600 text-white text-xs font-semibold py-1.5 flex justify-center items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" /> Syncing pending reports to Authority...
        </div>
      )}

      <header className="bg-white border-b px-6 py-4 flex justify-between items-center shadow-sm">
        <h1 className="text-xl font-bold text-gray-800 tracking-tight">
          Delhi Rescue <span className="text-blue-600">PWA</span>
        </h1>
        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setView('citizen')}
            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition ${view === 'citizen' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Citizen
          </button>
          <button
            onClick={() => setView('authority')}
            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition ${view === 'authority' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Authority
          </button>
        </div>
      </header>
      
      <main className="flex-1">
        {view === 'citizen' ? <CitizenCapture /> : <AuthorityDashboard />}
      </main>
    </div>
  );
}

export default App;
