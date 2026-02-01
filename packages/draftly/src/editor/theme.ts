import { EditorView } from "@codemirror/view";
import { HighlightStyle } from "@codemirror/language";

export const defaultHighlightStyle = HighlightStyle.define([]);

/**
 * Base theme for draftly styling
 * Note: Layout styles are scoped under .cm-draftly-enabled which is added by the view plugin
 */
export const draftlyBaseTheme = EditorView.baseTheme({
  // Container styles - only apply when view plugin is enabled
  "&.cm-draftly-enabled": {
    fontSize: "16px",
    lineHeight: "1.6",
  },

  "&.cm-draftly-enabled .cm-content": {
    maxWidth: "48rem",
    margin: "0 auto",
    fontFamily: "var(--font-sans, sans-serif)",
    fontSize: "16px",
    lineHeight: "1.6",
  },

  // Inline code
  ".cm-draftly-inline-code": {
    fontFamily: "var(--font-mono, monospace)",
    fontSize: "0.9em",
    backgroundColor: "rgba(175, 184, 193, 0.2)",
    padding: "0.1em 0.3em",
    borderRadius: "4px",
  },
  ".cm-draftly-code-mark": {
    opacity: "0.4",
  },

  // Links
  ".cm-draftly-link": {
    color: "#0969da",
    textDecoration: "none",
  },
  ".cm-draftly-link:hover": {
    textDecoration: "underline",
  },
  ".cm-draftly-url": {
    opacity: "0.6",
    fontSize: "0.9em",
  },

  // Images (placeholder styling)
  ".cm-draftly-image": {
    color: "#8250df",
  },

  // Code blocks
  ".cm-draftly-fenced-code": {
    fontFamily: "var(--font-mono, monospace)",
    fontSize: "0.9em",
  },
  ".cm-draftly-line-code": {
    backgroundColor: "rgba(175, 184, 193, 0.15)",
    borderRadius: "0",
  },
  ".cm-draftly-code-info": {
    color: "#6e7781",
    fontStyle: "italic",
  },

  // Blockquote
  ".cm-draftly-line-blockquote": {
    borderLeft: "3px solid #d0d7de",
    paddingLeft: "1em",
    color: "#656d76",
  },
  ".cm-draftly-quote-mark": {
    opacity: "0.4",
  },

  // Horizontal rule
  ".cm-draftly-line-hr": {
    textAlign: "center",
  },
  ".cm-draftly-hr": {
    opacity: "0.4",
  },
});
