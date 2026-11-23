import { Docspot, createDocspotUrl } from 'docspot';
import { createChat } from 'docspot/chat';
import { StrictMode, useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import { createRoot } from 'react-dom/client';

import 'docspot/styles.css';
import './style.css';
import { findPage, pages } from './pages';

const chat = createChat({
  async transport() {
    const { DefaultChatTransport } = await import('ai');
    return new DefaultChatTransport({ api: '/api/chat' });
  },
});

function usePath() {
  const [path, setPath] = useState(() => location.pathname);
  useEffect(() => {
    const update = () => setPath(location.pathname);
    addEventListener('popstate', update);
    return () => removeEventListener('popstate', update);
  }, []);
  return [
    path,
    (url: string) => {
      history.pushState(null, '', url);
      setPath(location.pathname);
      scrollTo(0, 0);
    },
  ] as const;
}

function App() {
  const [path, navigate] = usePath();
  const page = findPage(path) ?? pages[0]!;
  return (
    <div className="layout">
      <header className="header">
        <strong>Acme docs</strong>
        <nav>
          {pages.map(item => (
            <a
              key={item.url}
              href={item.url}
              aria-current={item === page ? 'page' : undefined}
              onClick={event => {
                if (
                  event.defaultPrevented ||
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
        <Docspot
          chat={chat}
          history
          syncUrl
          navigate={navigate}
          context={{
            page: {
              url: page.url,
              title: page.title,
              suggestions: page.suggestions,
            },
            suggestions: ['What can I build with Acme?'],
            resolvePage: url => findPage(url),
            loadPage: async ({ url }) => findPage(url)?.markdown ?? null,
          }}
          onEvent={event => console.debug('[docspot]', event)}
        />
      </header>
      <main className="content">
        <article>
          <Markdown>{page.markdown}</Markdown>
          <p>
            <a
              href={createDocspotUrl(page.url, {
                prompt: `Summarize ${page.title}`,
              })}
            >
              Ask for a summary of this page
            </a>
          </p>
        </article>
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
