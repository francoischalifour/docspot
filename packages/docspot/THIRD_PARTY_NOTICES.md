# Third-party notices

Docspot bundles no third-party code or fonts. Its interface icons are original drawings. It depends on the following packages, which are installed alongside it under their own licenses.

## Trademarks

`docspot/handoffs` shows the ChatGPT logo, a trademark of OpenAI, and the Claude logo, a trademark of Anthropic, to identify the services a query opens in. Docspot is not affiliated with or endorsed by either company. Pass your own `icon` to a handoff to use different artwork.

## Dependencies

| Package                                                                                     | License | Loaded            |
| ------------------------------------------------------------------------------------------- | ------- | ----------------- |
| [`@algolia/autocomplete-core`](https://github.com/algolia/autocomplete)                     | MIT     | When search opens |
| [`react-markdown`](https://github.com/remarkjs/react-markdown) and its unified dependencies | MIT     | When chat opens   |
| [`remark-gfm`](https://github.com/remarkjs/remark-gfm)                                      | MIT     | When chat opens   |

## Peer dependencies

| Package                                                   | License    | Needed for                        |
| --------------------------------------------------------- | ---------- | --------------------------------- |
| [`react`, `react-dom`](https://github.com/facebook/react) | MIT        | Everything                        |
| [`ai`](https://github.com/vercel/ai)                      | Apache-2.0 | Chat                              |
| [`@ai-sdk/react`](https://github.com/vercel/ai)           | Apache-2.0 | Chat                              |
| [`minisearch`](https://github.com/lucaong/minisearch)     | MIT        | `docspot/minisearch` (types only) |

Algolia is a trademark of Algolia SAS. Docspot does not include Algolia's logos; sites that show "Search by Algolia" supply them through the `branding` slot.
