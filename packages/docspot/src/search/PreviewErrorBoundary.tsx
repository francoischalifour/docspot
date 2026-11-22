import { Component, type ReactNode } from 'react';

/** Falls back to the result summary when a preview fails to render. */
type PreviewErrorBoundaryProps = { fallback: ReactNode; children: ReactNode };

export class PreviewErrorBoundary extends Component<
  PreviewErrorBoundaryProps,
  { hasError: boolean }
> {
  override state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  override render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
