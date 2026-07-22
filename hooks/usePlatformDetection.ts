import { useState, useEffect } from 'react';

export const usePlatformDetection = () => {
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const checkIsIOS = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isIphone = /iphone|ipod|ipad/.test(userAgent);
      const isMacWithTouch = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
      return isIphone || isMacWithTouch;
    };

    setIsIOS(checkIsIOS());
  }, []);

  return { isIOS };
};