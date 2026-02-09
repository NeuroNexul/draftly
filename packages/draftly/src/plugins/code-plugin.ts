import { Decoration, EditorView, KeyBinding, WidgetType } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { DecorationContext, DecorationPlugin } from "../editor/plugin";
import { createTheme, toggleMarkdownStyle } from "../editor";
import { SyntaxNode } from "@lezer/common";
import { highlightCode } from "@lezer/highlight";
import { languages } from "@codemirror/language-data";
import { classHighlighter } from "@lezer/highlight";

// ============================================================================
// Constants
// ============================================================================

/** Copy icon SVG (clipboard) */
const COPY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;

/** Checkmark icon SVG (success state) */
const CHECK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

/** Delay before resetting copy button state (ms) */
const COPY_RESET_DELAY = 2000;

// ============================================================================
// Decorations
// ============================================================================

/** Mark and line decorations for code elements */
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

  // Highlights
  "code-line-highlight": Decoration.line({ class: "cm-draftly-code-line-highlight" }),
  "code-text-highlight": Decoration.mark({ class: "cm-draftly-code-text-highlight" }),
};

/**
 * Text highlight definition
 * Matches text or regex patterns with optional instance selection
 */
export interface TextHighlight {
  /** The pattern to match (regex without slashes) */
  pattern: string;
  /** Specific instances to highlight (e.g., [3,5] or range [3,4,5]) */
  instances?: number[];
}

/**
 * Properties extracted from CodeInfo string
 *
 * Example: ```tsx line-numbers{5} title="hello.tsx" caption="Example" copy {2-4,5} /Hello/3-5
 */
export interface CodeBlockProperties {
  /** Language identifier (first token) */
  language: string;
  /** Show line numbers, optionally starting from a specific number */
  lineNumbers?: number | boolean;
  /** Title to display */
  title?: string;
  /** Caption to display */
  caption?: string;
  /** Show copy button */
  copy?: boolean;
  /** Lines to highlight (e.g., [2,3,4,5,9]) */
  highlightLines?: number[];
  /** Text patterns to highlight with optional instance selection */
  highlightText?: TextHighlight[];
}

// ============================================================================
// Widgets
// ============================================================================

/**
 * Widget for code block header.
 * Displays title or language on the left, and a copy button on the right.
 */
class CodeBlockHeaderWidget extends WidgetType {
  constructor(
    private props: CodeBlockProperties,
    private codeContent: string
  ) {
    super();
  }

  /** Creates the header DOM element with title/language and optional copy button. */
  toDOM(): HTMLElement {
    const header = document.createElement("div");
    header.className = "cm-draftly-code-header";

    // Left side: title or language
    const leftSide = document.createElement("div");
    leftSide.className = "cm-draftly-code-header-left";

    if (this.props.title) {
      const title = document.createElement("span");
      title.className = "cm-draftly-code-header-title";
      title.textContent = this.props.title;
      leftSide.appendChild(title);
    } else if (this.props.language) {
      const lang = document.createElement("span");
      lang.className = "cm-draftly-code-header-lang";
      lang.textContent = this.props.language;
      leftSide.appendChild(lang);
    }

    header.appendChild(leftSide);

    // Right side: copy button
    if (this.props.copy !== false) {
      const rightSide = document.createElement("div");
      rightSide.className = "cm-draftly-code-header-right";

      const copyBtn = document.createElement("button");
      copyBtn.className = "cm-draftly-code-copy-btn";
      copyBtn.type = "button";
      copyBtn.title = "Copy code";
      copyBtn.innerHTML = COPY_ICON;

      copyBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.writeText(this.codeContent).then(() => {
          copyBtn.classList.add("copied");
          copyBtn.innerHTML = CHECK_ICON;
          setTimeout(() => {
            copyBtn.classList.remove("copied");
            copyBtn.innerHTML = COPY_ICON;
          }, COPY_RESET_DELAY);
        });
      });

      rightSide.appendChild(copyBtn);
      header.appendChild(rightSide);
    }

    return header;
  }

  /** Checks equality for widget reuse optimization. */
  override eq(other: CodeBlockHeaderWidget): boolean {
    return (
      this.props.title === other.props.title &&
      this.props.language === other.props.language &&
      this.props.copy === other.props.copy &&
      this.codeContent === other.codeContent
    );
  }

  /** Allow click events to propagate for copy button interaction. */
  override ignoreEvent(): boolean {
    return false;
  }
}

/**
 * Widget for code block caption.
 * Displays descriptive text below the code block.
 */
class CodeBlockCaptionWidget extends WidgetType {
  constructor(private caption: string) {
    super();
  }

  /** Creates the caption DOM element. */
  toDOM(): HTMLElement {
    const captionEl = document.createElement("div");
    captionEl.className = "cm-draftly-code-caption";
    captionEl.textContent = this.caption;
    return captionEl;
  }

  /** Checks equality for widget reuse optimization. */
  override eq(other: CodeBlockCaptionWidget): boolean {
    return this.caption === other.caption;
  }

  /** Ignore all events (caption is non-interactive). */
  override ignoreEvent(): boolean {
    return true;
  }
}

// ============================================================================
// Plugin
// ============================================================================

/**
 * CodePlugin - Handles inline code and fenced code blocks.
 *
 * **Inline code:** `code`
 * Hides backticks when cursor is not in range.
 *
 * **Fenced code blocks:**
 * Supports syntax highlighting, line numbers, line/text highlighting,
 * title, caption, and copy button via CodeInfo properties.
 *
 * @example
 * ```tsx line-numbers{5} title="example.tsx" {2-4} /pattern/
 * const x = 1;
 * ```
 */
export class CodePlugin extends DecorationPlugin {
  readonly name = "code";
  readonly version = "1.0.0";
  override decorationPriority = 25;
  override readonly requiredNodes = ["InlineCode", "FencedCode", "CodeMark", "CodeInfo", "CodeText"] as const;

  /**
   * Plugin theme
   */
  override get theme() {
    return theme;
  }

  /**
   * Keyboard shortcuts for code formatting
   */
  override getKeymap(): KeyBinding[] {
    return [
      {
        key: "Mod-e",
        run: toggleMarkdownStyle("`"),
        preventDefault: true,
      },
      {
        key: "Mod-Shift-e",
        run: (view) => this.toggleCodeBlock(view),
        preventDefault: true,
      },
    ];
  }

  /**
   * Toggle code block on current line or selected lines
   */
  private toggleCodeBlock(view: EditorView): boolean {
    const { state } = view;
    const { from, to } = state.selection.main;

    // Get all lines in selection
    const startLine = state.doc.lineAt(from);
    const endLine = state.doc.lineAt(to);

    // Check if lines are already in a code block
    const prevLineNum = startLine.number > 1 ? startLine.number - 1 : startLine.number;
    const nextLineNum = endLine.number < state.doc.lines ? endLine.number + 1 : endLine.number;

    const prevLine = state.doc.line(prevLineNum);
    const nextLine = state.doc.line(nextLineNum);

    const isWrapped =
      prevLine.text.trim().startsWith("```") &&
      nextLine.text.trim() === "```" &&
      prevLineNum !== startLine.number &&
      nextLineNum !== endLine.number;

    if (isWrapped) {
      // Remove the fence lines
      view.dispatch({
        changes: [
          { from: prevLine.from, to: prevLine.to + 1, insert: "" }, // Remove opening fence + newline
          { from: nextLine.from - 1, to: nextLine.to, insert: "" }, // Remove newline + closing fence
        ],
      });
    } else {
      // Wrap with code fence
      const openFence = "```\n";
      const closeFence = "\n```";

      view.dispatch({
        changes: [
          { from: startLine.from, insert: openFence },
          { from: endLine.to, insert: closeFence },
        ],
        selection: { anchor: startLine.from + openFence.length, head: endLine.to + openFence.length },
      });
    }

    return true;
  }

  /**
   * Parse CodeInfo string into structured properties
   *
   * @param codeInfo - The raw CodeInfo string (e.g., "tsx line-numbers{5} title=\"hello.tsx\" copy {2-4,5} /Hello/3-5")
   * @returns Parsed CodeBlockProperties object
   *
   * @example
   * ```typescript
   * parseCodeInfo("tsx line-numbers{5} title=\"hello.tsx\" copy {2-4,5} /Hello/3-5")
   * ```
   *
   * Returns:
   * ```json
   * {
   *   language: "tsx",
   *   lineNumbers: 5,
   *   title: "hello.tsx",
   *   copy: true,
   *   highlightLines: [2,3,4,5],
   *   highlightText: [{ pattern: "Hello", instances: [3,4,5] }]
   * }
   * ```
   */
  parseCodeInfo(codeInfo: string): CodeBlockProperties {
    const props: CodeBlockProperties = { language: "" };

    if (!codeInfo || !codeInfo.trim()) {
      return props;
    }

    let remaining = codeInfo.trim();

    // Extract language (first word before any special tokens)
    const langMatch = remaining.match(/^(\w+)/);
    if (langMatch && langMatch[1]) {
      props.language = langMatch[1];
      remaining = remaining.slice(langMatch[0].length).trim();
    }

    // Extract quoted values (title="..." caption="...")
    const quotedPattern = /(\w+)="([^"]*)"/g;
    let quotedMatch;
    while ((quotedMatch = quotedPattern.exec(remaining)) !== null) {
      const key = quotedMatch[1]?.toLowerCase();
      const value = quotedMatch[2];

      if (key === "title" && value !== undefined) {
        props.title = value;
      } else if (key === "caption" && value !== undefined) {
        props.caption = value;
      }
    }
    // Remove matched quoted values
    remaining = remaining.replace(quotedPattern, "").trim();

    // Check for line-numbers with optional start value
    const lineNumbersMatch = remaining.match(/line-numbers(?:\{(\d+)\})?/);
    if (lineNumbersMatch) {
      if (lineNumbersMatch[1]) {
        props.lineNumbers = parseInt(lineNumbersMatch[1], 10);
      } else {
        props.lineNumbers = true;
      }
      remaining = remaining.replace(lineNumbersMatch[0], "").trim();
    }

    // Check for copy flag
    if (/\bcopy\b/.test(remaining)) {
      props.copy = true;
      remaining = remaining.replace(/\bcopy\b/, "").trim();
    }

    // Extract line highlights {2-4,5,9}
    const lineHighlightMatch = remaining.match(/\{([^}]+)\}/);
    if (lineHighlightMatch && lineHighlightMatch[1]) {
      const highlightLines: number[] = [];
      const parts = lineHighlightMatch[1].split(",");

      for (const part of parts) {
        const trimmed = part.trim();
        const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/);

        if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
          // Range: 2-4 -> [2,3,4]
          const start = parseInt(rangeMatch[1], 10);
          const end = parseInt(rangeMatch[2], 10);
          for (let i = start; i <= end; i++) {
            highlightLines.push(i);
          }
        } else if (/^\d+$/.test(trimmed)) {
          // Individual number
          highlightLines.push(parseInt(trimmed, 10));
        }
      }

      if (highlightLines.length > 0) {
        props.highlightLines = highlightLines;
      }
      remaining = remaining.replace(lineHighlightMatch[0], "").trim();
    }

    // Extract text/regex highlights /pattern/ or /pattern/3-5 or /pattern/3,5
    const textHighlightPattern = /\/([^/]+)\/(?:(\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*))?/g;
    let textMatch;
    const highlightText: TextHighlight[] = [];

    while ((textMatch = textHighlightPattern.exec(remaining)) !== null) {
      if (!textMatch[1]) continue;
      const highlight: TextHighlight = {
        pattern: textMatch[1],
      };

      // Parse instance selection if present
      if (textMatch[2]) {
        const instanceStr = textMatch[2];
        const instances: number[] = [];
        const instanceParts = instanceStr.split(",");

        for (const part of instanceParts) {
          const rangeMatch = part.match(/^(\d+)-(\d+)$/);
          if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
            // Range: 3-5 -> [3,4,5]
            const start = parseInt(rangeMatch[1], 10);
            const end = parseInt(rangeMatch[2], 10);
            for (let i = start; i <= end; i++) {
              instances.push(i);
            }
          } else if (/^\d+$/.test(part)) {
            instances.push(parseInt(part, 10));
          }
        }

        if (instances.length > 0) {
          highlight.instances = instances;
        }
      }

      highlightText.push(highlight);
    }

    if (highlightText.length > 0) {
      props.highlightText = highlightText;
    }

    return props;
  }

  /**
   * Build decorations for inline code and fenced code blocks.
   * Handles line numbers, highlights, header/caption widgets, and fence visibility.
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

          // Extract properties from CodeInfo
          let infoProps: CodeBlockProperties = { language: "" };
          for (let child = node.node.firstChild; child; child = child.nextSibling) {
            if (child.name === "CodeInfo") {
              infoProps = this.parseCodeInfo(view.state.sliceDoc(child.from, child.to).trim());
              break;
            }
          }

          // Calculate line number width for styling (if line numbers enabled)
          const totalCodeLines = nodeLineEnd.number - nodeLineStart.number - 1; // Exclude fence lines
          const startLineNum = typeof infoProps.lineNumbers === "number" ? infoProps.lineNumbers : 1;
          const maxLineNum = startLineNum + totalCodeLines - 1;
          const lineNumWidth = Math.max(String(maxLineNum).length, String(startLineNum).length);

          // Track code line index (excluding fence lines)
          let codeLineIndex = 0;

          // Extract code content for copy button
          let codeContent = "";
          for (let child = node.node.firstChild; child; child = child.nextSibling) {
            if (child.name === "CodeText") {
              codeContent = view.state.sliceDoc(child.from, child.to);
              break;
            }
          }

          const shouldShowHeader = !cursorInRange && (infoProps.title || infoProps.copy || infoProps.language);
          const shouldShowCaption = !cursorInRange && infoProps.caption;

          // Add header widget when cursor not in range and (title, copy, or language is set)
          if (shouldShowHeader) {
            decorations.push(
              Decoration.widget({
                widget: new CodeBlockHeaderWidget(infoProps, codeContent),
                block: false,
              }).range(nodeLineStart.from)
            );
          }

          // Add line decorations for all lines in the block
          for (let i = nodeLineStart.number; i <= nodeLineEnd.number; i++) {
            const line = view.state.doc.line(i);
            const isFenceLine = i === nodeLineStart.number || i === nodeLineEnd.number;
            const relativeLineNum = startLineNum + codeLineIndex;

            // Base line decoration
            decorations.push(codeMarkDecorations["code-block-line"].range(line.from));

            // Add start/end line decorations
            if (i === nodeLineStart.number) {
              decorations.push(codeMarkDecorations["code-block-line-start"].range(line.from));
              // Add class for header presence
              if (shouldShowHeader) {
                decorations.push(
                  Decoration.line({
                    class: "cm-draftly-code-block-has-header",
                  }).range(line.from)
                );
              }
            }
            if (i === nodeLineEnd.number) {
              decorations.push(codeMarkDecorations["code-block-line-end"].range(line.from));
              // Add class for caption presence
              if (shouldShowCaption) {
                decorations.push(
                  Decoration.line({
                    class: "cm-draftly-code-block-has-caption",
                  }).range(line.from)
                );
              }
            }

            // Line numbers (only for code lines, not fence lines)
            if (!isFenceLine && infoProps.lineNumbers) {
              decorations.push(
                Decoration.line({
                  class: "cm-draftly-code-line-numbered",
                  attributes: {
                    "data-line-num": String(relativeLineNum),
                    style: `--line-num-width: ${lineNumWidth}ch`,
                  },
                }).range(line.from)
              );
            }

            // Line highlight (check if this line should be highlighted)
            if (!isFenceLine && infoProps.highlightLines) {
              if (infoProps.highlightLines.includes(codeLineIndex + 1)) {
                decorations.push(codeMarkDecorations["code-line-highlight"].range(line.from));
              }
            }

            // Text highlights
            if (!isFenceLine && infoProps.highlightText && infoProps.highlightText.length > 0) {
              const lineText = view.state.sliceDoc(line.from, line.to);

              for (const textHighlight of infoProps.highlightText) {
                try {
                  const regex = new RegExp(textHighlight.pattern, "g");
                  let match;
                  let matchIndex = 0;

                  while ((match = regex.exec(lineText)) !== null) {
                    matchIndex++;

                    // Check if this instance should be highlighted
                    const shouldHighlight = !textHighlight.instances || textHighlight.instances.includes(matchIndex);

                    if (shouldHighlight) {
                      const matchFrom = line.from + match.index;
                      const matchTo = matchFrom + match[0].length;
                      decorations.push(codeMarkDecorations["code-text-highlight"].range(matchFrom, matchTo));
                    }
                  }
                } catch {
                  // Invalid regex, skip
                }
              }
            }

            // Increment code line index (only for non-fence lines)
            if (!isFenceLine) {
              codeLineIndex++;
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

          // Add caption widget when cursor not in range and caption is set
          if (!cursorInRange && infoProps.caption) {
            decorations.push(
              Decoration.widget({
                widget: new CodeBlockCaptionWidget(infoProps.caption),
                block: false,
                side: 1, // After the content
              }).range(nodeLineEnd.to)
            );
          }
        }
      },
    });
  }

  /**
   * Render code elements to HTML for static preview.
   * Applies syntax highlighting using @lezer/highlight.
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
      return `<code class="cm-draftly-code-inline" style="padding: 0.1rem 0.25rem">${ctx.sanitize(content)}</code>`;
    }

    // Fenced code block
    if (node.name === "FencedCode") {
      const content = ctx.sliceDoc(node.from, node.to);
      const lines = content.split("\n");

      // Extract info string from first line (everything after ```)
      const firstLine = lines[0] || "";
      const infoMatch = firstLine.match(/^```(.*)$/);
      const infoString = infoMatch?.[1]?.trim() || "";

      // Parse properties from info string
      const props = this.parseCodeInfo(infoString);

      // Get code content (without fence lines)
      const codeLines = lines.slice(1, -1);
      const code = codeLines.join("\n");

      // Build HTML parts
      let html = "";

      // Wrapper container
      html += `<div class="cm-draftly-code-container">`;

      // Header (if title, copy, or language is set)
      const showHeader = props.title || props.copy || props.language;
      if (showHeader) {
        html += `<div class="cm-draftly-code-header">`;
        html += `<div class="cm-draftly-code-header-left">`;
        if (props.title) {
          html += `<span class="cm-draftly-code-header-title">${ctx.sanitize(props.title)}</span>`;
        } else if (props.language) {
          html += `<span class="cm-draftly-code-header-lang">${ctx.sanitize(props.language)}</span>`;
        }
        html += `</div>`;
        if (props.copy !== false) {
          html += `<div class="cm-draftly-code-header-right">`;
          // Encode code as base64 to safely store in data attribute (preserves newlines and special chars)
          const encodedCode =
            typeof btoa !== "undefined" ? btoa(encodeURIComponent(code)) : Buffer.from(code).toString("base64");
          html += `<button class="cm-draftly-code-copy-btn" type="button" title="Copy code" data-code="${encodedCode}" data-encoded="true">`;
          html += `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
          html += `</button>`;
          html += `</div>`;
        }
        html += `</div>`;
      }

      // Calculate line number info
      const startLineNum = typeof props.lineNumbers === "number" ? props.lineNumbers : 1;
      const lineNumWidth = String(startLineNum + codeLines.length - 1).length;

      // Code block with line processing
      const hasHeader = showHeader ? " cm-draftly-code-block-has-header" : "";
      const hasCaption = props.caption ? " cm-draftly-code-block-has-caption" : "";
      html += `<pre class="cm-draftly-code-block${hasHeader}${hasCaption}"${props.language ? ` data-lang="${ctx.sanitize(props.language)}"` : ""}>`;
      html += `<code>`;

      // Process each line
      codeLines.forEach((line, index) => {
        const lineNum = startLineNum + index;
        const isHighlighted = props.highlightLines?.includes(index + 1);

        // Line classes
        const lineClasses: string[] = ["cm-draftly-code-line"];
        if (isHighlighted) lineClasses.push("cm-draftly-code-line-highlight");
        if (props.lineNumbers) lineClasses.push("cm-draftly-code-line-numbered");

        // Line attributes
        const lineAttrs: string[] = [`class="${lineClasses.join(" ")}"`];
        if (props.lineNumbers) {
          lineAttrs.push(`data-line-num="${lineNum}"`);
          lineAttrs.push(`style="--line-num-width: ${lineNumWidth}ch"`);
        }

        // Highlight text content
        let lineContent = this.highlightCodeLine(line, props.language || "", ctx);

        // Apply text highlights
        if (props.highlightText && props.highlightText.length > 0) {
          lineContent = this.applyTextHighlights(lineContent, props.highlightText);
        }

        html += `<span ${lineAttrs.join(" ")}>${lineContent || " "}</span>`;
      });

      html += `</code></pre>`;

      // Caption
      if (props.caption) {
        html += `<div class="cm-draftly-code-caption">${ctx.sanitize(props.caption)}</div>`;
      }

      // Close wrapper container
      html += `</div>`;

      return html;
    }

    // Hide CodeInfo and CodeText - they're handled by FencedCode
    if (node.name === "CodeInfo" || node.name === "CodeText") {
      return "";
    }

    return null;
  }

  /**
   * Highlight a single line of code using the language's Lezer parser.
   * Falls back to sanitized plain text if the language is not supported.
   */
  private highlightCodeLine(line: string, lang: string, ctx: { sanitize(html: string): string }): string {
    if (!lang || !line) {
      return ctx.sanitize(line);
    }

    // Find the language description
    const langDesc = languages.find(
      (l) => l.name.toLowerCase() === lang.toLowerCase() || (l.alias && l.alias.includes(lang.toLowerCase()))
    );

    if (!langDesc || !langDesc.support) {
      return ctx.sanitize(line);
    }

    try {
      const parser = langDesc.support.language.parser;
      const tree = parser.parse(line);

      let result = "";

      highlightCode(
        line,
        tree,
        classHighlighter,
        (text, classes) => {
          if (classes) {
            result += `<span class="${classes}">${ctx.sanitize(text)}</span>`;
          } else {
            result += ctx.sanitize(text);
          }
        },
        () => {} // No newlines for single line
      );

      return result;
    } catch {
      return ctx.sanitize(line);
    }
  }

  /**
   * Apply text highlights (regex patterns) to already syntax-highlighted HTML.
   * Wraps matched patterns in `<mark>` elements.
   */
  private applyTextHighlights(htmlContent: string, highlights: TextHighlight[]): string {
    let result = htmlContent;

    for (const highlight of highlights) {
      try {
        // Create regex from pattern
        const regex = new RegExp(`(${highlight.pattern})`, "g");
        let matchCount = 0;

        result = result.replace(regex, (match) => {
          matchCount++;
          // Check if this instance should be highlighted
          const shouldHighlight = !highlight.instances || highlight.instances.includes(matchCount);
          if (shouldHighlight) {
            return `<mark class="cm-draftly-code-text-highlight">${match}</mark>`;
          }
          return match;
        });
      } catch {
        // Invalid regex, skip
      }
    }

    return result;
  }
}

// ============================================================================
// Theme
// ============================================================================

/** Theme styles for code elements (light and dark modes) */
const theme = createTheme({
  default: {
    // Inline code
    ".cm-draftly-code-inline": {
      fontFamily: "var(--font-jetbrains-mono, monospace)",
      fontSize: "0.9rem",
      backgroundColor: "rgba(0, 0, 0, 0.05)",
      padding: "0.1rem 0rem",
      border: "1px solid var(--color-border)",
      borderRadius: "3px",
    },

    // Hidden inline code marks (backticks)
    ".cm-draftly-code-inline .cm-draftly-code-mark": {
      visibility: "hidden",
    },

    // Fenced code block lines
    ".cm-draftly-code-block-line": {
      "--radius": "0.375rem",

      fontFamily: "var(--font-jetbrains-mono, monospace)",
      fontSize: "0.9rem",
      backgroundColor: "rgba(0, 0, 0, 0.03)",
      padding: "0 1rem !important",
      lineHeight: "1.5",
      borderLeft: "1px solid var(--color-border)",
      borderRight: "1px solid var(--color-border)",
    },

    // First line of code block
    ".cm-draftly-code-block-line-start": {
      borderTopLeftRadius: "var(--radius)",
      borderTopRightRadius: "var(--radius)",
      position: "relative",
      overflow: "hidden",
      borderTop: "1px solid var(--color-border)",
    },

    // Remove top radius when header is present
    ".cm-draftly-code-block-has-header": {
      padding: "0 !important",
      paddingBottom: "0.5rem !important",
    },

    // Code block header widget
    ".cm-draftly-code-header": {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "0.25rem 1rem",
      backgroundColor: "rgba(0, 0, 0, 0.06)",
      fontFamily: "var(--font-jetbrains-mono, monospace)",
      fontSize: "0.85rem",
    },

    ".cm-draftly-code-header-left": {
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
    },

    ".cm-draftly-code-header-title": {
      color: "var(--color-text, inherit)",
      fontWeight: "500",
    },

    ".cm-draftly-code-header-lang": {
      color: "#6a737d",
      opacity: "0.8",
    },

    ".cm-draftly-code-header-right": {
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
    },

    ".cm-draftly-code-copy-btn": {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0.25rem",
      backgroundColor: "transparent",
      border: "none",
      borderRadius: "4px",
      cursor: "pointer",
      color: "#6a737d",
      transition: "color 0.2s, background-color 0.2s",
    },

    ".cm-draftly-code-copy-btn:hover": {
      backgroundColor: "rgba(0, 0, 0, 0.1)",
      color: "var(--color-text, inherit)",
    },

    ".cm-draftly-code-copy-btn.copied": {
      color: "#22c55e",
    },

    // Caption (below code block)
    ".cm-draftly-code-block-has-caption": {
      padding: "0 !important",
      paddingTop: "0.5rem !important",
    },

    ".cm-draftly-code-caption": {
      textAlign: "center",
      fontSize: "0.85rem",
      color: "#6a737d",
      fontStyle: "italic",
      padding: "0.25rem 1rem",
      backgroundColor: "rgba(0, 0, 0, 0.06)",
    },

    // Last line of code block
    ".cm-draftly-code-block-line-end": {
      borderBottomLeftRadius: "var(--radius)",
      borderBottomRightRadius: "var(--radius)",
      borderBottom: "1px solid var(--color-border)",
      paddingTop: "0.5rem !important",
    },

    ".cm-draftly-code-block-line-end br": {
      display: "none",
    },

    // Fence markers (```)
    ".cm-draftly-code-fence": {
      color: "#6a737d",
      fontFamily: "var(--font-jetbrains-mono, monospace)",
    },

    // Hidden fence markers (when cursor not in range)
    ".cm-draftly-code-hidden": {
      // visibility: "hidden",
      display: "none",
    },

    // Line numbers
    ".cm-draftly-code-line-numbered": {
      paddingLeft: "calc(var(--line-num-width, 2ch) + 1rem) !important",
      position: "relative",
    },

    ".cm-draftly-code-line-numbered::before": {
      content: "attr(data-line-num)",
      position: "absolute",
      left: "0.5rem",
      top: "0.2rem",
      width: "var(--line-num-width, 2ch)",
      textAlign: "right",
      color: "#6a737d",
      opacity: "0.6",
      fontFamily: "var(--font-jetbrains-mono, monospace)",
      fontSize: "0.85rem",
      userSelect: "none",
    },

    // Preview: code lines (need block display for full-width highlights)
    ".cm-draftly-code-line": {
      display: "block",
      position: "relative",
      paddingLeft: "1rem",
      paddingRight: "1rem",
      lineHeight: "1.5",
      borderLeft: "3px solid transparent",
    },

    // Line highlight
    ".cm-draftly-code-line-highlight": {
      backgroundColor: "rgba(255, 220, 100, 0.2) !important",
      borderLeft: "3px solid #f0b429 !important",
    },

    // Text highlight
    ".cm-draftly-code-text-highlight": {
      backgroundColor: "rgba(255, 220, 100, 0.4)",
      borderRadius: "2px",
      padding: "0.1rem 0",
    },
    // Preview: container wrapper
    ".cm-draftly-code-container": {
      margin: "1rem 0",
      borderRadius: "var(--radius)",
      overflow: "hidden",
      border: "1px solid var(--color-border)",
    },

    // Preview: header inside container
    ".cm-draftly-code-container .cm-draftly-code-header": {
      borderRadius: "0",
      border: "none",
      borderBottom: "1px solid var(--color-border)",
    },

    // Preview: code block inside container
    ".cm-draftly-code-container .cm-draftly-code-block": {
      margin: "0",
      borderRadius: "0",
      border: "none",
      whiteSpace: "pre-wrap",
    },

    // Preview: caption inside container
    ".cm-draftly-code-container .cm-draftly-code-caption": {
      borderTop: "1px solid var(--color-border)",
    },

    // Preview: standalone code block (not in container)
    ".cm-draftly-code-block": {
      fontFamily: "var(--font-jetbrains-mono, monospace)",
      fontSize: "0.9rem",
      backgroundColor: "rgba(0, 0, 0, 0.03)",
      padding: "1rem",
      overflow: "auto",
      position: "relative",
      borderRadius: "var(--radius)",
      border: "1px solid var(--color-border)",
    },

    // Preview: code block with header (remove top radius)
    ".cm-draftly-code-block.cm-draftly-code-block-has-header": {
      borderTopLeftRadius: "0",
      borderTopRightRadius: "0",
      borderTop: "none",
      margin: "0",
      paddingTop: "0.5rem !important",
    },

    // Preview: code block with caption (remove bottom radius)
    ".cm-draftly-code-block.cm-draftly-code-block-has-caption": {
      borderBottomLeftRadius: "0",
      borderBottomRightRadius: "0",
      borderBottom: "none",
      paddingBottom: "0.5rem !important",
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

    ".cm-draftly-code-header": {
      backgroundColor: "rgba(255, 255, 255, 0.08)",
    },

    ".cm-draftly-code-header-lang": {
      color: "#8b949e",
    },

    ".cm-draftly-code-copy-btn": {
      color: "#8b949e",
    },

    ".cm-draftly-code-copy-btn:hover": {
      backgroundColor: "rgba(255, 255, 255, 0.1)",
    },

    ".cm-draftly-code-caption": {
      backgroundColor: "rgba(255, 255, 255, 0.05)",
    },

    ".cm-draftly-code-line-numbered::before": {
      color: "#8b949e",
    },

    ".cm-draftly-code-line-highlight": {
      backgroundColor: "rgba(255, 220, 100, 0.15) !important",
      borderLeft: "3px solid #d9a520 !important",
    },

    ".cm-draftly-code-text-highlight": {
      backgroundColor: "rgba(255, 220, 100, 0.3)",
    },
  },
});
