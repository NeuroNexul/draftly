import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { Extension, Facet, Range, RangeSetBuilder } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { cursorInRange, selectionOverlapsRange } from "./utils";
import { draftlyBaseTheme } from "./theme";
import { DecorationContext, DraftlyPlugin } from "./plugin";
import { DraftlyNode } from "./draftly";

/**
 * Mark decorations for inline styling
 */
const markDecorations = {
  // Inline styles
  "inline-code": Decoration.mark({ class: "cm-draftly-inline-code" }),

  // Links and images
  link: Decoration.mark({ class: "cm-draftly-link" }),
  "link-text": Decoration.mark({ class: "cm-draftly-link-text" }),
  url: Decoration.mark({ class: "cm-draftly-url" }),
  image: Decoration.mark({ class: "cm-draftly-image" }),

  // Emphasis markers (* _ ~~ `)
  "emphasis-mark": Decoration.mark({ class: "cm-draftly-emphasis-mark" }),

  // Code blocks
  "fenced-code": Decoration.mark({ class: "cm-draftly-fenced-code" }),
  "code-mark": Decoration.mark({ class: "cm-draftly-code-mark" }),
  "code-info": Decoration.mark({ class: "cm-draftly-code-info" }),

  // Blockquote
  blockquote: Decoration.mark({ class: "cm-draftly-blockquote" }),
  "quote-mark": Decoration.mark({ class: "cm-draftly-quote-mark" }),

  // Horizontal rule
  hr: Decoration.mark({ class: "cm-draftly-hr" }),
};

/**
 * Line decorations for block-level elements
 */
const lineDecorations = {
  blockquote: Decoration.line({ class: "cm-draftly-line-blockquote" }),
  "code-block": Decoration.line({ class: "cm-draftly-line-code" }),
  hr: Decoration.line({ class: "cm-draftly-line-hr" }),
};

/**
 * Facet to register plugins with the view plugin
 */
export const DraftlyPluginsFacet = Facet.define<DraftlyPlugin[], DraftlyPlugin[]>({
  combine: (values) => values.flat(),
});

/**
 * Facet to register the onNodesChange callback
 */
export const draftlyOnNodesChangeFacet = Facet.define<
  ((nodes: DraftlyNode[]) => void) | undefined,
  ((nodes: DraftlyNode[]) => void) | undefined
>({
  combine: (values) => values.find((v) => v !== undefined),
});

/**
 * Facet to register the theme
 */
export const draftlyThemeFacet = Facet.define<"dark" | "light" | "auto", "dark" | "light" | "auto">({
  combine: (values) => values.find((v) => v !== undefined) || "auto",
});

/**
 * Build decorations for the visible viewport
 * @param view - The EditorView instance
 * @param plugins - Optional array of plugins to invoke for decorations
 */
function buildDecorations(view: EditorView, plugins: DraftlyPlugin[] = []): DecorationSet {
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
 * draftly View Plugin
 * Handles rich markdown rendering with decorations
 */
class draftlyViewPluginClass {
  decorations: DecorationSet;
  private plugins: DraftlyPlugin[];
  private onNodesChange?: (nodes: DraftlyNode[]) => void;

  constructor(view: EditorView) {
    this.plugins = view.state.facet(DraftlyPluginsFacet);
    this.onNodesChange = view.state.facet(draftlyOnNodesChangeFacet);
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
    this.plugins = update.view.state.facet(DraftlyPluginsFacet);
    this.onNodesChange = update.view.state.facet(draftlyOnNodesChangeFacet);

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

  private buildNodes(view: EditorView): DraftlyNode[] {
    const tree = syntaxTree(view.state);
    const roots: DraftlyNode[] = [];
    const stack: DraftlyNode[] = [];

    tree.iterate({
      enter: (nodeRef) => {
        const node: DraftlyNode = {
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
 * The main draftly ViewPlugin extension
 */
export const draftlyViewPlugin = ViewPlugin.fromClass(draftlyViewPluginClass, {
  decorations: (v) => v.decorations,
  provide: () => [],
});

/**
 * Extension to add the cm-draftly-enabled class to the editor
 */
const draftlyEditorClass = EditorView.editorAttributes.of({ class: "cm-draftly" });

/**
 * Create draftly view extension bundle with plugin support
 * @param plugins - Optional array of DraftlyPlugin instances
 * @param onNodesChange - Optional callback to receive nodes on every update
 * @returns Extension array including view plugin, theme, and plugin facet
 */
export function createDraftlyViewExtension(
  theme: "dark" | "light" | "auto" = "auto",
  baseStyles: boolean = true,
  plugins: DraftlyPlugin[] = [],
  onNodesChange?: (nodes: DraftlyNode[]) => void
): Extension[] {
  return [
    draftlyEditorClass,
    DraftlyPluginsFacet.of(plugins),
    draftlyOnNodesChangeFacet.of(onNodesChange),
    draftlyThemeFacet.of(theme),
    draftlyViewPlugin,
    ...(baseStyles ? [draftlyBaseTheme] : []),
  ];
}
