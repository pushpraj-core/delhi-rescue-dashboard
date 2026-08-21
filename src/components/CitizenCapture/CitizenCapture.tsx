import React, { useEffect, useRef, useState } from 'react';
import { Camera, MapPin, AlertCircle, ShieldCheck, RefreshCw, Send, AlertTriangle, Tag, CheckSquare, Square, CheckCircle, Copy } from 'lucide-react';
import { useSecureCamera } from './useSecureCamera';
import { useLocationSecure } from './useLocationSecure';
import { initModel, captureSecurely } from './inference';
import { encryptImagePayload } from '../../utils/crypto';
import { demoPublicKey } from '../../utils/demoKeys';
import { useNavigate } from 'react-router-dom';

const QUICK_TAGS = [
  'Traffic Intersection',
  'Construction Site',
  'Railway Station',
  'Bus Stand',
  'Market Area',
  'Highway Dhaba'
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

  // Success Modal State
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [isOfflineSave, setIsOfflineSave] = useState(false);

  // Initialize TensorFlow and Camera on mount
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

    return () => {
      mounted = false;
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current || !modelReady) return;

    setIsCapturing(true);
    setError(null);
    setSelectedCategory('');
    setSelectedTags([]);
    setIsEmergency(false);

    try {
      // 1. Verify Geofence First
      const loc = await getSecureLocation();
      setLocation(loc);

      // 2. Perform zero-data-leak capture & inference
      const { blob, scene_confidence_score } = await captureSecurely(videoRef.current, canvasRef.current);
      setCaptureBlob(blob);
      setConfidenceScore(scene_confidence_score);

      // 3. Stop camera immediately to prevent background monitoring
      stopCamera();
      
    } catch (err: any) {
      setError(err.message);
      // Ensure we don't hold any partial state if there's an error
      setCaptureBlob(null);
      setLocation(null);
      setConfidenceScore(null);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleRetake = async () => {
    setCaptureBlob(null);
    setLocation(null);
    setConfidenceScore(null);
    setError(null);
    setTrackingId(null);
    setIsOfflineSave(false);
    setSelectedCategory('');
    setSelectedTags([]);
    setIsEmergency(false);
    await startCamera();
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (!location || !captureBlob || !selectedCategory || !confidenceScore) return;
    
    setIsSubmitting(true);
    setError(null);

    try {
      // Encrypt the Blob securely using Hybrid E2EE Encryption
      const encryptedPayload = await encryptImagePayload(captureBlob, demoPublicKey);

      const payload = {
        longitude: location.longitude,
        latitude: location.latitude,
        encryptedPayload, // E2EE Payload
        confidence_score: confidenceScore,
        user_category: selectedCategory,
        tags: selectedTags,
        isEmergency
      };

      try {
        if (!navigator.onLine) throw new Error('Offline');
        
        const response = await fetch('/api/tickets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error('Server rejected submission');
        }

        const data = await response.json();
        const id = data.ticket.trackingId;
        setTrackingId(id);
        setIsOfflineSave(false);
        
        // Save to local history for easy tracking
        const history = JSON.parse(localStorage.getItem('raksha_recent_reports') || '[]');
        history.unshift({
          id,
          date: new Date().toISOString(),
          category: selectedCategory,
          isOffline: false
        });
        localStorage.setItem('raksha_recent_reports', JSON.stringify(history.slice(0, 10))); // keep last 10

      } catch (networkError) {
        // Offline Fallback
        const { saveOfflineReport } = await import('../../utils/db');
        const offlineId = await saveOfflineReport(payload);
        
        // When offline, we don't have a real tracking ID yet from the backend, 
        // but we can generate a temporary one or instruct the user to sync later.
        const id = `OFFLINE-${offlineId.split('_')[2].toUpperCase()}`;
        setTrackingId(id);
        setIsOfflineSave(true);
        
        // Save offline report to history too
        const history = JSON.parse(localStorage.getItem('raksha_recent_reports') || '[]');
        history.unshift({
          id,
          date: new Date().toISOString(),
          category: selectedCategory,
          isOffline: true
        });
        localStorage.setItem('raksha_recent_reports', JSON.stringify(history.slice(0, 10)));
      }
      
      // Clear sensitive memory strictly
      setCaptureBlob(null);
      setLocation(null);
      setConfidenceScore(null);
      setSelectedCategory('');
      setSelectedTags([]);
      setIsEmergency(false);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (trackingId) {
    return (
      <div className="max-w-md mx-auto p-8 bg-white min-h-[500px] flex flex-col items-center justify-center rounded-2xl shadow-xl border border-gray-100 text-center">
        <CheckCircle className="w-16 h-16 text-teal-600 mb-6" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Report Submitted</h2>
        
        {isOfflineSave ? (
          <p className="text-orange-600 font-medium mb-6">
            You are offline. Report securely queued and will automatically sync when connection is restored.
          </p>
        ) : (
          <p className="text-gray-600 mb-6">
            Your report has been securely transmitted to the District Child Protection Unit.
          </p>
        )}

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 w-full mb-8">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Your Anonymous Tracking ID</p>
          <div className="text-4xl font-mono font-bold text-gray-900 tracking-widest flex items-center justify-center gap-3">
            {trackingId}
          </div>
          <p className="text-xs text-gray-500 mt-4">Save this ID. You can use it to track the status of this report anonymously.</p>
        </div>

        <div className="flex gap-4 w-full">
          <button
            onClick={() => navigate('/track')}
            className="flex-1 py-3 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition"
          >
            Track Status
          </button>
          <button
            onClick={handleRetake}
            className="flex-1 py-3 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 transition"
          >
            New Report
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 bg-white min-h-[500px] max-h-[85vh] flex flex-col rounded-2xl shadow-xl border border-gray-100 overflow-y-auto relative">
      <div className="flex items-center gap-2 mb-4 p-2 bg-teal-50 text-teal-800 rounded-lg shrink-0">
        <ShieldCheck className="w-5 h-5 text-teal-600" />
        <span className="font-semibold text-sm">Govt. Secure Capture active</span>
      </div>

      {(camError || error) && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <p className="text-sm font-medium">{camError || error}</p>
        </div>
      )}

      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {!captureBlob ? (
        <div className="relative rounded-xl overflow-hidden bg-black aspect-[3/4] flex items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
          {!modelReady && !camError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white z-10">
              <RefreshCw className="w-8 h-8 animate-spin mb-2" />
              <p className="text-sm font-medium">Initializing Secure Model...</p>
            </div>
          )}
          
          <button
            onClick={handleCapture}
            disabled={!modelReady || isCapturing}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full border-4 border-teal-500 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed z-20 flex items-center justify-center hover:scale-105 transition-transform"
          >
            {isCapturing ? (
              <RefreshCw className="w-6 h-6 animate-spin text-teal-600" />
            ) : (
              <Camera className="w-6 h-6 text-teal-600" />
            )}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl overflow-hidden bg-gray-100 aspect-[3/4] relative max-h-[300px]">
            <img
              src={URL.createObjectURL(captureBlob)}
              alt="Processed Secure Capture"
              className="w-full h-full object-cover"
            />
            {/* Display AI Confidence Score */}
            <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold text-white shadow-lg ${confidenceScore && confidenceScore < 60 ? 'bg-orange-500' : 'bg-green-500'}`}>
              AI Confidence: {confidenceScore}%
            </div>
          </div>
          
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg flex flex-col gap-4">
            {/* Emergency Toggle */}
            <label className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg cursor-pointer hover:bg-red-100 transition">
              {isEmergency ? <CheckSquare className="w-5 h-5 text-red-600" /> : <Square className="w-5 h-5 text-red-400" />}
              <span className="text-sm font-bold text-red-700">Immediate Physical Danger</span>
              <input 
                type="checkbox" 
                className="hidden" 
                checked={isEmergency} 
                onChange={(e) => setIsEmergency(e.target.checked)} 
              />
            </label>

            {/* Main Category */}
            <div>
              <h3 className="font-semibold text-gray-800 text-sm mb-2">Primary Category *</h3>
              <div className="flex flex-col gap-2">
                {['Traffic Intersection Begging', 'Hazardous Labor', 'Unattended Child'].map(cat => (
                  <label key={cat} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${selectedCategory === cat ? 'bg-teal-50 border-teal-500' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                    <input 
                      type="radio" 
                      name="category" 
                      value={cat}
                      checked={selectedCategory === cat}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-sm font-medium text-gray-700">{cat}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Quick Tags */}
            <div>
              <h3 className="font-semibold text-gray-800 text-sm mb-2 flex items-center gap-1">
                <Tag className="w-4 h-4 text-gray-500" />
                Context Tags (Optional)
              </h3>
              <div className="flex flex-wrap gap-2">
                {QUICK_TAGS.map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition ${
                      selectedTags.includes(tag) 
                        ? 'bg-teal-100 border-teal-300 text-teal-800' 
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-2">
            <button
              onClick={handleRetake}
              disabled={isSubmitting}
              className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" />
              Retake
            </button>
            
            <button
              onClick={handleSubmit}
              disabled={!selectedCategory || isSubmitting}
              className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:bg-gray-300"
            >
              {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Submit Securely
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
