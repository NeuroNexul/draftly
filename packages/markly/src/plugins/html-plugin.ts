import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { Extension } from "@codemirror/state";
import { DecorationContext, DecorationPlugin } from "../plugin";
import DOMPurify from "dompurify";

/**
 * Mark decorations for HTML content
 */
const htmlMarkDecorations = {
  "html-tag": Decoration.mark({ class: "cm-markly-html-tag" }),
  "html-comment": Decoration.mark({ class: "cm-markly-html-comment" }),
};

/**
 * Line decorations for HTML blocks (when visible)
 */
const htmlLineDecorations = {
  "html-block": Decoration.line({ class: "cm-markly-line-html-block" }),
  "hidden-line": Decoration.line({ class: "cm-markly-hidden-line" }),
};

/**
 * Widget to render sanitized HTML (block)
 */
class HTMLPreviewWidget extends WidgetType {
  constructor(readonly html: string) {
    super();
  }

  eq(other: HTMLPreviewWidget): boolean {
    return other.html === this.html;
  }

  toDOM() {
    const div = document.createElement("div");
    div.className = "cm-markly-html-preview";
    div.innerHTML = DOMPurify.sanitize(this.html);
    return div;
  }

  ignoreEvent() {
    return false;
  }
}

/**
 * Widget to render sanitized inline HTML
 */
class InlineHTMLPreviewWidget extends WidgetType {
  constructor(readonly html: string) {
    super();
  }

  eq(other: InlineHTMLPreviewWidget): boolean {
    return other.html === this.html;
  }

  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-markly-inline-html-preview";
    span.innerHTML = DOMPurify.sanitize(this.html);
    return span;
  }

  ignoreEvent() {
    return false;
  }
}

interface HTMLGroup {
  from: number;
  to: number;
}

interface HTMLTagInfo {
  from: number;
  to: number;
  tagName: string;
  isClosing: boolean;
  isSelfClosing: boolean;
}

/**
 * Parse an HTML tag to extract its name and type
 */
function parseHTMLTag(content: string): { tagName: string; isClosing: boolean; isSelfClosing: boolean } | null {
  // Match opening, closing, or self-closing tags
  const match = content.match(/^<\s*(\/?)([a-zA-Z][a-zA-Z0-9-]*)[^>]*(\/?)>$/);
  if (!match) return null;

  return {
    tagName: match[2]!.toLowerCase(),
    isClosing: match[1] === "/",
    isSelfClosing:
      match[3] === "/" ||
      ["br", "hr", "img", "input", "meta", "link", "area", "base", "col", "embed", "source", "track", "wbr"].includes(match[2]!.toLowerCase()),
  };
}

/**
 * HTMLPlugin - Decorates and Renders HTML in markdown
 */
export class HTMLPlugin extends DecorationPlugin {
  readonly name = "html";
  readonly version = "1.0.0";

  override get decorationPriority(): number {
    return 30;
  }

  override getExtensions(): Extension[] {
    return [htmlTheme];
  }

  override buildDecorations(ctx: DecorationContext): void {
    const { view, decorations } = ctx;
    const tree = syntaxTree(view.state);

    // Collect blocks and inline tags
    const htmlGroups: HTMLGroup[] = [];
    const htmlTags: HTMLTagInfo[] = [];

    tree.iterate({
      enter: (node) => {
        const { from, to, name } = node;

        // Handle HTML Comments
        if (name === "Comment") {
          decorations.push(htmlMarkDecorations["html-comment"].range(from, to));
          return;
        }

        // Collect inline HTML tags for pairing
        if (name === "HTMLTag") {
          const content = view.state.sliceDoc(from, to);
          const parsed = parseHTMLTag(content);
          if (parsed) {
            htmlTags.push({
              from,
              to,
              tagName: parsed.tagName,
              isClosing: parsed.isClosing,
              isSelfClosing: parsed.isSelfClosing,
            });
          }
        }

        // Handle HTML Blocks - Collect for grouping
        if (name === "HTMLBlock") {
          const last = htmlGroups[htmlGroups.length - 1];
          if (last) {
            const gap = view.state.sliceDoc(last.to, from);
            if (!gap.trim()) {
              last.to = to;
              return;
            }
          }
          htmlGroups.push({ from, to });
        }
      },
    });

    // Process inline HTML tags (pair opening/closing)
    const processedRanges = new Set<string>();

    for (let i = 0; i < htmlTags.length; i++) {
      const openTag = htmlTags[i]!;

      // Skip if already processed or is a closing tag
      if (processedRanges.has(`${openTag.from}-${openTag.to}`) || openTag.isClosing) {
        continue;
      }

      // Handle self-closing tags
      if (openTag.isSelfClosing) {
        const cursorInRange = ctx.cursorInRange(openTag.from, openTag.to);
        if (cursorInRange) {
          decorations.push(htmlMarkDecorations["html-tag"].range(openTag.from, openTag.to));
        } else {
          const htmlContent = view.state.sliceDoc(openTag.from, openTag.to);
          decorations.push(
            Decoration.replace({
              widget: new InlineHTMLPreviewWidget(htmlContent),
            }).range(openTag.from, openTag.to),
          );
        }
        processedRanges.add(`${openTag.from}-${openTag.to}`);
        continue;
      }

      // Find matching closing tag
      let depth = 1;
      let closeTag: HTMLTagInfo | null = null;

      for (let j = i + 1; j < htmlTags.length && depth > 0; j++) {
        const tag = htmlTags[j]!;
        if (tag.tagName === openTag.tagName) {
          if (tag.isClosing) {
            depth--;
            if (depth === 0) {
              closeTag = tag;
            }
          } else if (!tag.isSelfClosing) {
            depth++;
          }
        }
      }

      if (closeTag) {
        // Found a matching pair
        const rangeFrom = openTag.from;
        const rangeTo = closeTag.to;
        const cursorInRange = ctx.cursorInRange(rangeFrom, rangeTo);

        if (cursorInRange) {
          // Show source - style the tags
          decorations.push(htmlMarkDecorations["html-tag"].range(openTag.from, openTag.to));
          decorations.push(htmlMarkDecorations["html-tag"].range(closeTag.from, closeTag.to));
        } else {
          // Render preview
          const htmlContent = view.state.sliceDoc(rangeFrom, rangeTo);
          decorations.push(
            Decoration.replace({
              widget: new InlineHTMLPreviewWidget(htmlContent),
            }).range(rangeFrom, rangeTo),
          );
        }

        processedRanges.add(`${openTag.from}-${openTag.to}`);
        processedRanges.add(`${closeTag.from}-${closeTag.to}`);
      } else {
        // No matching close tag - just style as source
        decorations.push(htmlMarkDecorations["html-tag"].range(openTag.from, openTag.to));
        processedRanges.add(`${openTag.from}-${openTag.to}`);
      }
    }

    // Style any remaining unprocessed tags
    for (const tag of htmlTags) {
      if (!processedRanges.has(`${tag.from}-${tag.to}`)) {
        decorations.push(htmlMarkDecorations["html-tag"].range(tag.from, tag.to));
      }
    }

    // Process gathered HTML block groups
    for (const group of htmlGroups) {
      const { from, to } = group;

      const nodeLineStart = view.state.doc.lineAt(from);
      const nodeLineEnd = view.state.doc.lineAt(to);
      const cursorInRange = ctx.cursorInRange(nodeLineStart.from, nodeLineEnd.to);

      if (cursorInRange) {
        for (let i = nodeLineStart.number; i <= nodeLineEnd.number; i++) {
          const line = view.state.doc.line(i);
          decorations.push(htmlLineDecorations["html-block"].range(line.from));
        }
      } else {
        const htmlContent = view.state.sliceDoc(from, to);

        decorations.push(
          Decoration.replace({
            widget: new HTMLPreviewWidget(htmlContent.trim()),
          }).range(from, nodeLineStart.to),
        );

        for (let i = nodeLineStart.number + 1; i <= nodeLineEnd.number; i++) {
          const line = view.state.doc.line(i);
          decorations.push(htmlLineDecorations["hidden-line"].range(line.from));
        }
      }
    }
  }
}

/**
 * Theme for HTML styling
 */
const htmlTheme = EditorView.theme({
  ".cm-markly-html-tag": {
    color: "#6a737d",
    fontFamily: "var(--font-jetbrains-mono, monospace)",
    fontSize: "0.85em",
  },

  ".cm-markly-html-comment": {
    color: "#6a737d",
    fontStyle: "italic",
    fontFamily: "var(--font-jetbrains-mono, monospace)",
    fontSize: "0.85em",
    opacity: 0.5,
  },

  ".cm-markly-line-html-block": {
    backgroundColor: "rgba(0, 0, 0, 0.02)",
  },

  ".cm-markly-hidden-line": {
    display: "none",
  },

  ".cm-markly-html-preview": {
    display: "inline-block",
    width: "100%",
    verticalAlign: "top",
    margin: "0",
    whiteSpace: "normal",
    lineHeight: "1.4",
  },
  ".cm-markly-html-preview > *:first-child": {
    marginTop: "0",
  },
  ".cm-markly-html-preview > *:last-child": {
    marginBottom: "0",
  },

  // Inline HTML preview
  ".cm-markly-inline-html-preview": {
    display: "inline",
    whiteSpace: "normal",
  },
});
