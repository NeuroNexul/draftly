import { Decoration, EditorView } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { DecorationContext, DecorationPlugin } from "../plugin";
import { Extension } from "@codemirror/state";

/**
 * Node types for ATX headings in markdown
 */
const HEADING_TYPES = ["ATXHeading1", "ATXHeading2", "ATXHeading3", "ATXHeading4", "ATXHeading5", "ATXHeading6"];

/**
 * Mark decorations for heading content
 */
const headingMarkDecorations = {
  "heading-1": Decoration.mark({ class: "cm-markly-h1" }),
  "heading-2": Decoration.mark({ class: "cm-markly-h2" }),
  "heading-3": Decoration.mark({ class: "cm-markly-h3" }),
  "heading-4": Decoration.mark({ class: "cm-markly-h4" }),
  "heading-5": Decoration.mark({ class: "cm-markly-h5" }),
  "heading-6": Decoration.mark({ class: "cm-markly-h6" }),
  "heading-mark": Decoration.mark({ class: "cm-markly-heading-mark" }),
};

/**
 * Line decorations for heading lines
 */
const headingLineDecorations = {
  "heading-1": Decoration.line({ class: "cm-markly-line-h1" }),
  "heading-2": Decoration.line({ class: "cm-markly-line-h2" }),
  "heading-3": Decoration.line({ class: "cm-markly-line-h3" }),
  "heading-4": Decoration.line({ class: "cm-markly-line-h4" }),
  "heading-5": Decoration.line({ class: "cm-markly-line-h5" }),
  "heading-6": Decoration.line({ class: "cm-markly-line-h6" }),
};

/**
 * HeadingPlugin - Decorates markdown headings
 *
 * Adds visual styling to ATX headings (# through ######)
 * - Line decorations for the entire heading line
 * - Mark decorations for heading content
 * - Hides # markers when cursor is not in the heading
 */
export class HeadingPlugin extends DecorationPlugin {
  readonly name = "heading";
  readonly version = "1.0.0";

  /**
   * Higher priority to ensure headings are styled first
   */
  override get decorationPriority(): number {
    return 10;
  }

  /**
   * Get the extensions for this plugin
   */
  getExtensions(): Extension[] {
    return [headingTheme];
  }

  /**
   * Build heading decorations by iterating the syntax tree
   */
  override buildDecorations(ctx: DecorationContext): void {
    const { view, decorations } = ctx;
    const tree = syntaxTree(view.state);

    tree.iterate({
      enter: (node) => {
        const { from, to, name } = node;

        if (!HEADING_TYPES.includes(name)) {
          return;
        }

        const level = parseInt(name.slice(-1), 10);
        const headingClass = `heading-${level}` as keyof typeof headingMarkDecorations;
        const lineClass = `heading-${level}` as keyof typeof headingLineDecorations;

        // Add line decoration
        const line = view.state.doc.lineAt(from);
        decorations.push(headingLineDecorations[lineClass].range(line.from));

        // Add mark decoration for the heading content
        decorations.push(headingMarkDecorations[headingClass].range(from, to + 1));

        // Find and style the heading marker (#)
        // Only hide when cursor is not in the heading
        const cursorInNode = ctx.selectionOverlapsRange(from, to);
        if (!cursorInNode) {
          const headingMark = node.node.getChild("HeaderMark");
          if (headingMark) {
            decorations.push(headingMarkDecorations["heading-mark"].range(headingMark.from, headingMark.to + 1));
          }
        }
      },
    });
  }
}

const headingTheme = EditorView.theme({
  ".cm-markly-h1": {
    fontSize: "2em",
    fontWeight: "bold",
    fontFamily: "sans-serif",
    textDecoration: "none",
  },

  ".cm-markly-h2": {
    fontSize: "1.75em",
    fontWeight: "bold",
    fontFamily: "sans-serif",
    textDecoration: "none",
  },

  ".cm-markly-h3": {
    fontSize: "1.5em",
    fontWeight: "bold",
    fontFamily: "sans-serif",
    textDecoration: "none",
  },

  ".cm-markly-h4": {
    fontSize: "1.25em",
    fontWeight: "bold",
    fontFamily: "sans-serif",
    textDecoration: "none",
  },

  ".cm-markly-h5": {
    fontSize: "1em",
    fontWeight: "bold",
    fontFamily: "sans-serif",
    textDecoration: "none",
  },

  ".cm-markly-h6": {
    fontSize: "0.75em",
    fontWeight: "bold",
    fontFamily: "sans-serif",
    textDecoration: "none",
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
    display: "none",
  },
});
