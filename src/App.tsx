import React from 'react'
import { CitizenCapture } from './components/CitizenCapture/CitizenCapture'

function App() {
  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 flex flex-col items-center justify-center">
      <div className="max-w-2xl w-full space-y-6">
        <header className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Citizen Dashboard</h1>
          <p className="text-gray-500 mt-2">Delhi Secure Reporting Portal</p>
        </header>

        <main>
          <CitizenCapture />
        </main>
        
        <footer className="text-center text-xs text-gray-400 mt-8">
          Strict Zero-Data-Leak Policy Enforced. No images are stored on device.
        </footer>
      </div>
    </div>
  )
}

export default App
