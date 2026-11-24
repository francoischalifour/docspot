/** The example's documentation, shared by the site and its chat backend. */
export type Page = {
  url: string;
  title: string;
  suggestions: string[];
  markdown: string;
};

export const pages: Page[] = [
  {
    url: '/',
    title: 'Getting started',
    suggestions: ['How do I install the CLI?', 'What does a project contain?'],
    markdown: `# Getting started

Install the CLI with \`npm install --global acme\`, then run \`acme init\` in an empty folder.

A project contains an \`acme.json\` file, a \`content\` folder, and a \`public\` folder for static assets.`,
  },
  {
    url: '/configuration',
    title: 'Configuration',
    suggestions: ['How do I change the port?', 'Which options are required?'],
    markdown: `# Configuration

\`acme.json\` accepts \`name\` (required), \`port\` (defaults to **3000**), and \`base\` for sites served under a path.

Environment variables prefixed with \`ACME_\` override options, such as \`ACME_PORT=8080\`.`,
  },
  {
    url: '/deployment',
    title: 'Deployment',
    suggestions: [
      'How do I deploy to a static host?',
      'Can I preview a build?',
    ],
    markdown: `# Deployment

Run \`acme build\` to write a static site to \`dist\`, then upload that folder to any static host.

Use \`acme preview\` to serve the build locally before deploying.`,
  },
];

export function findPage(url: string) {
  const path = new URL(url, 'https://example.invalid').pathname;
  return pages.find(page => page.url === path);
}
