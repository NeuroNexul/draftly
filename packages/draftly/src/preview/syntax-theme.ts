import { classHighlighter } from "@lezer/highlight";
import type { SyntaxThemeInput } from "./types";

type HighlightSpec = {
  tag?: unknown;
  class?: string;
  [key: string]: unknown;
};

type RuntimeHighlightStyle = {
  specs?: HighlightSpec[];
};

const SKIP_SPEC_KEYS = new Set(["tag", "class"]);
const MAX_WALK_DEPTH = 8;

/**
 * Extracts syntax highlight CSS from CodeMirror theme/highlight extensions
 * and maps it to Lezer `tok-*` classes used by Draftly preview HTML.
 */
export function generateSyntaxThemeCSS(
  syntaxTheme: SyntaxThemeInput | SyntaxThemeInput[] | undefined,
  wrapperClass: string
): string {
  if (!syntaxTheme) return "";

  const styles = extractHighlightStyles(syntaxTheme);
  if (!styles.length) return "";

  const scopedWrapperClass = normalizeWrapperClass(wrapperClass);
  const ruleMap = new Map<string, string[]>();

  for (const style of styles) {
    const specs = style.specs ?? [];

    for (const spec of specs) {
      const selector = getSelectorFromSpec(spec, scopedWrapperClass);
      if (!selector) continue;

      const declarations: string[] = [];
      for (const [rawProp, rawValue] of Object.entries(spec)) {
        if (SKIP_SPEC_KEYS.has(rawProp)) continue;
        if (rawValue === undefined || rawValue === null) continue;

        const cssProp = toKebabCase(rawProp);
        const cssValue = String(rawValue).trim();
        if (!cssValue) continue;

        declarations.push(`${cssProp}: ${cssValue};`);
      }

      if (!declarations.length) continue;

      const existing = ruleMap.get(selector) ?? [];
      existing.push(...declarations);
      ruleMap.set(selector, existing);
    }
  }

  if (!ruleMap.size) return "";

  return Array.from(ruleMap.entries())
    .map(([selector, declarations]) => {
      const merged = Array.from(new Set(declarations));
      return `${selector} { ${merged.join("")} }`;
    })
    .join("\n");
}

function extractHighlightStyles(input: SyntaxThemeInput | SyntaxThemeInput[]): RuntimeHighlightStyle[] {
  const values = Array.isArray(input) ? input : [input];
  const styles: RuntimeHighlightStyle[] = [];
  const visited = new WeakSet<object>();

  for (const value of values) {
    walk(value, 0, visited, styles);
  }

  return styles;
}

function walk(value: unknown, depth: number, visited: WeakSet<object>, out: RuntimeHighlightStyle[]): void {
  if (value === null || value === undefined) return;
  if (depth > MAX_WALK_DEPTH) return;

  if (isHighlightStyle(value)) {
    out.push(value);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      walk(item, depth + 1, visited, out);
    }
    return;
  }

  if (typeof value !== "object") return;
  if (visited.has(value)) return;
  visited.add(value);

  const keys = Object.getOwnPropertyNames(value);
  for (const key of keys) {
    try {
      walk((value as Record<string, unknown>)[key], depth + 1, visited, out);
    } catch {
      // Ignore inaccessible properties
    }
  }
}

function isHighlightStyle(value: unknown): value is RuntimeHighlightStyle {
  if (!value || typeof value !== "object") return false;
  const specs = (value as RuntimeHighlightStyle).specs;
  return Array.isArray(specs);
}

function getSelectorFromSpec(spec: HighlightSpec, wrapperClass: string): string | null {
  const explicitClass = typeof spec.class === "string" && spec.class.trim() ? spec.class.trim() : "";
  wrapperClass = escapeClassName(wrapperClass);

  const classNames = explicitClass || getClassNameFromTag(spec.tag);
  if (!classNames) return null;

  const classSelector = classNames
    .split(/\s+/)
    .filter(Boolean)
    .map((className) => `.${wrapperClass} .${escapeClassName(className)}`)
    .join(", ");

  if (!classSelector) return null;

  return `${classSelector}`;
}

function getClassNameFromTag(tag: unknown): string {
  try {
    if (!tag) return "";
    const className = classHighlighter.style(tag as never);
    return typeof className === "string" ? className : "";
  } catch {
    return "";
  }
}

function toKebabCase(value: string): string {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

function normalizeWrapperClass(wrapperClass: string): string {
  const firstClass = wrapperClass.trim().split(/\s+/)[0];
  return firstClass || "draftly-preview";
}

function escapeClassName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, (char) => {
    const codePoint = char.codePointAt(0);
    return codePoint ? `\\${codePoint.toString(16)} ` : "";
  });
}
