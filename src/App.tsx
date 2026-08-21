import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { CitizenCapture } from './components/CitizenCapture/CitizenCapture';
import { AuthorityDashboard } from './components/Dashboard/AuthorityDashboard';
import { Landing } from './components/Landing/Landing';
import { TrackReport } from './components/TrackReport/TrackReport';
import { WifiOff, RefreshCw, ArrowLeft, ShieldCheck, Map } from 'lucide-react';
import { syncOfflineReports } from './utils/db';

const Header = () => {
  const location = useLocation();
  const isLanding = location.pathname === '/';

  if (isLanding) return null;

  return (
    <header className="bg-white border-b px-6 py-4 flex justify-between items-center shadow-sm">
      <div className="flex items-center gap-4">
        <Link to="/" className="text-gray-500 hover:text-gray-800 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium hidden sm:inline">Home</span>
        </Link>
        <h1 className="text-xl font-bold text-gray-800 tracking-tight">
          Raksha <span className="text-teal-600">PWA</span>
        </h1>
      </div>
      <div className="flex gap-2">
        <Link
          to="/report"
          className={`px-3 py-1.5 text-sm font-semibold rounded-md transition ${location.pathname === '/report' ? 'bg-teal-50 text-teal-700' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          Report
        </Link>
        <Link
          to="/track"
          className={`px-3 py-1.5 text-sm font-semibold rounded-md transition ${location.pathname === '/track' ? 'bg-teal-50 text-teal-700' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          Track
        </Link>
        <Link
          to="/authority"
          className={`px-3 py-1.5 text-sm font-semibold rounded-md transition ${location.pathname === '/authority' ? 'bg-teal-50 text-teal-700' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          Authority
        </Link>
      </div>
    </header>
  );
};

function App() {
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
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* PWA Offline / Syncing Banner */}
        {isOffline && (
          <div className="bg-orange-500 text-white text-xs font-semibold py-1.5 flex justify-center items-center gap-2">
            <WifiOff className="w-4 h-4" /> You are offline. Encrypted reports will be saved securely to this device.
          </div>
        )}
        {isSyncing && !isOffline && (
          <div className="bg-teal-600 text-white text-xs font-semibold py-1.5 flex justify-center items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" /> Syncing pending reports to Authority...
          </div>
        )}

        <Header />
        
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/report" element={<CitizenCapture />} />
            <Route path="/track" element={<TrackReport />} />
            <Route path="/authority" element={<AuthorityDashboard />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
