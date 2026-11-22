import { useEffect, useRef, useState } from 'react';

export function useClipboard(resetAfter = 2000) {
  const [isCopied, setIsCopied] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timeout.current), []);
  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setIsCopied(true);
    clearTimeout(timeout.current);
    timeout.current = setTimeout(() => setIsCopied(false), resetAfter);
  }
  return { isCopied, copy };
}
