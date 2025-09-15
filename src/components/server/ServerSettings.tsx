import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Wifi, WifiOff, Loader2, Server, TestTube, CheckCircle, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useConnectionStore } from '@/ui/store/connectionStore';

interface ServerSettingsProps {
  onBack?: () => void;
}

const ServerSettings: React.FC<ServerSettingsProps> = ({ onBack }) => {
  const navigate = useNavigate();
  const { 
    url, 
    isConnected, 
    isConnecting, 
    error, 
    setUrl, 
    connect, 
    disconnect,
    setError 
  } = useConnectionStore();

  const [inputUrl, setInputUrl] = useState(url);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    setInputUrl(url);
  }, [url]);

  const validateUrl = (url: string): { isValid: boolean; message?: string } => {
    if (!url.trim()) {
      return { isValid: false, message: 'URL is required' };
    }

    try {
      const urlObj = new URL(url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return { isValid: false, message: 'URL must use HTTP or HTTPS protocol' };
      }
      return { isValid: true };
    } catch {
      return { isValid: false, message: 'Invalid URL format' };
    }
  };

  const handleUrlChange = (value: string) => {
    setInputUrl(value);
    setTestResult(null);
    setError(null);
  };

  const handleTestConnection = async () => {
    const validation = validateUrl(inputUrl);
    if (!validation.isValid) {
      setTestResult({ success: false, message: validation.message || 'Invalid URL' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    
    try {
      // Temporarily set URL for testing
      setUrl(inputUrl);
      
      // Test connection
      await connect();
      
      setTestResult({ 
        success: true, 
        message: 'Connection successful! ComfyUI server is reachable.' 
      });
    } catch (error) {
      setTestResult({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Connection failed' 
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    const validation = validateUrl(inputUrl);
    if (!validation.isValid) {
      setTestResult({ success: false, message: validation.message || 'Invalid URL' });
      return;
    }

    setUrl(inputUrl);
    setTestResult({ 
      success: true, 
      message: 'Server URL saved successfully!' 
    });
  };

  const handleConnect = async () => {
    if (inputUrl !== url) {
      handleSave();
    }
    
    try {
      await connect();
    } catch (error) {
      console.error('Connection failed:', error);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setTestResult(null);
  };


  const getDefaultUrls = () => [
    'http://127.0.0.1:8188',
    'http://localhost:8188',
    'http://192.168.1.100:8188', // Common local network IP
  ];

  return (
    <div className="pwa-container bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/20 dark:bg-slate-800/20 backdrop-blur-xl border-b border-white/20 dark:border-slate-600/20 shadow-2xl shadow-slate-900/10 dark:shadow-slate-900/25 relative overflow-hidden pwa-header">
        {/* Gradient Overlay for Enhanced Glass Effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-slate-900/10 pointer-events-none" />
        <div className="relative flex items-center space-x-4 p-4 z-10">
          <Button
            onClick={() => onBack ? onBack() : navigate('/')}
            variant="outline"
            size="sm"
            className="bg-white/20 dark:bg-slate-700/20 backdrop-blur-sm border border-white/30 dark:border-slate-600/30 shadow-lg hover:shadow-xl hover:bg-white/30 dark:hover:bg-slate-700/30 transition-all duration-300 h-10 w-10 p-0 flex-shrink-0 rounded-lg"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Server Settings
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Configure your ComfyUI server connection
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-6 py-8 max-w-2xl">
        {/* Connection Status */}
        <div className="mb-8 p-6 bg-white/70 backdrop-blur-sm border border-slate-200/50 rounded-lg shadow-sm dark:bg-slate-900/70 dark:border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Server className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Connection Status
              </h2>
            </div>
            <div className="flex items-center space-x-2">
              {isConnected ? (
                <>
                  <Wifi className="h-4 w-4 text-green-500" />
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                    Connected
                  </Badge>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-red-500" />
                  <Badge variant="destructive">
                    Disconnected
                  </Badge>
                </>
              )}
            </div>
          </div>
          
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Server Configuration */}
        <div className="space-y-6">
          <div className="p-6 bg-white/70 backdrop-blur-sm border border-slate-200/50 rounded-lg shadow-sm dark:bg-slate-900/70 dark:border-slate-700/50">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Server Configuration
            </h2>
            
            {/* URL Input */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                ComfyUI Server URL
              </label>
              <Input
                type="url"
                value={inputUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="http://127.0.0.1:8188"
                className="text-base"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Enter the full URL of your ComfyUI server including protocol and port
              </p>
            </div>

            {/* Quick URL Options */}
            <div className="mt-4">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                Quick Options
              </label>
              <div className="flex flex-wrap gap-2">
                {getDefaultUrls().map((defaultUrl) => (
                  <Button
                    key={defaultUrl}
                    variant="outline"
                    size="sm"
                    onClick={() => handleUrlChange(defaultUrl)}
                    className="text-xs"
                  >
                    {defaultUrl}
                  </Button>
                ))}
              </div>
            </div>

            {/* Test Result */}
            {testResult && (
              <div className={`mt-4 p-3 rounded border ${
                testResult.success
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
              }`}>
                <div className="flex items-center space-x-2">
                  {testResult.success ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  <span className="text-sm">{testResult.message}</span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3 mt-6">
              <Button
                onClick={handleTestConnection}
                disabled={isTesting || isConnecting}
                variant="outline"
                className="flex-1"
              >
                {isTesting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4 mr-2" />
                )}
                {isTesting ? 'Testing...' : 'Test Connection'}
              </Button>
              
              <Button
                onClick={handleSave}
                disabled={inputUrl === url}
                variant="outline"
                className="flex-1"
              >
                Save URL
              </Button>
            </div>

            {/* Connect/Disconnect Button */}
            <div className="mt-4">
              {isConnected ? (
                <Button
                  onClick={handleDisconnect}
                  variant="destructive"
                  className="w-full"
                >
                  <WifiOff className="h-4 w-4 mr-2" />
                  Disconnect
                </Button>
              ) : (
                <Button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white"
                >
                  {isConnecting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Wifi className="h-4 w-4 mr-2" />
                  )}
                  {isConnecting ? 'Connecting...' : 'Connect'}
                </Button>
              )}
            </div>
          </div>


          {/* Connection Help */}
          <div className="p-6 bg-white/70 backdrop-blur-sm border border-slate-200/50 rounded-lg shadow-sm dark:bg-slate-900/70 dark:border-slate-700/50">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">
              Connection Help
            </h3>
            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <p>• Make sure ComfyUI is running on your server</p>
              <p>• Default ComfyUI port is usually 8188</p>
              <p>• For local connections, try http://127.0.0.1:8188</p>
              <p>• For network connections, use your server's IP address</p>
              <p>• Ensure CORS is enabled if connecting from a different domain</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServerSettings;