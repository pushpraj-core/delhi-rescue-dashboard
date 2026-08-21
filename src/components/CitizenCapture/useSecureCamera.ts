import { useState, useRef, useCallback } from 'react';

export const useSecureCamera = () => {
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  // Use a ref so startCamera/stopCamera never change identity
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    try {
      setError(null);

      // Stop any existing stream first to avoid leaks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // Prefer rear camera on mobile, falls back to front on laptop
        audio: false, // Absolutely no audio recording for privacy
      });

      streamRef.current = mediaStream;

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // Wait for video to be ready before playing
        await new Promise<void>((resolve) => {
          const v = videoRef.current!;
          if (v.readyState >= 2) { // HAVE_CURRENT_DATA or higher
            resolve();
          } else {
            v.onloadeddata = () => resolve();
          }
        });
        await videoRef.current.play().catch(() => {
          // autoplay may be blocked, that's okay — the video element has autoPlay attribute
        });
      }
    } catch (err: any) {
      let errorMessage = 'Failed to access camera securely.';
      if (err.name === 'NotAllowedError') {
        errorMessage = 'Camera access was denied. Please grant permissions to report safely.';
      } else if (err.name === 'NotFoundError' || err.name === 'OverconstrainedError') {
        // If rear camera not found, try any camera
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          streamRef.current = fallbackStream;
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
            await videoRef.current.play().catch(() => {});
          }
          return; // Success with fallback
        } catch {
          errorMessage = 'No camera found on this device.';
        }
      }
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []); // No dependencies — stable reference forever

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop(); // Strictly stop tracks to flush from memory
      });
      streamRef.current = null;
    }

    // Explicitly unbind from video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []); // No dependencies — stable reference forever

  return { startCamera, stopCamera, videoRef, streamRef, error };
};
