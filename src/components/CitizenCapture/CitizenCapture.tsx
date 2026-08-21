import React, { useEffect, useRef, useState } from 'react';
import { useSecureCamera } from './useSecureCamera';
import { useLocationSecure } from './useLocationSecure';
import { initModel, captureSecurely } from './inference';
import { encryptImagePayload } from '../../utils/crypto';
import { demoPublicKey } from '../../utils/demoKeys';
import { useNavigate, Link } from 'react-router-dom';

const QUICK_TAGS = [
  'Traffic Intersection',
  'Construction Site',
  'Railway Station',
  'Bus Stand',
  'Market Area'
];

export const CitizenCapture: React.FC = () => {
  const { startCamera, stopCamera, videoRef, error: camError } = useSecureCamera();
  const { getSecureLocation } = useLocationSecure();
  const navigate = useNavigate();
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [modelReady, setModelReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [captureBlob, setCaptureBlob] = useState<Blob | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null);
  
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isEmergency, setIsEmergency] = useState(false);

  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [isOfflineSave, setIsOfflineSave] = useState(false);

  // 1: Capture, 2: Details/Confirm, 3: Success
  const [step, setStep] = useState<1 | 2 | 3>(1); 

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        await initModel();
        if (mounted) setModelReady(true);
        await startCamera();
      } catch (err: any) {
        if (mounted) setError(err.message || 'Initialization failed.');
      }
    };
    init();
    return () => { mounted = false; stopCamera(); };
  }, [startCamera, stopCamera]);

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current || !modelReady) return;
    setIsCapturing(true); setError(null);
    try {
      const loc = await getSecureLocation();
      setLocation(loc);
      const { blob, scene_confidence_score } = await captureSecurely(videoRef.current, canvasRef.current);
      setCaptureBlob(blob);
      setConfidenceScore(scene_confidence_score);
      stopCamera();
      setStep(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleRetake = async () => {
    setCaptureBlob(null); setLocation(null); setConfidenceScore(null); setError(null);
    setSelectedCategory(''); setSelectedTags([]); setIsEmergency(false);
    setStep(1);
    await startCamera();
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleSubmit = async () => {
    if (!location || !captureBlob || !selectedCategory || !confidenceScore) return;
    setIsSubmitting(true); setError(null);

    try {
      const encryptedPayload = await encryptImagePayload(captureBlob, demoPublicKey);
      const payload = {
        longitude: location.longitude, latitude: location.latitude,
        encryptedPayload, confidence_score: confidenceScore,
        user_category: selectedCategory, tags: selectedTags, isEmergency
      };

      try {
        if (!navigator.onLine) throw new Error('Offline');
        const response = await fetch('/api/tickets', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error('Server rejected submission');
        const data = await response.json();
        const id = data.ticket.trackingId;
        setTrackingId(id); setIsOfflineSave(false);
        saveHistory(id, false);
      } catch (networkError) {
        const { saveOfflineReport } = await import('../../utils/db');
        const offlineId = await saveOfflineReport(payload);
        const id = `OFFLINE-${offlineId.split('_')[2].toUpperCase()}`;
        setTrackingId(id); setIsOfflineSave(true);
        saveHistory(id, true);
      }
      setStep(3);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveHistory = (id: string, offline: boolean) => {
    const history = JSON.parse(localStorage.getItem('raksha_recent_reports') || '[]');
    history.unshift({ id, date: new Date().toISOString(), category: selectedCategory, isOffline: offline });
    localStorage.setItem('raksha_recent_reports', JSON.stringify(history.slice(0, 10)));
  };

  return (
    <div className="bg-dotted-paper min-h-[calc(100vh)] text-[var(--ink)] font-body pb-16">
      <nav className="sticky top-0 z-50 bg-[var(--paper)] border-b-[1.5px] border-[var(--ink)]">
        <div className="max-w-[1160px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-1.5 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[15px] h-[15px]"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Home
          </Link>
          <div className="font-display text-[19px] font-bold flex items-center gap-2.5 tracking-tight">
            <span className="w-[22px] h-[22px] border-[1.5px] border-[var(--ink)] rounded-full flex items-center justify-center relative">
              <span className="block w-[7px] h-[7px] bg-[var(--saffron)] rounded-full"></span>
            </span>
            Raksha
          </div>
          <div className="hidden sm:flex gap-7 items-center">
            <Link to="/report" className="text-sm font-medium text-[var(--ink)] border-b-2 border-[var(--saffron)] pb-[3px]">Report</Link>
            <Link to="/track" className="text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">Track a report</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-[640px] mx-auto px-6 pt-12">
        <div className="mb-6">
          <div className="font-mono text-[11.5px] tracking-[0.08em] uppercase text-[var(--teal)] flex items-center gap-2 mb-3">
            <span className="w-1.5 h-1.5 bg-[var(--saffron)] rotate-45 block"></span>
            Step {step} of 3 · {step === 1 ? 'Capture' : step === 2 ? 'Details & Confirm' : 'Sent'}
          </div>
          <h1 className="font-display font-semibold text-[clamp(24px,3vw,30px)] tracking-tight mb-2">
            {step === 3 ? 'Report submitted securely' : 'Report a child in need'}
          </h1>
          <p className="text-[14.5px] text-[var(--ink-soft)] max-w-[480px]">
            {step === 3 
              ? 'Your identity remains private. The District Child Protection Unit has received the encrypted file.' 
              : 'Photograph the situation. Faces are blurred on your device before anything is saved or sent — the original image never leaves your phone.'}
          </p>
        </div>

        {/* Hidden Canvas */}
        <canvas ref={canvasRef} className="hidden" />

        {error || camError ? (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-sm mb-6 text-sm font-medium shadow-sm">
            {error || camError}
            <button onClick={handleRetake} className="ml-4 underline">Try Again</button>
          </div>
        ) : null}

        <div className="bg-white/60 backdrop-blur-md rounded-xl p-5 shadow-sm border border-[var(--line)]">
          <div className="flex items-center gap-2 border border-[var(--teal)]/20 rounded-xl py-2 px-3 mb-4 bg-[var(--teal)]/5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[15px] h-[15px] text-[var(--teal)] shrink-0"><path d="M12 2l8 3.5v6c0 5-3.4 8.9-8 10.5-4.6-1.6-8-5.5-8-10.5v-6L12 2z"/><path d="M9 12l2 2 4-4"/></svg>
            <span className="font-mono text-[11.5px] text-[var(--teal)] font-semibold tracking-[0.01em]">ON-DEVICE SECURE CAPTURE ACTIVE</span>
          </div>

          {step === 1 && (
            <div className="aspect-[3/4] rounded-xl overflow-hidden relative border border-[var(--line)] bg-[#0d1420] bg-camera-grid">
              <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover z-0" />
              
              {!modelReady && !camError && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0d1420]/80 text-white font-mono text-xs">
                  <div className="w-6 h-6 border-2 border-white/20 border-t-[var(--saffron)] rounded-full animate-spin mb-3"></div>
                  LOADING NEURAL ENGINE
                </div>
              )}

              <div className="absolute top-4 left-1/2 -translate-x-1/2 font-mono text-[10.5px] text-[rgba(239,238,230,0.65)] tracking-[0.04em] z-10 text-center">
                CENTER SITUATION IN FRAME
              </div>

              {/* Corners */}
              <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-[var(--saffron)] z-10"></div>
              <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-[var(--saffron)] z-10"></div>
              <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-[var(--saffron)] z-10"></div>
              <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-[var(--saffron)] z-10"></div>

              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
                <button 
                  onClick={handleCapture}
                  disabled={!modelReady || isCapturing}
                  className="w-[60px] h-[60px] rounded-full bg-white/90 backdrop-blur border border-[var(--line)] shadow-sm flex items-center justify-center cursor-pointer hover:bg-white transition-colors disabled:opacity-50"
                >
                  {isCapturing 
                    ? <div className="w-5 h-5 border-2 border-[var(--ink)] border-t-transparent rounded-full animate-spin"></div>
                    : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6 text-[var(--ink)]"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  }
                </button>
              </div>
            </div>
          )}

          {step === 2 && captureBlob && (
            <div className="animate-in fade-in duration-300">
              <div className="aspect-[3/4] rounded-xl overflow-hidden relative border border-[var(--line)] max-h-[350px]">
                <img src={URL.createObjectURL(captureBlob)} alt="Secure Capture" className="w-full h-full object-cover" />
                <div className={`absolute top-3 right-3 px-2 py-0.5 rounded-md font-mono text-[10px] font-bold shadow-sm ${confidenceScore && confidenceScore < 60 ? 'bg-[var(--stamp)] text-white' : 'bg-[var(--teal)] text-white'}`}>
                  AI SCORE: {confidenceScore}%
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-5">
                <div>
                  <h3 className="font-semibold text-[13px] mb-2">Category *</h3>
                  <div className="flex flex-col gap-2">
                    {['Traffic Intersection Begging', 'Hazardous Labor', 'Unattended Child'].map(cat => (
                      <label 
                        key={cat} 
                        onClick={() => setSelectedCategory(cat)}
                        className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${selectedCategory === cat ? 'border-[var(--teal)] bg-[var(--teal)]/5' : 'border-[var(--line)] bg-white/50 hover:bg-white/80'}`}
                      >
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedCategory === cat ? 'border-[var(--teal)] bg-[var(--teal)]' : 'border-[var(--line-strong)] bg-transparent'}`}>
                           {selectedCategory === cat && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                        </div>
                        <span className="text-[13px] font-medium">{cat}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-[13px] mb-2">Quick Tags (Optional)</h3>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_TAGS.map(tag => (
                      <button
                        key={tag} onClick={() => toggleTag(tag)}
                        className={`px-3 py-1 text-[12px] font-medium rounded-lg border transition-colors ${
                          selectedTags.includes(tag) ? 'border-[var(--teal)] bg-[var(--teal)] text-white' : 'border-[var(--line)] bg-white/50 text-[var(--ink-soft)] hover:border-[var(--teal)]'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-3 p-3 bg-[rgba(162,59,46,0.06)] border border-[rgba(162,59,46,0.2)] rounded-xl cursor-pointer mt-2 backdrop-blur">
                  <input type="checkbox" className="w-4 h-4 accent-[var(--stamp)]" checked={isEmergency} onChange={(e) => setIsEmergency(e.target.checked)} />
                  <span className="text-[13px] font-bold text-[var(--stamp)]">Flag as Immediate Physical Danger</span>
                </label>

                <div className="flex gap-3 mt-2">
                  <button onClick={handleRetake} disabled={isSubmitting} className="flex-1 py-3 text-[13px] font-semibold border border-[var(--line)] bg-white/50 rounded-xl hover:bg-white transition-colors">
                    RETAKE
                  </button>
                  <button onClick={handleSubmit} disabled={!selectedCategory || isSubmitting} className="flex-[2] py-3 text-[13px] font-semibold bg-[var(--ink)] text-white rounded-xl shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2">
                    {isSubmitting ? <span className="w-4 h-4 border-2 border-[var(--paper)] border-t-transparent rounded-full animate-spin"></span> : 'ENCRYPT & SEND'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 3 && trackingId && (
            <div className="py-8 flex flex-col items-center text-center animate-in fade-in duration-300">
              <div className="w-16 h-16 rounded-full bg-[var(--teal-light)] text-white flex items-center justify-center mb-5 shadow-sm">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-8 h-8"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
              
              <p className="font-mono text-[12px] font-bold tracking-widest text-[var(--ink-soft)] mb-2 uppercase">Your Anonymous Tracking ID</p>
              <div className="text-[32px] font-mono font-bold tracking-widest bg-white/80 border border-[var(--line)] px-6 py-3 rounded-xl shadow-sm mb-8">
                {trackingId}
              </div>
              
              {isOfflineSave && (
                <div className="mb-6 p-3 bg-[rgba(201,116,56,0.1)] border border-[var(--saffron)] text-[13px] text-[var(--ink)] rounded-[2px]">
                  <b>Offline Mode:</b> This report is securely queued and will automatically sync when you regain connection.
                </div>
              )}
              
              <div className="flex gap-3 w-full max-w-[300px]">
                <Link to="/track" className="flex-1 py-3 text-[13px] font-semibold border border-[var(--line)] rounded-xl bg-white/50 hover:bg-white transition-colors text-center">
                  TRACK
                </Link>
                <button onClick={handleRetake} className="flex-1 py-3 text-[13px] font-semibold bg-[var(--ink)] text-white rounded-xl shadow-sm hover:shadow-md transition-colors">
                  NEW REPORT
                </button>
              </div>
            </div>
          )}

          <div className="flex mt-6 pt-4 border-t border-[var(--line)]">
            <div className="flex-1 text-center relative">
              <div className={`w-5 h-5 mx-auto mb-1.5 rounded-full font-mono text-[10.5px] flex items-center justify-center relative z-10 ${step >= 1 ? 'bg-[var(--ink)] text-[var(--paper)]' : 'bg-transparent border border-[var(--line)] text-[var(--ink-soft)]'}`}>1</div>
              <p className="text-[11px] text-[var(--ink-soft)]">Capture</p>
              <div className="absolute top-[9px] left-[60%] w-[80%] h-px bg-[var(--line)]"></div>
            </div>
            <div className="flex-1 text-center relative">
              <div className={`w-5 h-5 mx-auto mb-1.5 rounded-full font-mono text-[10.5px] flex items-center justify-center relative z-10 ${step >= 2 ? 'bg-[var(--ink)] text-[var(--paper)]' : 'bg-transparent border border-[var(--line)] text-[var(--ink-soft)]'}`}>2</div>
              <p className="text-[11px] text-[var(--ink-soft)]">Details</p>
              <div className="absolute top-[9px] left-[60%] w-[80%] h-px bg-[var(--line)]"></div>
            </div>
            <div className="flex-1 text-center relative">
              <div className={`w-5 h-5 mx-auto mb-1.5 rounded-full font-mono text-[10.5px] flex items-center justify-center relative z-10 ${step >= 3 ? 'bg-[var(--ink)] text-[var(--paper)]' : 'bg-transparent border border-[var(--line)] text-[var(--ink-soft)]'}`}>3</div>
              <p className="text-[11px] text-[var(--ink-soft)]">Send</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 items-start mt-6 p-4 bg-white/40 backdrop-blur border border-[var(--line)] border-l-[3px] border-l-[var(--teal)] rounded-xl">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-[var(--teal)] shrink-0 mt-0.5"><path d="M12 2l8 3.5v6c0 5-3.4 8.9-8 10.5-4.6-1.6-8-5.5-8-10.5v-6L12 2z"/></svg>
          <p className="text-[13px] text-[var(--ink-soft)] leading-relaxed">
            <b className="text-[var(--ink)]">Your identity stays private.</b> Reports are encrypted and reviewed only by verified child protection officers in your district. You won't be asked to give your name.
          </p>
        </div>

        <div className="mt-4 p-4 bg-[rgba(162,59,46,0.05)] border border-[rgba(162,59,46,0.2)] rounded-xl text-[12.5px] text-[var(--stamp)] leading-relaxed backdrop-blur">
          <b>In immediate danger?</b> Contact Childline at 1098 or the police at 100 before filing a report.
        </div>
      </main>
    </div>
  );
};
