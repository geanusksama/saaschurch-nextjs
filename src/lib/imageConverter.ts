export const loadHeic2Any = async (): Promise<any> => {
  if (typeof window === 'undefined') return null;
  if ((window as any).heic2any) return (window as any).heic2any;

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';
    script.onload = () => resolve((window as any).heic2any);
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });
};

export async function convertToJpeg(file: File, maxDimension = 2048, quality = 0.8): Promise<File> {
  // If it is not an image, return it unchanged (e.g., PDF)
  const nameLower = file.name.toLowerCase();
  const isHeic = nameLower.endsWith('.heic') || nameLower.endsWith('.heif') || file.type.includes('heic') || file.type.includes('heif');
  const isStandardImg = file.type.startsWith('image/') || nameLower.endsWith('.jpg') || nameLower.endsWith('.jpeg') || nameLower.endsWith('.png') || nameLower.endsWith('.webp') || nameLower.endsWith('.bmp') || nameLower.endsWith('.tiff') || nameLower.endsWith('.gif');

  if (!isHeic && !isStandardImg) {
    return file;
  }

  let imageBlob: Blob = file;

  if (isHeic) {
    try {
      const heic2any = await loadHeic2Any();
      if (heic2any) {
        const converted = await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: quality,
        });
        imageBlob = Array.isArray(converted) ? converted[0] : converted;
      }
    } catch (err) {
      console.error('Erro ao converter HEIC client-side, prosseguindo com original:', err);
    }
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(imageBlob);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      
      let width = img.width;
      let height = img.height;
      
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const newFileName = file.name.replace(/\.[^/.]+$/, '.jpg');
              resolve(new File([blob], newFileName, { type: 'image/jpeg' }));
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      } else {
        resolve(file);
      }
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    
    img.src = url;
  });
}
