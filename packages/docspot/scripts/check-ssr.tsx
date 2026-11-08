// Renders every surface on the server, where neither window nor storage
// exists, as frameworks with server rendering or prerendering do.
import { DefaultChatTransport } from 'ai';
import { renderToString } from 'react-dom/server';

import { Docspot } from '../dist/index.js';
import { createChat } from '../dist/chat.js';

if (typeof window !== 'undefined')
  throw new Error('Expected a server environment');

const chat = createChat({
  transport: new DefaultChatTransport({ api: '/api/chat' }),
});
const html = renderToString(
  <Docspot
    search={() => []}
    chat={chat}
    history
    syncUrl
    context={{ page: { url: '/docs', title: 'Docs' } }}
  >
    <Docspot.ChatTrigger />
  </Docspot>
);
for (const text of ['Search or ask docs', 'Ask AI']) {
  if (!html.includes(text))
    throw new Error(`Server render is missing “${text}”`);
}
console.log(`✓ server render (${html.length} characters)`);
