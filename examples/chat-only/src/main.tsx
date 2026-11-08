import { DefaultChatTransport } from 'ai';
import { Docspot, createDocspotUrl } from 'docspot';
import { createChat } from 'docspot/chat';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import 'docspot/styles.css';
import './style.css';
import { findPage, pages } from './pages';

const chat = createChat({
  transport: new DefaultChatTransport({ api: '/api/chat' }),
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
                if (event.metaKey || event.ctrlKey || event.shiftKey) return;
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
          navigate={url => navigate(url)}
          context={{
            page: { url: page.url, title: page.title, prompts: page.prompts },
            prompts: ['What can I build with Acme?'],
            resolvePage: url => findPage(url),
          }}
          loadPage={async ({ url }) => findPage(url)?.markdown ?? null}
          onEvent={event => console.debug('[docspot]', event)}
        />
      </header>
      <main className="content">
        <article>
          {page.markdown
            .split('\n\n')
            .map((block, index) =>
              index === 0 ? (
                <h1 key={index}>{block.replace(/^# /, '')}</h1>
              ) : (
                <p key={index}>{block}</p>
              )
            )}
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
