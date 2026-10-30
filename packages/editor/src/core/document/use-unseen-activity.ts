"use client";

import { useEffect, useState } from "react";

function readSeenAt(key: string | null): number | null {
  if (!key) return null;
  try {
    const value = Number(window.localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function writeSeenAt(key: string | null, value: number) {
  if (!key) return;
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Storage can be unavailable (private mode); the dot then resets per visit.
  }
}

/**
 * Whether a panel has activity newer than the last time the viewer had it
 * open. `latest` is the newest relevant timestamp (0 for none). The first
 * visit counts as seen, so existing activity is not flagged. "Seen" is kept
 * per viewer in the browser under `storageKey`, or for this visit without one.
 */
export function useUnseenActivity(
  storageKey: string | null,
  latest: number,
  open: boolean,
): boolean {
  const [seenAt, setSeenAt] = useState(
    () => readSeenAt(storageKey) ?? Date.now(),
  );

  // While the panel is open, everything in it counts as seen.
  if (open && latest > seenAt) {
    setSeenAt(latest);
  }

  // Persist when the viewer looked (not the newest item's time), and the
  // first visit, so a later visit compares against that moment.
  useEffect(() => {
    if (open) {
      writeSeenAt(storageKey, Math.max(Date.now(), latest));
    } else if (readSeenAt(storageKey) === null) {
      writeSeenAt(storageKey, seenAt);
    }
  }, [latest, open, seenAt, storageKey]);

  return !open && latest > seenAt;
}
