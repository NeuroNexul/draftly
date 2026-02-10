import { SyntaxNode } from "@lezer/common";
import { ThemeEnum } from "../editor/utils";
import { PreviewContext } from "./types";
import DOMPurify from "dompurify";

/**
 * Creates a PreviewContext for rendering
 */
export function createPreviewContext(
  doc: string,
  theme: ThemeEnum,
  renderChildren: (node: SyntaxNode) => Promise<string>,
  sanitizeHtml: boolean = true
): PreviewContext {
  return {
    doc,
    theme,

    sliceDoc(from: number, to: number): string {
      return doc.slice(from, to);
    },

    sanitize(html: string): string {
      if (!sanitizeHtml) return html;

      // DOMPurify works in browser; in Node, it needs jsdom
      if (typeof window !== "undefined") {
        return DOMPurify.sanitize(html);
      }

      // Server-side: return as-is (user should sanitize at application level)
      // or use isomorphic-dompurify in their setup
      return html;
    },

    renderChildren,
  };
}
