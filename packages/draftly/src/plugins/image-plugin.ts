import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { DecorationContext, DecorationPlugin } from "../editor/plugin";
import { createTheme } from "../editor";
import { SyntaxNode } from "@lezer/common";

/**
 * Mark decorations for image syntax elements
 */
const imageMarkDecorations = {
  "image-block": Decoration.line({ class: "cm-draftly-image-block" }),
  "image-marker": Decoration.mark({ class: "cm-draftly-image-marker" }),
  "image-alt": Decoration.mark({ class: "cm-draftly-image-alt" }),
  "image-url": Decoration.mark({ class: "cm-draftly-image-url" }),
  "image-hidden": Decoration.mark({ class: "cm-draftly-image-hidden" }),
};

/**
 * Parse image markdown to extract alt text, URL, and optional title
 * Format: ![alt text](url "optional title")
 */
function parseImageMarkdown(content: string): { alt: string; url: string; title?: string } | null {
  // Regex to match: ![alt](url) or ![alt](url "title")
  const match = content.match(/^!\[([^\]]*)\]\(([^"\s)]+)(?:\s+"([^"]*)")?\s*\)$/);
  if (!match) return null;

  const result: { alt: string; url: string; title?: string } = {
    alt: match[1] || "",
    url: match[2]!,
  };

  if (match[3] !== undefined) {
    result.title = match[3];
  }

  return result;
}

/**
 * Widget to render an image with optional caption using figure/figcaption
 * Placed below the markdown syntax as a widget decoration
 */
class ImageWidget extends WidgetType {
  constructor(
    readonly url: string,
    readonly alt: string,
    readonly from: number,
    readonly to: number,
    readonly title?: string
  ) {
    super();
  }

  override eq(other: ImageWidget): boolean {
    return (
      other.url === this.url &&
      other.alt === this.alt &&
      other.from === this.from &&
      other.to === this.to &&
      other.title === this.title
    );
  }

  toDOM(view: EditorView) {
    // Create figure element for semantic image container
    const figure = document.createElement("figure");
    figure.className = "cm-draftly-image-figure";
    figure.setAttribute("role", "figure");
    figure.style.cursor = "pointer";
    if (this.title) {
      figure.setAttribute("aria-label", this.title);
    }

    // Click handler to select the raw markdown text
    figure.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      view.dispatch({
        selection: { anchor: this.from, head: this.to },
        scrollIntoView: true,
      });
      view.focus();
    });

    // Create image element with accessibility attributes
    const img = document.createElement("img");
    img.className = "cm-draftly-image";
    img.src = this.url;
    img.alt = this.alt;
    img.setAttribute("loading", "lazy");
    img.setAttribute("decoding", "async");
    if (this.title) {
      img.title = this.title;
    }

    // Handle image loading error
    img.onerror = () => {
      img.style.display = "none";
      const errorSpan = document.createElement("span");
      errorSpan.className = "cm-draftly-image-error";
      errorSpan.setAttribute("role", "alert");
      errorSpan.textContent = `[Image not found: ${this.alt || this.url}]`;
      figure.appendChild(errorSpan);
    };

    figure.appendChild(img);

    // Add figcaption if title exists
    if (this.title) {
      const figcaption = document.createElement("figcaption");
      figcaption.className = "cm-draftly-image-caption";
      figcaption.textContent = this.title;
      figure.appendChild(figcaption);
    }

    return figure;
  }

  override ignoreEvent(event: Event) {
    // Allow click events to be handled by our click handler
    return event.type !== "click";
  }
}

/**
 * ImagePlugin - Decorates and renders images in markdown
 *
 * Supports the full image syntax: ![alt text](url "optional title")
 * - Shows image widget below the node when cursor is not in range
 * - Hides the markdown syntax when cursor is not in range
 * - Shows raw markdown when cursor is in the image syntax
 * - Uses figure/figcaption for semantic HTML with accessibility attributes
 */
export class ImagePlugin extends DecorationPlugin {
  readonly name = "image";
  readonly version = "1.0.0";
  override decorationPriority = 25;
  override readonly requiredNodes = ["Image"] as const;

  constructor() {
    super();
  }

  /**
   * Plugin theme
   */
  override get theme() {
    return theme;
  }

  buildDecorations(ctx: DecorationContext): void {
    const { view, decorations } = ctx;
    const tree = syntaxTree(view.state);

    tree.iterate({
      enter: (node) => {
        const { from, to, name } = node;

        // Handle Image nodes
        if (name === "Image") {
          const content = view.state.sliceDoc(from, to);
          const parsed = parseImageMarkdown(content);

          if (!parsed) return;

          const cursorInRange = ctx.selectionOverlapsRange(from, to);

          // Add line decoration for image
          decorations.push(imageMarkDecorations["image-block"].range(from));

          // Always add the image widget below the node
          decorations.push(
            Decoration.widget({
              widget: new ImageWidget(parsed.url, parsed.alt, from, to, parsed.title),
              side: 1, // Place after the position
              block: false, // Don't create a new line
            }).range(to)
          );

          if (cursorInRange) {
            // Cursor in range: show raw markdown with styling
            this.decorateRawImage(node.node, decorations, view);
          } else {
            // Cursor out of range: hide the raw markdown text
            decorations.push(imageMarkDecorations["image-hidden"].range(from, to));
          }
        }
      },
    });
  }

  /**
   * Decorate raw image markdown when cursor is in range
   */
  private decorateRawImage(
    node: SyntaxNode,
    decorations: import("@codemirror/state").Range<Decoration>[],
    view: import("@codemirror/view").EditorView
  ): void {
    // Find and style child nodes
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (child.name === "URL") {
        decorations.push(imageMarkDecorations["image-url"].range(child.from, child.to));
      }
    }

    // Style the markers (! [ ] ( ))
    const content = view.state.sliceDoc(node.from, node.to);
    const bangBracket = node.from; // Position of !
    if (content.startsWith("![")) {
      decorations.push(imageMarkDecorations["image-marker"].range(bangBracket, bangBracket + 2));
    }

    // Find and style closing bracket and parentheses
    const altEnd = content.indexOf("](");
    if (altEnd !== -1) {
      const altStart = 2;
      // Style alt text
      if (altEnd > altStart) {
        decorations.push(imageMarkDecorations["image-alt"].range(node.from + altStart, node.from + altEnd));
      }
      // Style ]( markers
      decorations.push(imageMarkDecorations["image-marker"].range(node.from + altEnd, node.from + altEnd + 2));
      // Style closing )
      decorations.push(imageMarkDecorations["image-marker"].range(node.to - 1, node.to));
    }
  }

  /**
   * Render image to HTML for preview mode using figure/figcaption
   */
  override renderToHTML(
    node: SyntaxNode,
    _children: string,
    ctx: { sliceDoc(from: number, to: number): string; sanitize(html: string): string }
  ): string | null {
    if (node.name !== "Image") return null;

    const content = ctx.sliceDoc(node.from, node.to);
    const parsed = parseImageMarkdown(content);
    if (!parsed) return null;

    const altAttr = ctx.sanitize(parsed.alt);
    const titleAttr = parsed.title ? ` title="${ctx.sanitize(parsed.title)}"` : "";
    const ariaLabel = parsed.title ? ` aria-label="${ctx.sanitize(parsed.title)}"` : "";

    let html = `<figure class="cm-draftly-image-figure" role="figure"${ariaLabel}>`;
    html += `<img class="cm-draftly-image" src="${ctx.sanitize(parsed.url)}" alt="${altAttr}"${titleAttr} loading="lazy" decoding="async" />`;

    if (parsed.title) {
      html += `<figcaption class="cm-draftly-image-caption">${ctx.sanitize(parsed.title)}</figcaption>`;
    }

    html += `</figure>`;
    return html;
  }
}

/**
 * Theme for image styling
 */
const theme = createTheme({
  default: {
    ".cm-draftly-image-block br": {
      display: "none",
    },

    // Image markers (! [ ] ( ))
    ".cm-draftly-image-marker": {
      color: "#6a737d",
      fontFamily: "var(--font-jetbrains-mono, monospace)",
    },

    // Alt text
    ".cm-draftly-image-alt": {
      color: "#22863a",
      fontStyle: "italic",
    },

    // URL
    ".cm-draftly-image-url": {
      color: "#0366d6",
      textDecoration: "underline",
    },

    // Hidden markdown syntax (when cursor is not in range)
    ".cm-draftly-image-hidden": {
      display: "none",
    },

    // Figure container
    ".cm-draftly-image-figure": {
      display: "flex",
      flexDirection: "column",
      alignItems: "start",
      maxWidth: "100%",
      padding: "0",
    },

    // Image element
    ".cm-draftly-image": {
      maxWidth: "100%",
      maxHeight: "800px",
      height: "auto",
      borderRadius: "4px",
    },

    // Figcaption
    ".cm-draftly-image-caption": {
      display: "block",
      width: "100%",
      fontSize: "0.875em",
      color: "#6a737d",
      marginTop: "0.5em",
      textAlign: "center",
      fontStyle: "italic",
    },

    // Error state
    ".cm-draftly-image-error": {
      display: "inline-block",
      padding: "0.5em 1em",
      backgroundColor: "rgba(255, 0, 0, 0.1)",
      color: "#d73a49",
      borderRadius: "4px",
      fontSize: "0.875em",
      fontStyle: "italic",
    },
  },

  dark: {
    ".cm-draftly-image-marker": {
      color: "#8b949e",
    },

    ".cm-draftly-image-alt": {
      color: "#7ee787",
    },

    ".cm-draftly-image-url": {
      color: "#58a6ff",
    },

    ".cm-draftly-image-caption": {
      color: "#8b949e",
    },

    ".cm-draftly-image-error": {
      backgroundColor: "rgba(255, 0, 0, 0.15)",
      color: "#f85149",
    },
  },
});
