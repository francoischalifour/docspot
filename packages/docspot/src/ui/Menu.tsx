import {
  type ComponentProps,
  type ReactNode,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { cx } from '@/ui/cx';

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
      /** Muted, for an item less used than the others. */
      quiet?: boolean;
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

type MenuProps = {
  trigger: (props: ComponentProps<'button'>) => ReactNode;
  items: MenuItem[];
  className?: string;
  onOpenChange?: (open: boolean) => void;
};

/**
 * A menu button on the Popover API: the browser handles light dismiss,
 * Escape, and top-layer rendering. Arrow keys move between items and focus
 * returns to the button.
 */
export function Menu({ trigger, items, className, onOpenChange }: MenuProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Where focus goes once a secondary action, such as delete, removes its row.
  const refocusRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    const index = refocusRef.current;
    if (index === null) return;
    refocusRef.current = null;
    if (menuRef.current?.contains(document.activeElement)) return;
    const elements = getItems();
    const next = elements[Math.min(index, elements.length - 1)];
    if (next) next.focus();
    else close();
  });

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
                data-quiet={item.quiet || undefined}
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
                  onClick={event => {
                    // The row's item, or the next row's once this one goes.
                    refocusRef.current = Math.max(
                      0,
                      getItems().indexOf(event.currentTarget) - 1
                    );
                    item.secondary!.onSelect();
                  }}
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
