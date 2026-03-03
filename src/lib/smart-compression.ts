/**
 * Smart Compression & Tiered Storage System
 * Automatically selects compression quality based on subscription tier
 */

export type CompressionTier = 'basic' | 'standard' | 'premium';

interface CompressionConfig {
  maxImageWidth: number;
  maxImageHeight: number;
  imageQuality: number;
  maxVideoSizeMB: number;
  label: string;
}

const TIER_CONFIGS: Record<CompressionTier, CompressionConfig> = {
  basic: {
    maxImageWidth: 1280,
    maxImageHeight: 720,
    imageQuality: 0.6,
    maxVideoSizeMB: 5,
    label: 'Basic (720p)',
  },
  standard: {
    maxImageWidth: 1920,
    maxImageHeight: 1080,
    imageQuality: 0.8,
    maxVideoSizeMB: 15,
    label: 'Standard (1080p)',
  },
  premium: {
    maxImageWidth: 3840,
    maxImageHeight: 2160,
    imageQuality: 0.92,
    maxVideoSizeMB: 50,
    label: 'Premium (4K)',
  },
};

export function getCompressionConfig(tier: CompressionTier): CompressionConfig {
  return TIER_CONFIGS[tier];
}

/**
 * Smart image compression based on subscription tier
 */
export async function smartCompressImage(file: File, tier: CompressionTier): Promise<{ file: File; stats: CompressionStats }> {
  const config = TIER_CONFIGS[tier];
  const originalSize = file.size;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      let { width, height } = img;

      // Scale down if exceeds tier limits
      if (width > config.maxImageWidth || height > config.maxImageHeight) {
        const ratio = Math.min(config.maxImageWidth / width, config.maxImageHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;

      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to compress image'));
            return;
          }

          const compressedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });

          const stats: CompressionStats = {
            originalSize,
            compressedSize: compressedFile.size,
            ratio: compressedFile.size / originalSize,
            tier: config.label,
            dimensions: `${width}×${height}`,
          };

          resolve({ file: compressedFile, stats });
        },
        'image/jpeg',
        config.imageQuality,
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

export interface CompressionStats {
  originalSize: number;
  compressedSize: number;
  ratio: number;
  tier: string;
  dimensions: string;
}

/**
 * Check if a video file is within tier limits
 */
export function isVideoWithinTierLimits(file: File, tier: CompressionTier): { allowed: boolean; maxSizeMB: number; fileSizeMB: number } {
  const config = TIER_CONFIGS[tier];
  const fileSizeMB = file.size / (1024 * 1024);
  return {
    allowed: fileSizeMB <= config.maxVideoSizeMB,
    maxSizeMB: config.maxVideoSizeMB,
    fileSizeMB: Math.round(fileSizeMB * 10) / 10,
  };
}

/**
 * Format compression stats for display
 */
export function formatCompressionStats(stats: CompressionStats): string {
  const savedPercent = Math.round((1 - stats.ratio) * 100);
  const originalMB = (stats.originalSize / (1024 * 1024)).toFixed(1);
  const compressedMB = (stats.compressedSize / (1024 * 1024)).toFixed(1);
  return `${originalMB}MB → ${compressedMB}MB (${savedPercent}% saved) • ${stats.tier}`;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
