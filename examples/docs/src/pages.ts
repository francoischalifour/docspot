/** The example's documentation, shared by the site, its index, and its chat backend. */
export type Page = {
  url: string;
  title: string;
  /** The sidebar section the page belongs to. */
  section: string;
  suggestions: string[];
  markdown: string;
};

export const pages: Page[] = [
  {
    url: '/',
    title: 'Getting started',
    section: 'Guides',
    suggestions: ['How do I install the CLI?', 'What does a project contain?'],
    markdown: `# Getting started

Acme turns a folder of Markdown into a documentation site.

## Install

Install the CLI with \`npm install --global acme\`, then run \`acme init\` in an empty folder.

## Project structure

A project contains an \`acme.json\` file, a \`content\` folder, and a \`public\` folder for static assets.`,
  },
  {
    url: '/configuration',
    title: 'Configuration',
    section: 'Reference',
    suggestions: ['How do I change the port?', 'Which options are required?'],
    markdown: `# Configuration

\`acme.json\` configures the site.

## Options

\`name\` is required. \`port\` defaults to **3000**, and \`base\` serves the site under a path.

## Environment variables

Environment variables prefixed with \`ACME_\` override options, such as \`ACME_PORT=8080\`.`,
  },
  {
    url: '/deployment',
    title: 'Deployment',
    section: 'Guides',
    suggestions: [
      'How do I deploy to a static host?',
      'Can I preview a build?',
    ],
    markdown: `# Deployment

## Build

Run \`acme build\` to write a static site to \`dist\`, then upload that folder to any static host.

## Preview

Use \`acme preview\` to serve the build locally before deploying.`,
  },
];

/** Heading text as a URL fragment: "Project structure" → "project-structure". */
export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '');
}

export function findPage(url: string) {
  const path = new URL(url, 'https://example.invalid').pathname;
  return pages.find(page => page.url === path);
}
