import * as faceapi from '@vladmandic/face-api';
import CryptoJS from 'crypto-js';
// import { GoogleGenAI, Type } from "@google/genai";

// const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || (import.meta as any).env.VITE_GEMINI_API_KEY || '' });

// Disabled to prevent Gemini API RPM consumption
export const extractAttributesWithGemini = async (_base64Image: string) => {
  /*
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: _base64Image.split(',')[1] || _base64Image
          }
        },
        {
          text: "Analyze the person in this image and extract identity attributes. Return JSON only with these fields: wearingGlasses (boolean, true ONLY if the person is currently wearing eyeglasses or sunglasses on their face. If they are NOT wearing glasses, or if you are unsure, return false. Do not confuse facial features or shadows with glasses.), hairStyle (string, be very specific about length and style in Thai, e.g. 'ผมสั้นเสมอติ่งหู', 'ผมสั้นประบ่า', 'ผมยาว', 'หัวล้าน', 'ใส่มุสลิม/ฮิญาบ'), hairColor (string), shirtColor (string), shirtPattern (string, e.g. 'solid', 'striped', 'dotted', 'checkered'), gender (string, 'ชาย' or 'หญิง')."
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            wearingGlasses: { type: Type.BOOLEAN },
            hairStyle: { type: Type.STRING },
            hairColor: { type: Type.STRING },
            shirtColor: { type: Type.STRING },
            shirtPattern: { type: Type.STRING },
            gender: { type: Type.STRING }
          },
          required: ["wearingGlasses", "hairStyle", "shirtColor", "shirtPattern", "gender"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini Attribute Extraction Error:", error);
    return null;
  }
  */
  return null;
};

// Use jsdelivr CDN for models
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

// Secret key for AES encryption. 
// IMPORTANT: If this key changes, existing data in localStorage will become unreadable.
// We use (import.meta as any).env.VITE_FACE_ENCRYPTION_KEY with a fallback for stability.
const ENCRYPTION_KEY = (import.meta as any).env.VITE_FACE_ENCRYPTION_KEY || 'face-speaker-secure-key-2026'; 

let modelsLoaded = false;

const encrypt = (data: string): string => {
  return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
};

const decrypt = (ciphertext: string): string => {
  if (!ciphertext) return "";
  
  // Basic check: if it looks like JSON, it's probably not encrypted
  const trimmed = ciphertext.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return "";
  }
  
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted;
  } catch (e) {
    // Suppress "Malformed UTF-8 data" error as it's handled by fallback
    return "";
  }
};

export const calculateEuclideanDistance = (descriptor1: Float32Array, descriptor2: Float32Array): number => {
  return faceapi.euclideanDistance(descriptor1, descriptor2);
};

export const loadFaceModels = async () => {
  if (modelsLoaded) return;
  try {
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
    modelsLoaded = true;
    console.log('Face API models loaded successfully');
  } catch (error) {
    console.error('Error loading Face API models:', error);
    throw error;
  }
};

const applyAutoContrast = (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  let min = 255;
  let max = 0;
  
  // Find min and max luminance
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i+1];
    const b = data[i+2];
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    if (luma < min) min = luma;
    if (luma > max) max = luma;
  }
  
  if (min >= max) return; // Avoid division by zero
  
  const scale = 255 / (max - min);
  
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.max(0, (data[i] - min) * scale));
    data[i+1] = Math.min(255, Math.max(0, (data[i+1] - min) * scale));
    data[i+2] = Math.min(255, Math.max(0, (data[i+2] - min) * scale));
  }
  
  ctx.putImageData(imageData, 0, 0);
};

export const enhanceFaceImage = (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  // 1. Auto Contrast first
  applyAutoContrast(canvas);
  
  // 2. Simple Sharpening Convolution
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const output = ctx.createImageData(width, height);
  const dst = output.data;
  
  // Sharpening kernel
  const kernel = [
    0, -1,  0,
   -1,  5, -1,
    0, -1,  0
  ];
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) { // R, G, B
        let sum = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const pixelIdx = ((y + ky) * width + (x + kx)) * 4 + c;
            sum += data[pixelIdx] * kernel[(ky + 1) * 3 + (kx + 1)];
          }
        }
        dst[(y * width + x) * 4 + c] = Math.min(255, Math.max(0, sum));
      }
      dst[(y * width + x) * 4 + 3] = 255; // Alpha
    }
  }
  
  ctx.putImageData(output, 0, 0);
};

export const extractColorGrid = (videoElement: HTMLVideoElement, box: {x: number, y: number, width: number, height: number}, gridSize: number = 5): { r: number, g: number, b: number, v: number }[][] | null => {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const sourceX = Math.max(0, box.x);
    const sourceY = Math.max(0, box.y);
    const sourceW = Math.min(videoElement.videoWidth - sourceX, box.width);
    const sourceH = Math.min(videoElement.videoHeight - sourceY, box.height);

    if (sourceW <= 0 || sourceH <= 0) return null;

    // Use a slightly larger canvas to calculate variance (texture)
    const sampleSize = gridSize * 4; 
    canvas.width = sampleSize;
    canvas.height = sampleSize;
    
    ctx.drawImage(videoElement, sourceX, sourceY, sourceW, sourceH, 0, 0, canvas.width, canvas.height);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    const grid: { r: number, g: number, b: number, v: number }[][] = [];
    const step = 4; // pixels per grid cell
    
    for (let gy = 0; gy < gridSize; gy++) {
      const row: { r: number, g: number, b: number, v: number }[] = [];
      for (let gx = 0; gx < gridSize; gx++) {
        let r = 0, g = 0, b = 0, count = 0;
        const pixels: number[] = [];
        
        // Sample pixels in this grid cell
        for (let py = 0; py < step; py++) {
          for (let px = 0; px < step; px++) {
            const idx = ((gy * step + py) * sampleSize + (gx * step + px)) * 4;
            r += data[idx];
            g += data[idx+1];
            b += data[idx+2];
            // Use luminance for variance (texture) calculation
            pixels.push(0.299 * data[idx] + 0.587 * data[idx+1] + 0.114 * data[idx+2]);
            count++;
          }
        }
        
        const avgLuma = pixels.reduce((s, v) => s + v, 0) / count;
        const variance = Math.sqrt(pixels.reduce((s, v) => s + Math.pow(v - avgLuma, 2), 0) / count) / 255;
        
        row.push({
          r: Math.round(r / count),
          g: Math.round(g / count),
          b: Math.round(b / count),
          v: variance // Texture/Pattern intensity
        });
      }
      grid.push(row);
    }
    return grid;
  } catch (e) {
    console.error("Error extracting color grid:", e);
    return null;
  }
};

export const calculateGridDistance = (grid1: any[][], grid2: any[][]): number => {
  if (!grid1 || !grid2 || grid1.length !== grid2.length) return 1.0;
  
  let totalDiff = 0;
  let count = 0;
  
  for (let y = 0; y < grid1.length; y++) {
    for (let x = 0; x < grid1[y].length; x++) {
      const c1 = grid1[y][x];
      const c2 = grid2[y][x];
      
      const rDiff = Math.abs(c1.r - c2.r) / 255;
      const gDiff = Math.abs(c1.g - c2.g) / 255;
      const bDiff = Math.abs(c1.b - c2.b) / 255;
      const vDiff = Math.abs((c1.v || 0) - (c2.v || 0)); // Pattern difference
      
      // Weight color and texture
      totalDiff += (rDiff + gDiff + bDiff + vDiff * 2) / 5;
      count++;
    }
  }
  
  return count > 0 ? totalDiff / count : 1.0;
};

export const extractClothingColor = (videoElement: HTMLVideoElement, faceBox: faceapi.Box): { r: number, g: number, b: number } | null => {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Define clothing area: below the face
    // We take a region that is roughly the same width as the face, 
    // starting from just below the chin, and going down about 1.5x face height.
    const clothingX = faceBox.x;
    const clothingY = faceBox.y + faceBox.height * 1.1;
    const clothingW = faceBox.width;
    const clothingH = faceBox.height * 1.5;

    // Ensure we don't go out of bounds
    const sourceX = Math.max(0, clothingX);
    const sourceY = Math.max(0, clothingY);
    const sourceW = Math.min(videoElement.videoWidth - sourceX, clothingW);
    const sourceH = Math.min(videoElement.videoHeight - sourceY, clothingH);

    if (sourceW <= 0 || sourceH <= 0) return null;

    canvas.width = 20; // Small size for fast averaging
    canvas.height = 20;
    
    ctx.drawImage(videoElement, sourceX, sourceY, sourceW, sourceH, 0, 0, canvas.width, canvas.height);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    let r = 0, g = 0, b = 0;
    let count = 0;
    
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i+1];
      b += data[i+2];
      count++;
    }
    
    return {
      r: Math.round(r / count),
      g: Math.round(g / count),
      b: Math.round(b / count)
    };
  } catch (e) {
    console.error("Error extracting clothing color:", e);
    return null;
  }
};

// Laplacian Variance for Blur Detection
const calculateBlurScore = (canvas: HTMLCanvasElement): number => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const grayscale = new Float32Array(width * height);

  for (let i = 0; i < data.length; i += 4) {
    grayscale[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  const laplacian = new Float32Array(width * height);
  const kernel = [0, 1, 0, 1, -4, 1, 0, 1, 0];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          sum += grayscale[(y + ky) * width + (x + kx)] * kernel[(ky + 1) * 3 + (kx + 1)];
        }
      }
      laplacian[y * width + x] = sum;
    }
  }

  let mean = 0;
  for (let i = 0; i < laplacian.length; i++) mean += laplacian[i];
  mean /= laplacian.length;

  let variance = 0;
  for (let i = 0; i < laplacian.length; i++) variance += Math.pow(laplacian[i] - mean, 2);
  return variance / laplacian.length;
};

// Estimate Head Pose (Yaw and Pitch) from Landmarks
const estimatePose = (landmarks: faceapi.FaceLandmarks68) => {
  const nose = landmarks.getNose();
  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();
  const mouth = landmarks.getMouth();

  // Center of eyes
  const leftEyeCenter = {
    x: leftEye.reduce((s, p) => s + p.x, 0) / leftEye.length,
    y: leftEye.reduce((s, p) => s + p.y, 0) / leftEye.length
  };
  const rightEyeCenter = {
    x: rightEye.reduce((s, p) => s + p.x, 0) / rightEye.length,
    y: rightEye.reduce((s, p) => s + p.y, 0) / rightEye.length
  };
  const eyesCenter = {
    x: (leftEyeCenter.x + rightEyeCenter.x) / 2,
    y: (leftEyeCenter.y + rightEyeCenter.y) / 2
  };

  // Nose tip (approx)
  const noseTip = nose[3]; // Tip of the nose

  // Yaw: Horizontal distance ratio
  const eyeDist = rightEyeCenter.x - leftEyeCenter.x;
  const noseOffset = noseTip.x - eyesCenter.x;
  const yaw = (noseOffset / eyeDist) * 90; // Rough estimation in degrees

  // Pitch: Vertical position
  const mouthCenterY = mouth.reduce((s, p) => s + p.y, 0) / mouth.length;
  const faceHeight = mouthCenterY - eyesCenter.y;
  const noseVerticalOffset = noseTip.y - eyesCenter.y;
  const pitch = ((noseVerticalOffset / faceHeight) - 0.5) * 90; // Rough estimation

  return { yaw: Math.abs(yaw), pitch: Math.abs(pitch) };
};

export const extractCenterFace = async (
  videoElement: HTMLVideoElement, 
  preprocess: boolean = false, 
  skipQualityCheck: boolean = false,
  lastFacePosition: { x: number, y: number, width: number, height: number } | null = null,
  isEnrollment: boolean = false,
  enhance: boolean = false
) => {
  if (!modelsLoaded) {
    await loadFaceModels();
  }

  // Detect all faces - Try SsdMobilenetv1 first (more accurate)
  let detections = await faceapi.detectAllFaces(videoElement)
    .withFaceLandmarks()
    .withFaceDescriptors();

  // Fallback 1: TinyFaceDetector with default options
  if (detections.length === 0) {
    detections = await faceapi.detectAllFaces(videoElement, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptors();
  }

  // Fallback 2: TinyFaceDetector with larger input size (better for small/blurry faces)
  if (detections.length === 0) {
    detections = await faceapi.detectAllFaces(videoElement, new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.3 }))
      .withFaceLandmarks()
      .withFaceDescriptors();
  }

  // Fallback 3: TinyFaceDetector with even larger input size and lower threshold
  if (detections.length === 0) {
    detections = await faceapi.detectAllFaces(videoElement, new faceapi.TinyFaceDetectorOptions({ inputSize: 608, scoreThreshold: 0.2 }))
      .withFaceLandmarks()
      .withFaceDescriptors();
  }

  if (detections.length === 0) return null;

  // We no longer manually re-extract and re-compute descriptors. 
  // faceapi's .withFaceDescriptors() already handles alignment and generates high-quality descriptors internally.
  // This saves massive CPU time during registration and detection.

  // Speaker Prioritization: Weighting by Size & Centering
  // Safely handle both HTMLVideoElement and HTMLImageElement
  const elemWidth = (videoElement as any).videoWidth || (videoElement as any).width || (videoElement as any).naturalWidth || videoElement.clientWidth;
  const elemHeight = (videoElement as any).videoHeight || (videoElement as any).height || (videoElement as any).naturalHeight || videoElement.clientHeight;
  
  const videoCenterX = elemWidth / 2;
  const videoCenterY = elemHeight / 2;
  const maxPossibleDist = Math.sqrt(Math.pow(videoCenterX, 2) + Math.pow(videoCenterY, 2));

  let bestFace = null;
  let maxScore = -1;

  for (const det of detections) {
    const box = det.detection.box;
    const faceCenterX = box.x + box.width / 2;
    const faceCenterY = box.y + box.height / 2;
    
    // Safety check in case elemWidth/elemHeight is 0 or NaN
    if (isNaN(maxPossibleDist) || maxPossibleDist === 0) {
      bestFace = det; // fallback to first face if sizing fails
      break;
    }

    const dist = Math.sqrt(Math.pow(faceCenterX - videoCenterX, 2) + Math.pow(faceCenterY - videoCenterY, 2));
    const distScore = 1 - (dist / maxPossibleDist); // 1 is center, 0 is far
    
    const sizeScore = (box.width * box.height) / (elemWidth * elemHeight);
    
    // Tracking bonus: If this face is close to where the last face was, give it a big bonus
    let trackingScore = 0;
    if (lastFacePosition) {
      const lastCenterX = lastFacePosition.x + lastFacePosition.width / 2;
      const lastCenterY = lastFacePosition.y + lastFacePosition.height / 2;
      const distToLast = Math.sqrt(Math.pow(faceCenterX - lastCenterX, 2) + Math.pow(faceCenterY - lastCenterY, 2));
      const maxTrackDist = Math.max(elemWidth, elemHeight) * 0.3; // 30% of screen
      trackingScore = Math.max(0, 1 - (distToLast / maxTrackDist));
    }

    // Weighting: 20% size, 80% centering, 0% tracking (handled by score redistribution)
    // If no tracking, redistribute tracking weight to size and centering
    const score = lastFacePosition 
      ? (sizeScore * 0.1) + (distScore * 0.5) + (trackingScore * 0.4)
      : (sizeScore * 0.2) + (distScore * 0.8);
    
    if (score > maxScore) {
      maxScore = score;
      bestFace = det;
    }
  }

  if (!bestFace) return null;

  // Face Quality Check: Pose
  if (!skipQualityCheck) {
    const pose = estimatePose(bestFace.landmarks);
    // During enrollment, we are extremely lenient to allow capturing from high-angle meeting cameras
    const yawLimit = isEnrollment ? 90 : 35;
    const pitchLimit = isEnrollment ? 90 : 50;
    
    if (pose.yaw > yawLimit || pose.pitch > pitchLimit) {
      console.log(`Face skipped: Pose too extreme (Yaw: ${pose.yaw.toFixed(1)}, Pitch: ${pose.pitch.toFixed(1)})`);
      return { ...bestFace, qualityError: 'Pose' };
    }
  }

  if (preprocess) {
    try {
      // Extract face to canvas
      const faceCanvases = await faceapi.extractFaces(videoElement, [bestFace.detection.box]);
      if (faceCanvases.length > 0) {
        const faceCanvas = faceCanvases[0];
        
        // Face Quality Check: Blur
        let blurScore = 0;
        if (!skipQualityCheck) {
          blurScore = calculateBlurScore(faceCanvas);
          (bestFace as any).blurScore = blurScore;
          // Extremely lenient blur threshold during enrollment (10 instead of 100)
          const blurLimit = isEnrollment ? 10 : 100;
          if (blurScore < blurLimit) { 
            console.log(`Face skipped: Too blurry (Score: ${blurScore.toFixed(1)})`);
            return { ...bestFace, qualityError: 'Blur', blurScore };
          }
        } else {
          // Still calculate it for metadata but don't fail
          blurScore = calculateBlurScore(faceCanvas);
        }

        // We skip re-detecting on preprocessed image because SsdMobilenet is good enough
        // and re-running the neural net doubles the time taken for enrollment.
        // If we really needed better descriptors, we'd do it conditionally, but user 
        // experience requires fast enrollment.

        return {
          ...bestFace,
          blurScore
        };
      }
    } catch (e) {
      console.error("Error in preprocessing face:", e);
    }
  }

  return bestFace;
};

export const saveFaceToDB = (name: string, descriptor: Float32Array, dbKey: string = 'faceDB', extraFeatures?: any) => {
  try {
    const faceDB = getFaceDB(dbKey);
    
    let dbEntry = faceDB[name] || { descriptors: [] };
    
    // Backward compatibility: if it's an array, convert to object
    if (Array.isArray(dbEntry)) {
      if (dbEntry.length > 0 && typeof dbEntry[0] === 'number') {
        dbEntry = { descriptors: [dbEntry] };
      } else {
        dbEntry = { descriptors: dbEntry };
      }
    }
    
    let descriptorsForName = dbEntry.descriptors || [];
    
    // Smart Enrollment: Vector Diversity Check
    if (descriptorsForName.length > 0) {
      let minDistance = Infinity;
      for (const existingDescriptorArray of descriptorsForName) {
        const existingDescriptor = new Float32Array(existingDescriptorArray);
        const distance = faceapi.euclideanDistance(descriptor, existingDescriptor);
        if (distance < minDistance) minDistance = distance;
      }
      
      // If the new face is too similar to existing ones (Distance < 0.15), skip it
      if (minDistance < 0.15) {
        console.log(`Smart Enrollment: Face too similar to existing data (Dist: ${minDistance.toFixed(3)}). Skipping.`);
        return 'duplicate';
      }
    }

    // Append the new descriptor
    descriptorsForName.push(Array.from(descriptor));
    
    // Keep only the last 10 descriptors
    if (descriptorsForName.length > 10) {
      descriptorsForName = descriptorsForName.slice(-10);
    }
    
    dbEntry.descriptors = descriptorsForName;
    
    // Save extra features if provided
    if (extraFeatures) {
      if (extraFeatures.clothingGrid) {
        dbEntry.clothingGrids = dbEntry.clothingGrids || [];
        dbEntry.clothingGrids.push(extraFeatures.clothingGrid);
        if (dbEntry.clothingGrids.length > 10) dbEntry.clothingGrids = dbEntry.clothingGrids.slice(-10);
      }
      if (extraFeatures.headGrid) {
        dbEntry.headGrids = dbEntry.headGrids || [];
        dbEntry.headGrids.push(extraFeatures.headGrid);
        if (dbEntry.headGrids.length > 10) dbEntry.headGrids = dbEntry.headGrids.slice(-10);
      }
      if (extraFeatures.position) {
        dbEntry.positions = dbEntry.positions || [];
        dbEntry.positions.push(extraFeatures.position);
        if (dbEntry.positions.length > 10) dbEntry.positions = dbEntry.positions.slice(-10);
      }
      if (extraFeatures.attributes) {
        dbEntry.attributes = { ...(dbEntry.attributes || {}), ...extraFeatures.attributes };
      }
    }
    
    faceDB[name] = dbEntry;
    
    const encryptedData = encrypt(JSON.stringify(faceDB));
    localStorage.setItem(dbKey, encryptedData);
    return true;
  } catch (error) {
    console.error('Error saving face to DB:', error);
    return false;
  }
};

export const getFaceDB = (dbKey: string = 'faceDB') => {
  try {
    const data = localStorage.getItem(dbKey);
    if (!data) return {};
    
    // Try to decrypt first
    const decrypted = decrypt(data);
    if (decrypted) {
      try {
        return JSON.parse(decrypted);
      } catch (e) {
        return {};
      }
    } else {
      // Fallback for old data (plain JSON)
      try {
        return JSON.parse(data);
      } catch (e) {
        return {};
      }
    }
  } catch (error) {
    console.error('Error loading face DB:', error);
    return {};
  }
};

export const deleteFaceFromDB = (name: string, dbKey: string = 'faceDB') => {
  try {
    const faceDB = getFaceDB(dbKey);
    if (!faceDB[name]) return false;
    delete faceDB[name];
    const encryptedData = encrypt(JSON.stringify(faceDB));
    localStorage.setItem(dbKey, encryptedData);
    return true;
  } catch (error) {
    console.error('Error deleting face from DB:', error);
    return false;
  }
};

export const clearFaceDB = (dbKey: string = 'faceDB') => {
  try {
    localStorage.removeItem(dbKey);
    return true;
  } catch (error) {
    console.error('Error clearing face DB:', error);
    return false;
  }
};

export const exportFaceDB = (dbKey: string = 'faceDB') => {
  try {
    const faceDB = getFaceDB(dbKey);
    const data = JSON.stringify(faceDB);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${dbKey}_export_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting face DB:', error);
  }
};

export const importFaceDB = async (file: File, dbKey: string = 'faceDB') => {
  try {
    const text = await file.text();
    // Validate JSON structure
    const data = JSON.parse(text);
    if (typeof data !== 'object' || data === null) throw new Error('Invalid format');
    const encryptedData = encrypt(JSON.stringify(data));
    localStorage.setItem(dbKey, encryptedData);
    return true;
  } catch (error) {
    console.error('Error importing face DB:', error);
    return false;
  }
};

export const trackCenterFace = async (videoElement: HTMLVideoElement) => {
  if (!modelsLoaded) return null;

  try {
    // Fast detection using TinyFaceDetector for tracking
    const detections = await faceapi.detectAllFaces(videoElement, new faceapi.TinyFaceDetectorOptions());
    if (detections.length === 0) return null;

    const videoCenterX = videoElement.videoWidth / 2;
    const videoCenterY = videoElement.videoHeight / 2;

    let closestFace = detections[0];
    let minDistance = Infinity;

    for (const det of detections) {
      const box = det.box;
      const faceCenterX = box.x + box.width / 2;
      const faceCenterY = box.y + box.height / 2;
      
      const dist = Math.sqrt(Math.pow(faceCenterX - videoCenterX, 2) + Math.pow(faceCenterY - videoCenterY, 2));
      if (dist < minDistance) {
        minDistance = dist;
        closestFace = det;
      }
    }

    return closestFace.box;
  } catch (error) {
    console.error('Error tracking face:', error);
    return null;
  }
};

// Define weights for metadata-based matching
const ATTRIBUTE_WEIGHTS = {
  gender: 0.05,
  hairStyle: 0.04,
  shirtColor: 0.02,
  shirtPattern: 0.02,
};

export const recognizeFace = async (
  videoElement: HTMLVideoElement, 
  faceDB: Record<string, any>, 
  threshold: number = 0.40, 
  preprocess: boolean = false,
  lastFacePosition: { x: number, y: number, width: number, height: number } | null = null,
  enhance: boolean = false,
  enableReId: boolean = false,
  enableSpatialBias: boolean = false,
  currentMetadata: any = null
) => {
  const centerFace = await extractCenterFace(videoElement, preprocess, false, lastFacePosition, false, enhance);
  if (!centerFace) return null;

  const descriptor = centerFace.descriptor;
  const box = centerFace.detection.box;
  
  let currentClothingGrid: { r: number, g: number, b: number }[][] | null = null;
  let currentHeadGrid: { r: number, g: number, b: number }[][] | null = null;
  
  if (enableReId) {
    // Extract clothing (below face)
    const clothingBox = {
      x: box.x,
      y: box.y + box.height,
      width: box.width,
      height: box.height * 1.5
    };
    currentClothingGrid = extractColorGrid(videoElement, clothingBox);
    
    // Extract head/hair (above face)
    const headBox = {
      x: box.x,
      y: box.y - box.height * 0.5,
      width: box.width,
      height: box.height * 0.5
    };
    currentHeadGrid = extractColorGrid(videoElement, headBox);
  }

  let bestMatch = { name: 'Unknown', distance: Infinity, source: 'face' };

  for (const [name, dbData] of Object.entries(faceDB)) {
    let dbEntry: any = { descriptors: [] };
    
    if (Array.isArray(dbData)) {
      if (dbData.length > 0 && typeof dbData[0] === 'number') {
        dbEntry.descriptors = [dbData];
      } else {
        dbEntry.descriptors = dbData;
      }
    } else if (dbData && dbData.descriptors) {
      dbEntry = dbData;
    }

    for (let i = 0; i < dbEntry.descriptors.length; i++) {
      const dbDescriptor = new Float32Array(dbEntry.descriptors[i]);
      let faceDistance = faceapi.euclideanDistance(descriptor, dbDescriptor);
      let distance = faceDistance;
      
      // Apply Re-ID (Clothing & Hair)
      if (enableReId) {
        let reIdPenalty = 0;
        let reIdWeight = 0;
        
        if (currentClothingGrid && dbEntry.clothingGrids && dbEntry.clothingGrids[i]) {
          const clothingDist = calculateGridDistance(currentClothingGrid, dbEntry.clothingGrids[i]);
          reIdPenalty += clothingDist;
          reIdWeight += 1;
        }
        
        if (currentHeadGrid && dbEntry.headGrids && dbEntry.headGrids[i]) {
          const headDist = calculateGridDistance(currentHeadGrid, dbEntry.headGrids[i]);
          reIdPenalty += headDist;
          reIdWeight += 1;
        }
        
        if (reIdWeight > 0) {
          const avgReIdDist = reIdPenalty / reIdWeight;
          // Trust face more if clear, trust Re-ID more if face is uncertain
          const faceWeight = faceDistance < 0.3 ? 0.8 : 0.6;
          distance = (faceDistance * faceWeight) + (avgReIdDist * (1 - faceWeight));
        }
      }
      
      // --- NEW: Apply Metadata-based Confidence Boost ---
      if (dbEntry.attributes && currentMetadata && distance < threshold * 1.5) {
        let metadataBonus = 0;
        
        // Static Metadata (High Weight)
        if (currentMetadata.gender === dbEntry.attributes.gender) {
          metadataBonus += ATTRIBUTE_WEIGHTS.gender;
        } else if (currentMetadata.gender && dbEntry.attributes.gender) {
          metadataBonus -= ATTRIBUTE_WEIGHTS.gender * 2; // Strong penalty for gender mismatch
        }

        if (currentMetadata.hairStyle === dbEntry.attributes.hairStyle) {
          metadataBonus += ATTRIBUTE_WEIGHTS.hairStyle;
        } else if (currentMetadata.hairStyle && dbEntry.attributes.hairStyle) {
          metadataBonus -= ATTRIBUTE_WEIGHTS.hairStyle;
        }

        // Dynamic Metadata (Lower Weight, be careful)
        if (currentMetadata.wearingGlasses === dbEntry.attributes.wearingGlasses) {
          metadataBonus += 0.02;
        } else if (currentMetadata.wearingGlasses !== undefined && dbEntry.attributes.wearingGlasses !== undefined) {
          metadataBonus -= 0.03; // Penalty for glasses mismatch
        }

        if (currentMetadata.shirtColor === dbEntry.attributes.shirtColor) {
          metadataBonus += ATTRIBUTE_WEIGHTS.shirtColor;
        } else if (currentMetadata.shirtColor && dbEntry.attributes.shirtColor) {
          metadataBonus -= ATTRIBUTE_WEIGHTS.shirtColor;
        }

        distance -= metadataBonus;
      }
      
      // Apply Spatial Bias
      if (enableSpatialBias && dbEntry.positions && dbEntry.positions[i]) {
        const dbPos = dbEntry.positions[i];
        const currentPos = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        const spatialDist = Math.sqrt(Math.pow(currentPos.x - dbPos.x, 2) + Math.pow(currentPos.y - dbPos.y, 2)) / 1920;
        
        if (spatialDist < 0.1) {
          distance -= 0.08; // Stronger bonus for same seat
        } else if (spatialDist > 0.4) {
          distance += 0.08; // Stronger penalty for different seat
        }
      }

      if (distance < bestMatch.distance) {
        bestMatch = { name, distance, source: 'face' };
      }
    }
  }

  const debugInfo = {
    distance: bestMatch.distance,
    pose: estimatePose(centerFace.landmarks),
    blur: (centerFace as any).blurScore || 0
  };

  if (bestMatch.distance < threshold) {
    return { 
      match: bestMatch.name, 
      distance: bestMatch.distance, 
      box: centerFace.detection.box, 
      descriptor: descriptor, // Return descriptor
      qualityError: (centerFace as any).qualityError,
      debug: debugInfo
    };
  }
  
  return { 
    match: null, 
    distance: bestMatch.distance, 
    box: centerFace.detection.box, 
    descriptor: descriptor, // Return descriptor
    qualityError: (centerFace as any).qualityError,
    debug: debugInfo
  };
};
