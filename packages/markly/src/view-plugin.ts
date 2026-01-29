import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import { Extension, Range, RangeSetBuilder } from "@codemirror/state";
import { syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { cursorInRange, selectionOverlapsRange } from "./utils";
import { highlightStyle, marklyBaseTheme } from "./theme";

/**
 * Node types from @lezer/markdown that we handle
 */
const HEADING_TYPES = ["ATXHeading1", "ATXHeading2", "ATXHeading3", "ATXHeading4", "ATXHeading5", "ATXHeading6"];

/**
 * Mark decorations for inline styling
 */
const markDecorations = {
  // Headers
  "heading-1": Decoration.mark({ class: "cm-markly-h1" }),
  "heading-2": Decoration.mark({ class: "cm-markly-h2" }),
  "heading-3": Decoration.mark({ class: "cm-markly-h3" }),
  "heading-4": Decoration.mark({ class: "cm-markly-h4" }),
  "heading-5": Decoration.mark({ class: "cm-markly-h5" }),
  "heading-6": Decoration.mark({ class: "cm-markly-h6" }),

  // Heading markers (# symbols)
  "heading-mark": Decoration.mark({ class: "cm-markly-heading-mark" }),

  // Inline styles
  emphasis: Decoration.mark({ class: "cm-markly-emphasis" }),
  strong: Decoration.mark({ class: "cm-markly-strong" }),
  "inline-code": Decoration.mark({ class: "cm-markly-inline-code" }),
  strikethrough: Decoration.mark({ class: "cm-markly-strikethrough" }),

  // Links and images
  link: Decoration.mark({ class: "cm-markly-link" }),
  "link-text": Decoration.mark({ class: "cm-markly-link-text" }),
  url: Decoration.mark({ class: "cm-markly-url" }),
  image: Decoration.mark({ class: "cm-markly-image" }),

  // Emphasis markers (* _ ~~ `)
  "emphasis-mark": Decoration.mark({ class: "cm-markly-emphasis-mark" }),

  // Code blocks
  "fenced-code": Decoration.mark({ class: "cm-markly-fenced-code" }),
  "code-mark": Decoration.mark({ class: "cm-markly-code-mark" }),
  "code-info": Decoration.mark({ class: "cm-markly-code-info" }),

  // Blockquote
  blockquote: Decoration.mark({ class: "cm-markly-blockquote" }),
  "quote-mark": Decoration.mark({ class: "cm-markly-quote-mark" }),

  // Lists
  "list-mark": Decoration.mark({ class: "cm-markly-list-mark" }),
  "task-marker": Decoration.mark({ class: "cm-markly-task-marker" }),

  // Horizontal rule
  hr: Decoration.mark({ class: "cm-markly-hr" }),
};

/**
 * Line decorations for block-level elements
 */
const lineDecorations = {
  "heading-1": Decoration.line({ class: "cm-markly-line-h1" }),
  "heading-2": Decoration.line({ class: "cm-markly-line-h2" }),
  "heading-3": Decoration.line({ class: "cm-markly-line-h3" }),
  "heading-4": Decoration.line({ class: "cm-markly-line-h4" }),
  "heading-5": Decoration.line({ class: "cm-markly-line-h5" }),
  "heading-6": Decoration.line({ class: "cm-markly-line-h6" }),
  blockquote: Decoration.line({ class: "cm-markly-line-blockquote" }),
  "code-block": Decoration.line({ class: "cm-markly-line-code" }),
  hr: Decoration.line({ class: "cm-markly-line-hr" }),
};

/**
 * Task checkbox widget
 */
class TaskCheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean) {
    super();
  }

  eq(other: TaskCheckboxWidget): boolean {
    return other.checked === this.checked;
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement("span");
    wrap.className = `cm-markly-task-checkbox ${this.checked ? "checked" : ""}`;
    wrap.setAttribute("aria-hidden", "true");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = this.checked;
    checkbox.tabIndex = -1;

    checkbox.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const pos = view.posAtDOM(wrap);
      // Find the task marker in the document and toggle it
      const line = view.state.doc.lineAt(pos);
      const match = line.text.match(/^(\s*[-*+]\s*)\[([ xX])\]/);
      if (match) {
        const markerStart = line.from + match[1]!.length + 1;
        const newChar = this.checked ? " " : "x";
        view.dispatch({
          changes: { from: markerStart, to: markerStart + 1, insert: newChar },
        });
      }
    });

    wrap.appendChild(checkbox);
    return wrap;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

/**
 * Build decorations for the visible viewport
 */
function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const decorations: Range<Decoration>[] = [];

  const tree = syntaxTree(view.state);

  // Iterate through the syntax tree
  tree.iterate({
    enter: (node) => {
      const { from, to, name } = node;

      // Skip if cursor is in this range (show raw markdown)
      const cursorInNode = selectionOverlapsRange(view, from, to);

      // Handle headings
      if (HEADING_TYPES.includes(name)) {
        const level = parseInt(name.slice(-1), 10);
        const headingClass = `heading-${level}` as keyof typeof markDecorations;
        const lineClass = `heading-${level}` as keyof typeof lineDecorations;

        // Add line decoration
        const line = view.state.doc.lineAt(from);
        decorations.push(lineDecorations[lineClass].range(line.from));

        // Add mark decoration for the content
        decorations.push(markDecorations[headingClass].range(from, to));

        // Find and style the heading marker (#)
        if (!cursorInNode) {
          const headingMark = node.node.getChild("HeaderMark");
          if (headingMark) {
            decorations.push(markDecorations["heading-mark"].range(headingMark.from, headingMark.to));
          }
        }
      }

      // Handle emphasis (italic)
      if (name === "Emphasis") {
        decorations.push(markDecorations.emphasis.range(from, to));

        // Style the markers (* or _)
        if (!cursorInNode) {
          const marks = node.node.getChildren("EmphasisMark");
          for (const mark of marks) {
            decorations.push(markDecorations["emphasis-mark"].range(mark.from, mark.to));
          }
        }
      }

      // Handle strong emphasis (bold)
      if (name === "StrongEmphasis") {
        decorations.push(markDecorations.strong.range(from, to));

        // Style the markers (** or __)
        if (!cursorInNode) {
          const marks = node.node.getChildren("EmphasisMark");
          for (const mark of marks) {
            decorations.push(markDecorations["emphasis-mark"].range(mark.from, mark.to));
          }
        }
      }

      // Handle inline code
      if (name === "InlineCode") {
        decorations.push(markDecorations["inline-code"].range(from, to));

        // Style the backticks
        if (!cursorInNode) {
          const marks = node.node.getChildren("CodeMark");
          for (const mark of marks) {
            decorations.push(markDecorations["code-mark"].range(mark.from, mark.to));
          }
        }
      }

      // Handle strikethrough
      if (name === "Strikethrough") {
        decorations.push(markDecorations.strikethrough.range(from, to));

        // Style the ~~ markers
        if (!cursorInNode) {
          const marks = node.node.getChildren("StrikethroughMark");
          for (const mark of marks) {
            decorations.push(markDecorations["emphasis-mark"].range(mark.from, mark.to));
          }
        }
      }

      // Handle links
      if (name === "Link") {
        decorations.push(markDecorations.link.range(from, to));

        // Find the URL child
        const url = node.node.getChild("URL");
        if (url) {
          decorations.push(markDecorations.url.range(url.from, url.to));
        }
      }

      // Handle images
      if (name === "Image") {
        decorations.push(markDecorations.image.range(from, to));
      }

      // Handle fenced code blocks
      if (name === "FencedCode") {
        decorations.push(markDecorations["fenced-code"].range(from, to));

        // Add line decorations for each line in the code block
        const startLine = view.state.doc.lineAt(from);
        const endLine = view.state.doc.lineAt(to);
        for (let i = startLine.number; i <= endLine.number; i++) {
          const line = view.state.doc.line(i);
          decorations.push(lineDecorations["code-block"].range(line.from));
        }

        // Style code info (language identifier)
        const codeInfo = node.node.getChild("CodeInfo");
        if (codeInfo) {
          decorations.push(markDecorations["code-info"].range(codeInfo.from, codeInfo.to));
        }

        // Style code marks (```)
        const codeMarks = node.node.getChildren("CodeMark");
        for (const mark of codeMarks) {
          decorations.push(markDecorations["code-mark"].range(mark.from, mark.to));
        }
      }

      // Handle blockquotes
      if (name === "Blockquote") {
        decorations.push(markDecorations.blockquote.range(from, to));

        // Add line decorations
        const startLine = view.state.doc.lineAt(from);
        const endLine = view.state.doc.lineAt(to);
        for (let i = startLine.number; i <= endLine.number; i++) {
          const line = view.state.doc.line(i);
          decorations.push(lineDecorations.blockquote.range(line.from));
        }

        // Style quote marks (>)
        const quoteMarks = node.node.getChildren("QuoteMark");
        for (const mark of quoteMarks) {
          decorations.push(markDecorations["quote-mark"].range(mark.from, mark.to));
        }
      }

      // Handle horizontal rules
      if (name === "HorizontalRule") {
        const line = view.state.doc.lineAt(from);
        decorations.push(lineDecorations.hr.range(line.from));
        decorations.push(markDecorations.hr.range(from, to));
      }

      // Handle list markers
      if (name === "ListMark") {
        decorations.push(markDecorations["list-mark"].range(from, to));
      }

      // Handle task lists
      if (name === "TaskMarker") {
        const text = view.state.sliceDoc(from, to);
        const isChecked = text.includes("x") || text.includes("X");

        decorations.push(markDecorations["task-marker"].range(from, to));

        // Add checkbox widget if cursor is not in the task item
        const taskLine = view.state.doc.lineAt(from);
        if (!cursorInRange(view, taskLine.from, taskLine.to)) {
          decorations.push(
            Decoration.widget({
              widget: new TaskCheckboxWidget(isChecked),
              side: -1,
            }).range(from),
          );
        }
      }
    },
  });

  // Sort decorations by position (required for RangeSetBuilder)
  decorations.sort((a, b) => a.from - b.from || a.value.startSide - b.value.startSide);

  // Build the decoration set
  for (const decoration of decorations) {
    builder.add(decoration.from, decoration.to, decoration.value);
  }

  return builder.finish();
}

/**
 * Markly View Plugin
 * Handles rich markdown rendering with decorations
 */
class MarklyViewPluginClass {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = buildDecorations(view);
  }

  update(update: ViewUpdate) {
    // Rebuild decorations when:
    // - Document changes
    // - Selection changes (to show/hide syntax markers)
    // - Viewport changes
    if (update.docChanged || update.selectionSet || update.viewportChanged) {
      this.decorations = buildDecorations(update.view);
    }
  }
}

/**
 * The main Markly ViewPlugin extension
 */
export const marklyViewPlugin = ViewPlugin.fromClass(MarklyViewPluginClass, {
  decorations: (v) => v.decorations,
  provide: () => [syntaxHighlighting(highlightStyle)],
});

/**
 * Complete Markly view extension bundle
 * Includes the view plugin and base theme
 */
export function createMarklyViewExtension(): Extension[] {
  return [marklyViewPlugin, marklyBaseTheme];
}
