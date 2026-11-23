import type { AlgoliaHitInsights } from '@/algolia/createAlgoliaSearch';
import type { DocspotEvent } from '@/types';

export type AlgoliaInsightsOptions = {
  appId: string;
  /** A search-only API key; it needs the `search` ACL, as for queries. */
  apiKey: string;
  /**
   * Identifies the reader, such as a signed-in user's ID, or an anonymous
   * token your site already keeps. Called for each query and event, so it
   * can change. Without one, or when it returns undefined, an
   * `anonymous-` token is made for the page's lifetime and kept nowhere.
   */
  userToken?: string | (() => string | undefined);
  /** Names the click events in the Algolia dashboard. */
  eventName?: string;
};

export type AlgoliaInsights = {
  /**
   * Sends a click event for a `search.select` event on a result from
   * `createAlgoliaSearch` with `insights` on, and ignores every other event.
   */
  onEvent: (event: DocspotEvent) => void;
  /** The token sent with events and, through `insights`, with queries. */
  getUserToken: () => string;
};

function createAnonymousToken() {
  // `randomUUID` is missing outside secure contexts, such as on plain HTTP.
  const crypto = globalThis.crypto as Partial<Crypto> | undefined;
  const id =
    crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `anonymous-${id}`;
}

function isHitInsights(value: unknown): value is AlgoliaHitInsights {
  if (typeof value !== 'object' || value === null) return false;
  const { indexName, queryID, position } = value as AlgoliaHitInsights;
  return (
    typeof indexName === 'string' &&
    typeof queryID === 'string' &&
    typeof position === 'number'
  );
}

/**
 * Reports search result clicks to Algolia Insights, for click-through and
 * conversion rates in the Algolia dashboard. Compose its `onEvent` into
 * Docspot's, and pass the object to `createAlgoliaSearch` as `insights`.
 */
export function createAlgoliaInsights({
  appId,
  apiKey,
  userToken,
  eventName = 'Search result clicked',
}: AlgoliaInsightsOptions): AlgoliaInsights {
  let anonymousToken: string | undefined;
  function getUserToken() {
    const token = typeof userToken === 'function' ? userToken() : userToken;
    return token || (anonymousToken ??= createAnonymousToken());
  }
  // Credentials in the URL and a plain text body make a simple request,
  // which skips the CORS preflight.
  const url = `https://insights.algolia.io/1/events?${new URLSearchParams({
    'X-Algolia-Application-Id': appId,
    'X-Algolia-API-Key': apiKey,
  })}`;
  return {
    getUserToken,
    onEvent(event) {
      if (event.type !== 'search.select' || !('result' in event)) return;
      const hit = event.result.data as
        { objectID?: unknown; _insights?: unknown } | undefined;
      const insights = hit?._insights;
      if (typeof hit?.objectID !== 'string' || !isHitInsights(insights)) return;
      // A failed event never affects search or navigation.
      try {
        fetch(url, {
          method: 'POST',
          body: JSON.stringify({
            events: [
              {
                eventType: 'click',
                eventName,
                index: insights.indexName,
                queryID: insights.queryID,
                objectIDs: [hit.objectID],
                positions: [insights.position],
                userToken: getUserToken(),
              },
            ],
          }),
          // Outlives the navigation the click starts.
          keepalive: true,
        }).catch(() => {});
      } catch {
        // `fetch` is missing or threw synchronously.
      }
    },
  };
}
