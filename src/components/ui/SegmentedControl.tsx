import React from 'react';

interface SegmentedControlItem {
  value: string | number;
  label: string;
  icon?: React.ReactNode;
  color?: string;
}

interface SegmentedControlProps {
  items: SegmentedControlItem[];
  value: string | number;
  onChange: (value: string | number) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
}

export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  items,
  value,
  onChange,
  size = 'md',
  className = '',
  disabled = false
}) => {
  const sizeClasses = {
    sm: 'h-8 text-xs px-2',
    md: 'h-12 text-sm px-3',
    lg: 'h-14 text-base px-4'
  };

  const selectedIndex = items.findIndex(item => item.value === value);
  
  // Get theme background color based on selected value
  const getSelectedBackgroundColor = (selectedValue: string | number) => {
    switch (selectedValue) {
      case 0: // Always - Green theme
        return 'bg-green-100 dark:bg-green-800/60 border border-green-200/50 dark:border-green-700/50';
      case 2: // Mute - Blue theme
        return 'bg-blue-100 dark:bg-blue-800/60 border border-blue-200/50 dark:border-blue-700/50';
      case 4: // Bypass - Purple theme
        return 'bg-purple-100 dark:bg-purple-800/60 border border-purple-200/50 dark:border-purple-700/50';
      default:
        return 'bg-white dark:bg-slate-800';
    }
  };
  
  // Get theme text color for selected item
  const getSelectedTextColor = (selectedValue: string | number) => {
    switch (selectedValue) {
      case 0: // Always - Green theme
        return 'text-green-800 dark:text-green-100';
      case 2: // Mute - Blue theme
        return 'text-blue-800 dark:text-blue-100';
      case 4: // Bypass - Purple theme
        return 'text-purple-800 dark:text-purple-100';
      default:
        return 'text-slate-900 dark:text-slate-100';
    }
  };

  return (
    <div 
      className={`
        relative flex items-stretch
        bg-slate-800/50 dark:bg-slate-900/50 
        backdrop-blur-sm
        border border-slate-600/60 dark:border-slate-700/60
        rounded-lg p-0.5 
        ${sizeClasses[size]}
        ${disabled ? 'opacity-50 pointer-events-none' : ''}
        ${className}
      `}
    >
      {/* Sliding background indicator with theme colors */}
      {selectedIndex >= 0 && (
        <div
          className={`absolute top-0.5 bottom-0.5 rounded-md shadow-sm transition-all duration-300 ease-out ${getSelectedBackgroundColor(value)}`}
          style={{
            left: `calc(${selectedIndex * 100 / items.length}% + 0.125rem)`,
            width: `calc(${100 / items.length}% - 0.25rem)`
          }}
        />
      )}
      
      {/* Buttons */}
      {items.map((item, index) => {
        const isSelected = item.value === value;
        
        return (
          <button
            key={item.value}
            onClick={() => !disabled && onChange(item.value)}
            className={`
              relative z-10 flex-1 flex items-center justify-center
              transition-all duration-300 ease-out
              rounded-md
              ${!disabled ? 'cursor-pointer' : 'cursor-default'}
              ${isSelected 
                ? `${getSelectedTextColor(value)} font-bold` 
                : 'text-slate-600 dark:text-slate-400 font-medium hover:text-slate-800 dark:hover:text-slate-200'
              }
            `}
            disabled={disabled}
          >
            <span className="truncate">
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};