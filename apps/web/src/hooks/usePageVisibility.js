import { useEffect, useState } from 'react';

/** True while the tab is hidden. Drives pausing the camera. */
export function usePageHidden() {
  const [hidden, setHidden] = useState(() => document.hidden);

  useEffect(() => {
    const onChange = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  return hidden;
}
