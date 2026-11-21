import { useEffect } from 'react';

let activeLockCount = 0;
let savedBodyOverflow = '';

export function useBodyScrollLock(isLocked) {
  useEffect(() => {
    if (!isLocked || typeof document === 'undefined') return undefined;

    if (activeLockCount === 0) {
      savedBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    activeLockCount += 1;

    return () => {
      activeLockCount = Math.max(0, activeLockCount - 1);
      if (activeLockCount === 0) {
        document.body.style.overflow = savedBodyOverflow;
        savedBodyOverflow = '';
      }
    };
  }, [isLocked]);
}

export default useBodyScrollLock;
