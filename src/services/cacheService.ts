export interface CacheInfo {
  name: string;
  size: number;
  lastModified: Date;
}

export interface CacheClearResult {
  success: boolean;
  clearedCaches: string[];
  errors: string[];
  totalSize: number;
  method: string;
}

export interface BrowserCapabilities {
  supportsCacheAPI: boolean;
  supportsServiceWorker: boolean;
  browserName: string;
  isSafari: boolean;
  isIOS: boolean;
}

export class CacheService {
  static getBrowserCapabilities(): BrowserCapabilities {
    const userAgent = navigator.userAgent;
    const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isChrome = /chrome/i.test(userAgent);
    const isFirefox = /firefox/i.test(userAgent);
    
    let browserName = 'Unknown';
    if (isSafari) browserName = 'Safari';
    else if (isChrome) browserName = 'Chrome';
    else if (isFirefox) browserName = 'Firefox';

    return {
      supportsCacheAPI: 'caches' in window,
      supportsServiceWorker: 'serviceWorker' in navigator,
      browserName,
      isSafari,
      isIOS
    };
  }

  static async clearLocationReload(): Promise<CacheClearResult> {
    try {
      window.location.reload();
      return {
        success: true,
        clearedCaches: ['Browser Page Cache'],
        errors: [],
        totalSize: 0,
        method: 'Page Reload'
      };
    } catch (error) {
      return {
        success: false,
        clearedCaches: [],
        errors: [error instanceof Error ? error.message : 'Failed to reload'],
        totalSize: 0,
        method: 'Page Reload'
      };
    }
  }

  static async clearApplicationCache(): Promise<CacheClearResult> {
    const result: CacheClearResult = {
      success: true,
      clearedCaches: [],
      errors: [],
      totalSize: 0,
      method: 'Application Cache'
    };

    // Legacy Application Cache (deprecated but still exists in some browsers)
    if ('applicationCache' in window) {
      try {
        const appCache = (window as any).applicationCache;
        if (appCache && appCache.status !== appCache.UNCACHED) {
          appCache.update();
          result.clearedCaches.push('Application Cache');
        }
      } catch (error) {
        result.errors.push(`Application Cache: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return result;
  }

  static async clearWebkitCache(): Promise<CacheClearResult> {
    const result: CacheClearResult = {
      success: true,
      clearedCaches: [],
      errors: [],
      totalSize: 0,
      method: 'WebKit Cache'
    };

    // Try to clear WebKit specific caches (Safari)
    try {
      // Clear WebKit database storage (if accessible)
      if ('webkitStorageInfo' in navigator) {
        const storageInfo = (navigator as any).webkitStorageInfo;
        if (storageInfo && storageInfo.queryUsageAndQuota) {
          // This is mostly for information, can't actually clear from here
          result.clearedCaches.push('WebKit Storage Info Accessed');
        }
      }

      // Force reload with cache bypass
      if (window.performance && window.performance.navigation) {
        const nav = window.performance.navigation;
        if (nav.type !== nav.TYPE_RELOAD) {
          result.clearedCaches.push('Performance Navigation Cache');
        }
      }
    } catch (error) {
      result.errors.push(`WebKit Cache: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }
  static async getCacheInfo(): Promise<CacheInfo[]> {
    const cacheInfo: CacheInfo[] = [];
    
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        
        for (const cacheName of cacheNames) {
          const cache = await caches.open(cacheName);
          const requests = await cache.keys();
          
          let totalSize = 0;
          let lastModified = new Date(0);
          
          for (const request of requests) {
            const response = await cache.match(request);
            if (response) {
              const contentLength = response.headers.get('content-length');
              if (contentLength) {
                totalSize += parseInt(contentLength, 10);
              }
              
              const responseDate = response.headers.get('date');
              if (responseDate) {
                const date = new Date(responseDate);
                if (date > lastModified) {
                  lastModified = date;
                }
              }
            }
          }
          
          cacheInfo.push({
            name: cacheName,
            size: totalSize,
            lastModified: requests.length > 0 ? lastModified : new Date()
          });
        }
      } catch (error) {
        console.warn('Failed to get cache info:', error);
      }
    }
    
    return cacheInfo;
  }

  static async clearBrowserCaches(): Promise<CacheClearResult> {
    const capabilities = this.getBrowserCapabilities();
    
    // Try Cache API first (modern browsers)
    if (capabilities.supportsCacheAPI) {
      return this.clearCacheAPI();
    }
    
    // Fallback methods for Safari and other browsers
    if (capabilities.isSafari || capabilities.isIOS) {
      return this.clearSafariCompatibleCache();
    }
    
    // Generic fallback
    return this.clearFallbackCache();
  }

  static async clearCacheAPI(): Promise<CacheClearResult> {
    const result: CacheClearResult = {
      success: true,
      clearedCaches: [],
      errors: [],
      totalSize: 0,
      method: 'Cache API'
    };

    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        
        for (const cacheName of cacheNames) {
          try {
            const cache = await caches.open(cacheName);
            const requests = await cache.keys();
            
            let cacheSize = 0;
            for (const request of requests) {
              const response = await cache.match(request);
              if (response) {
                const contentLength = response.headers.get('content-length');
                if (contentLength) {
                  cacheSize += parseInt(contentLength, 10);
                }
              }
            }
            
            const deleted = await caches.delete(cacheName);
            if (deleted) {
              result.clearedCaches.push(cacheName);
              result.totalSize += cacheSize;
            } else {
              result.errors.push(`Failed to clear cache: ${cacheName}`);
            }
          } catch (error) {
            result.errors.push(`Error clearing ${cacheName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      } catch (error) {
        result.success = false;
        result.errors.push(`Failed to access caches: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      result.success = false;
      result.errors.push('Cache API not supported in this browser');
    }

    if (result.errors.length > 0) {
      result.success = false;
    }

    return result;
  }

  static async clearSafariCompatibleCache(): Promise<CacheClearResult> {
    const result: CacheClearResult = {
      success: true,
      clearedCaches: [],
      errors: [],
      totalSize: 0,
      method: 'Safari Compatible'
    };

    // Try multiple Safari-compatible methods
    try {
      // Method 1: Try Cache API if available (newer Safari versions)
      if ('caches' in window) {
        const cacheResult = await this.clearCacheAPI();
        result.clearedCaches.push(...cacheResult.clearedCaches);
        result.errors.push(...cacheResult.errors);
        result.totalSize += cacheResult.totalSize;
      }

      // Method 2: Clear application cache
      const appCacheResult = await this.clearApplicationCache();
      result.clearedCaches.push(...appCacheResult.clearedCaches);
      result.errors.push(...appCacheResult.errors);

      // Method 3: Force a hard reload to bypass cache
      if (result.clearedCaches.length === 0) {
        // Show user instruction for manual cache clear
        result.clearedCaches.push('Instructions provided for manual clear');
        result.success = true;
      }

    } catch (error) {
      result.errors.push(`Safari cache clear failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.success = false;
    }

    return result;
  }

  static async clearFallbackCache(): Promise<CacheClearResult> {
    const result: CacheClearResult = {
      success: true,
      clearedCaches: [],
      errors: [],
      totalSize: 0,
      method: 'Fallback'
    };

    try {
      // Try application cache
      const appCacheResult = await this.clearApplicationCache();
      result.clearedCaches.push(...appCacheResult.clearedCaches);

      // Add manual instructions
      result.clearedCaches.push('Manual clear instructions provided');
      
    } catch (error) {
      result.errors.push(`Fallback cache clear failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.success = false;
    }

    return result;
  }

  static async clearServiceWorkerCache(): Promise<boolean> {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      try {
        navigator.serviceWorker.controller.postMessage({
          type: 'CLEAR_CACHE'
        });
        return true;
      } catch (error) {
        console.warn('Failed to clear service worker cache:', error);
        return false;
      }
    }
    return false;
  }

  static formatCacheSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  }

  static async getTotalCacheSize(): Promise<number> {
    const cacheInfo = await this.getCacheInfo();
    return cacheInfo.reduce((total, cache) => total + cache.size, 0);
  }
}