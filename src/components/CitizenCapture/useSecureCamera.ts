import { useState, useRef, useCallback } from 'react';

export const useSecureCamera = () => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Prefer rear camera for citizen capture
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false, // Absolutely no audio recording for privacy
      });

      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      let errorMessage = 'Failed to access camera securely.';
      if (err.name === 'NotAllowedError') {
        errorMessage = 'Camera access was denied. Please grant permissions to report safely.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'No camera found on this device.';
      }
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => {
        track.stop(); // Strictly stop tracks to flush from memory
      });
      setStream(null);
    }
    
    // Explicitly unbind from video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stream]);

  return { startCamera, stopCamera, videoRef, stream, error };
};
