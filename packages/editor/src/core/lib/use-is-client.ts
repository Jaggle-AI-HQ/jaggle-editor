import { useSyncExternalStore } from "react";

function emptySubscribe() {
  return () => undefined;
}

/** False during server render and hydration, true once running in the browser. */
export function useIsClient() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}
