import { useEffect } from 'react';

interface OriginalStyles {
  html: {
    overscrollBehavior: string;
    position: string;
    width: string;
    height: string;
    overflow: string;
  };
  body: {
    overscrollBehavior: string;
    position: string;
    width: string;
    height: string;
    overflow: string;
  };
}

interface NodePanelStyles {
  touchAction: string;
  overscrollBehaviorX: string;
  overflowX: string;
}

export const useMobileOptimizations = (isNodePanelVisible: boolean, selectedNode: any) => {
  // Additional mobile scroll prevention for node panel
  useEffect(() => {
    if (isNodePanelVisible && selectedNode) {
      // Save original styles
      const originalStyles: NodePanelStyles = {
        touchAction: document.body.style.touchAction,
        overscrollBehaviorX: document.body.style.overscrollBehaviorX,
        overflowX: document.body.style.overflowX,
      };
      
      // Apply very strict mobile scroll prevention when node panel is open
      document.body.style.touchAction = 'pan-y pinch-zoom';
      document.body.style.overscrollBehaviorX = 'none';
      document.body.style.overflowX = 'hidden';
      
      let startX = 0;
      let startY = 0;
      
      // More aggressive prevention of horizontal swipes
      const preventHorizontalSwipe = (e: TouchEvent) => {
        if (e.touches.length === 1) {
          const target = e.target as HTMLElement;
          const touch = e.touches[0];
          
          // For touchstart, record the starting position
          if (e.type === 'touchstart') {
            startX = touch.clientX;
            startY = touch.clientY;
            return;
          }
          
          // For touchmove, check if it's a horizontal swipe
          if (e.type === 'touchmove') {
            const deltaX = Math.abs(touch.clientX - startX);
            const deltaY = Math.abs(touch.clientY - startY);
            
            // If it's primarily a horizontal movement
            if (deltaX > deltaY && deltaX > 30) {
              // Allow slider interactions only
              if (!target.closest('[role="slider"]') && 
                  !target.closest('.slider-track') && 
                  !target.closest('[data-slider]') &&
                  !target.closest('[data-radix-slider-root]')) {
                e.preventDefault();
                e.stopPropagation();
                return false;
              }
            }
          }
        }
      };

      // Add event listeners with passive: false to allow preventDefault
      document.addEventListener('touchstart', preventHorizontalSwipe, { passive: false, capture: true });
      document.addEventListener('touchmove', preventHorizontalSwipe, { passive: false, capture: true });
      
      // Also prevent on the window level
      window.addEventListener('touchstart', preventHorizontalSwipe, { passive: false, capture: true });
      window.addEventListener('touchmove', preventHorizontalSwipe, { passive: false, capture: true });

      return () => {
        // Restore original styles
        document.body.style.touchAction = originalStyles.touchAction;
        document.body.style.overscrollBehaviorX = originalStyles.overscrollBehaviorX;
        document.body.style.overflowX = originalStyles.overflowX;

        // Remove event listeners
        document.removeEventListener('touchstart', preventHorizontalSwipe, true);
        document.removeEventListener('touchmove', preventHorizontalSwipe, true);
        window.removeEventListener('touchstart', preventHorizontalSwipe, true);
        window.removeEventListener('touchmove', preventHorizontalSwipe, true);
      };
    }
  }, [isNodePanelVisible, selectedNode]);

  // Apply mobile optimizations only to this page
  useEffect(() => {
    // Save original styles
    const originalStyles: OriginalStyles = {
      html: {
        overscrollBehavior: document.documentElement.style.overscrollBehavior,
        position: document.documentElement.style.position,
        width: document.documentElement.style.width,
        height: document.documentElement.style.height,
        overflow: document.documentElement.style.overflow,
      },
      body: {
        overscrollBehavior: document.body.style.overscrollBehavior,
        position: document.body.style.position,
        width: document.body.style.width,
        height: document.body.style.height,
        overflow: document.body.style.overflow,
      }
    };

    // Apply mobile optimizations (but avoid position: fixed which breaks keyboard viewport)
    document.documentElement.style.overscrollBehavior = 'none';
    // document.documentElement.style.position = 'fixed'; // REMOVED: Causes keyboard viewport issues
    document.documentElement.style.width = '100%';
    document.documentElement.style.height = '100%';
    document.documentElement.style.overflow = 'hidden';
    
    document.body.style.overscrollBehavior = 'none';
    // document.body.style.position = 'fixed'; // REMOVED: Causes keyboard viewport issues  
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    document.body.style.overflow = 'hidden';

    // Cleanup function to restore original styles
    return () => {
      document.documentElement.style.overscrollBehavior = originalStyles.html.overscrollBehavior;
      document.documentElement.style.position = originalStyles.html.position;
      document.documentElement.style.width = originalStyles.html.width;
      document.documentElement.style.height = originalStyles.html.height;
      document.documentElement.style.overflow = originalStyles.html.overflow;
      
      document.body.style.overscrollBehavior = originalStyles.body.overscrollBehavior;
      document.body.style.position = originalStyles.body.position;
      document.body.style.width = originalStyles.body.width;
      document.body.style.height = originalStyles.body.height;
      document.body.style.overflow = originalStyles.body.overflow;
    };
  }, []);
};