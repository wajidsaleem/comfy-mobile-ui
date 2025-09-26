/**
 * Gallery permission utilities for determining what file types should be allowed
 * when opening OutputsGallery for file selection
 */

import { isImageFile, isVideoFile } from './ComfyFileUtils';

export interface GalleryPermissions {
  allowImages: boolean;
  allowVideos: boolean;
}

/**
 * Determines what file types should be allowed in OutputsGallery based on parameter context
 *
 * Rules:
 * - Images: Always allowed
 * - Videos: Allowed if:
 *   1. Parameter name contains 'video', OR
 *   2. Current value has video file extension, OR
 *   3. Parameter has video extensions in possible values
 *
 * @param paramName - The parameter name (e.g., 'video_input', 'image_file')
 * @param currentValue - The current parameter value (may be a filename)
 * @param possibleValues - Array of possible values for the parameter
 * @returns Object with allowImages and allowVideos flags
 */
export const getGalleryPermissions = (
  paramName: string,
  currentValue: any = null,
  possibleValues: any[] = []
): GalleryPermissions => {
  const name = paramName.toLowerCase();

  // Always allow images
  const allowImages = true;

  // Allow videos if:
  // 1. Parameter name contains 'video'
  if (name.includes('video')) {
    return { allowImages, allowVideos: true };
  }

  // 2. Current value has video file extension
  if (currentValue && typeof currentValue === 'string' && isVideoFile(currentValue)) {
    return { allowImages, allowVideos: true };
  }

  // 3. Possible values contain video file extensions
  const hasVideoExtensions = possibleValues.some((value: any) => {
    const str = String(value).toLowerCase();
    return str.match(/\.(mp4|webm|avi|mov|mkv|flv|wmv|mpg|mpeg)$/);
  });

  if (hasVideoExtensions) {
    return { allowImages, allowVideos: true };
  }

  // Default: images only
  return { allowImages, allowVideos: false };
};

/**
 * Legacy function for parameter type detection (used by NodeParameterEditor)
 * Returns 'VIDEO' if videos should be allowed, 'IMAGE' if images only
 *
 * @param paramName - The parameter name
 * @param currentValue - The current parameter value
 * @param possibleValues - Array of possible values for the parameter
 * @param excludedNames - Names to exclude from detection (e.g., model names)
 * @returns 'VIDEO' | 'IMAGE' | null
 */
export const detectParameterTypeForGallery = (
  paramName: string,
  currentValue: any = null,
  possibleValues: any[] = [],
  excludedNames: string[] = ['clip_name', 'ckpt_name', 'model_name', 'lora_name', 'vae_name', 'upscale_model_name', 'controlnet_name']
): 'VIDEO' | 'IMAGE' | null => {
  const name = paramName.toLowerCase();

  // Exclude model/config parameter names
  if (excludedNames.includes(name)) {
    return null;
  }

  const permissions = getGalleryPermissions(paramName, currentValue, possibleValues);

  // If videos are allowed, return 'VIDEO' (which will allow both images and videos in the UI)
  if (permissions.allowVideos) {
    return 'VIDEO';
  }

  // Check if this looks like an image/video parameter at all
  const hasImageExtensions = possibleValues.some((value: any) => {
    const str = String(value).toLowerCase();
    return str.match(/\.(png|jpg|jpeg|gif|webp|bmp|svg)$/);
  });

  if (hasImageExtensions) {
    return 'IMAGE'; // Images only
  }

  return null; // Not an image/video parameter
};