import { Decoration } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { DecorationContext, DecorationPlugin } from "../editor/plugin";
import { createTheme } from "../editor";
import { SyntaxNode } from "@lezer/common";

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
  emphasis: Decoration.mark({ class: "cm-draftly-emphasis" }),
  strong: Decoration.mark({ class: "cm-draftly-strong" }),
  strikethrough: Decoration.mark({ class: "cm-draftly-strikethrough" }),
  subscript: Decoration.mark({ class: "cm-draftly-subscript" }),
  superscript: Decoration.mark({ class: "cm-draftly-superscript" }),
  // Markers (* _ ~~ ^ ~)
  "inline-mark": Decoration.mark({ class: "cm-draftly-inline-mark" }),
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
  override decorationPriority = 20;
  override readonly requiredNodes = [
    "Emphasis",
    "StrongEmphasis",
    "Strikethrough",
    "Subscript",
    "Superscript",
    "EmphasisMark",
    "StrikethroughMark",
    "SubscriptMark",
    "SuperscriptMark",
  ] as const;
  marks: string[] = [];

  constructor() {
    super();

    for (const mark of Object.keys(INLINE_TYPES)) {
      this.marks.push(...this.getMarkerNames(mark));
    }
  }

  /**
   * Plugin theme
   */
  override get theme() {
    return theme;
  }

  /**
   * Build inline decorations by iterating the syntax tree
   */
  buildDecorations(ctx: DecorationContext): void {
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

  override renderToHTML(node: SyntaxNode, children: string): string | null {
    if (this.marks.includes(node.name)) {
      return "";
    }

    const inlineType = INLINE_TYPES[node.name as keyof typeof INLINE_TYPES];
    if (!inlineType) {
      return null;
    }
    const className = inlineMarkDecorations[inlineType].spec.class as string;

    return `<span class="${className}">${children}</span>`;
  }
}

/**
 * Theme for inline styling
 */
const theme = createTheme({
  default: {
    // Emphasis (italic)
    ".cm-draftly-emphasis": {
      fontStyle: "italic",
    },

    // Strong (bold)
    ".cm-draftly-strong": {
      fontWeight: "bold",
    },

    // Strikethrough
    ".cm-draftly-strikethrough": {
      textDecoration: "line-through",
      opacity: "0.7",
    },

    // Subscript
    ".cm-draftly-subscript": {
      fontSize: "0.75em",
      verticalAlign: "sub",
    },

    // Superscript
    ".cm-draftly-superscript": {
      fontSize: "0.75em",
      verticalAlign: "super",
    },

    // Inline markers (* _ ~~ ^ ~) - hidden when not focused
    ".cm-draftly-inline-mark": {
      display: "none",
    },
  },
});
