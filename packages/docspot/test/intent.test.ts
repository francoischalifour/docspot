import { expect, it } from 'vitest';

import { highlightTerms, isQuestion, shouldPrioritizeChat } from '@/index';
import { ar, de, es, fr, ja, zhCN } from '@/locale';

const locales = { ar, de, es, fr, ja, zhCN };

it('highlights text regardless of case or accents', () => {
  expect(highlightTerms('Thème sombre', ['theme'])).toEqual([
    { text: 'Thème', highlighted: true },
    { text: ' sombre', highlighted: false },
  ]);
  expect(highlightTerms('Café', ['CAFÉ'])).toEqual([
    { text: 'Café', highlighted: true },
  ]);
});

it.each([
  'how to share a data app',
  'How do I connect Snowflake?',
  'which connectors support CDC',
  'who can edit dashboards',
  'can Altertable sync Postgres',
  'will my queries be cached',
  'what’s the difference between insights and dashboards',
  'show me how to ingest events',
  'explain semantic models',
  "I'm trying to invite a teammate",
  'snowflake vs bigquery connector',
  'rotate api key?',
])('treats “%s” as a question', query => {
  expect(isQuestion(query)).toBe(true);
});

it.each([
  'how',
  'where clause',
  'when expression',
  'is null',
  'sql explorer',
  'data apps',
  'ingestion',
  'snake_case columns',
  'useAltertable()',
  'altertable.track',
])('treats “%s” as a lookup', query => {
  expect(isQuestion(query)).toBe(false);
});

it('lets chat lead only when no result answers the question', () => {
  const question = 'how do I join product usage with accounts';
  expect(
    shouldPrioritizeChat({
      query: question,
      pageTitles: [],
      hasResults: false,
      hasCompleteMatch: false,
    })
  ).toBe(true);
  expect(
    shouldPrioritizeChat({
      query: question,
      pageTitles: [],
      hasResults: true,
      hasCompleteMatch: true,
    })
  ).toBe(false);
  expect(
    shouldPrioritizeChat({
      query: 'what is the sql explorer',
      pageTitles: ['SQL Explorer'],
      hasResults: true,
      hasCompleteMatch: false,
    })
  ).toBe(false);
});

it.each([
  ['fr', 'Comment exporter un tableau ?'],
  ['fr', 'pourquoi mes requêtes sont lentes'],
  ['de', 'Wie installiere ich das Paket'],
  ['es', '¿Cómo exporto los datos'],
  ['es', 'como exportar datos a csv'],
  ['ja', 'データをエクスポートするにはどうすればいいですか'],
  ['zhCN', '如何导出数据'],
  ['zhCN', '这个功能支持导出吗'],
  ['ar', 'كيف أصدّر البيانات'],
  ['ar', 'هل يدعم التصدير؟'],
  // Readers search in English whatever the interface's language.
  ['fr', 'how do I export data'],
] as const)('treats a %s question, “%s”, as one', (name, query) => {
  expect(isQuestion(query, locales[name])).toBe(true);
});

it.each([
  ['fr', 'export tableau csv'],
  ['de', 'Paket installieren'],
  ['ja', 'データ エクスポート'],
  ['zhCN', '导出数据'],
] as const)('treats %s keywords, “%s”, as keywords', (name, query) => {
  expect(isQuestion(query, locales[name])).toBe(false);
});

it('recognizes questions in a language a site’s own locale describes', () => {
  const italian = { code: 'it', questions: { starts: ['come', 'perche'] } };
  expect(isQuestion('come esporto i dati', italian)).toBe(true);
  expect(isQuestion('come esporto i dati')).toBe(false);
});
