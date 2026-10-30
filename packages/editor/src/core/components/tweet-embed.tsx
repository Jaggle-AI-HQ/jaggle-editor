"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Loader2 } from "lucide-react";

const WIDGET_SCRIPT_URL = "https://platform.twitter.com/widgets.js";

type TwitterWindow = Window & {
  twttr?: {
    widgets: {
      createTweet: (
        tweetID: string,
        container: HTMLElement | null,
      ) => Promise<HTMLElement | undefined>;
    };
  };
};

let isTwitterScriptLoading = true;

/**
 * The X widget for one post, with a loading state and a link fallback. Shared
 * by the editor block and read-only views, so both show the same embed.
 */
export function TweetEmbed({ tweetID }: { tweetID: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isTweetLoading, setIsTweetLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const createTweet = useCallback(async () => {
    const widgets = (window as TwitterWindow).twttr?.widgets;
    if (!widgets) {
      setFailed(true);
      setIsTweetLoading(false);
      return;
    }
    try {
      await widgets.createTweet(tweetID, containerRef.current);
      isTwitterScriptLoading = false;
      setIsTweetLoading(false);
    } catch {
      setFailed(true);
      setIsTweetLoading(false);
    }
  }, [tweetID]);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!cancelled) {
        void createTweet();
      }
    };

    if (!isTwitterScriptLoading) {
      const frame = requestAnimationFrame(run);
      return () => {
        cancelled = true;
        cancelAnimationFrame(frame);
      };
    }

    const doc = containerRef.current?.ownerDocument ?? document;
    const existing = doc.querySelector<HTMLScriptElement>(
      `script[src="${WIDGET_SCRIPT_URL}"]`,
    );
    if (existing) {
      if ((window as TwitterWindow).twttr?.widgets) {
        const frame = requestAnimationFrame(run);
        return () => {
          cancelled = true;
          cancelAnimationFrame(frame);
        };
      }
      existing.addEventListener("load", run);
      return () => {
        cancelled = true;
        existing.removeEventListener("load", run);
      };
    }

    const script = doc.createElement("script");
    script.src = WIDGET_SCRIPT_URL;
    script.async = true;
    script.onload = run;
    script.onerror = () => {
      if (!cancelled) {
        setFailed(true);
        setIsTweetLoading(false);
      }
    };
    doc.body.appendChild(script);
    return () => {
      cancelled = true;
    };
  }, [createTweet]);

  return (
    <>
      {isTweetLoading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : null}
      {failed ? (
        <a
          href={`https://x.com/i/web/status/${tweetID}`}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline underline-offset-2"
        >
          {`https://x.com/i/web/status/${tweetID}`}
        </a>
      ) : null}
      {/* X's widget adds 10 px above and below the post; drop it so the
          caption sits as close as under other blocks. */}
      <div ref={containerRef} className="[&_.twitter-tweet]:my-0!" />
    </>
  );
}
