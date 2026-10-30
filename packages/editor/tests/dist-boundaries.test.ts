import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// An app's first-load JavaScript gets the entry and its static imports. The
// editors, Yjs, the emoji data, KaTeX and the Word importer must load only
// when an editor opens (a dynamic import), as they did inside jaggle-app-fe.
// (The read-only view draws boards, so @dnd-kit/react loads with it, as in
// jaggle-app-fe.) Reads the built package, so `npm run build` runs first.
const dist = path.resolve(import.meta.dirname, "../dist");
const lazyPackages = /^(yjs$|y-websocket|@lexical\/yjs|@emoji-mart\/|katex|mammoth)/;

const IMPORT = /(?:^|[\n;])\s*(?:import|export)\s*(?:[^;"']*?\sfrom\s*)?["']([^"']+)["']/g;
const DYNAMIC = /import\(\s*["']([^"']+)["']\s*\)/g;

function readModule(file: string) {
  const source = readFileSync(path.join(dist, file), "utf8");
  return {
    staticImports: [...source.matchAll(IMPORT)].map((match) => match[1]),
    dynamicImports: [...source.matchAll(DYNAMIC)].map((match) => match[1]),
  };
}

function staticGraph(entry: string) {
  const files = new Set<string>();
  const packages = new Set<string>();
  const queue = [entry];
  while (queue.length) {
    const file = queue.shift()!;
    if (files.has(file)) continue;
    files.add(file);
    for (const specifier of readModule(file).staticImports) {
      if (specifier.startsWith("./")) queue.push(specifier.slice(2));
      else packages.add(specifier);
    }
  }
  return { files, packages };
}

describe("built entry points", () => {
  it("is built", () => {
    expect(existsSync(path.join(dist, "index.js")), "run `npm run build` first").toBe(true);
  });

  it.each(["index.js", "kit.js"])("%s keeps the editors and heavy packages out of its static imports", (entry) => {
    const { files, packages } = staticGraph(entry);
    expect([...files].filter((file) => /^(surface|composer)-/.test(file))).toEqual([]);
    expect([...packages].filter((name) => lazyPackages.test(name))).toEqual([]);
  });

  it("loads the document surface and the comment composer dynamically", () => {
    const { dynamicImports } = readModule("index.js");
    expect(dynamicImports.some((file) => /\/surface-[\w-]+\.js$/.test(file))).toBe(true);
    expect(dynamicImports.some((file) => /\/composer-[\w-]+\.js$/.test(file))).toBe(true);
  });

  it("marks every module as client code and imports nothing from the app it came from", () => {
    for (const file of readdirSync(dist).filter((name) => name.endsWith(".js"))) {
      const source = readFileSync(path.join(dist, file), "utf8");
      expect(source.startsWith('"use client";'), file).toBe(true);
      expect(source, file).not.toMatch(/from\s*["'](@\/|next\/)|process\.env|api\.dev\.jaggle\.ai/);
    }
  });
});
