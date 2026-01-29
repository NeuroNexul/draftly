import { EditorView } from "@codemirror/view";
import { HighlightStyle } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

export const highlightStyle = HighlightStyle.define([
  { tag: t.heading1, fontWeight: "bold", fontFamily: "sans-serif", fontSize: "2em", textDecoration: "none" },
  { tag: t.heading2, fontWeight: "bold", fontFamily: "sans-serif", fontSize: "1.75em", textDecoration: "none" },
  { tag: t.heading3, fontWeight: "bold", fontFamily: "sans-serif", fontSize: "1.35em", textDecoration: "none" },
  { tag: t.heading4, fontWeight: "bold", fontFamily: "sans-serif", fontSize: "1.375em", textDecoration: "none" },
  { tag: t.heading5, fontWeight: "bold", fontFamily: "sans-serif", fontSize: "1.25em", textDecoration: "none" },
  { tag: t.heading6, fontWeight: "bold", fontFamily: "sans-serif", fontSize: "1.125em", textDecoration: "none" },
  { tag: t.link, fontFamily: "sans-serif", textDecoration: "underline", color: "var(--color-link)" },
  { tag: t.emphasis, fontFamily: "sans-serif", fontStyle: "italic" },
  { tag: t.strong, fontFamily: "sans-serif", fontWeight: "bold" },
  { tag: t.monospace, fontFamily: "var(--font-jetbrains-mono)" },
  { tag: t.content, fontFamily: "sans-serif" },
  { tag: t.meta, color: "darkgrey" },
]);

/**
 * Base theme for Markly styling
 */
export const marklyBaseTheme = EditorView.baseTheme({
  // Container
  "&": {
    fontSize: "16px",
    lineHeight: "1.6",
  },

  // Heading line styles
  ".cm-markly-line-h1": {
    paddingTop: "1.5em",
    paddingBottom: "0.5em",
  },
  ".cm-markly-line-h2": {
    paddingTop: "1.25em",
    paddingBottom: "0.5em",
  },
  ".cm-markly-line-h3, .cm-markly-line-h4, .cm-markly-line-h5, .cm-markly-line-h6": {
    paddingTop: "1em",
    paddingBottom: "0.5em",
  },

  // Heading mark (# symbols)
  ".cm-markly-heading-mark": {
    opacity: "0.5",
    fontWeight: "normal",
    fontSize: "0.75em",
  },

  // Emphasis
  ".cm-markly-emphasis": {
    fontStyle: "italic",
  },
  ".cm-markly-strong": {
    fontWeight: "700",
  },
  ".cm-markly-strikethrough": {
    textDecoration: "line-through",
    opacity: "0.7",
  },

  // Emphasis marks (* _ ~)
  ".cm-markly-emphasis-mark": {
    opacity: "0.3",
    fontSize: "0.9em",
  },

  // Inline code
  ".cm-markly-inline-code": {
    fontFamily: "var(--font-mono, monospace)",
    fontSize: "0.9em",
    backgroundColor: "rgba(175, 184, 193, 0.2)",
    padding: "0.1em 0.3em",
    borderRadius: "4px",
  },
  ".cm-markly-code-mark": {
    opacity: "0.4",
  },

  // Links
  ".cm-markly-link": {
    color: "#0969da",
    textDecoration: "none",
  },
  ".cm-markly-link:hover": {
    textDecoration: "underline",
  },
  ".cm-markly-url": {
    opacity: "0.6",
    fontSize: "0.9em",
  },

  // Images (placeholder styling)
  ".cm-markly-image": {
    color: "#8250df",
  },

  // Code blocks
  ".cm-markly-fenced-code": {
    fontFamily: "var(--font-mono, monospace)",
    fontSize: "0.9em",
  },
  ".cm-markly-line-code": {
    backgroundColor: "rgba(175, 184, 193, 0.15)",
    borderRadius: "0",
  },
  ".cm-markly-code-info": {
    color: "#6e7781",
    fontStyle: "italic",
  },

  // Blockquote
  ".cm-markly-line-blockquote": {
    borderLeft: "3px solid #d0d7de",
    paddingLeft: "1em",
    color: "#656d76",
  },
  ".cm-markly-quote-mark": {
    opacity: "0.4",
  },

  // Horizontal rule
  ".cm-markly-line-hr": {
    textAlign: "center",
  },
  ".cm-markly-hr": {
    opacity: "0.4",
  },

  // List marks
  ".cm-markly-list-mark": {
    color: "#57606a",
    fontWeight: "500",
  },

  // Task checkbox
  ".cm-markly-task-checkbox": {
    display: "inline-flex",
    alignItems: "center",
    paddingRight: "0.25em",
    verticalAlign: "middle",
  },
  ".cm-markly-task-checkbox input": {
    width: "14px",
    height: "14px",
    margin: "0",
    cursor: "pointer",
  },
  ".cm-markly-task-marker": {
    opacity: "0.5",
  },
});
