import { SyntaxNode } from "@lezer/common";
import { Emoji, GFM, MarkdownConfig, parser as markdownParser, Subscript, Superscript } from "@lezer/markdown";

import { DraftlyPlugin } from "../editor/plugin";
import { ThemeEnum } from "../editor/utils";
import { createPreviewContext } from "./context";
import { defaultRenderers, escapeHtml } from "./default-renderers";
import { NodeRendererMap, PreviewContext } from "./types";
import { foldNodeProp } from "@codemirror/language";

/**
 * Renderer class that walks the syntax tree and produces HTML
 */
export class PreviewRenderer {
  private doc: string;
  private theme: ThemeEnum;
  private plugins: DraftlyPlugin[];
  private markdown: MarkdownConfig[];
  private sanitizeHtml: boolean;
  private renderers: NodeRendererMap;
  private ctx: PreviewContext;

  constructor(
    doc: string,
    plugins: DraftlyPlugin[] = [],
    markdown: MarkdownConfig[],
    theme: ThemeEnum = ThemeEnum.AUTO,
    sanitize: boolean = true
  ) {
    this.doc = doc;
    this.theme = theme;
    this.plugins = plugins;
    this.markdown = markdown;
    this.sanitizeHtml = sanitize;
    this.renderers = { ...defaultRenderers };

    // Create context with reference to renderChildren
    this.ctx = createPreviewContext(doc, theme, this.renderChildren.bind(this), sanitize);
  }

  /**
   * Render the document to HTML
   */
  render(): string {
    // Collect markdown extensions from plugins
    const extensions = [
      ...this.markdown,
      ...this.plugins.map((p) => p.getMarkdownConfig()).filter((ext): ext is NonNullable<typeof ext> => ext !== null),
    ];

    // Use GFM extensions to match the editor (markdownLanguage includes GFM by default)
    // GFM includes: Table, TaskList, Strikethrough, Autolink
    const baseParser = markdownParser.configure([
      GFM,
      Subscript,
      Superscript,
      Emoji,
      {
        props: [
          foldNodeProp.add({
            Table: (tree, state) => ({ from: state.doc.lineAt(tree.from).to, to: tree.to }),
          }),
        ],
      },
    ]);
    const parser = extensions.length > 0 ? baseParser.configure(extensions) : baseParser;

    // Parse the document
    const tree = parser.parse(this.doc);

    // Render from root
    return this.renderNode(tree.topNode);
  }

  /**
   * Render a single node to HTML
   */
  private renderNode(node: SyntaxNode): string {
    // First, let plugins try to render
    for (const plugin of this.plugins) {
      if (plugin.renderToHTML) {
        const children = this.renderChildren(node);
        const result = plugin.renderToHTML(node, children, this.ctx);
        if (result !== null) {
          return result;
        }
      }
    }

    // Use default renderer
    const renderer = this.renderers[node.name];
    if (renderer) {
      const children = this.renderChildren(node);
      return renderer(node, children, this.ctx);
    }

    // Unknown node - render children or text
    if (node.firstChild) {
      return this.renderChildren(node);
    }

    // Leaf node - return text content
    return this.ctx.sliceDoc(node.from, node.to);
  }

  /**
   * Render all children of a node, including text between nodes
   */
  private renderChildren(node: SyntaxNode): string {
    let result = "";
    let pos = node.from; // Track position to find text gaps
    let child = node.firstChild;

    while (child) {
      // Add any text between the last position and this child
      if (child.from > pos) {
        result += escapeHtml(this.ctx.sliceDoc(pos, child.from));
      }

      // Render the child node
      result += this.renderNode(child);

      // Update position to end of this child
      pos = child.to;
      child = child.nextSibling;
    }

    // Add any trailing text after the last child
    if (pos < node.to) {
      result += escapeHtml(this.ctx.sliceDoc(pos, node.to));
    }

    return result;
  }
}
