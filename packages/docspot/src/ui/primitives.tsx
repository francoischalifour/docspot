import {
  type ComponentProps,
  type ReactNode,
  type Ref,
  type RefCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import { useIsApplePlatform } from '@/core/platform';
import { CheckIcon, CopyIcon } from '@/ui/icons';

/** Sets every ref to the same element, and clears them on detach. */
export function mergeRefs<T>(
  ...refs: Array<Ref<T> | undefined>
): RefCallback<T> {
  return value => {
    const cleanups = refs.map(ref => {
      if (typeof ref === 'function') {
        const cleanup = ref(value);
        return typeof cleanup === 'function' ? cleanup : () => ref(null);
      }
      if (ref) {
        ref.current = value;
        return () => {
          ref.current = null;
        };
      }
      return undefined;
    });
    return () => cleanups.forEach(cleanup => cleanup?.());
  };
}

/** Runs the consumer's handler, then Docspot's own. */
export function chain<E>(
  own: (event: E) => void,
  theirs: ((event: E) => void) | undefined
) {
  return (event: E) => {
    theirs?.(event);
    own(event);
  };
}

export function cx(...names: Array<string | false | null | undefined>) {
  return names.filter(Boolean).join(' ');
}

const keyLabels: Record<string, string> = {
  enter: '↵',
  esc: 'Esc',
  tab: '⇥',
  shift: '⇧',
  up: '↑',
  down: '↓',
};

/** Keyboard keys. `mod` is ⌘ on Apple platforms and Ctrl elsewhere. */
export function Kbd({
  keys,
  variant = 'default',
  className,
  ...props
}: ComponentProps<'kbd'> & {
  keys: string[];
  variant?: 'default' | 'ghost';
}) {
  const isApple = useIsApplePlatform();
  return (
    <kbd
      data-ghost={variant === 'ghost' || undefined}
      className={cx('docspot-kbd', className)}
      {...props}
    >
      {keys.map(key => (
        <span key={key}>
          {key === 'mod'
            ? isApple
              ? '⌘'
              : 'Ctrl'
            : (keyLabels[key] ??
              // Letters print as on the keycap: ⌘K, not ⌘k.
              (key.length === 1 ? key.toUpperCase() : key))}
        </span>
      ))}
    </kbd>
  );
}

export function Shimmer({ children }: { children: ReactNode }) {
  return <span className="docspot-shimmer">{children}</span>;
}

/**
 * A button whose label shows on hover and focus. Tooltips repeat the
 * accessible name, so screen readers hear it once.
 */
export function IconButton({
  label,
  tooltip,
  shortcut,
  className,
  children,
  side = 'bottom',
  ...props
}: ComponentProps<'button'> & {
  label: string;
  tooltip?: string;
  shortcut?: string[];
  side?: 'top' | 'bottom' | 'left';
}) {
  return (
    <span className="docspot-tooltip-anchor" data-side={side}>
      <button
        type="button"
        aria-label={label}
        className={cx('docspot-icon-button', className)}
        {...props}
      >
        {children}
      </button>
      <span className="docspot-tooltip" aria-hidden="true">
        {tooltip ?? label}
        {shortcut && <Kbd variant="ghost" keys={shortcut} />}
      </span>
    </span>
  );
}

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

export function CopyButton({
  text,
  label,
  copiedLabel,
}: {
  text: string;
  label: string;
  copiedLabel: string;
}) {
  const { isCopied, copy } = useClipboard();
  return (
    <IconButton
      label={isCopied ? copiedLabel : label}
      side="top"
      className="docspot-message-action"
      onClick={() => void copy(text).catch(() => {})}
    >
      {isCopied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
    </IconButton>
  );
}

export type MenuItem =
  | {
      kind?: 'item';
      key: string;
      label: ReactNode;
      icon?: ReactNode;
      current?: boolean;
      danger?: boolean;
      /** Keeps the menu open after selecting. */
      keepOpen?: boolean;
      onSelect: () => void;
      /** A secondary action shown at the end of the row. */
      secondary?: {
        label: string;
        icon: ReactNode;
        onSelect: () => void;
      };
    }
  | { kind: 'label'; key: string; label: ReactNode }
  | { kind: 'separator'; key: string }
  | { kind: 'text'; key: string; label: ReactNode };

/**
 * A menu button on the Popover API: the browser handles light dismiss,
 * Escape, and top-layer rendering. Arrow keys move between items and focus
 * returns to the button.
 */
export function Menu({
  trigger,
  items,
  className,
  onOpenChange,
}: {
  trigger: (props: ComponentProps<'button'>) => ReactNode;
  items: MenuItem[];
  className?: string;
  onOpenChange?: (open: boolean) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function getItems() {
    return [
      ...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ??
        []),
    ];
  }

  /** Places the menu below the button, or above it when there is no room. */
  function position() {
    const menu = menuRef.current;
    const button = buttonRef.current;
    if (!menu || !button) return;
    const anchor = button.getBoundingClientRect();
    const height = menu.offsetHeight;
    const below = anchor.bottom + 4;
    const top =
      below + height > window.innerHeight && anchor.top - height - 4 > 0
        ? anchor.top - height - 4
        : below;
    menu.style.top = `${top}px`;
    menu.style.left = `${Math.max(4, anchor.left)}px`;
  }

  function close({ restoreFocus = true } = {}) {
    menuRef.current?.hidePopover();
    if (restoreFocus) buttonRef.current?.focus();
  }

  return (
    <div className={cx('docspot-menu-root', className)}>
      {trigger({
        ref: buttonRef,
        type: 'button',
        popoverTarget: id,
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': id,
        onKeyDown: event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            menuRef.current?.showPopover();
          } else if (event.key === 'Escape' && open) {
            // The menu, not its surroundings, handles this Escape.
            event.preventDefault();
            event.stopPropagation();
            close();
          }
        },
      })}
      <div
        ref={menuRef}
        id={id}
        popover="auto"
        role="menu"
        className="docspot-menu"
        onToggle={event => {
          const isOpen = event.newState === 'open';
          setOpen(isOpen);
          onOpenChange?.(isOpen);
          if (isOpen) {
            position();
            getItems()[0]?.focus();
          }
        }}
        onKeyDown={event => {
          const elements = getItems();
          const index = elements.indexOf(document.activeElement as HTMLElement);
          let next: HTMLElement | undefined;
          if (event.key === 'ArrowDown')
            next = elements[(index + 1) % elements.length];
          else if (event.key === 'ArrowUp')
            next = elements[(index - 1 + elements.length) % elements.length];
          else if (event.key === 'Home') next = elements[0];
          else if (event.key === 'End') next = elements.at(-1);
          else if (event.key === 'Tab') {
            close({ restoreFocus: false });
            return;
          } else if (event.key === 'Escape') {
            // Handled here so Escape does not also close the chat panel.
            event.preventDefault();
            event.stopPropagation();
            close();
            return;
          } else return;
          event.preventDefault();
          next?.focus();
        }}
      >
        {items.map(item => {
          if (item.kind === 'separator')
            return (
              <div
                key={item.key}
                role="separator"
                className="docspot-menu-separator"
              />
            );
          if (item.kind === 'label')
            return (
              <div key={item.key} className="docspot-menu-label">
                {item.label}
              </div>
            );
          if (item.kind === 'text')
            return (
              <p key={item.key} className="docspot-menu-text">
                {item.label}
              </p>
            );
          return (
            <div
              key={item.key}
              className="docspot-menu-row"
              data-current={item.current || undefined}
            >
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                aria-current={item.current || undefined}
                data-danger={item.danger || undefined}
                className="docspot-menu-item"
                onClick={() => {
                  item.onSelect();
                  if (!item.keepOpen) close();
                }}
              >
                {item.icon}
                <span className="docspot-truncate">{item.label}</span>
              </button>
              {item.secondary && (
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  aria-label={item.secondary.label}
                  className="docspot-menu-secondary"
                  onClick={item.secondary.onSelect}
                >
                  {item.secondary.icon}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
