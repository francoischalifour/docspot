// The parts contract: every part accepts the props of the element it
// renders and passes them through. The table lists every member of
// `Docspot`, so a new part fails to type-check until it is listed here.
import type { ComponentProps, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { type Locator, page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { Docspot } from '@/index';
import { results } from '@test/fixtures';
import { createTestChat } from '@test/testing';

const modifier = navigator.platform.includes('Mac') ? 'Meta' : 'Control';

type Tag = 'button' | 'dialog' | 'aside';

/** Props any element takes, which each part must pass through. */
type ElementProps<T extends Tag> = Pick<
  ComponentProps<T>,
  'className' | 'style' | 'ref' | 'title' | 'onMouseEnter' | 'onKeyDown'
> & { 'data-site': string };

type PartCase<T extends Tag> = {
  tag: T;
  /** The stable class Docspot keeps beside the site's. */
  className: string;
  /** Renders the part with the site's props, inside a root. */
  render: (props: ElementProps<T>) => ReactNode;
  /** Shows the part, for those that render only while open. */
  show?: () => Promise<void>;
  locate: () => Locator;
  /**
   * A key the site's `onKeyDown` cancels with `preventDefault`, and what
   * Docspot would otherwise have done, which must not happen.
   */
  cancels?: { key: string; expect: () => Promise<unknown> };
};

type AnyPartCase = { [T in Tag]: PartCase<T> }[Tag];

/** The table checks each part's props against its tag; tests share them. */
type SharedProps = Omit<ElementProps<'button'>, 'ref' | 'onKeyDown'> & {
  ref?: (element: HTMLElement | null) => void;
  onKeyDown?: (event: KeyboardEvent & { key: string }) => void;
};

function renderPart(part: AnyPartCase, props: SharedProps) {
  return render((part.render as (props: SharedProps) => ReactNode)(props));
}

const searchOnly = (children: ReactNode) => (
  <Docspot.Root search={() => results}>{children}</Docspot.Root>
);
function chatOnly(children: ReactNode) {
  const { chat } = createTestChat({ answer: () => ({ text: 'Hi.' }) });
  return <Docspot.Root chat={chat}>{children}</Docspot.Root>;
}
const dialog = () => page.getByRole('dialog', { name: 'Search documentation' });
const panel = () => page.getByRole('complementary', { name: 'Ask AI' });

const parts: {
  [Name in keyof typeof Docspot]: AnyPartCase | 'renders no element';
} = {
  Root: 'renders no element',
  Trigger: {
    tag: 'button',
    className: 'docspot-trigger',
    render: props => searchOnly(<Docspot.Trigger {...props} />),
    locate: () => page.getByRole('button', { name: 'Search docs' }),
  },
  SearchTrigger: {
    tag: 'button',
    className: 'docspot-trigger',
    render: props => searchOnly(<Docspot.SearchTrigger {...props} />),
    locate: () => page.getByRole('button', { name: 'Search docs' }),
  },
  ChatTrigger: {
    tag: 'button',
    className: 'docspot-trigger',
    render: props => chatOnly(<Docspot.ChatTrigger {...props} />),
    locate: () => page.getByRole('button', { name: 'Ask AI' }),
  },
  ChatLauncher: {
    tag: 'button',
    className: 'docspot-launcher',
    render: props => chatOnly(<Docspot.ChatLauncher {...props} />),
    locate: () => page.getByRole('button', { name: 'Ask AI' }),
  },
  SearchDialog: {
    tag: 'dialog',
    className: 'docspot-search',
    render: props =>
      searchOnly(
        <>
          <Docspot.SearchTrigger />
          <Docspot.SearchDialog {...props} />
        </>
      ),
    async show() {
      await page.getByRole('button', { name: 'Search docs' }).click();
    },
    locate: dialog,
    cancels: {
      key: 'Escape',
      expect: () => expect.element(dialog()).toBeVisible(),
    },
  },
  ChatPanel: {
    tag: 'aside',
    className: 'docspot-chat',
    render: props =>
      chatOnly(
        <>
          <Docspot.ChatTrigger />
          <Docspot.ChatPanel {...props} />
        </>
      ),
    async show() {
      await page.getByRole('button', { name: 'Ask AI' }).click();
      await expect.element(panel().getByRole('textbox')).toHaveFocus();
    },
    locate: panel,
    cancels: {
      key: 'Escape',
      expect: () => expect.element(panel()).toBeVisible(),
    },
  },
};

const cases = Object.entries(parts).flatMap(([name, part]) =>
  typeof part === 'string' ? [] : [[name, part] as const]
);

describe.each(cases)('Docspot.%s', (_name, part) => {
  it('passes the site’s props, ref, and handlers to its element', async () => {
    const ref = vi.fn();
    const onMouseEnter = vi.fn();
    const props: SharedProps = {
      ref,
      className: 'site-part',
      style: { outlineColor: 'rgb(255, 0, 0)' },
      title: 'From the site',
      'data-site': 'yes',
      onMouseEnter,
    };
    await renderPart(part, props);
    await part.show?.();
    const element = part.locate();
    await expect.element(element).toBeVisible();
    await expect.element(element).toHaveClass(part.className);
    await expect.element(element).toHaveClass('site-part');
    await expect.element(element).toHaveAttribute('title', 'From the site');
    await expect.element(element).toHaveAttribute('data-site', 'yes');
    await expect
      .element(element)
      .toHaveStyle({ outlineColor: 'rgb(255, 0, 0)' });
    expect(element.element().tagName.toLowerCase()).toBe(part.tag);
    expect(ref).toHaveBeenCalledWith(element.element());
    await element.hover();
    expect(onMouseEnter).toHaveBeenCalled();
  });

  if (part.cancels) {
    const { key, expect: stays } = part.cancels;
    it(`skips Docspot’s handler when the site’s calls preventDefault`, async () => {
      await renderPart(part, {
        'data-site': 'yes',
        onKeyDown: event => {
          if (event.key === key) event.preventDefault();
        },
      });
      await part.show?.();
      await userEvent.keyboard(`{${key}}`);
      await stays();
    });
  }
});

it('keeps a trigger closed when the site’s click handler prevents it', async () => {
  await render(
    searchOnly(
      <>
        <Docspot.SearchTrigger onClick={event => event.preventDefault()} />
        <Docspot.SearchDialog />
      </>
    )
  );
  await page.getByRole('button', { name: 'Search docs' }).click();
  await expect.element(dialog()).not.toBeInTheDocument();
  // The shortcut still opens it: only the trigger's click was cancelled.
  await userEvent.keyboard(`{${modifier}>}k{/${modifier}}`);
  await expect.element(dialog()).toBeVisible();
});
