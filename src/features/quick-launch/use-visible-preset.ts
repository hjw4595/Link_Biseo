'use client';
import { useEffect, useRef, useState } from 'react';

/** Extra cards opt in only while visible. Cached data survives leaving the viewport. */
export function useVisiblePreset() {
  const element = useRef<HTMLLIElement>(null);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  useEffect(() => {
    const update = () => setPageVisible(document.visibilityState === 'visible');
    update();
    document.addEventListener('visibilitychange', update);
    const node = element.current;
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(!!entry?.isIntersecting);
    });
    if (node) observer.observe(node);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return { element, visible: visible && pageVisible };
}
