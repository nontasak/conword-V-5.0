import * as pdfjsLib from 'pdfjs-dist';

const PDFJS_VERSION = pdfjsLib.version;
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

export const getPDFDocument = async (fileData: ArrayBuffer) => {
  const loadingTask = pdfjsLib.getDocument({ data: fileData });
  return await loadingTask.promise;
};

export const renderPageToImage = async (
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  scale = 2
): Promise<{ blob: Blob; url: string; width: number; height: number }> => {
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  if (!context) throw new Error('Could not get canvas context');
  
  canvas.height = viewport.height;
  canvas.width = viewport.width;

  context.fillStyle = '#FFFFFF';
  context.fillRect(0, 0, canvas.width, canvas.height);
  
  const renderContext: any = {
    canvasContext: context,
    viewport: viewport,
  };
  
  await page.render(renderContext).promise;
  
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas to Blob failed'));
        return;
      }
      const url = URL.createObjectURL(blob);
      resolve({
        blob,
        url,
        width: viewport.width,
        height: viewport.height
      });
    }, 'image/jpeg', 0.9);
  });
};
