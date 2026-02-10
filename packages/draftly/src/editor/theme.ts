import { EditorView } from "@codemirror/view";

/**
 * Base theme for draftly styling
 * Note: Layout styles are scoped under .cm-draftly which is added by the view plugin
 */
export const draftlyBaseTheme = EditorView.theme({
  // Container styles - only apply when view plugin is enabled
  "&.cm-draftly": {
    fontSize: "16px",
    lineHeight: "1.6",
  },

  "&.cm-draftly .cm-content": {
    width: "100%",
    maxWidth: "48rem",
    padding: "0 0.5rem",
    margin: "0 auto",
    fontFamily: "var(--font-sans, sans-serif)",
    fontSize: "16px",
    lineHeight: "1.6",
  },

  "&.cm-draftly .cm-content .cm-line": {
    paddingInline: 0,
  },

  "&.cm-draftly .cm-content .cm-widgetBuffer": {
    display: "none !important",
  },
});
