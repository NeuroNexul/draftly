import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { Extension, Facet, Range, RangeSetBuilder } from "@codemirror/state";
import { syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { cursorInRange, selectionOverlapsRange } from "./utils";
import { highlightStyle, marklyBaseTheme } from "./theme";
import { DecorationContext, MarklyPlugin } from "./plugin";
import { MarklyNode } from "./markly";

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
 * Facet to register the onNodesChange callback
 */
export const marklyOnNodesChangeFacet = Facet.define<((nodes: MarklyNode[]) => void) | undefined, ((nodes: MarklyNode[]) => void) | undefined>({
  combine: (values) => values.find((v) => v !== undefined),
});

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
  private onNodesChange?: (nodes: MarklyNode[]) => void;

  constructor(view: EditorView) {
    this.plugins = view.state.facet(marklyPluginsFacet);
    this.onNodesChange = view.state.facet(marklyOnNodesChangeFacet);
    this.decorations = buildDecorations(view, this.plugins);

    // Notify plugins that view is ready
    for (const plugin of this.plugins) {
      plugin.onViewReady(view);
    }

    // Call onNodesChange callback with initial nodes
    if (this.onNodesChange) {
      this.onNodesChange(this.buildNodes(view));
    }
  }

  update(update: ViewUpdate) {
    // Update plugins list if facet changed
    this.plugins = update.view.state.facet(marklyPluginsFacet);
    this.onNodesChange = update.view.state.facet(marklyOnNodesChangeFacet);

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

      // Call onNodesChange callback
      if (this.onNodesChange) {
        this.onNodesChange(this.buildNodes(update.view));
      }
    }
  }

  private buildNodes(view: EditorView): MarklyNode[] {
    const tree = syntaxTree(view.state);
    const roots: MarklyNode[] = [];
    const stack: MarklyNode[] = [];

    tree.iterate({
      enter: (nodeRef) => {
        const node: MarklyNode = {
          from: nodeRef.from,
          to: nodeRef.to,
          name: nodeRef.name,
          children: [],
          isSelected: selectionOverlapsRange(view, nodeRef.from, nodeRef.to),
        };

        if (stack.length > 0) {
          stack[stack.length - 1]!.children.push(node);
        } else {
          roots.push(node);
        }

        stack.push(node);
      },
      leave: () => {
        stack.pop();
      },
    });

    return roots;
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
 * Extension to add the cm-markly-enabled class to the editor
 */
const marklyEditorClass = EditorView.editorAttributes.of({ class: "cm-markly-enabled" });

/**
 * Create Markly view extension bundle with plugin support
 * @param plugins - Optional array of MarklyPlugin instances
 * @param onNodesChange - Optional callback to receive nodes on every update
 * @returns Extension array including view plugin, theme, and plugin facet
 */
export function createMarklyViewExtension(plugins: MarklyPlugin[] = [], onNodesChange?: (nodes: MarklyNode[]) => void): Extension[] {
  return [marklyPluginsFacet.of(plugins), marklyOnNodesChangeFacet.of(onNodesChange), marklyViewPlugin, marklyBaseTheme, marklyEditorClass];
}
