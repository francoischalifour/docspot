import { expect, it } from 'vitest';

import { isQuestion, shouldPrioritizeChat } from '../src';

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
