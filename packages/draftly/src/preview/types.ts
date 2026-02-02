import { SyntaxNode } from "@lezer/common";
import { ThemeEnum } from "../editor/utils";

/**
 * Context passed to plugin preview methods
 */
export interface PreviewContext {
  /** Full document text */
  readonly doc: string;

  /** Current theme */
  readonly theme: ThemeEnum;

  /** Slice document text between positions */
  sliceDoc(from: number, to: number): string;

  /** Sanitize HTML content (for HTMLBlock/HTMLTag) */
  sanitize(html: string): string;

  /** Render children of a node to HTML */
  renderChildren(node: SyntaxNode): string;
}

/**
 * Configuration for the preview renderer
 */
export interface PreviewConfig {
  /** Plugins to use for rendering */
  plugins?: import("../editor/plugin").DraftlyPlugin[];

  /** Markdown extensions to use for rendering */
  markdown?: import("@lezer/markdown").MarkdownConfig[];

  /** CSS class for the wrapper element */
  wrapperClass?: string;

  /** HTML tag for the wrapper element */
  wrapperTag?: "article" | "div" | "section";

  /** Whether to sanitize HTML blocks (default: true) */
  sanitize?: boolean;

  /** Theme to use */
  theme?: ThemeEnum;
}

/**
 * Result of CSS generation
 */
export interface GenerateCSSConfig {
  /** Plugins to extract styles from */
  plugins?: import("../editor/plugin").DraftlyPlugin[];

  /** Theme to use */
  theme?: ThemeEnum;

  /** Wrapper class for scoping (default: "draftly-preview") */
  wrapperClass?: string;

  /** Include base styles */
  includeBase?: boolean;
}

/**
 * Node renderer function type
 */
export type NodeRenderer = (node: SyntaxNode, children: string, ctx: PreviewContext) => string;

/**
 * Map of node names to their renderers
 */
export type NodeRendererMap = Record<string, NodeRenderer>;
