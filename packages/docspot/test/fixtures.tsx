import type { DocspotResult } from '@/index';

export const results: DocspotResult[] = [
  {
    url: '/docs/query/sql-explorer#example',
    title: 'Example',
    pageTitle: 'SQL Explorer',
    breadcrumb: ['Lakehouse', 'SQL Explorer'],
    group: 'Lakehouse',
    type: 'section',
    excerpt: 'Join product usage to account data.',
    highlights: {
      title: [{ text: 'Example', highlighted: false }],
      breadcrumb: [
        [{ text: 'Lakehouse', highlighted: true }],
        [{ text: 'SQL Explorer', highlighted: false }],
      ],
      excerpt: [
        { text: 'Join ', highlighted: false },
        { text: 'product', highlighted: true },
        { text: ' usage to account data.', highlighted: false },
      ],
    },
  },
  {
    url: '/docs/query/http-api',
    title: 'HTTP API',
    breadcrumb: ['Lakehouse'],
    group: 'Lakehouse',
    type: 'page',
    excerpt: 'Run a SQL query over HTTP.',
  },
  {
    url: '/docs/agents/setup',
    title: 'Connect your agent',
    breadcrumb: ['Agents'],
    group: 'Agents',
    type: 'page',
  },
];

export function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
