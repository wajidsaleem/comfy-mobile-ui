import React from 'react';
import { useConnectionStore } from '@/ui/store/connectionStore';
import ModelBrowser from './ModelBrowser';

const ModelBrowserPage: React.FC = () => {
  const { url } = useConnectionStore();
  
  return <ModelBrowser serverUrl={url || 'http://localhost:8188'} />;
};

export default ModelBrowserPage;