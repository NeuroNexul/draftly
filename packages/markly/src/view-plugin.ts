import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { Extension, Facet, Range, RangeSetBuilder } from "@codemirror/state";
import { syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { cursorInRange, selectionOverlapsRange } from "./utils";
import { highlightStyle, marklyBaseTheme } from "./theme";
import { DecorationContext, MarklyPlugin } from "./plugin";

/**
 * Mark decorations for inline styling
 */
const markDecorations = {
  // Inline styles
  "inline-code": Decoration.mark({ class: "cm-markly-inline-code" }),

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
  blockquote: Decoration.line({ class: "cm-markly-line-blockquote" }),
  "code-block": Decoration.line({ class: "cm-markly-line-code" }),
  hr: Decoration.line({ class: "cm-markly-line-hr" }),
};

/**
 * Facet to register plugins with the view plugin
 */
export const marklyPluginsFacet = Facet.define<MarklyPlugin[], MarklyPlugin[]>({
  combine: (values) => values.flat(),
});

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
 * @param view - The EditorView instance
 * @param plugins - Optional array of plugins to invoke for decorations
 */
function buildDecorations(view: EditorView, plugins: MarklyPlugin[] = []): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const decorations: Range<Decoration>[] = [];

  const tree = syntaxTree(view.state);

  // Iterate through the syntax tree
  tree.iterate({
    enter: (node) => {
      const { from, to, name } = node;

      // Skip if cursor is in this range (show raw markdown)
      const cursorInNode = selectionOverlapsRange(view, from, to);

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

  // Allow plugins to contribute decorations
  if (plugins.length > 0) {
    const ctx: DecorationContext = {
      view,
      decorations,
      selectionOverlapsRange: (from, to) => selectionOverlapsRange(view, from, to),
      cursorInRange: (from, to) => cursorInRange(view, from, to),
    };

    // Sort plugins by priority and invoke each one's decoration builder
    const sortedPlugins = [...plugins].sort((a, b) => a.decorationPriority - b.decorationPriority);

    for (const plugin of sortedPlugins) {
      plugin.buildDecorations(ctx);
    }
  }

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
  private plugins: MarklyPlugin[];

  constructor(view: EditorView) {
    this.plugins = view.state.facet(marklyPluginsFacet);
    this.decorations = buildDecorations(view, this.plugins);

    // Notify plugins that view is ready
    for (const plugin of this.plugins) {
      plugin.onViewReady(view);
    }
  }

  update(update: ViewUpdate) {
    // Update plugins list if facet changed
    this.plugins = update.view.state.facet(marklyPluginsFacet);

    // Notify plugins of the update
    for (const plugin of this.plugins) {
      plugin.onViewUpdate(update);
    }

    // Rebuild decorations when:
    // - Document changes
    // - Selection changes (to show/hide syntax markers)
    // - Viewport changes
    if (update.docChanged || update.selectionSet || update.viewportChanged) {
      this.decorations = buildDecorations(update.view, this.plugins);
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
 * Create Markly view extension bundle with plugin support
 * @param plugins - Optional array of MarklyPlugin instances
 * @returns Extension array including view plugin, theme, and plugin facet
 */
export function createMarklyViewExtension(plugins: MarklyPlugin[] = []): Extension[] {
  return [marklyPluginsFacet.of(plugins), marklyViewPlugin, marklyBaseTheme];
}
