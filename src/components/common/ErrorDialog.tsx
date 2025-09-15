import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  details?: string;
  onClose: () => void;
}

export const ErrorDialog: React.FC<ErrorDialogProps> = ({
  isOpen,
  title,
  message,
  details,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 pwa-modal z-[65] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative max-w-2xl w-full max-h-[90vh] bg-white dark:bg-slate-900 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col">
        {/* Dialog Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <X className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h3>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Dialog Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-slate-700 dark:text-slate-300 mb-4 break-words">
            {message}
          </p>
          
          {details && (
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
              <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Details:</h4>
              <div className="max-h-64 overflow-auto">
                <pre className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap font-mono break-words">
                  {details}
                </pre>
              </div>
            </div>
          )}
        </div>
        
        {/* Dialog Footer */}
        <div className="flex justify-end p-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
          <Button
            onClick={onClose}
            className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900"
          >
            OK
          </Button>
        </div>
      </div>
    </div>
  );
};