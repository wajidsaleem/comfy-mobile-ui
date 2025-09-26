import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Settings, Wifi, WifiOff, Server, Download, Upload, RotateCcw, Package, Trash2, HardDrive, FolderOpen, Database, Layers, Video } from 'lucide-react';
import { useConnectionStore } from '@/ui/store/connectionStore';
import { CacheService, CacheClearResult, BrowserCapabilities } from '@/services/cacheService';

interface SideMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onServerSettingsClick: () => void;
  onImportWorkflowsClick: () => void;
  onUploadWorkflowsClick: () => void;
  onServerRebootClick: () => void;
  onModelDownloadClick: () => void;
  onModelBrowserClick: () => void;
  onBrowserDataBackupClick: () => void;
  onWidgetTypeSettingsClick: () => void;
  onVideoDownloadClick: () => void;
}

const SideMenu: React.FC<SideMenuProps> = ({ isOpen, onClose, onServerSettingsClick, onImportWorkflowsClick, onUploadWorkflowsClick, onServerRebootClick, onModelDownloadClick, onModelBrowserClick, onBrowserDataBackupClick, onWidgetTypeSettingsClick, onVideoDownloadClick }) => {
  const { url, isConnected, error } = useConnectionStore();
  const [cacheSize, setCacheSize] = useState<number>(0);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [clearResult, setClearResult] = useState<CacheClearResult | null>(null);
  const [browserCapabilities, setBrowserCapabilities] = useState<BrowserCapabilities | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadCacheSize();
      setBrowserCapabilities(CacheService.getBrowserCapabilities());
    }
  }, [isOpen]);

  const loadCacheSize = async () => {
    try {
      const size = await CacheService.getTotalCacheSize();
      setCacheSize(size);
    } catch (error) {
      console.warn('Failed to load cache size:', error);
    }
  };

  const handleClearCache = async () => {
    setIsClearing(true);
    setClearResult(null);
    
    try {
      const result = await CacheService.clearBrowserCaches();
      setClearResult(result);
      setCacheSize(0);
      
      if (result.success) {
        setTimeout(() => {
          setClearResult(null);
        }, 3000);
      }
    } catch (error) {
      setClearResult({
        success: false,
        clearedCaches: [],
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        totalSize: 0,
        method: 'Error'
      });
    } finally {
      setIsClearing(false);
    }
  };

  const formatUrl = (url: string) => {
    if (!url) return 'Not configured';
    try {
      const urlObj = new URL(url);
      return `${urlObj.hostname}:${urlObj.port}`;
    } catch {
      return url;
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 pwa-modal"
          onClick={onClose}
        />
      )}
      
      {/* Side Menu */}
      <div className={`fixed left-0 top-0 h-full w-80 bg-white/20 dark:bg-slate-800/20 backdrop-blur-xl border-r border-white/20 dark:border-slate-600/20 shadow-2xl shadow-slate-900/10 dark:shadow-slate-900/25 z-50 transform transition-transform duration-300 ease-out flex flex-col relative overflow-hidden ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Gradient Overlay for Enhanced Glass Effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-slate-900/10 pointer-events-none" />
        {/* Header */}
        <div className="relative z-10 flex items-center justify-between p-6 border-b border-white/20 dark:border-slate-600/20">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Settings
          </h2>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 bg-white/20 dark:bg-slate-700/20 backdrop-blur-sm border border-white/30 dark:border-slate-600/30 hover:bg-white/30 dark:hover:bg-slate-700/30 rounded-lg"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content - Made scrollable */}
        <div className="relative z-10 flex-1 overflow-y-auto p-6 space-y-6">
          {/* Server Connection Status */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Server className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Server Connection
              </h3>
            </div>
            
            {/* Connection Status */}
            <div className="p-4 bg-white/10 dark:bg-slate-700/10 backdrop-blur-sm rounded-lg border border-white/20 dark:border-slate-600/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Status
                </span>
                <div className="flex items-center space-x-2">
                  {isConnected ? (
                    <>
                      <Wifi className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                        Connected
                      </Badge>
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-4 w-4 text-red-600 dark:text-red-400" />
                      <Badge variant="destructive">
                        Disconnected
                      </Badge>
                    </>
                  )}
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Server
                </span>
                <span className="text-sm text-slate-600 dark:text-slate-400 max-w-40 truncate">
                  {formatUrl(url)}
                </span>
              </div>

              {error && (
                <div className="p-2 bg-white/10 dark:bg-slate-700/10 border border-white/20 dark:border-slate-600/20 rounded text-sm text-slate-700 dark:text-slate-300">
                  {error}
                </div>
              )}
            </div>

            {/* Action Buttons - Grouped with Separators */}
            <div className="space-y-4">
              {/* Server Management Group */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Server Management
                </h4>
                <Button
                  onClick={onServerSettingsClick}
                  className="w-full justify-start bg-white/10 dark:bg-slate-700/10 backdrop-blur-sm border border-white/20 dark:border-slate-600/20 text-slate-700 dark:text-slate-300 hover:bg-white/20 dark:hover:bg-slate-700/20 hover:border-white/30 dark:hover:border-slate-600/30"
                >
                  <Settings className="h-4 w-4 mr-3" />
                  Server Settings
                </Button>
                
                <Button
                  onClick={onServerRebootClick}
                  variant="outline"
                  className="w-full justify-start bg-white/10 dark:bg-slate-700/10 backdrop-blur-sm border border-white/20 dark:border-slate-600/20 text-slate-700 dark:text-slate-300 hover:bg-white/20 dark:hover:bg-slate-700/20 hover:border-white/30 dark:hover:border-slate-600/30"
                >
                  <RotateCcw className="h-4 w-4 mr-3" />
                  Server Reboot
                </Button>
              </div>

              {/* Separator */}
              <div className="border-t border-white/20 dark:border-slate-600/20"></div>

              {/* Workflow Management Group */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Workflow Sync
                </h4>
                <Button
                  onClick={onImportWorkflowsClick}
                  variant="outline"
                  className="w-full justify-start bg-white/10 dark:bg-slate-700/10 backdrop-blur-sm border border-white/20 dark:border-slate-600/20 text-slate-700 dark:text-slate-300 hover:bg-white/20 dark:hover:bg-slate-700/20 hover:border-white/30 dark:hover:border-slate-600/30"
                >
                  <Download className="h-4 w-4 mr-3" />
                  Import from ComfyUI
                </Button>
                
                <Button
                  onClick={onUploadWorkflowsClick}
                  variant="outline"
                  className="w-full justify-start bg-white/10 dark:bg-slate-700/10 backdrop-blur-sm border border-white/20 dark:border-slate-600/20 text-slate-700 dark:text-slate-300 hover:bg-white/20 dark:hover:bg-slate-700/20 hover:border-white/30 dark:hover:border-slate-600/30"
                >
                  <Upload className="h-4 w-4 mr-3" />
                  Upload to ComfyUI
                </Button>
              </div>

              {/* Separator */}
              <div className="border-t border-white/20 dark:border-slate-600/20"></div>

              {/* Model Management Group */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Model Management
                </h4>
                <Button
                  onClick={onModelDownloadClick}
                  variant="outline"
                  className="w-full justify-start bg-white/10 dark:bg-slate-700/10 backdrop-blur-sm border-white/20 dark:border-slate-600/20 text-slate-700 dark:text-slate-300 hover:bg-white/20 dark:hover:bg-slate-700/20 hover:border-white/30 dark:hover:border-slate-600/30"
                >
                  <Package className="h-4 w-4 mr-3" />
                  Model Download
                </Button>
                
                <Button
                  onClick={onModelBrowserClick}
                  variant="outline"
                  className="w-full justify-start bg-white/10 dark:bg-slate-700/10 backdrop-blur-sm border-white/20 dark:border-slate-600/20 text-slate-700 dark:text-slate-300 hover:bg-white/20 dark:hover:bg-slate-700/20 hover:border-white/30 dark:hover:border-slate-600/30"
                >
                  <FolderOpen className="h-4 w-4 mr-3" />
                  Model Browser
                </Button>
              </div>

              {/* Separator */}
              <div className="border-t border-white/20 dark:border-slate-600/20"></div>

              {/* Helper Tools Group */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Helper Tools
                </h4>
                <Button
                  onClick={onVideoDownloadClick}
                  variant="outline"
                  className="w-full justify-start bg-white/10 dark:bg-slate-700/10 backdrop-blur-sm border-white/20 dark:border-slate-600/20 text-slate-700 dark:text-slate-300 hover:bg-white/20 dark:hover:bg-slate-700/20 hover:border-white/30 dark:hover:border-slate-600/30"
                >
                  <Video className="h-4 w-4 mr-3" />
                  Video Downloader
                </Button>
              </div>

              {/* Separator */}
              <div className="border-t border-white/20 dark:border-slate-600/20"></div>

              {/* System Management Group */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  System Tools
                </h4>
                <Button
                  onClick={onWidgetTypeSettingsClick}
                  variant="outline"
                  className="w-full justify-start bg-white/10 dark:bg-slate-700/10 backdrop-blur-sm border-white/20 dark:border-slate-600/20 text-slate-700 dark:text-slate-300 hover:bg-white/20 dark:hover:bg-slate-700/20 hover:border-white/30 dark:hover:border-slate-600/30"
                >
                  <Layers className="h-4 w-4 mr-3" />
                  Node Patches
                </Button>

                <Button
                  onClick={onBrowserDataBackupClick}
                  variant="outline"
                  className="w-full justify-start bg-white/10 dark:bg-slate-700/10 backdrop-blur-sm border-white/20 dark:border-slate-600/20 text-slate-700 dark:text-slate-300 hover:bg-white/20 dark:hover:bg-slate-700/20 hover:border-white/30 dark:hover:border-slate-600/30"
                >
                  <Database className="h-4 w-4 mr-3" />
                  Browser Data Backup
                </Button>
              </div>
            </div>
          </div>

          {/* App Cache Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <HardDrive className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                App Cache
              </h3>
            </div>

            {/* Cache Info */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Cache Size
                </span>
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {CacheService.formatCacheSize(cacheSize)}
                </span>
              </div>

              {/* Browser Compatibility Info */}
              {browserCapabilities && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Browser
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      {browserCapabilities.browserName}
                    </span>
                    <Badge 
                      variant={browserCapabilities.supportsCacheAPI ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {browserCapabilities.supportsCacheAPI ? "Full Support" : "Limited"}
                    </Badge>
                  </div>
                </div>
              )}

              {clearResult && (
                <div className={`p-2 border rounded text-sm ${
                  clearResult.success 
                    ? 'bg-white/10 dark:bg-slate-700/10 border-white/20 dark:border-slate-600/20 text-slate-700 dark:text-slate-300'
                    : 'bg-white/10 dark:bg-slate-700/10 border-white/20 dark:border-slate-600/20 text-slate-700 dark:text-slate-300'
                }`}>
                  {clearResult.success ? (
                    <div className="space-y-1">
                      <div>
                        Method: {clearResult.method}
                      </div>
                      {clearResult.clearedCaches.length > 0 ? (
                        <div>
                          Cleared: {clearResult.clearedCaches.join(', ')}
                          {clearResult.totalSize > 0 && (
                            <> ({CacheService.formatCacheSize(clearResult.totalSize)} freed)</>
                          )}
                        </div>
                      ) : (
                        <div>Cache cleared successfully</div>
                      )}
                      {clearResult.method === 'Safari Compatible' && (
                        <div className="text-xs text-green-500 dark:text-green-400 mt-1">
                          For complete cache clearing in Safari, use: Settings → Safari → Clear History and Website Data
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      Cache clear failed: {clearResult.errors[0]}
                      {browserCapabilities?.isSafari && (
                        <div className="text-xs text-red-400 mt-1">
                          Safari users can manually clear cache: Settings → Safari → Clear History and Website Data
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Safari Warning */}
              {browserCapabilities?.isSafari && !browserCapabilities.supportsCacheAPI && !clearResult && (
                <div className="p-2 bg-white/10 dark:bg-slate-700/10 border border-white/20 dark:border-slate-600/20 rounded text-sm text-slate-700 dark:text-slate-300">
                  <div className="font-medium">Safari Note:</div>
                  <div className="text-xs mt-1">
                    Limited cache API support. For complete cache clearing, use Safari Settings → Clear History and Website Data
                  </div>
                </div>
              )}
            </div>

            {/* Cache Actions */}
            <div className="space-y-3">
              <Button
                onClick={handleClearCache}
                disabled={isClearing}
                variant="outline"
                className="w-full justify-start bg-white/10 dark:bg-slate-700/10 backdrop-blur-sm border-white/20 dark:border-slate-600/20 text-slate-700 dark:text-slate-300 hover:bg-white/20 dark:hover:bg-slate-700/20 hover:border-white/30 dark:hover:border-slate-600/30 disabled:opacity-50"
              >
                {isClearing ? (
                  <>
                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-red-700 border-t-transparent" />
                    Clearing Cache...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-3" />
                    {browserCapabilities?.isSafari && !browserCapabilities.supportsCacheAPI 
                      ? "Clear Cache (Limited)"
                      : "Clear App Cache"
                    }
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* App Information */}
          <div className="pt-6 border-t border-slate-200/50 dark:border-slate-700/50">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                ComfyUI Mobile
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Mobile-first interface for ComfyUI workflows
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-500">
                Version 1.0.0
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SideMenu;