import { useState } from 'react';

export interface UploadResult {
  url: string;
  mediaType: 'image' | 'audio' | 'document';
}

export function useFileUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compressImage = (file: File): Promise<Blob | File> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(new File([blob], file.name, { type: 'image/jpeg' }));
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          0.8
        );
      };
      img.onerror = () => {
        resolve(file);
      };
    });
  };

  const uploadFile = async (file: File): Promise<UploadResult | null> => {
    setUploading(true);
    setError(null);

    try {
      // 1. Client-side validations
      const maxSizeBytes = 2 * 1024 * 1024; // 2MB
      if (file.size > maxSizeBytes && !file.type.startsWith('image/')) {
        throw new Error('File size exceeds the 2MB limit');
      }

      // Allowed types check
      let mediaType: 'image' | 'audio' | 'document' | null = null;
      if (file.type.startsWith('image/')) {
        const allowedImages = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedImages.includes(file.type)) {
          throw new Error('Unsupported image format. Allowed: JPEG, PNG, WebP');
        }
        mediaType = 'image';
      } else if (file.type.startsWith('audio/')) {
        mediaType = 'audio';
      } else if (file.type === 'application/pdf') {
        mediaType = 'document';
      } else {
        throw new Error('Unsupported file type. Allowed: JPEG, PNG, WebP, PDF, Audio');
      }

      let fileToUpload = file;
      if (mediaType === 'image') {
        fileToUpload = (await compressImage(file)) as File;
        if (fileToUpload.size > maxSizeBytes) {
          throw new Error('Compressed image still exceeds the 2MB limit');
        }
      }

      const fd = new FormData();
      fd.append('file', fileToUpload);
      fd.append('folder', 'chat-attachments');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: fd,
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Upload failed');
      }

      setUploading(false);
      return {
        url: data.path, // Return storage path
        mediaType,
      };
    } catch (err: any) {
      console.error('[Upload hook] error:', err);
      setError(err?.message || 'Upload failed');
      setUploading(false);
      return null;
    }
  };

  return { uploadFile, uploading, error };
}
