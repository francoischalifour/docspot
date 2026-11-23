import Markdown from 'react-markdown';

import { slugify } from './pages';

type PageMarkdownProps = {
  children: string;
  preview?: boolean;
};

export function PageMarkdown({ children, preview = false }: PageMarkdownProps) {
  return (
    <Markdown
      components={{
        h2: ({ children }) => {
          const anchor =
            typeof children === 'string' ? slugify(children) : undefined;
          return preview ? (
            <h2 data-docspot-anchor={anchor}>{children}</h2>
          ) : (
            <h2 id={anchor}>{children}</h2>
          );
        },
      }}
    >
      {children}
    </Markdown>
  );
}
