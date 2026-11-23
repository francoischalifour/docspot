import { Docspot, defineItem, recentItems, useDocspot } from 'docspot';
import { createChat } from 'docspot/chat';
import { chatGptHandoff, claudeHandoff } from 'docspot/handoffs';
import { createMiniSearchSearch } from 'docspot/minisearch';
import { StrictMode, lazy, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import 'docspot/styles.css';
import './style.css';
import { OptionCard } from './OptionCard';
import { PageMarkdown } from './PageMarkdown';
import { findPage, pages } from './pages';
import { Tooltip } from './Tooltip';

// Search: a MiniSearch index built in the browser, loaded when Docspot
// preloads (once the page is idle, or when a trigger is hovered).
const loadPreview = () => import('./Preview');
const search = createMiniSearchSearch({
  index: () => {
    void loadPreview();
    return import('./search-index').then(module => module.index);
  },
  // A hit carries the fields the index stores, typed as its documents.
  getDocument: hit => {
    const { title, pageTitle, section, text } = hit;
    return {
      url: hit.id,
      title,
      pageTitle,
      breadcrumb: [section, pageTitle],
      group: section,
      type: 'section',
      content: text,
    };
  },
});
const Preview = lazy(loadPreview);
const PageActions = lazy(() =>
  loadPreview().then(module => ({ default: module.PageActions }))
);

// Chat: any AI SDK transport. The scripted backend lives in chat-server.ts.
const chat = createChat({
  async transport() {
    const { DefaultChatTransport } = await import('ai');
    return new DefaultChatTransport({ api: '/api/chat' });
  },
  // Tool calls the agent makes, rendered in answers.
  tools: { showOption: OptionCard },
});

// Handoffs send the query elsewhere, with a link to the best result.
const prompt = ({
  query,
  results,
}: {
  query: string;
  results: { url: string }[];
}) =>
  results[0]
    ? `${query}\n\nRead ${new URL(results[0].url, location.href)} and answer.`
    : query;
const handoffs = [chatGptHandoff({ prompt }), claudeHandoff({ prompt })];

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return [theme, setTheme] as const;
}

function usePath() {
  const [path, setPath] = useState(() => location.pathname);
  useEffect(() => {
    const update = () => setPath(location.pathname);
    addEventListener('popstate', update);
    return () => removeEventListener('popstate', update);
  }, []);
  function navigate(url: string) {
    const target = new URL(url, location.href);
    history.pushState(null, '', target);
    flushSync(() => setPath(target.pathname));
    if (target.hash)
      document.getElementById(target.hash.slice(1))?.scrollIntoView();
    else scrollTo(0, 0);
  }
  return [path, navigate] as const;
}

/** Any component inside Docspot can control it with useDocspot(). */
function AskAboutThisPage() {
  const docspot = useDocspot();
  return (
    <button
      type="button"
      className="button"
      onClick={() => docspot.submitQuestion('Summarize this page')}
    >
      Summarize this page
    </button>
  );
}

function App() {
  const [path, navigate] = usePath();
  const [theme, setTheme] = useTheme();
  const page = findPage(path) ?? pages[0]!;

  // Items: things to do, found by typing their title or keywords.
  const toggleTheme = defineItem({
    id: 'toggle-theme',
    title: theme === 'dark' ? 'Light theme' : 'Dark theme',
    keywords: ['appearance', 'color', 'mode'],
    group: 'Actions',
    action: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
  });

  return (
    <Docspot.Root
      search={search}
      chat={chat}
      history
      syncUrl
      navigate={navigate}
      context={{
        page: { url: page.url, title: page.title, prompts: page.prompts },
        prompts: ['What can I build with Acme?'],
        resolvePage: url => findPage(url),
        loadPage: async ({ url }) => findPage(url)?.markdown ?? null,
      }}
      items={[toggleTheme]}
      defaultItems={[
        recentItems,
        { url: '/', title: 'Getting started', group: 'Popular' },
        { url: '/configuration', title: 'Configuration', group: 'Popular' },
        toggleTheme,
      ]}
      handoffs={handoffs}
      slots={{ preview: Preview, pageActions: PageActions, tooltip: Tooltip }}
      onEvent={event => console.debug('[docspot]', event)}
    >
      <div className="layout">
        <header className="header">
          <strong>Acme docs</strong>
          <Docspot.SearchTrigger />
          <Docspot.ChatTrigger />
        </header>
        <div className="page">
          <nav aria-label="Documentation" className="sidebar">
            {pages.map(item => (
              <a
                key={item.url}
                href={item.url}
                aria-current={item === page ? 'page' : undefined}
                onClick={event => {
                  if (
                    event.button !== 0 ||
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey
                  )
                    return;
                  event.preventDefault();
                  navigate(item.url);
                }}
              >
                {item.title}
              </a>
            ))}
          </nav>
          <main className="content">
            <article>
              <PageMarkdown>{page.markdown}</PageMarkdown>
              <AskAboutThisPage />
            </article>
          </main>
        </div>
      </div>
      <Docspot.SearchDialog />
      <Docspot.ChatPanel />
    </Docspot.Root>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
