import { EditorView } from "@codemirror/view";
import { HighlightStyle } from "@codemirror/language";

export const highlightStyle = HighlightStyle.define([]);

/**
 * Base theme for Markly styling
 */
export const marklyBaseTheme = EditorView.baseTheme({
  // Container
  "&": {
    fontSize: "16px",
    lineHeight: "1.6",
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
});
