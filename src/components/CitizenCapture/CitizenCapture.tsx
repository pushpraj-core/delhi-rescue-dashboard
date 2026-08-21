import React, { useEffect, useRef, useState } from 'react';
import { Camera, MapPin, AlertCircle, ShieldCheck, RefreshCw, Send, AlertTriangle } from 'lucide-react';
import { useSecureCamera } from './useSecureCamera';
import { useLocationSecure } from './useLocationSecure';
import { initModel, captureSecurely } from './inference';
import { encryptImagePayload } from '../../utils/crypto';
import { demoPublicKey } from '../../utils/demoKeys';

export const CitizenCapture: React.FC = () => {
  const { startCamera, stopCamera, videoRef, error: camError } = useSecureCamera();
  const { getSecureLocation } = useLocationSecure();
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [modelReady, setModelReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  const [captureBlob, setCaptureBlob] = useState<Blob | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

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
    setSuccessMsg(null);
    setSelectedCategory('');

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
    setSuccessMsg(null);
    setSelectedCategory('');
    await startCamera();
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
        user_category: selectedCategory
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

        alert('Secure report submitted to Authorities successfully.');
        setSuccessMsg('Report submitted securely!');
      } catch (networkError) {
        // Offline Fallback
        const { saveOfflineReport } = await import('../../utils/db');
        await saveOfflineReport(payload);
        alert('You are currently offline. Your encrypted report has been saved securely to your device and will automatically sync when connection is restored.');
        setSuccessMsg('Report saved offline. Will sync when online.');
      }
      
      // Clear sensitive memory strictly
      setCaptureBlob(null);
      setLocation(null);
      setConfidenceScore(null);
      setSelectedCategory('');

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 bg-white min-h-[500px] flex flex-col rounded-2xl shadow-xl border border-gray-100 overflow-hidden relative">
      <div className="flex items-center gap-2 mb-4 p-2 bg-blue-50 text-blue-800 rounded-lg">
        <ShieldCheck className="w-5 h-5 text-blue-600" />
        <span className="font-semibold text-sm">Govt. Secure Capture active</span>
      </div>

      {(camError || error) && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <p className="text-sm font-medium">{camError || error}</p>
        </div>
      )}

      {successMsg && (
        <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg flex items-start gap-2">
          <ShieldCheck className="w-5 h-5 mt-0.5 shrink-0" />
          <p className="text-sm font-medium">{successMsg}</p>
        </div>
      )}

      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {!captureBlob && !successMsg ? (
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
            className="absolute bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full border-4 border-blue-500 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed z-20 flex items-center justify-center hover:scale-105 transition-transform"
          >
            {isCapturing ? (
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            ) : (
              <Camera className="w-6 h-6 text-blue-600" />
            )}
          </button>
        </div>
      ) : captureBlob ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl overflow-hidden bg-gray-100 aspect-[3/4] relative">
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
          
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg flex flex-col gap-3">
            <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              Mandatory Verification
            </h3>
            <p className="text-xs text-gray-500">Select the context of the situation to verify this report.</p>
            
            <div className="flex flex-col gap-2">
              {['Traffic Intersection Begging', 'Hazardous Labor', 'Unattended Child'].map(cat => (
                <label key={cat} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedCategory === cat ? 'bg-blue-50 border-blue-500' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                  <input 
                    type="radio" 
                    name="category" 
                    value={cat}
                    checked={selectedCategory === cat}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">{cat}</span>
                </label>
              ))}
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
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:bg-gray-300"
            >
              {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Submit Securely
            </button>
          </div>
        </div>
      ) : (
        <button onClick={handleRetake} className="mt-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">
          Capture New Incident
        </button>
      )}
    </div>
  );
};
