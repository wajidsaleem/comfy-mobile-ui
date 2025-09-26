/**
 * Video processing utilities for thumbnail extraction
 */

export const isVideoFile = (filename: string): boolean => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return ['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(ext);
};

/**
 * Extract first frame from video as thumbnail image while preserving aspect ratio
 */
export const extractVideoThumbnail = (
  videoFile: File,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    format?: 'png' | 'jpeg';
    quality?: number;
  } = {}
): Promise<File> => {
  return new Promise((resolve, reject) => {
    const {
      maxWidth = 800,
      maxHeight = 600,
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
      // Get original video dimensions
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;

      if (videoWidth === 0 || videoHeight === 0) {
        reject(new Error('Invalid video dimensions'));
        return;
      }

      // Calculate aspect ratio preserving dimensions
      const aspectRatio = videoWidth / videoHeight;
      let canvasWidth = videoWidth;
      let canvasHeight = videoHeight;

      // Scale down if video is larger than max dimensions
      if (canvasWidth > maxWidth || canvasHeight > maxHeight) {
        if (aspectRatio > 1) {
          // Landscape: width is larger
          canvasWidth = Math.min(maxWidth, videoWidth);
          canvasHeight = canvasWidth / aspectRatio;

          // Check if height still exceeds max
          if (canvasHeight > maxHeight) {
            canvasHeight = maxHeight;
            canvasWidth = canvasHeight * aspectRatio;
          }
        } else {
          // Portrait or square: height is larger or equal
          canvasHeight = Math.min(maxHeight, videoHeight);
          canvasWidth = canvasHeight * aspectRatio;

          // Check if width still exceeds max
          if (canvasWidth > maxWidth) {
            canvasWidth = maxWidth;
            canvasHeight = canvasWidth / aspectRatio;
          }
        }
      }

      // Set canvas dimensions (preserve aspect ratio)
      canvas.width = Math.round(canvasWidth);
      canvas.height = Math.round(canvasHeight);

      console.log(`📐 Video thumbnail dimensions: ${videoWidth}x${videoHeight} -> ${canvas.width}x${canvas.height} (aspect ratio: ${aspectRatio.toFixed(2)})`);

      // Seek to first frame
      video.currentTime = 0.1; // Slightly after start to ensure frame is loaded
    });

    video.addEventListener('seeked', () => {
      try {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw video frame to canvas maintaining aspect ratio
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

              console.log(`🖼️ Generated thumbnail: ${thumbnailFilename} (${canvas.width}x${canvas.height}, ${(blob.size / 1024).toFixed(1)}KB)`);

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