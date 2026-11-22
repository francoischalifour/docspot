# Changelog

## [0.2.0](https://github.com/francoischalifour/docspot/compare/0.1.0...0.2.0) (2026-11-22)


### ⚠ BREAKING CHANGES

* keep search results apart from site items ([#16](https://github.com/francoischalifour/docspot/issues/16))
* `search.continueConversation` and `chat.newConversation` messages are removed; override `search.continueChat` and `chat.newChat`.
* `DocspotSearchResult` and `DocspotCommand` are replaced by `DocspotItem`: `url` and `run` become `action`. `defaultResults` becomes `defaultItems`, `commands` becomes `items`, and a search response object returns `items` instead of `results`. Slot props and the handoff context pass `item`/`items` instead of `result`/`results`, and the `resultIcon` slot now draws every item without its own `icon`, actions included. The `search.command` event folds into `search.select`, which carries `item`. The `messages.search.commands` key is now `actions`. MiniSearch documents set `action` instead of `url`.

### Features

* add commands, things to do found by typing in search ([#8](https://github.com/francoischalifour/docspot/issues/8)) ([89e8d62](https://github.com/francoischalifour/docspot/commit/89e8d62263748b84f5a738bf60e0245d0f4c5e9f))
* add createSearch ([d539a57](https://github.com/francoischalifour/docspot/commit/d539a57ec62957865a091698a3d6b04a4ffe32a9))
* **chat:** render tool calls in answers ([a0dad81](https://github.com/francoischalifour/docspot/commit/a0dad81ed1583fb62582be5bc419f30a1d840f3a))
* control search and chat open state and the query ([3111627](https://github.com/francoischalifour/docspot/commit/31116276590c9d651ec887be7c48be568123665a))
* keep search results apart from site items ([#16](https://github.com/francoischalifour/docspot/issues/16)) ([3b043dd](https://github.com/francoischalifour/docspot/commit/3b043dd7f806ff6f288d49d42df6c20d0f717e16))
* keep useDocspot methods stable across renders ([24e4171](https://github.com/francoischalifour/docspot/commit/24e4171fdc630ffc7a139f599e7a5209f0979ad9))
* mark React chunks 'use client' for React Server Components ([a8bbf0b](https://github.com/francoischalifour/docspot/commit/a8bbf0ba7f6e2306b78aefcd662c5b35bc6382cc))
* render triggers as your own element with a render prop ([583ec12](https://github.com/francoischalifour/docspot/commit/583ec12ef7b1f66696f9d48c87a2119419e796e0))
* scope shortcuts and docked layout to an owner element ([a806525](https://github.com/francoischalifour/docspot/commit/a806525903dd6efbbea96203d6d3edd540d57be8))
* simplify defaults to one Ask AI path and no empty preview pane ([#4](https://github.com/francoischalifour/docspot/issues/4)) ([079366d](https://github.com/francoischalifour/docspot/commit/079366d78ac2fb52d6fb0eaffb84fc87dea7be2a))
* **styles:** document every token and fix dark and contrast defaults ([94e7ed9](https://github.com/francoischalifour/docspot/commit/94e7ed9f3504407070d8b00cf552b206921d57b1))
* **styles:** match native parts to the palette, and theme any section ([40e6f46](https://github.com/francoischalifour/docspot/commit/40e6f46263a407e3ba678e62b502fd95971302e9))
* support right-to-left pages ([65acb40](https://github.com/francoischalifour/docspot/commit/65acb4095e720407d564af4bdbbc8f6648f7bc53))
* unify search results and commands into one item shape ([#9](https://github.com/francoischalifour/docspot/issues/9)) ([519ca72](https://github.com/francoischalifour/docspot/commit/519ca72e54d3db430e50717bb7db976f71445cc9))


### Bug Fixes

* accept AI SDK 6 and 7 and MiniSearch 6 as peers ([#15](https://github.com/francoischalifour/docspot/issues/15)) ([c6c795f](https://github.com/francoischalifour/docspot/commit/c6c795fe5ba6e17360a30e2e0e254a1eae775f22))
* **chat:** draw the source arrow in proportion to its label ([260684b](https://github.com/francoischalifour/docspot/commit/260684bf44a3a071fd8c686fc03f29c335c49931))
* **chat:** hide generic progress while a tool's renderer shows its own ([6918dc1](https://github.com/francoischalifour/docspot/commit/6918dc1f915ff6751fd9bedf092eba1991f59508))
* **chat:** open sources in place and jump only to unread content ([77b8909](https://github.com/francoischalifour/docspot/commit/77b890984f689746be8bbfa72e745f2b617a8127))
* **chat:** recover from startup failures without resending questions ([484c403](https://github.com/francoischalifour/docspot/commit/484c4038f2a9091ac29fa67e5ff897ba38875065))
* **chat:** show a search for the question as asked as thinking ([f39acb7](https://github.com/francoischalifour/docspot/commit/f39acb78d67a14ab63c9640bb44185158ef3f77c))
* **chat:** synchronize history and isolate session lifecycles ([e26c18b](https://github.com/francoischalifour/docspot/commit/e26c18ba2e4a0ef3452ac4b0abd870bbe03ba2c9))
* keep consumer trigger props and message overrides working ([71767cb](https://github.com/francoischalifour/docspot/commit/71767cb57e67681c5500bc7207f16eb840574c5e))
* keep keyboard shortcuts working on non-Latin layouts ([da20bb4](https://github.com/francoischalifour/docspot/commit/da20bb4aa3e6c99346961ab9a408ec32ff5ab94d))
* keep results while a search is in flight, unify naming, raise type scale ([#3](https://github.com/francoischalifour/docspot/issues/3)) ([436daf0](https://github.com/francoischalifour/docspot/commit/436daf001e8770c32669f4f831ad02aed297caee))
* remove dead code and duplicate message keys, cancel idle preload ([#13](https://github.com/francoischalifour/docspot/issues/13)) ([c8b6a77](https://github.com/francoischalifour/docspot/commit/c8b6a7708c384f9e89f3cdece10964758f7654f8))
* **search:** align displayed results, previews, and navigation ([0671a8d](https://github.com/francoischalifour/docspot/commit/0671a8d28347b619969c1f75b28723a916f50a7b))
* **search:** highlight plain result titles and clarify ask context ([4825752](https://github.com/francoischalifour/docspot/commit/4825752cca6ee6933039ff6b5308c718ea8a1373))
* **search:** improve the Ask AI preview on wide screens ([a9b6767](https://github.com/francoischalifour/docspot/commit/a9b6767ec6fc92d9dcfb07c51489dc7ed86f7e00))
* **search:** keep configured previews visible while searching ([1e074f5](https://github.com/francoischalifour/docspot/commit/1e074f5487b99634e66904d24575f4e44add5f87))
* **styles:** support right-to-left key hints, high contrast, print, and more contrast ([b482d9e](https://github.com/francoischalifour/docspot/commit/b482d9eec4756da5bd759fea37771b452b56274c))
* **ui:** use shared shimmer for visible loading labels ([4cfa6a6](https://github.com/francoischalifour/docspot/commit/4cfa6a66314f89d13e5e4fdba735e66c3727bb1e))


### Performance Improvements

* memoize answers and load the chat panel frame with chat ([f29b476](https://github.com/francoischalifour/docspot/commit/f29b4762418602cc9e74d87659bc7b658e3857b5))
* name every regex as a constant and build none in hot paths ([c03b712](https://github.com/francoischalifour/docspot/commit/c03b712ef080e340579f5f7f68dadeda3c6617ed))
* **search:** render only the rows a selection change affects ([9c4cce5](https://github.com/francoischalifour/docspot/commit/9c4cce58f94446620db767a4e8a26897b016b379))
