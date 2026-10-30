/**
 * The stylesheet exported HTML and PDF documents carry. The editor styles its
 * HTML with Tailwind classes, which mean nothing outside the app, so the
 * export drops classes and styles by tag and `data-*` attribute instead.
 * Light and print friendly; colors follow the editor's light theme.
 */
export const EXPORT_CSS = `
:root { color-scheme: light; }
body { margin: 0; background: #fff; color: #1f2328; font-family: Inter, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; }
article { max-width: 720px; margin: 0 auto; padding: 48px 24px; }
article > :first-child { margin-top: 0; }
h1, h2, h3, h4, h5, h6 { margin: 1.6em 0 0.6em; font-weight: 700; line-height: 1.25; }
h1 { font-size: 2em; } h2 { font-size: 1.5em; } h3 { font-size: 1.25em; } h4 { font-size: 1.1em; } h5, h6 { font-size: 1em; }
p { margin: 0.5em 0; }
a { color: #4f46e5; }
blockquote { margin: 1em 0; padding-left: 1em; border-left: 3px solid #d0d7de; color: #57606a; }
code { padding: 0.1em 0.35em; border-radius: 4px; background: #f3f4f6; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.9em; }
pre { margin: 1em 0; padding: 12px 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f6f8fa !important; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; line-height: 1.55; white-space: pre-wrap; overflow-x: auto; }
mark { padding: 0 0.1em; border-radius: 2px; background: #fef08a; color: inherit; }
hr { margin: 2em 0; border: 0; border-top: 1px solid #e5e7eb; }
img { max-width: 100%; height: auto; border-radius: 6px; }
video, iframe { max-width: 100%; border: 0; border-radius: 8px; }
audio { width: 100%; }
ul, ol { padding-left: 1.5em; }
table { margin: 1em 0; max-width: 100%; border-collapse: collapse; }
th, td { padding: 6px 10px; border: 1px solid #d0d7de !important; text-align: start; vertical-align: top; }
th { background: #f6f8fa; font-weight: 600; }
td > p, th > p { margin: 0; }
ul[data-list="check"] { padding-left: 0.25em; list-style: none; }
li[role="checkbox"]::before { content: "\\2610"; margin-right: 0.5em; }
li[role="checkbox"][aria-checked="true"]::before { content: "\\2611"; }
li[role="checkbox"][aria-checked="true"] { color: #6b7280; text-decoration: line-through; }
[data-lexical-mention], [data-lexical-datetime] { padding: 0 0.3em; border-radius: 4px; background: #f3f4f6; color: #374151; white-space: nowrap; }
[data-export-caption] { display: block; margin-top: 4px; color: #6b7280; font-size: 0.875em; text-align: left; }
[data-layout="columns"] { display: grid; gap: 24px; margin: 1em 0; }
[data-lexical-card], [data-lexical-review], details { margin: 1em 0; padding: 12px 16px; border: 1px solid #e5e7eb; border-radius: 8px; }
[data-lexical-card] > [data-lexical-slot="title"] { font-weight: 600; }
summary { font-weight: 600; }
summary > p { display: inline; margin: 0; }
[data-toggle] { margin: 0.5em 0; }
[data-toggle-title] { font-weight: 600; }
[data-toggle-title]::before { content: "\\25BE  "; color: #9ca3af; }
[data-toggle][data-level="1"] > [data-toggle-title] { font-size: 2em; }
[data-toggle][data-level="2"] > [data-toggle-title] { font-size: 1.5em; }
[data-toggle][data-level="3"] > [data-toggle-title] { font-size: 1.25em; }
[data-toggle-content] { padding-left: 1.25em; }
[data-lexical-pullquote] { margin: 1.5em 0; padding: 0 1.5em; font-size: 1.25em; font-style: italic; text-align: center; }
[data-lexical-pullquote] [data-lexical-slot="attribution"] { color: #6b7280; font-size: 0.8em; font-style: normal; }
[data-lexical-pullquote] [data-lexical-slot="attribution"] p::before, [data-lexical-review] [data-lexical-slot="author"] p::before { content: "\\2014  "; }
[data-lexical-review-stars] { color: #f59e0b; letter-spacing: 2px; }
[data-lexical-review] [data-lexical-slot="author"] { color: #6b7280; font-size: 0.9em; }
[data-lexical-poll-question] { display: inline-block; min-width: min(280px, 100%); max-width: 100%; box-sizing: border-box; vertical-align: top; text-align: left; margin: 0.5em 0; padding: 12px 16px; border: 1px solid #e5e7eb; border-radius: 8px; }
[data-lexical-poll-question] > span:first-child { display: block; margin-bottom: 8px; font-weight: 600; }
[data-lexical-poll-question] > span + span { position: relative; display: flex; justify-content: space-between; gap: 12px; margin-top: 4px; padding: 4px 8px; overflow: hidden; border-radius: 6px; background: #f9fafb; }
[data-lexical-poll-question] > span + span > span:first-child { position: absolute; inset: 0 auto 0 0; background: #e0e7ff; }
[data-lexical-poll-question] > span + span > span + span { position: relative; }
[data-lexical-poll-question] > span + span > span:last-child { color: #6b7280; }
[data-lexical-board] { margin: 1em 0; }
[data-lexical-board] > p { font-weight: 600; }
[data-lexical-board] > div { display: flex; align-items: flex-start; gap: 12px; }
[data-lexical-board] > div > div { flex: 1 1 0; min-width: 0; padding: 8px; border-radius: 8px; background: #f6f8fa; }
[data-lexical-board] > div > div > div:first-child { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 0.9em; font-weight: 600; }
[data-lexical-board] > div > div > div:first-child > span + span { color: #6b7280; font-weight: 400; }
[data-lexical-board] > div > div > div + div { margin-top: 6px; padding: 6px 8px; border: 1px solid #e5e7eb; border-radius: 6px; background: #fff; }
[data-lexical-board] > div > div > div + div > div { display: flex; gap: 8px; margin-top: 4px; color: #6b7280; font-size: 0.8em; }
a[data-lexical-file] { display: inline-block; margin: 0.5em 0; padding: 6px 10px; border: 1px solid #e5e7eb; border-radius: 6px; color: inherit; text-decoration: none; }
a[data-lexical-file]::before { content: "\\1F4CE  "; }
math[display="block"] { margin: 1em 0; }
@media print {
  article { max-width: none; padding: 0; }
  pre, table, img, [data-lexical-card], [data-lexical-board], [data-lexical-poll-question], [data-lexical-review], details { break-inside: avoid; }
  h1, h2, h3, h4 { break-after: avoid; }
}
`;
