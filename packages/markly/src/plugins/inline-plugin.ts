import { Decoration, EditorView } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { DecorationContext, DecorationPlugin } from "../plugin";
import { Extension } from "@codemirror/state";

/**
 * Node types for inline styling in markdown
 */
const INLINE_TYPES = {
  Emphasis: "emphasis",
  StrongEmphasis: "strong",
  Strikethrough: "strikethrough",
  Subscript: "subscript",
  Superscript: "superscript",
} as const;

/**
 * Mark decorations for inline content
 */
const inlineMarkDecorations = {
  emphasis: Decoration.mark({ class: "cm-markly-emphasis" }),
  strong: Decoration.mark({ class: "cm-markly-strong" }),
  strikethrough: Decoration.mark({ class: "cm-markly-strikethrough" }),
  subscript: Decoration.mark({ class: "cm-markly-subscript" }),
  superscript: Decoration.mark({ class: "cm-markly-superscript" }),
  // Markers (* _ ~~ ^ ~)
  "inline-mark": Decoration.mark({ class: "cm-markly-inline-mark" }),
};

/**
 * InlinePlugin - Decorates inline markdown formatting
 *
 * Adds visual styling to inline elements:
 * - Emphasis (italic) - *text* or _text_
 * - Strong (bold) - **text** or __text__
 * - Strikethrough - ~~text~~
 * - Subscript - ~text~
 * - Superscript - ^text^
 *
 * Hides formatting markers when cursor is not in the element
 */
export class InlinePlugin extends DecorationPlugin {
  readonly name = "inline";
  readonly version = "1.0.0";

  /**
   * Moderate priority for inline styling
   */
  override get decorationPriority(): number {
    return 20;
  }

  /**
   * Get the extensions for this plugin (theme)
   */
  override getExtensions(): Extension[] {
    return [inlineTheme];
  }

  /**
   * Build inline decorations by iterating the syntax tree
   */
  override buildDecorations(ctx: DecorationContext): void {
    const { view, decorations } = ctx;
    const tree = syntaxTree(view.state);

    tree.iterate({
      enter: (node) => {
        const { from, to, name } = node;

        // Check if this is an inline type we handle
        const inlineType = INLINE_TYPES[name as keyof typeof INLINE_TYPES];
        if (!inlineType) {
          return;
        }

        // Add mark decoration for the content
        decorations.push(inlineMarkDecorations[inlineType].range(from, to));

        // Only hide markers when cursor is not in the element
        const cursorInNode = ctx.selectionOverlapsRange(from, to);
        if (!cursorInNode) {
          // Get the appropriate marker children based on type
          const markerNames = this.getMarkerNames(name);
          for (const markerName of markerNames) {
            const marks = node.node.getChildren(markerName);
            for (const mark of marks) {
              decorations.push(inlineMarkDecorations["inline-mark"].range(mark.from, mark.to));
            }
          }
        }
      },
    });
  }

  /**
   * Get the marker node names for a given inline type
   */
  private getMarkerNames(nodeType: string): string[] {
    switch (nodeType) {
      case "Emphasis":
      case "StrongEmphasis":
        return ["EmphasisMark"];
      case "Strikethrough":
        return ["StrikethroughMark"];
      case "Subscript":
        return ["SubscriptMark"];
      case "Superscript":
        return ["SuperscriptMark"];
      default:
        return [];
    }
  }
}

/**
 * Theme for inline styling
 */
const inlineTheme = EditorView.theme({
  // Emphasis (italic)
  ".cm-markly-emphasis": {
    fontStyle: "italic",
  },

  // Strong (bold)
  ".cm-markly-strong": {
    fontWeight: "bold",
  },

  // Strikethrough
  ".cm-markly-strikethrough": {
    textDecoration: "line-through",
    opacity: "0.7",
  },

  // Subscript
  ".cm-markly-subscript": {
    fontSize: "0.75em",
    verticalAlign: "sub",
  },

  // Superscript
  ".cm-markly-superscript": {
    fontSize: "0.75em",
    verticalAlign: "super",
  },

  // Inline markers (* _ ~~ ^ ~) - hidden when not focused
  ".cm-markly-inline-mark": {
    display: "none",
  },
});
