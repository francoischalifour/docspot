import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

/**
 * The stroke as drawn, in pixels, unless `--docspot-icon-stroke` sets it.
 * Icons are drawn on a 24-unit grid, so the stroke scales with each one's
 * size; this keeps their weight the same.
 */
const STROKE_PX = 1.3;

// A function rather than a component, so an icon is one component to render.
function drawIcon(
  { size = 16, style, ...props }: IconProps,
  children: ReactNode
) {
  const scale = 24 / size;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE_PX * scale}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        // In user units, the 24-unit grid.
        strokeWidth: `calc(var(--docspot-icon-stroke, ${STROKE_PX}) * ${scale}px)`,
        ...style,
      }}
      {...props}
    >
      {children}
    </svg>
  );
}

export const SearchIcon = (props: IconProps) =>
  drawIcon(
    props,
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.4-4.4" />
    </>
  );

export const LoadingIcon = (props: IconProps) =>
  drawIcon(
    props,
    <>
      <path d="M12 3a9 9 0 1 0 9 9" />
    </>
  );

export const PageIcon = (props: IconProps) =>
  drawIcon(
    props,
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </>
  );

export const SectionIcon = (props: IconProps) =>
  drawIcon(
    props,
    <>
      <path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16" />
    </>
  );

export const HistoryIcon = (props: IconProps) =>
  drawIcon(
    props,
    <>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" />
      <path d="M3.5 4v4h4M12 8v4l3 2" />
    </>
  );

export const QuestionIcon = (props: IconProps) =>
  drawIcon(
    props,
    <>
      <path d="M4 19.5 5.3 16A8 8 0 1 1 8 18.7z" />
      <path d="M9.8 9.5a2.3 2.3 0 0 1 4.4.8c0 1.5-2.2 2-2.2 3.2M12 16h.01" />
    </>
  );

export const ChatIcon = (props: IconProps) =>
  drawIcon(
    props,
    <>
      <path d="M4 19.5 5.3 16A8 8 0 1 1 8 18.7z" />
    </>
  );

export const SendIcon = (props: IconProps) =>
  drawIcon(
    props,
    <>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </>
  );

export const StopIcon = (props: IconProps) =>
  drawIcon(
    props,
    <>
      <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" />
    </>
  );

export const CloseIcon = (props: IconProps) =>
  drawIcon(
    props,
    <>
      <path d="M6 6l12 12M18 6 6 18" />
    </>
  );

export const CollapseIcon = (props: IconProps) =>
  drawIcon(
    props,
    <>
      <path d="m6 7 5 5-5 5M13 7l5 5-5 5" />
    </>
  );

export const NewChatIcon = (props: IconProps) =>
  drawIcon(
    props,
    <>
      <path d="M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />
      <path d="M18.4 3.6a2 2 0 0 1 2.8 2.8L13 14.6 9.5 15.5l.9-3.5z" />
    </>
  );

export const ChevronDownIcon = (props: IconProps) =>
  drawIcon(
    props,
    <>
      <path d="m7 10 5 5 5-5" />
    </>
  );

export const ArrowDownIcon = (props: IconProps) =>
  drawIcon(
    props,
    <>
      <path d="M12 5v14M6 13l6 6 6-6" />
    </>
  );

export const ArrowUpRightIcon = (props: IconProps) =>
  drawIcon(
    props,
    <>
      <path d="M7 17 17 7M8 7h9v9" />
    </>
  );

export const ExternalIcon = (props: IconProps) =>
  drawIcon(
    props,
    <>
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </>
  );

export const DeleteIcon = (props: IconProps) =>
  drawIcon(
    props,
    <>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
    </>
  );

export const CopyIcon = (props: IconProps) =>
  drawIcon(
    props,
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  );

export const CheckIcon = (props: IconProps) =>
  drawIcon(
    props,
    <>
      <path d="m5 12 5 5 9-10" />
    </>
  );

export const RetryIcon = (props: IconProps) =>
  drawIcon(
    props,
    <>
      <path d="M20 12a8 8 0 1 1-2.3-5.7L20 8.5" />
      <path d="M20 4v4.5h-4.5" />
    </>
  );

export const EnterIcon = (props: IconProps) =>
  drawIcon(
    props,
    <>
      <path d="M19 6v5a3 3 0 0 1-3 3H6M10 10l-4 4 4 4" />
    </>
  );

/** A command: something to do rather than a page to open. */
export const CommandIcon = (props: IconProps) =>
  drawIcon(
    props,
    <>
      <path d="m13 3-7.5 10.5H12L11 21l7.5-10.5H12Z" />
    </>
  );

// A function, so the module has no side effects to keep.
const drawThumb = () => (
  <>
    <path d="M7.5 10.5V20.5" />
    <path d="M7.5 10.5 11 3.6a1.9 1.9 0 0 1 3.5 1.3L13.6 9.5h5a2 2 0 0 1 2 2.3l-1.1 7A2 2 0 0 1 17.5 20.5h-12a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z" />
  </>
);

export const ThumbUpIcon = (props: IconProps) => drawIcon(props, drawThumb());

export const ThumbDownIcon = (props: IconProps) =>
  drawIcon(props, <g transform="rotate(180 12 12)">{drawThumb()}</g>);
