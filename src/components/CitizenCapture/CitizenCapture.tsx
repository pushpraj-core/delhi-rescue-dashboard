import React, { useEffect, useRef, useState } from 'react';
import { Camera, MapPin, AlertCircle, ShieldCheck, RefreshCw } from 'lucide-react';
import { useSecureCamera } from './useSecureCamera';
import { useLocationSecure } from './useLocationSecure';
import { initModel, captureSecurely } from './inference';

export const CitizenCapture: React.FC = () => {
  const { startCamera, stopCamera, videoRef, error: camError } = useSecureCamera();
  const { getSecureLocation } = useLocationSecure();
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [modelReady, setModelReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [captureBlob, setCaptureBlob] = useState<Blob | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);

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

    try {
      // 1. Verify Geofence First (Strict security policy)
      const loc = await getSecureLocation();
      setLocation(loc);

      // 2. Perform zero-data-leak capture & inference
      const blob = await captureSecurely(videoRef.current, canvasRef.current);
      setCaptureBlob(blob);

      // 3. Stop camera immediately to prevent background monitoring
      stopCamera();
      
    } catch (err: any) {
      setError(err.message);
      // Ensure we don't hold any partial state if there's an error
      setCaptureBlob(null);
      setLocation(null);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleRetake = async () => {
    setCaptureBlob(null);
    setLocation(null);
    setError(null);
    await startCamera();
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
            className="absolute bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full border-4 border-blue-500 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed z-20 flex items-center justify-center hover:scale-105 transition-transform"
          >
            {isCapturing ? (
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            ) : (
              <Camera className="w-6 h-6 text-blue-600" />
            )}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl overflow-hidden bg-gray-100 aspect-[3/4] relative">
            <img
              src={URL.createObjectURL(captureBlob)}
              alt="Processed Secure Capture"
              className="w-full h-full object-cover"
            />
          </div>
          
          <div className="p-4 bg-green-50 rounded-lg border border-green-100 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-green-700">
              <ShieldCheck className="w-5 h-5" />
              <span className="font-semibold text-sm">Faces Blurred & Memory Flushed</span>
            </div>
            {location && (
              <div className="flex items-center gap-2 text-gray-600 text-sm">
                <MapPin className="w-4 h-4" />
                <span>Delhi Verified: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</span>
              </div>
            )}
          </div>

          <button
            onClick={handleRetake}
            className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Retake Photo
          </button>
        </div>
      )}
    </div>
  );
};
