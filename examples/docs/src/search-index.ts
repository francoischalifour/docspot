// Loaded on demand: the page pays for the index only once search is about
// to be used.
import MiniSearch from 'minisearch';

import { pages, slugify } from './pages';

export type Section = {
  id: string;
  title: string;
  pageTitle: string;
  section: string;
  text: string;
};

/** One document per heading, so results open at the matching section. */
const sections: Section[] = pages.flatMap(page =>
  page.markdown
    .split(/^## /m)
    .slice(1)
    .map(chunk => {
      const [heading = '', ...body] = chunk.split('\n');
      return {
        id: `${page.url}#${slugify(heading)}`,
        title: heading.trim(),
        pageTitle: page.title,
        section: page.section,
        text: body.join(' ').replace(/[`*]/g, '').trim(),
      };
    })
);

export const index = new MiniSearch<Section>({
  fields: ['title', 'pageTitle', 'text'],
  storeFields: ['title', 'pageTitle', 'section', 'text'],
  searchOptions: {
    boost: { title: 2, pageTitle: 1.5 },
    prefix: true,
    fuzzy: 0.2,
  },
});
index.addAll(sections);
