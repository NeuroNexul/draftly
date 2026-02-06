import { Decoration } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { DecorationContext, DecorationPlugin } from "../editor/plugin";
import { createTheme } from "../editor";
import { SyntaxNode } from "@lezer/common";
import { highlightCode } from "@lezer/highlight";
import { languages } from "@codemirror/language-data";
import { classHighlighter } from "@lezer/highlight";

/**
 * Mark decorations for code elements
 */
const codeMarkDecorations = {
  // Inline code
  "inline-code": Decoration.mark({ class: "cm-draftly-code-inline" }),
  "inline-mark": Decoration.mark({ class: "cm-draftly-code-mark" }),

  // Fenced code block
  "code-block-line": Decoration.line({ class: "cm-draftly-code-block-line" }),
  "code-block-line-start": Decoration.line({ class: "cm-draftly-code-block-line-start" }),
  "code-block-line-end": Decoration.line({ class: "cm-draftly-code-block-line-end" }),
  "code-fence": Decoration.mark({ class: "cm-draftly-code-fence" }),
  "code-hidden": Decoration.mark({ class: "cm-draftly-code-hidden" }),
};

/**
 * CodePlugin - Handles inline code and fenced code blocks
 *
 * Inline code: `code`
 * - Hides backticks when cursor is not in range
 *
 * Fenced code blocks:
 * ```language
 * code
 * ```
 * - Hides fence lines when cursor is not in range
 * - Syntax highlighting handled by CodeMirror in editor
 * - Uses @lezer/highlight for renderToHTML preview
 */
export class CodePlugin extends DecorationPlugin {
  readonly name = "code";
  readonly version = "1.0.0";
  override decorationPriority = 25;

  /**
   * Plugin theme
   */
  override get theme() {
    return theme;
  }

  /**
   * Build decorations for code elements
   */
  buildDecorations(ctx: DecorationContext): void {
    const { view, decorations } = ctx;
    const tree = syntaxTree(view.state);

    tree.iterate({
      enter: (node) => {
        const { from, to, name } = node;

        // Handle inline code
        if (name === "InlineCode") {
          // Add inline code styling
          decorations.push(codeMarkDecorations["inline-code"].range(from, to));

          // Hide backticks when cursor is not in range
          const cursorInRange = ctx.selectionOverlapsRange(from, to);
          if (!cursorInRange) {
            // Find the CodeMark children (backticks)
            for (let child = node.node.firstChild; child; child = child.nextSibling) {
              if (child.name === "CodeMark") {
                decorations.push(codeMarkDecorations["inline-mark"].range(child.from, child.to));
              }
            }
          }
        }

        // Handle fenced code blocks
        if (name === "FencedCode") {
          const nodeLineStart = view.state.doc.lineAt(from);
          const nodeLineEnd = view.state.doc.lineAt(to);
          const cursorInRange = ctx.selectionOverlapsRange(nodeLineStart.from, nodeLineEnd.to);

          // Extract language from CodeInfo
          let lang = "";
          for (let child = node.node.firstChild; child; child = child.nextSibling) {
            if (child.name === "CodeInfo") {
              lang = view.state.sliceDoc(child.from, child.to).trim();
              break;
            }
          }

          // Add line decorations for all lines in the block
          for (let i = nodeLineStart.number; i <= nodeLineEnd.number; i++) {
            const line = view.state.doc.line(i);
            decorations.push(codeMarkDecorations["code-block-line"].range(line.from));

            // Add start/end line decorations
            if (i === nodeLineStart.number) {
              decorations.push(codeMarkDecorations["code-block-line-start"].range(line.from));
              // Add language label decoration when cursor not in range
              if (!cursorInRange && lang) {
                decorations.push(
                  Decoration.line({
                    class: "cm-draftly-code-block-line-with-lang",
                    attributes: { "data-lang": lang },
                  }).range(line.from)
                );
              }
            }
            if (i === nodeLineEnd.number) {
              decorations.push(codeMarkDecorations["code-block-line-end"].range(line.from));
            }
          }

          // Find CodeMark and CodeInfo children
          for (let child = node.node.firstChild; child; child = child.nextSibling) {
            if (child.name === "CodeMark" || child.name === "CodeInfo") {
              if (cursorInRange) {
                // Show fence markers with styling when cursor is in range
                decorations.push(codeMarkDecorations["code-fence"].range(child.from, child.to));
              } else {
                // Hide fence markers when cursor is not in range
                decorations.push(codeMarkDecorations["code-hidden"].range(child.from, child.to));
              }
            }
          }
        }
      },
    });
  }

  /**
   * Render code to HTML for preview mode
   */
  override renderToHTML(
    node: SyntaxNode,
    children: string,
    ctx: { sliceDoc(from: number, to: number): string; sanitize(html: string): string }
  ): string | null {
    // Hide CodeMark (backticks)
    if (node.name === "CodeMark") {
      return "";
    }

    // Inline code
    if (node.name === "InlineCode") {
      // Extract content without backticks
      let content = ctx.sliceDoc(node.from, node.to);
      // Remove leading and trailing backticks
      const match = content.match(/^`+(.+?)`+$/s);
      if (match && match[1]) {
        content = match[1];
      }
      return `<code class="cm-draftly-code-inline">${ctx.sanitize(content)}</code>`;
    }

    // Fenced code block
    if (node.name === "FencedCode") {
      const content = ctx.sliceDoc(node.from, node.to);
      const lines = content.split("\n");

      // Extract language from first line
      const firstLine = lines[0] || "";
      const langMatch = firstLine.match(/^```(\w*)/);
      const lang = langMatch ? langMatch[1] : "";

      // Get code content (without fence lines)
      const codeLines = lines.slice(1, -1);
      const code = codeLines.join("\n");

      // Try to get syntax highlighting
      const highlighted = this.highlightCode(code, lang || "", ctx);

      const langAttr = lang ? ` data-lang="${ctx.sanitize(lang)}"` : "";
      return `<pre class="cm-draftly-code-block"${langAttr}><code>${highlighted}</code></pre>`;
    }

    // Hide CodeInfo and CodeText - they're handled by FencedCode
    if (node.name === "CodeInfo" || node.name === "CodeText") {
      return "";
    }

    return null;
  }

  /**
   * Highlight code using @lezer/highlight
   */
  private highlightCode(code: string, lang: string, ctx: { sanitize(html: string): string }): string {
    if (!lang) {
      return ctx.sanitize(code);
    }

    // Find the language description
    const langDesc = languages.find(
      (l) => l.name.toLowerCase() === lang.toLowerCase() || (l.alias && l.alias.includes(lang.toLowerCase()))
    );

    if (!langDesc) {
      return ctx.sanitize(code);
    }

    try {
      // Load language synchronously if possible (this is for preview)
      // For now, use a simpler approach - check if we can get the parser
      const langSupport = langDesc.support;
      if (!langSupport) {
        return ctx.sanitize(code);
      }

      const parser = langSupport.language.parser;
      const tree = parser.parse(code);

      let result = "";

      highlightCode(
        code,
        tree,
        classHighlighter,
        (text, classes) => {
          if (classes) {
            result += `<span class="${classes}">${ctx.sanitize(text)}</span>`;
          } else {
            result += ctx.sanitize(text);
          }
        },
        () => {
          result += "\n";
        }
      );

      return result;
    } catch {
      // Fallback to plain text if highlighting fails
      return ctx.sanitize(code);
    }
  }
}

/**
 * Theme for code styling
 */
const theme = createTheme({
  default: {
    // Inline code
    ".cm-draftly-code-inline": {
      fontFamily: "var(--font-jetbrains-mono, monospace)",
      fontSize: "0.9em",
      backgroundColor: "rgba(0, 0, 0, 0.05)",
      padding: "0.1em 0em",
      borderRadius: "3px",
    },

    // Hidden inline code marks (backticks)
    ".cm-draftly-code-inline .cm-draftly-code-mark": {
      visibility: "hidden",
    },

    // Fenced code block lines
    ".cm-draftly-code-block-line": {
      fontFamily: "var(--font-jetbrains-mono, monospace)",
      fontSize: "0.9em",
      backgroundColor: "rgba(0, 0, 0, 0.03)",
      padding: "0 1rem !important",
      lineHeight: "1.5",
    },

    // First line of code block
    ".cm-draftly-code-block-line-start": {
      borderTopLeftRadius: "6px",
      borderTopRightRadius: "6px",
      position: "relative",
    },

    // Language label (shown when cursor not in range)
    ".cm-draftly-code-block-line-with-lang::before": {
      content: "attr(data-lang)",
      position: "absolute",
      top: "0.5rem",
      right: "1rem",
      fontSize: "0.9rem",
      color: "#6a737d",
      fontFamily: "var(--font-jetbrains-mono, monospace)",
      opacity: "0.7",
    },

    // Last line of code block
    ".cm-draftly-code-block-line-end": {
      borderBottomLeftRadius: "6px",
      borderBottomRightRadius: "6px",
    },

    // Fence markers (```)
    ".cm-draftly-code-fence": {
      color: "#6a737d",
      fontFamily: "var(--font-jetbrains-mono, monospace)",
    },

    // Hidden fence markers (when cursor not in range)
    ".cm-draftly-code-hidden": {
      visibility: "hidden",
    },

    // Preview: code block container
    ".cm-draftly-code-block": {
      fontFamily: "var(--font-jetbrains-mono, monospace)",
      fontSize: "0.9em",
      backgroundColor: "rgba(0, 0, 0, 0.03)",
      padding: "1em",
      borderRadius: "6px",
      overflow: "auto",
      margin: "1em 0",
      position: "relative",
    },

    // Preview: language label
    ".cm-draftly-code-block[data-lang]::before": {
      content: "attr(data-lang)",
      position: "absolute",
      top: "0.5rem",
      right: "1rem",
      fontSize: "0.9rem",
      color: "#6a737d",
      fontFamily: "var(--font-jetbrains-mono, monospace)",
      opacity: "0.7",
    },
  },

  dark: {
    ".cm-draftly-code-inline": {
      backgroundColor: "rgba(255, 255, 255, 0.1)",
    },

    ".cm-draftly-code-block-line": {
      backgroundColor: "rgba(255, 255, 255, 0.05)",
    },

    ".cm-draftly-code-fence": {
      color: "#8b949e",
    },

    ".cm-draftly-code-block": {
      backgroundColor: "rgba(255, 255, 255, 0.05)",
    },
  },
});
