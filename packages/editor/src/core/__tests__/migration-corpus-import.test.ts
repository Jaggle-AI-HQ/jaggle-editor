// @vitest-environment happy-dom
/**
 * Imports the backend migration job's corpus (HTML documents and Lexical
 * comment JSON) into the app's real editors and checks nothing is lost.
 * fixtures/migration-corpus.json comes from jaggle-ai-be
 * scripts/lexical-migration: `node test/corpus.mjs <this fixture>`.
 * MIGRATION_CORPUS points the test at another corpus.
 */
import { readFileSync } from "node:fs";

import { buildEditorFromExtensions, HorizontalRuleExtension } from "@lexical/extension";
import { CodeExtension } from "@lexical/code";
import { HistoryExtension } from "@lexical/history";
import { $generateHtmlFromNodes } from "@lexical/html";
import { LinkExtension } from "@lexical/link";
import { ListExtension } from "@lexical/list";
import { RichTextExtension } from "@lexical/rich-text";
import { TableExtension } from "@lexical/table";
import { $getRoot, configExtension, defineExtension } from "lexical";
import { describe, expect, it } from "vitest";

import { splitCommentEditorState } from "../comment/attachment-content";
import { createHeadlessDocumentEditor } from "../document/headless";
import { commentNodes } from "../lib/comment-nodes";
import { $replaceWithHtml } from "../lib/transfer";

import fixture from "./fixtures/migration-corpus.json";

type N = Record<string, any> & { type: string; children?: N[] };

type Corpus = {
  documents: Record<string, string>;
  comments: Record<string, { content: { state: any }; plainText: string }>;
};
const corpus: Corpus = process.env.MIGRATION_CORPUS
  ? JSON.parse(readFileSync(process.env.MIGRATION_CORPUS, "utf8"))
  : fixture;

function importDoc(name: string): N[] {
  const editor = createHeadlessDocumentEditor();
  editor.update(() => $replaceWithHtml(corpus.documents[name]), { discrete: true });
  const root = (editor.getEditorState().toJSON().root as unknown as N).children ?? [];
  editor.dispose();
  // $replaceWithHtml leaves the seed paragraph after the content; the editor
  // keeps a trailing empty line anyway.
  const last = root[root.length - 1];
  if (last?.type === "paragraph" && !last.children?.length) root.pop();
  return root;
}

const walk = (n: N, out: N[] = []): N[] => {
  out.push(n);
  n.children?.forEach((c) => walk(c, out));
  return out;
};
const all = (nodes: N[]) => nodes.flatMap((n) => walk(n));
const ofType = (nodes: N[], t: string) => all(nodes).filter((n) => n.type === t);
const text = (nodes: N[], t: string) => {
  const f = all(nodes).find((n) => n.type === "text" && n.text === t);
  if (!f) throw new Error(`no text node "${t}"`);
  return f;
};
const style = (n: N) => Object.fromEntries(
  String(n.style ?? "").split(";").filter(Boolean).map((s) => s.split(":").map((x) => x.trim()) as [string, string]),
);

describe("documents", () => {
  it("marks", () => {
    const d = importDoc("marks");
    expect(["bold", "italic", "underline", "strike", "code", "all"].map((t) => text(d, t).format))
      .toEqual([1, 2, 8, 4, 16, 15]);
  });
  it("colours", () => {
    const d = importDoc("colours");
    expect(style(text(d, "red")).color).toBe("#e03e3e");
    expect(style(text(d, "yellow bg"))["background-color"]).toBe("#fbf3db");
    const both = text(d, "both");
    expect(both.format).toBe(1);
    expect(style(both).color).toBe("#0b6e99");
    expect(style(both)["background-color"]).toBe("#ebeced");
  });
  it("block_colours", () => {
    const d = importDoc("block_colours");
    const ts = all(d).filter((n) => n.type === "text");
    expect(ts.length).toBeGreaterThan(0);
    for (const t of ts) {
      expect(style(t).color).toBe("#6940a5");
      expect(style(t)["background-color"]).toBe("#ddedea");
    }
    expect(text(d, "bold").format).toBe(1);
  });
  it("link", () => {
    const l = ofType(importDoc("link"), "link")[0];
    expect(l.url).toBe("https://example.com/a?b=1&c=2");
    expect(l.children![0]).toMatchObject({ text: "docs", format: 1 });
  });
  it("hard_break", () => {
    const p = importDoc("hard_break");
    expect(p).toHaveLength(1);
    expect(p[0].children!.map((c) => c.type)).toEqual(["text", "linebreak", "text"]);
    expect(p[0].children!.map((c) => c.text)).toEqual(["line one", undefined, "line two"]);
  });
  it("alignment", () => {
    const d = importDoc("alignment");
    expect(d[0]).toMatchObject({ type: "paragraph", format: "center" });
    expect(d[1]).toMatchObject({ type: "paragraph", format: "right" });
    expect(d[2]).toMatchObject({ type: "heading", tag: "h2", format: "justify" });
  });
  it("headings", () => {
    expect(importDoc("headings").map((n) => n.tag)).toEqual(["h1", "h2", "h3", "h4", "h5", "h6"]);
  });
  it("bullet_list", () => {
    const d = importDoc("bullet_list");
    expect(d[0]).toMatchObject({ type: "list", listType: "bullet" });
    expect(ofType(d, "list")).toHaveLength(2);
    const items = d[0].children!;
    expect(items[0].children![0].text).toBe("one");
    expect(items[1].children![0]).toMatchObject({ type: "list", listType: "bullet" });
    expect(text(d, "two").format).toBe(1);
  });
  it("numbered_list", () => {
    const d = importDoc("numbered_list");
    expect(d[0]).toMatchObject({ type: "list", listType: "number", start: 3 });
    expect(ofType(d, "list")[1]).toMatchObject({ listType: "number" });
  });
  it("check_list", () => {
    const d = importDoc("check_list");
    expect(d[0]).toMatchObject({ listType: "check" });
    const li = (t: string) => ofType(d, "listitem").find((i) => i.children![0].text === t)!;
    expect(li("done").checked).toBe(true);
    expect(!!li("open").checked).toBe(false);
    expect(li("nested done").checked).toBe(true);
    expect(ofType(d, "list").every((l) => l.listType === "check")).toBe(true);
  });
  it("mixed_nested_list", () => {
    const d = importDoc("mixed_nested_list");
    expect(d[0]).toMatchObject({ listType: "bullet" });
    const inner = ofType(d, "list").slice(1).map((l) => l.listType);
    expect(inner).toEqual(["check", "number"]);
  });
  it("list_item_with_paragraph_child", () => {
    const d = importDoc("list_item_with_paragraph_child");
    const items = ofType(d, "listitem");
    expect(items).toHaveLength(1);
    expect(items[0].children!.map((c) => c.text ?? c.type)).toEqual(["item", "linebreak", "child paragraph"]);
  });
  it("coloured_list_item", () => {
    expect(style(text(importDoc("coloured_list_item"), "red item")).color).toBe("#e03e3e");
  });
  it("quote", () => {
    const d = importDoc("quote");
    expect(d[0].type).toBe("quote");
    expect(text(d, "bold").format).toBe(1);
  });
  it("code_block", () => {
    const d = importDoc("code_block");
    expect(d[0]).toMatchObject({ type: "code", language: "javascript" });
    expect(d[0].children!.map((c) => c.text ?? c.type)).toEqual(["const a = 1;", "linebreak", "if (a < 2) {}"]);
    expect(d[1].type).toBe("code");
    expect(d[1].children![0].text).toBe("plain");
  });
  it("divider", () => {
    expect(importDoc("divider").map((n) => n.type)).toEqual(["paragraph", "horizontalrule", "paragraph"]);
  });
  it("table", () => {
    const d = importDoc("table");
    const t = d[0];
    expect(t.type).toBe("table");
    expect(t.colWidths).toEqual([160, 240]);
    const rows = t.children!;
    expect(rows).toHaveLength(3);
    expect(rows[0].children!.every((c) => c.headerState > 0)).toBe(true);
    expect(rows[1].children).toHaveLength(1);
    expect(rows[1].children![0]).toMatchObject({ colSpan: 2, backgroundColor: "#fbf3db" });
    expect(style(text([rows[1]], "spans two")).color).toBe("#e03e3e");
    const c = rows[2].children![0].children!;
    expect(c).toHaveLength(2);
    expect(c.every((p) => p.type === "paragraph" && p.format === "center")).toBe(true);
  });
  it("image", () => {
    const d = importDoc("image");
    expect(d[0]).toMatchObject({ type: "paragraph", format: "center" });
    expect(d[0].children![0]).toMatchObject({
      type: "image", src: "https://bucket.example/a.png", altText: "a.png", width: 320, caption: "A caption",
    });
  });
  it("image_reference", () => {
    const i = ofType(importDoc("image_reference"), "image")[0];
    expect(i.src).toMatch(/^jaggle-file:\/\/attachment\//);
    expect(i.attachmentId).toBe("33333333-3333-4333-8333-333333333333");
  });
  it("video", () => {
    expect(importDoc("video")[0]).toMatchObject({
      type: "video", src: "https://bucket.example/v.mp4", name: "v.mp4", width: 480, format: "right",
    });
  });
  it("audio", () => {
    expect(importDoc("audio")[0]).toMatchObject({ type: "audio", src: "https://bucket.example/a.mp3" });
  });
  it("file", () => {
    expect(importDoc("file")[0]).toMatchObject({ type: "file", name: "report.pdf", caption: "Q3" });
  });
  it("toggle_list", () => {
    const t = importDoc("toggle_list")[0];
    expect(t).toMatchObject({ type: "toggle", variant: "list" });
    expect(t.children!.map((c) => c.type)).toEqual(["toggle-title", "toggle-content"]);
    expect(t.children![0].children![0].text).toBe("toggle title");
    expect(t.children![1].children![0].type).toBe("paragraph");
  });
  it("toggle_heading", () => {
    expect(importDoc("toggle_heading")[0]).toMatchObject({ type: "toggle", variant: "heading", level: 2 });
  });
  it("indented_children", () => {
    const d = importDoc("indented_children");
    expect(d.map((n) => n.indent ?? 0).slice(0, 3)).toEqual([0, 1, 2]);
  });
  // KNOWN LOSS: a top-level list cannot carry an indent in Lexical (list item
  // indent is derived from list nesting), so the importer drops the
  // padding-inline-start on <ul>. be-migration.md 6.3 says the same.
  it.fails("indented_children: the list keeps its indent", () => {
    const d = importDoc("indented_children");
    expect(ofType(d, "listitem")[0].indent ?? 0).toBeGreaterThanOrEqual(1);
  });
  it("lifted_out_of_list", () => {
    const d = importDoc("lifted_out_of_list");
    expect(d.map((n) => n.type)).toEqual(["list", "table", "paragraph", "list"]);
    expect(d[0]).toMatchObject({ listType: "number", start: 1 });
    expect(d[3]).toMatchObject({ listType: "number", start: 2 });
    expect(d[2].indent).toBe(1);
    text(d, "cell");
  });
  // Every visible character of every document survives the import. Media
  // nodes report their file name as text; the HTML has it as data-name.
  it.each(Object.keys(corpus.documents))("%s keeps its text", (name) => {
    const dom = new DOMParser().parseFromString(corpus.documents[name], "text/html");
    const mediaNames = [...dom.querySelectorAll("[data-name]")].map((media) => media.getAttribute("data-name") ?? "");
    dom.querySelectorAll("a[data-lexical-file]").forEach((file) => file.remove());
    const editor = createHeadlessDocumentEditor();
    editor.update(() => $replaceWithHtml(corpus.documents[name]), { discrete: true });
    let imported = editor.getEditorState().read(() => $getRoot().getTextContent());
    editor.dispose();
    for (const mediaName of mediaNames) imported = imported.replace(mediaName, "");
    const visible = (value: string) => value.replace(/\s/g, "");
    expect(visible(imported)).toBe(visible(dom.body.textContent ?? ""));
  });
  // The job writes the editor's theme classes (jaggle-ai-be
  // scripts/lexical-migration/src/theme.js) so read-only views style its HTML:
  // each themed element carries the classes the editor's own export gives it.
  // Tables are left out: the headless export drops them.
  it.each(Object.keys(corpus.documents))("%s has the editor's theme classes", (name) => {
    const editor = createHeadlessDocumentEditor();
    editor.update(() => $replaceWithHtml(corpus.documents[name]), { discrete: true });
    const exported = editor.getEditorState().read(() => $generateHtmlFromNodes(editor, null));
    editor.dispose();
    const themed = (html: string, tag: string) =>
      [...new DOMParser().parseFromString(html, "text/html").body.querySelectorAll(tag)].filter(
        (element) => element.hasAttribute("class") && !element.closest("table"),
      );
    const classes = (element: Element) => [...element.classList].sort().join(" ");
    for (const tag of ["p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "ul", "ol", "li", "a", "pre"]) {
      const ours = themed(corpus.documents[name], tag);
      const editors = themed(exported, tag);
      ours.forEach((element, index) => {
        expect(classes(element), `${tag} #${index}: regenerate the corpus after a theme change`).toBe(
          editors[index] ? classes(editors[index]) : "",
        );
      });
    }
  });
  it("thread_anchors", () => {
    const d = importDoc("thread_anchors");
    const marks = ofType(d, "mark");
    const A = "11111111-1111-4111-8111-111111111111";
    const B = "22222222-2222-4222-8222-222222222222";
    expect(marks.map((m) => m.ids)).toEqual([[A], [A, B]]);
    expect(marks[0].children![0].text).toBe("anchored");
    expect(marks[1].children![0]).toMatchObject({ text: "two threads", format: 1 });
  });
  it("empty_paragraph", () => {
    const d = importDoc("empty_paragraph");
    expect(d.map((n) => n.children?.[0]?.text ?? "")).toEqual(["a", "", "b"]);
  });
  it("escaping", () => {
    expect(text(importDoc("escaping"), '<script>alert(1)</script> & "quotes"')).toBeTruthy();
  });
  it("markdown", () => {
    const d = importDoc("markdown");
    expect(d.map((n) => n.type)).toEqual(["heading", "paragraph", "quote", "list", "list", "code", "horizontalrule", "paragraph"]);
    expect(d[0].tag).toBe("h1");
    expect([text(d, "bold").format, text(d, "italic").format, text(d, "strike").format, text(d, "code").format]).toEqual([1, 2, 4, 16]);
    expect(ofType(d, "link")[0].url).toBe("https://example.com");
    expect(d[3].listType).toBe("number");
    expect(d[4].listType).toBe("check");
    expect(d[5].language).toBe("js");
    // Lines, whether or not the code is split into highlight tokens.
    const codeLines = d[5].children!
      .map((c) => (c.type === "linebreak" ? "\n" : (c.text ?? "")))
      .join("")
      .split("\n");
    expect(codeLines).toEqual(["let a = 1;", "let b = 2;"]);
    expect(ofType(d, "image")).toHaveLength(1);
  });
  it("plain_text_description", () => {
    const d = importDoc("plain_text_description");
    expect(d.map((n) => n.children?.[0]?.text ?? "")).toEqual(["First line", "Second & <third>", "", "Last"]);
  });
  it("markdown_description", () => {
    const d = importDoc("markdown_description");
    expect(d.map((n) => n.type)).toEqual(["heading", "paragraph", "list"]);
    expect(d[0].tag).toBe("h2");
    expect(d[1].children!.map((c) => c.type)).toEqual(["text", "linebreak", "text"]);
    expect(ofType(d, "listitem")[0].checked).toBe(true);
  });
  it("blocknote_html_description", () => {
    const d = importDoc("blocknote_html_description");
    expect(d[0].tag).toBe("h3");
    const s = text(d, "Scope");
    expect(s.format).toBe(1);
    expect(style(s).color).toBe("#0b6e99");
    expect(ofType(d, "listitem")[0].checked).toBe(true);
    expect(style(text(d, "now"))["background-color"]).toBe("#fbf3db");
  });
});

// The comment composer's configuration (comment/composer.tsx), minus the React view.
const commentEditor = () =>
  buildEditorFromExtensions(
    defineExtension({
      name: "migration-test/comment",
      namespace: "JaggleComment",
      dependencies: [
        RichTextExtension,
        HistoryExtension,
        ListExtension,
        LinkExtension,
        CodeExtension,
        HorizontalRuleExtension,
        configExtension(TableExtension, {
          hasCellMerge: false,
          hasCellBackgroundColor: false,
          hasHorizontalScroll: false,
        }),
      ],
      nodes: () => commentNodes,
      $initialEditorState: null,
    }),
  );

function loadComment(name: string, strip: boolean) {
  const raw = corpus.comments[name].content.state;
  const split = splitCommentEditorState(raw);
  const state = strip ? split.editorState : raw;
  const editor = commentEditor();
  let rootText = "";
  let children: N[] = [];
  if (state) {
    editor.setEditorState(editor.parseEditorState(JSON.stringify(state)));
    children = (editor.getEditorState().toJSON().root as unknown as N).children ?? [];
    rootText = editor.getEditorState().read(() => $getRoot().getTextContent());
  }
  editor.dispose();
  return { children, rootText, attachment: split.attachment };
}
// MentionNode.getTextContent() is the bare title; the "@" is added by the view.
const norm = (s: string) => s.replace(/\s+/g, "").replace(/@/g, "");

describe("comments (app path: splitCommentEditorState then parseEditorState)", () => {
  for (const name of Object.keys(corpus.comments)) {
    it(`${name} parses and root text equals plainText`, () => {
      const r = loadComment(name, true);
      expect(norm(r.rootText)).toBe(norm(corpus.comments[name].plainText));
    });
  }
  it("plate_marks formats", () => {
    const t = ofType(loadComment("plate_marks", true).children, "text");
    expect(t.map((x) => x.format)).toEqual([1, 2, 8, 4, 16, 128, 32, 64]);
  });
  it("plate_blocks", () => {
    const c = loadComment("plate_blocks", true).children;
    expect(c.map((n) => n.type)).toEqual(["heading", "paragraph", "quote", "code", "horizontalrule"]);
    expect(c[0].tag).toBe("h1");
    expect(c[1].format).toBe("center");
    expect(c[3].language).toBe("go");
  });
  it("plate_lists", () => {
    const c = loadComment("plate_lists", true).children;
    expect(c.map((n) => n.listType)).toEqual(["bullet", "number", "check"]);
    expect(ofType(c, "list")).toHaveLength(4);
    expect(ofType(c, "listitem").find((i) => i.checked)).toBeTruthy();
  });
  it("mentions", () => {
    for (const n of ["plate_link_and_mention", "thread_comment"]) {
      const m = ofType(loadComment(n, true).children, "mention");
      expect(m).toHaveLength(1);
      expect(m[0].entityId).toMatch(/^user-/);
      expect(ofType(loadComment(n, true).children, "link")).toHaveLength(1);
    }
  });
  it("plate_table", () => {
    const t = loadComment("plate_table", true).children[0];
    expect(t.type).toBe("table");
    expect(t.children).toHaveLength(2);
    expect(t.children![0].children![0].headerState).toBeGreaterThan(0);
  });
  it("plate_image: becomes the comment's attachment with attachmentId", () => {
    const r = loadComment("plate_image", true);
    expect(r.attachment).toMatchObject({ kind: "image", attachmentId: "33333333-3333-4333-8333-333333333333" });
  });
  it("plate_file / plate_video: become the comment's attachment", () => {
    expect(loadComment("plate_file", true).attachment).toMatchObject({ kind: "file", name: "report.pdf" });
    expect(loadComment("plate_video", true).attachment).toMatchObject({ kind: "video", name: "v.mp4" });
  });
});

// The comment editor registers only MentionNode and ImageNode, so file/video
// nodes can only load through splitCommentEditorState (above).
describe("comments (raw parseEditorState, no attachment split)", () => {
  it("plate_image parses", () => {
    expect(() => loadComment("plate_image", false)).not.toThrow();
  });
  for (const name of ["plate_file", "plate_video"]) {
    it(`${name} is not a node of the comment editor`, () => {
      expect(() => loadComment(name, false)).toThrow(/not found/);
    });
  }
});
