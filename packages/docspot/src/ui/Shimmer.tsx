import type { ReactNode } from 'react';

type ShimmerProps = { children: ReactNode };

export function Shimmer({ children }: ShimmerProps) {
  return <span className="docspot-shimmer">{children}</span>;
}
