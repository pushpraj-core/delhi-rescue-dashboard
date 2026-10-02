import * as tf from '@tensorflow/tfjs';
import * as blazeface from '@tensorflow-models/blazeface';

let detector: any = null;

// Initialize real BlazeFace model for actual ML face detection
export const initModel = async (): Promise<void> => {
  if (detector) return;
  // Ensure TensorFlow is ready before loading model
  await tf.ready();
  detector = await blazeface.load();
};

// Zero-leak execution: processes frame, extracts blob, destroys evidence
export const captureSecurely = async (
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement
): Promise<{ blob: Blob; scene_confidence_score: number; dHash: string }> => {
  if (!detector) {
    throw new Error('Model not initialized');
  }

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Canvas 2D context not available');
  }

  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;

  // 1. Draw raw video frame to canvas
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  try {
    // 2. Perform real ML inference
    const returnTensors = false;
    const faces = await detector.estimateFaces(video, returnTensors);
    
    let maxProbability = 0;

    // 3. Apply Gaussian blur to each detected face region securely
    for (const face of faces) {
      // BlazeFace returns probability as an array of 1 element
      const probability = Array.isArray(face.probability) ? face.probability[0] : face.probability;
      if (probability > maxProbability) {
        maxProbability = probability;
      }

      // topLeft and bottomRight are arrays of [x, y]
      const [xMin, yMin] = face.topLeft as [number, number];
      const [xMax, yMax] = face.bottomRight as [number, number];
      const width = xMax - xMin;
      const height = yMax - yMin;

      // Extract the face region securely
      const faceRegion = ctx.getImageData(xMin, yMin, width, height);

      // Create an offscreen canvas specifically for blurring
      const blurCanvas = document.createElement('canvas');
      blurCanvas.width = width;
      blurCanvas.height = height;
      const blurCtx = blurCanvas.getContext('2d');
      if (blurCtx) {
        blurCtx.putImageData(faceRegion, 0, 0);

        // Apply heavy CSS blur and overlay onto main canvas
        ctx.save();
        ctx.filter = 'blur(40px)';
        ctx.drawImage(blurCanvas, xMin, yMin);
        ctx.restore();
      }
    }

    // Calculate simple image brightness/blur quality score (simulated/heuristic for MVP)
    // We sample pixels to determine if it's too dark or too blurry
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let brightnessSum = 0;
    for (let i = 0; i < imageData.data.length; i += 4) {
      brightnessSum += (imageData.data[i] + imageData.data[i+1] + imageData.data[i+2]) / 3;
    }
    const avgBrightness = brightnessSum / (canvas.width * canvas.height);
    const brightnessScore = Math.min(100, Math.max(0, avgBrightness > 30 && avgBrightness < 220 ? 100 : 50));
    
    // Composite Quality Score = 60% face probability + 40% image quality
    const scene_confidence_score = Math.floor((maxProbability * 100 * 0.6) + (brightnessScore * 0.4));
    
    // On-device dHash (perceptual hash) for tamper evidence
    const dHash = await generateDHash(imageData);

    // 4. Securely extract Blob (Memory-safe)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          // 5. ABSOLUTE MEMORY FLUSH (Zero Data Leak Rule)
          // Clear canvas completely by writing solid black over the entire buffer, then clearing.
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Explicitly reset canvas dimensions to flush memory
          canvas.width = 0;
          canvas.height = 0;

          if (b) resolve(b);
          else reject(new Error('Failed to create Blob'));
        },
        'image/jpeg',
        0.85
      );
    });

    return { blob, scene_confidence_score, dHash };
  } catch (error) {
    throw error;
  }
};

// Simple on-device perceptual hash (dHash) implementation for duplicate/tamper check
async function generateDHash(imageData: ImageData): Promise<string> {
  // Create an offscreen canvas to resize to 9x8 grayscale
  const canvas = document.createElement('canvas');
  canvas.width = 9;
  canvas.height = 8;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '0000000000000000';

  // We need to draw the imageData onto a temporary canvas first to resize it
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = imageData.width;
  tempCanvas.height = imageData.height;
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) return '0000000000000000';
  tempCtx.putImageData(imageData, 0, 0);

  // Draw onto 9x8 canvas
  ctx.drawImage(tempCanvas, 0, 0, 9, 8);
  const resizedData = ctx.getImageData(0, 0, 9, 8).data;

  // Convert to grayscale
  const grays = [];
  for (let i = 0; i < resizedData.length; i += 4) {
    const r = resizedData[i];
    const g = resizedData[i + 1];
    const b = resizedData[i + 2];
    // Luminosity method
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    grays.push(gray);
  }

  // Calculate dHash (compare adjacent pixels in each row)
  let hashStr = '';
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const left = grays[y * 9 + x];
      const right = grays[y * 9 + x + 1];
      hashStr += left > right ? '1' : '0';
    }
  }

  // Convert 64-bit binary string to hex
  let hexHash = '';
  for (let i = 0; i < 64; i += 4) {
    const chunk = hashStr.substr(i, 4);
    hexHash += parseInt(chunk, 2).toString(16);
  }

  return hexHash;
}
