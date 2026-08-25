import { ProcessedPage } from '../types';

interface CropInfo {
  top: number; bottom: number; left: number; right: number;
}

const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`Failed to load image.`));
    img.src = url;
  });
};

const getContentBounds = (ctx: CanvasRenderingContext2D, width: number, height: number): CropInfo => {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  let top = 0, bottom = height, left = 0, right = width;

  const isWhite = (idx: number) => data[idx] > 240 && data[idx + 1] > 240 && data[idx + 2] > 240;

  for (let y = 0; y < height; y++) {
    let rowIsWhite = true;
    for (let x = 0; x < width; x += 10) {
      if (!isWhite((y * width + x) * 4)) { rowIsWhite = false; break; }
    }
    if (!rowIsWhite) { top = y; break; }
  }

  for (let y = height - 1; y >= top; y--) {
    let rowIsWhite = true;
    for (let x = 0; x < width; x += 10) {
      if (!isWhite((y * width + x) * 4)) { rowIsWhite = false; break; }
    }
    if (!rowIsWhite) { bottom = y + 1; break; }
  }
  
  for (let x = 0; x < width; x++) {
    let colIsWhite = true;
    for (let y = top; y < bottom; y += 10) {
       if (!isWhite((y * width + x) * 4)) { colIsWhite = false; break; }
    }
    if (!colIsWhite) { left = x; break; }
  }

  for (let x = width - 1; x >= left; x--) {
    let colIsWhite = true;
    for (let y = top; y < bottom; y += 10) {
       if (!isWhite((y * width + x) * 4)) { colIsWhite = false; break; }
    }
    if (!colIsWhite) { right = x + 1; break; }
  }

  const padding = 10;
  top = Math.max(0, top - padding);
  bottom = Math.min(height, bottom + padding);
  left = Math.max(0, left - padding);
  right = Math.min(width, right + padding);

  if (bottom <= top || right <= left) return { top: 0, bottom: height, left: 0, right: width };
  return { top, bottom, left, right };
};

export const mergeImagesVertical = async (pages: ProcessedPage[]): Promise<Blob> => {
  if (pages.length === 0) throw new Error("No pages to merge");

  const images = await Promise.all(pages.map(p => loadImage(p.imageUrl)));
  const analyzeCanvas = document.createElement('canvas');
  const analyzeCtx = analyzeCanvas.getContext('2d', { willReadFrequently: true });
  
  if (!analyzeCtx) throw new Error("Context failed");

  const cropInfos: CropInfo[] = [];
  let maxWidth = 0;
  let totalHeight = 0;

  for (const img of images) {
    analyzeCanvas.width = img.width;
    analyzeCanvas.height = img.height;
    analyzeCtx.drawImage(img, 0, 0);
    
    const bounds = getContentBounds(analyzeCtx, img.width, img.height);
    const contentWidth = bounds.right - bounds.left;
    const contentHeight = bounds.bottom - bounds.top;
    
    cropInfos.push(bounds);
    maxWidth = Math.max(maxWidth, contentWidth);
    totalHeight += contentHeight;
  }

  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = maxWidth + 40; 
  finalCanvas.height = totalHeight + 40;

  const ctx = finalCanvas.getContext('2d');
  if (!ctx) throw new Error("Final context failed");

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

  let currentY = 20;
  
  images.forEach((img, i) => {
    const bounds = cropInfos[i];
    const contentWidth = bounds.right - bounds.left;
    const contentHeight = bounds.bottom - bounds.top;
    const targetX = (finalCanvas.width - contentWidth) / 2;
    
    ctx.drawImage(
      img,
      bounds.left, bounds.top, contentWidth, contentHeight,
      targetX, currentY, contentWidth, contentHeight
    );
    currentY += contentHeight;
  });

  return new Promise((resolve, reject) => {
    finalCanvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Blob creation failed"));
    }, 'image/jpeg', 0.90);
  });
};
