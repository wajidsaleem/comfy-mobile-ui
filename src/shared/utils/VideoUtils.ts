/**
 * Video processing utilities for thumbnail extraction
 */

export const isVideoFile = (filename: string): boolean => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return ['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(ext);
};

/**
 * Extract first frame from video as thumbnail image
 */
export const extractVideoThumbnail = (
  videoFile: File, 
  options: {
    width?: number;
    height?: number;
    format?: 'png' | 'jpeg';
    quality?: number;
  } = {}
): Promise<File> => {
  return new Promise((resolve, reject) => {
    const {
      width = 320,
      height = 240,
      format = 'png',
      quality = 0.8
    } = options;

    // Create video element
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    // Create canvas for frame extraction
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Could not create canvas context'));
      return;
    }

    // Handle video load
    video.addEventListener('loadedmetadata', () => {
      // Set canvas size
      canvas.width = width;
      canvas.height = height;
      
      // Seek to first frame
      video.currentTime = 0.1; // Slightly after start to ensure frame is loaded
    });

    video.addEventListener('seeked', () => {
      try {
        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas to blob
        const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              // Generate thumbnail filename
              const originalName = videoFile.name;
              const nameWithoutExt = originalName.substring(0, originalName.lastIndexOf('.'));
              const thumbnailFilename = `${nameWithoutExt}.${format}`;
              
              // Create File object from blob
              const thumbnailFile = new File([blob], thumbnailFilename, {
                type: mimeType,
                lastModified: Date.now()
              });
              
              // Cleanup
              video.removeAttribute('src');
              video.load();
              URL.revokeObjectURL(video.src);
              
              resolve(thumbnailFile);
            } else {
              reject(new Error('Failed to create thumbnail blob'));
            }
          },
          mimeType,
          format === 'jpeg' ? quality : undefined
        );
      } catch (error) {
        reject(error);
      }
    });

    video.addEventListener('error', (e) => {
      reject(new Error(`Video loading error: ${e.message || 'Unknown error'}`));
    });

    // Load video
    const videoUrl = URL.createObjectURL(videoFile);
    video.src = videoUrl;
  });
};