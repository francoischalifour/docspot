import { expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { Docspot, type DocspotEvent, type DocspotIconProps } from '@/index';
import { createTestChat } from '@test/testing';

const panel = () => page.getByRole('complementary', { name: 'Ask AI' });
const composer = () => panel().getByRole('textbox', { name: /Ask/ });
const answers = () => panel().getByRole('article', { name: 'Docs answer' });
const helpful = () =>
  panel().getByRole('button', { name: 'Helpful', exact: true });
const unhelpful = () => panel().getByRole('button', { name: 'Not helpful' });
const reasons = () => panel().getByRole('group', { name: 'What went wrong?' });

async function openChat() {
  await page.getByRole('button', { name: 'Ask AI' }).first().click();
  await expect.element(composer()).toHaveFocus();
}

function feedbackEvents(events: DocspotEvent[]) {
  return events.filter(event => event.type === 'chat.feedback');
}

it('rates an answer, asks why it was not helpful, and changes or clears the rating', async () => {
  const events: DocspotEvent[] = [];
  const { chat } = createTestChat({
    answer: ({ question }) => `About ${question}.`,
  });
  await render(<Docspot chat={chat} onEvent={event => events.push(event)} />);
  await openChat();
  await userEvent.keyboard('How do I zoom?{Enter}');
  await expect
    .element(answers().getByText('About How do I zoom?.'))
    .toBeVisible();
  const conversationId = events.find(
    event => event.type === 'chat.submit'
  )!.conversationId;

  await helpful().click();
  await expect.element(helpful()).toHaveAttribute('aria-pressed', 'true');
  await expect.element(unhelpful()).toHaveAttribute('aria-pressed', 'false');
  const [up] = feedbackEvents(events);
  expect(up).toEqual({
    type: 'chat.feedback',
    conversationId,
    messageId: expect.any(String),
    question: 'How do I zoom?',
    answer: 'About How do I zoom?.',
    value: 'up',
  });
  // Rating it up asks nothing more.
  await expect.element(reasons()).not.toBeInTheDocument();

  // Changing to down asks why, optionally.
  await unhelpful().click();
  await expect.element(unhelpful()).toHaveAttribute('aria-pressed', 'true');
  await expect.element(helpful()).toHaveAttribute('aria-pressed', 'false');
  expect(feedbackEvents(events).at(-1)).toMatchObject({
    value: 'down',
    messageId: up!.messageId,
  });
  await expect.element(reasons()).toBeVisible();

  // The reasons are reached in order with the keyboard.
  await userEvent.keyboard('{Tab}');
  await expect
    .element(reasons().getByRole('radio', { name: 'Incorrect' }))
    .toHaveFocus();
  await userEvent.keyboard('{ArrowDown}');
  await expect
    .element(reasons().getByRole('radio', { name: 'Incomplete' }))
    .toBeChecked();
  await userEvent.fill(
    reasons().getByRole('textbox', { name: 'Tell us more (optional)' }),
    '  It skips the margin.  '
  );
  await userEvent.keyboard('{Enter}');
  expect(feedbackEvents(events).at(-1)).toEqual({
    type: 'chat.feedback',
    conversationId,
    messageId: up!.messageId,
    question: 'How do I zoom?',
    answer: 'About How do I zoom?.',
    value: 'down',
    reason: 'incomplete',
    comment: 'It skips the margin.',
  });
  await expect
    .element(panel().getByRole('status').getByText('Thanks for your feedback'))
    .toBeVisible();
  await expect.element(reasons()).not.toBeInTheDocument();
  await expect.element(unhelpful()).toHaveFocus();

  // Choosing the rating again clears it.
  await unhelpful().click();
  await expect.element(unhelpful()).toHaveAttribute('aria-pressed', 'false');
  expect(feedbackEvents(events).at(-1)).toEqual({
    type: 'chat.feedback',
    conversationId,
    messageId: up!.messageId,
    question: 'How do I zoom?',
    answer: 'About How do I zoom?.',
    value: null,
  });
  await expect
    .element(panel().getByText('Thanks for your feedback'))
    .not.toBeInTheDocument();
});

it('rates each answer of a conversation on its own', async () => {
  const events: DocspotEvent[] = [];
  const { chat } = createTestChat({
    answer: ({ question }) => `About ${question}.`,
  });
  await render(<Docspot chat={chat} onEvent={event => events.push(event)} />);
  await openChat();
  await userEvent.keyboard('First{Enter}');
  await expect.element(answers().getByText('About First.')).toBeVisible();
  await userEvent.fill(composer(), 'Second');
  await userEvent.keyboard('{Enter}');
  await expect.element(answers().getByText('About Second.')).toBeVisible();
  await answers()
    .first()
    .getByRole('button', { name: 'Helpful', exact: true })
    .click();
  await expect
    .element(
      answers().last().getByRole('button', { name: 'Helpful', exact: true })
    )
    .toHaveAttribute('aria-pressed', 'false');
  expect(feedbackEvents(events)).toEqual([
    expect.objectContaining({
      question: 'First',
      answer: 'About First.',
      value: 'up',
    }),
  ]);
});

it('leaves the reasons with Escape, keeping the rating and the panel open', async () => {
  const events: DocspotEvent[] = [];
  const { chat } = createTestChat({ answer: () => 'Answer.' });
  await render(<Docspot chat={chat} onEvent={event => events.push(event)} />);
  await openChat();
  await userEvent.keyboard('Hello{Enter}');
  await unhelpful().click();
  await reasons().getByRole('radio', { name: 'Incorrect' }).click();
  await userEvent.keyboard('{Escape}');
  await expect.element(reasons()).not.toBeInTheDocument();
  await expect.element(unhelpful()).toHaveFocus();
  await expect.element(unhelpful()).toHaveAttribute('aria-pressed', 'true');
  await expect.element(panel()).toBeVisible();
  // Nothing was sent, so only the rating was reported.
  expect(feedbackEvents(events).map(event => event.value)).toEqual(['down']);
  expect(feedbackEvents(events).at(-1)).not.toHaveProperty('reason');

  // Its close button does the same.
  await unhelpful().click();
  await unhelpful().click();
  await panel().getByRole('button', { name: 'Close feedback' }).click();
  await expect.element(reasons()).not.toBeInTheDocument();
  await expect.element(unhelpful()).toHaveAttribute('aria-pressed', 'true');
});

it('keeps a rating and its reason after a reload', async () => {
  const events: DocspotEvent[] = [];
  const { chat } = createTestChat({ answer: () => 'Answer.' });
  const screen = await render(
    <Docspot chat={chat} history onEvent={event => events.push(event)} />
  );
  await openChat();
  await userEvent.keyboard('Hello{Enter}');
  await unhelpful().click();
  await reasons()
    .getByRole('radio', { name: 'Didn’t answer my question' })
    .click();
  await reasons().getByRole('button', { name: 'Send feedback' }).click();
  await expect
    .element(panel().getByText('Thanks for your feedback'))
    .toBeVisible();
  await screen.unmount();

  await render(<Docspot chat={chat} history />);
  await expect.element(answers().getByText('Answer.')).toBeVisible();
  await expect.element(unhelpful()).toHaveAttribute('aria-pressed', 'true');
  // A restored rating asks nothing again.
  await expect.element(reasons()).not.toBeInTheDocument();
  const stored = JSON.parse(localStorage.getItem('docspot:conversations')!) as {
    value: Array<{ messages: Array<{ id: string; metadata?: unknown }> }>;
  };
  const answer = stored.value[0]!.messages[1]!;
  expect(answer.id).toBe(feedbackEvents(events).at(-1)?.messageId);
  expect(answer.metadata).toMatchObject({
    feedback: { value: 'down', reason: 'unrelated' },
  });

  // Clearing it is saved too.
  await unhelpful().click();
  await expect.element(unhelpful()).toHaveAttribute('aria-pressed', 'false');
  expect(localStorage.getItem('docspot:conversations')).not.toContain(
    'feedback'
  );
});

it('offers no rating while an answer streams, or once it stopped or failed', async () => {
  const { chat, nextRequest } = createTestChat({
    answer: ({ index }) => (index === 2 ? { status: 500 } : undefined),
  });
  await render(<Docspot chat={chat} />);
  await openChat();

  await userEvent.keyboard('First{Enter}');
  const first = await nextRequest();
  first.text('Partial');
  await expect.element(answers().getByText('Partial')).toBeVisible();
  await expect.element(helpful()).not.toBeInTheDocument();
  first.text(' answer.');
  first.end();
  await expect.element(helpful()).toBeVisible();

  // The first answer stays rateable while the next one streams.
  await userEvent.fill(composer(), 'Second');
  await userEvent.keyboard('{Enter}');
  const second = await nextRequest();
  second.text('Cut short');
  await expect.element(answers().getByText('Cut short')).toBeVisible();
  await expect.element(helpful()).toBeVisible();
  await panel().getByRole('button', { name: 'Stop response' }).click();
  await expect
    .element(answers().last().getByText('Stopped', { exact: true }))
    .toBeVisible();
  await expect
    .element(answers().last().getByRole('button', { name: 'Copy answer' }))
    .toBeVisible();
  await expect
    .element(
      answers().last().getByRole('button', { name: 'Helpful', exact: true })
    )
    .not.toBeInTheDocument();

  await userEvent.fill(composer(), 'Third');
  await userEvent.keyboard('{Enter}');
  await expect.element(panel().getByRole('alert')).toBeVisible();
  await expect.element(helpful()).toBeVisible();
  expect(
    panel().getByRole('button', { name: 'Helpful', exact: true }).all()
  ).toHaveLength(1);
});

it('draws ratings with the site’s icons', async () => {
  const { chat } = createTestChat({ answer: () => 'Answer.' });
  const Up = ({ size, ...props }: DocspotIconProps) => (
    <svg data-icon="up" width={size} height={size} {...props} />
  );
  const Down = ({ size, ...props }: DocspotIconProps) => (
    <svg data-icon="down" width={size} height={size} {...props} />
  );
  await render(
    <Docspot chat={chat} slots={{ icons: { helpful: Up, unhelpful: Down } }} />
  );
  await openChat();
  await userEvent.keyboard('Hello{Enter}');
  await expect.element(helpful()).toBeVisible();
  expect(helpful().element().querySelector('svg')?.dataset.icon).toBe('up');
  expect(unhelpful().element().querySelector('svg')?.dataset.icon).toBe('down');
});

it('offers no rating on an answer that failed partway, even after a reload', async () => {
  const { chat, nextRequest } = createTestChat();
  const screen = await render(<Docspot chat={chat} history />);
  await openChat();
  await userEvent.keyboard('First{Enter}');
  const first = await nextRequest();
  first.text('Complete.');
  first.end();
  await expect.element(helpful()).toBeVisible();

  await userEvent.fill(composer(), 'Second');
  await userEvent.keyboard('{Enter}');
  const second = await nextRequest();
  second.text('Half an ans');
  await expect.element(answers().getByText('Half an ans')).toBeVisible();
  second.error();
  await expect.element(panel().getByRole('alert')).toBeVisible();
  await expect
    .element(answers().last().getByRole('button', { name: 'Copy answer' }))
    .toBeVisible();
  await expect
    .element(answers().last().getByRole('button', { name: 'Not helpful' }))
    .not.toBeInTheDocument();
  await screen.unmount();

  // Saved with its partial text, the failed answer still can't be rated.
  await render(<Docspot chat={chat} history />);
  await expect.element(answers().getByText('Half an ans')).toBeVisible();
  await expect
    .element(answers().first().getByRole('button', { name: 'Not helpful' }))
    .toBeVisible();
  await expect
    .element(answers().last().getByRole('button', { name: 'Not helpful' }))
    .not.toBeInTheDocument();
});

it('keeps a conversation’s place in recent chats when rating it', async () => {
  const { chat } = createTestChat({
    answer: ({ question }) => `About ${question}.`,
  });
  await render(<Docspot chat={chat} history />);
  await openChat();
  await userEvent.keyboard('Older{Enter}');
  await expect.element(answers().getByText('About Older.')).toBeVisible();
  await panel().getByRole('button', { name: 'New chat' }).click();
  await userEvent.keyboard('Newer{Enter}');
  await expect.element(answers().getByText('About Newer.')).toBeVisible();

  const switcher = () => panel().getByRole('button', { name: /Switch chat/ });
  const recentChats = async () => {
    await switcher().click();
    // Each chat has a delete action named after it, in list order.
    const titles = page
      .getByRole('menu')
      .getByRole('menuitem', { name: /^Delete chat, / })
      .elements()
      .map(item => item.getAttribute('aria-label'));
    await userEvent.keyboard('{Escape}');
    return titles;
  };
  expect(await recentChats()).toEqual([
    'Delete chat, Newer',
    'Delete chat, Older',
  ]);

  await switcher().click();
  await page
    .getByRole('menu')
    .getByRole('menuitem', { name: 'Older', exact: true })
    .click();
  await expect.element(answers().getByText('About Older.')).toBeVisible();
  await helpful().click();
  await expect.element(helpful()).toHaveAttribute('aria-pressed', 'true');
  expect(await recentChats()).toEqual([
    'Delete chat, Newer',
    'Delete chat, Older',
  ]);
});
