import React, { useState } from 'react';
import { CitizenCapture } from './components/CitizenCapture/CitizenCapture';
import { AuthorityDashboard } from './components/Dashboard/AuthorityDashboard';

function App() {
  const [view, setView] = useState<'citizen' | 'authority'>('citizen');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
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
