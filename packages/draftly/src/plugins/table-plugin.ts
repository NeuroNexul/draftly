import { Decoration, EditorView, KeyBinding, WidgetType } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { DecorationContext, DecorationPlugin, PluginContext } from "../editor/plugin";
import { createTheme, ThemeEnum } from "../editor";
import { SyntaxNode } from "@lezer/common";
import { DraftlyConfig } from "../editor/draftly";
import { PreviewRenderer } from "../preview/renderer";

// ============================================================================
// Types
// ============================================================================

/** Column alignment parsed from the delimiter row */
type Alignment = "left" | "center" | "right";

/** Parsed table structure */
interface ParsedTable {
  /** Header row cells */
  headers: string[];
  /** Column alignments */
  alignments: Alignment[];
  /** Data rows, each an array of cell strings */
  rows: string[][];
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Parse alignment from a delimiter cell (e.g., `:---:`, `---:`, `:---`, `---`)
 */
function parseAlignment(cell: string): Alignment {
  const trimmed = cell.trim();
  const left = trimmed.startsWith(":");
  const right = trimmed.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  return "left";
}

/**
 * Parse a markdown table string into structured data
 */
function parseTableMarkdown(markdown: string): ParsedTable | null {
  const lines = markdown.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return null;

  const parseCells = (line: string): string[] => {
    // Remove leading/trailing pipes, then split by pipe
    let trimmed = line.trim();
    if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
    if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
    return trimmed.split("|").map((c) => c.trim());
  };

  const headers = parseCells(lines[0]!);
  const delimiterCells = parseCells(lines[1]!);

  // Validate delimiter row (must contain only -, :, and spaces)
  const isDelimiter = delimiterCells.every((c) => /^:?-+:?$/.test(c.trim()));
  if (!isDelimiter) return null;

  const alignments = delimiterCells.map(parseAlignment);

  const rows: string[][] = [];
  for (let i = 2; i < lines.length; i++) {
    rows.push(parseCells(lines[i]!));
  }

  return { headers, alignments, rows };
}

/**
 * Auto-format a markdown table to align pipes and pad cells
 */
function formatTable(markdown: string): string {
  const parsed = parseTableMarkdown(markdown);
  if (!parsed) return markdown;

  const { headers, alignments, rows } = parsed;
  const colCount = Math.max(headers.length, ...rows.map((r) => r.length));

  // Calculate max width per column
  const colWidths: number[] = [];
  for (let c = 0; c < colCount; c++) {
    let maxW = (headers[c] || "").length;
    for (const row of rows) {
      maxW = Math.max(maxW, (row[c] || "").length);
    }
    // Minimum width of 3 for delimiter row
    colWidths.push(Math.max(maxW, 3));
  }

  // Pad a cell to the target width with alignment
  const padCell = (text: string, colIndex: number): string => {
    const width = colWidths[colIndex] || 3;
    const align = alignments[colIndex] || "left";
    const trimmed = text || "";
    const padding = width - trimmed.length;
    if (padding <= 0) return trimmed;

    switch (align) {
      case "center": {
        const leftPad = Math.floor(padding / 2);
        const rightPad = padding - leftPad;
        return " ".repeat(leftPad) + trimmed + " ".repeat(rightPad);
      }
      case "right":
        return " ".repeat(padding) + trimmed;
      default:
        return trimmed + " ".repeat(padding);
    }
  };

  // Build delimiter cell
  const buildDelimiter = (colIndex: number): string => {
    const width = colWidths[colIndex] || 3;
    const align = alignments[colIndex] || "left";
    const dashes = "-".repeat(width);
    if (align === "center") return ":" + dashes.slice(1, -1) + ":";
    if (align === "right") return dashes.slice(0, -1) + ":";
    return dashes;
  };

  // Build lines
  const headerLine = "| " + headers.map((h, i) => padCell(h, i)).join(" | ") + " |";
  const delimiterLine = "| " + Array.from({ length: colCount }, (_, i) => buildDelimiter(i)).join(" | ") + " |";
  const dataLines = rows.map(
    (row) => "| " + Array.from({ length: colCount }, (_, i) => padCell(row[i] || "", i)).join(" | ") + " |"
  );

  return [headerLine, delimiterLine, ...dataLines].join("\n");
}

/**
 * Check if a row is completely empty (all cells are empty/whitespace)
 */
function isRowEmpty(rowText: string): boolean {
  const trimmed = rowText.trim();
  if (!trimmed.startsWith("|")) return false;
  let inner = trimmed;
  if (inner.startsWith("|")) inner = inner.slice(1);
  if (inner.endsWith("|")) inner = inner.slice(0, -1);
  return inner.split("|").every((cell) => cell.trim() === "");
}

// ============================================================================
// Widget
// ============================================================================

/**
 * Widget to render a markdown table as a styled HTML table.
 * Shows rounded borders, alternate row colors, cell borders, and alignments.
 */
class TableWidget extends WidgetType {
  constructor(
    readonly tableMarkdown: string,
    readonly from: number,
    readonly to: number,
    readonly config?: DraftlyConfig
  ) {
    super();
  }

  override eq(other: TableWidget): boolean {
    return (
      other.tableMarkdown === this.tableMarkdown &&
      other.from === this.from &&
      other.to === this.to &&
      other.config === this.config
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "cm-draftly-table-widget";

    const parsed = parseTableMarkdown(this.tableMarkdown);
    if (!parsed) {
      wrapper.textContent = "[Invalid table]";
      return wrapper;
    }

    const { headers, alignments, rows } = parsed;

    // Build the table
    const table = document.createElement("table");
    table.className = "cm-draftly-table";

    // Thead
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    headers.forEach((h, i) => {
      const th = document.createElement("th");
      // Initial sync render
      th.innerHTML = this.renderCellContent(h);
      // Async update
      if (this.config) {
        this.renderCellAsync(h, th);
      }
      const align = alignments[i];
      if (align) th.style.textAlign = align;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Tbody
    const tbody = document.createElement("tbody");
    rows.forEach((row) => {
      const tr = document.createElement("tr");
      // Ensure we render enough cells for the column count
      const colCount = Math.max(headers.length, row.length);
      for (let i = 0; i < colCount; i++) {
        const td = document.createElement("td");
        // Initial sync render
        td.innerHTML = this.renderCellContent(row[i] || "");
        // Async update
        if (this.config) {
          this.renderCellAsync(row[i] || "", td);
        }
        const align = alignments[i];
        if (align) td.style.textAlign = align;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    wrapper.appendChild(table);

    // Click handler — set cursor inside table to reveal raw markdown
    wrapper.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      view.dispatch({
        selection: { anchor: this.from },
        scrollIntoView: true,
      });
      view.focus();
    });

    return wrapper;
  }

  /**
   * Render cell content asynchronously using PreviewRenderer
   */
  private async renderCellAsync(text: string, element: HTMLElement) {
    if (!text.trim() || !this.config) return;

    try {
      const renderer = new PreviewRenderer(
        text,
        this.config.plugins,
        this.config.markdown || [],
        this.config.theme || ThemeEnum.AUTO,
        true
      );
      const html = await renderer.render();

      // If the result is wrapped in a single paragraph, unwrap it for table cell display
      // This is a common case since markdown parsers treat text as a paragraph
      const temp = document.createElement("div");
      temp.innerHTML = html;

      if (temp.children.length === 1 && temp.children[0]!.tagName === "P") {
        element.innerHTML = temp.children[0]!.innerHTML;
      } else {
        element.innerHTML = html;
      }
    } catch (error) {
      console.error("Failed to render table cell:", error);
      // Fallback is already already rendered synchronously
    }
  }

  /**
   * Render cell content — handle basic inline markdown (fallback/loading state)
   */
  private renderCellContent(text: string): string {
    if (!text.trim()) return "&nbsp;";

    let html = this.escapeHtml(text);

    // Inline code: `code`
    html = html.replace(/`([^`]+)`/g, '<code class="cm-draftly-table-inline-code">$1</code>');

    // Bold: **text** or __text__
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");

    // Italic: *text* or _text_
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
    html = html.replace(/_(.+?)_/g, "<em>$1</em>");

    // Strikethrough: ~~text~~
    html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");

    // Links: [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="cm-draftly-table-link">$1</a>');

    // Inline math: $...$
    html = html.replace(/\$([^$]+)\$/g, '<span class="cm-draftly-table-math">$$$1$$</span>');

    return html;
  }

  private escapeHtml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  override ignoreEvent(event: Event): boolean {
    return event.type !== "click";
  }
}

// ============================================================================
// Decorations
// ============================================================================

const tableMarkDecorations = {
  "table-line": Decoration.line({ class: "cm-draftly-table-line" }),
  "table-line-start": Decoration.line({ class: "cm-draftly-table-line-start" }),
  "table-line-end": Decoration.line({ class: "cm-draftly-table-line-end" }),
  "table-delimiter": Decoration.line({ class: "cm-draftly-table-delimiter-line" }),
  "table-rendered": Decoration.line({ class: "cm-draftly-table-rendered" }),
  // "table-hidden": Decoration.mark({ class: "cm-draftly-table-hidden" }),
  "table-hidden": Decoration.replace({}),
};

// ============================================================================
// Plugin
// ============================================================================

/**
 * TablePlugin — Renders GFM markdown tables as styled widgets.
 *
 * Features:
 * - Rendered table widget with rounded borders, alternate row colors, cell borders
 * - Alignment support (`:---:`, `----:`, `:---`)
 * - Monospace raw markdown when cursor is inside the table
 * - Keyboard shortcuts for table creation, adding rows/columns
 * - Enter in last row/last cell: creates row, again removes it
 * - Auto-formats table markdown to align pipes
 */
export class TablePlugin extends DecorationPlugin {
  readonly name = "table";
  readonly version = "1.0.0";
  override decorationPriority = 20;
  override readonly requiredNodes = ["Table", "TableHeader", "TableDelimiter", "TableRow", "TableCell"] as const;

  /** Track whether we were previously inside a table (for auto-format on exit) */
  private lastTableRange: { from: number; to: number } | null = null;

  /** Configuration stored from onRegister */
  private draftlyConfig: DraftlyConfig | undefined;

  override onRegister(context: PluginContext): void {
    super.onRegister(context);
    this.draftlyConfig = context.config;
  }

  override get theme() {
    return theme;
  }

  // ============================================
  // Keymaps
  // ============================================

  override getKeymap(): KeyBinding[] {
    return [
      {
        key: "Mod-Shift-t",
        run: (view) => this.insertTable(view),
        preventDefault: true,
      },
      {
        key: "Mod-Enter",
        run: (view) => this.addRow(view),
        preventDefault: true,
      },
      {
        key: "Mod-Shift-Enter",
        run: (view) => this.addColumn(view),
        preventDefault: true,
      },
      {
        key: "Enter",
        run: (view) => this.handleEnter(view),
      },
      {
        key: "Tab",
        run: (view) => this.handleTab(view, false),
      },
      {
        key: "Shift-Tab",
        run: (view) => this.handleTab(view, true),
      },
    ];
  }

  // ============================================
  // Extensions
  // ============================================

  override getExtensions() {
    return [
      // EditorView.updateListener.of((update) => {
      //   if (update.selectionSet || update.docChanged) {
      //     this.handleAutoFormat(update.view);
      //   }
      // }),
    ];
  }

  // ============================================
  // Decorations
  // ============================================

  buildDecorations(ctx: DecorationContext): void {
    const { view, decorations } = ctx;
    const tree = syntaxTree(view.state);

    tree.iterate({
      enter: (node) => {
        if (node.name !== "Table") return;

        const { from, to } = node;
        const nodeLineStart = view.state.doc.lineAt(from);
        const nodeLineEnd = view.state.doc.lineAt(to);
        const cursorInRange = ctx.selectionOverlapsRange(nodeLineStart.from, nodeLineEnd.to);

        if (cursorInRange) {
          // Cursor inside: show raw markdown with monospace styling
          // Add line decorations for every line in the table
          for (let i = nodeLineStart.number; i <= nodeLineEnd.number; i++) {
            const line = view.state.doc.line(i);
            decorations.push(tableMarkDecorations["table-line"].range(line.from));

            if (i === nodeLineStart.number) {
              decorations.push(tableMarkDecorations["table-line-start"].range(line.from));
            }
            if (i === nodeLineEnd.number) {
              decorations.push(tableMarkDecorations["table-line-end"].range(line.from));
            }

            // Check if this is the delimiter line (line 2 of the table)
            if (i === nodeLineStart.number + 1) {
              decorations.push(tableMarkDecorations["table-delimiter"].range(line.from));
            }
          }
        } else {
          // Cursor outside: hide raw text and show rendered widget
          const tableContent = view.state.sliceDoc(from, to);

          // Add line decorations to hide all lines
          for (let i = nodeLineStart.number; i <= nodeLineEnd.number; i++) {
            const line = view.state.doc.line(i);
            decorations.push(tableMarkDecorations["table-rendered"].range(line.from));

            // Hide the raw text content
            decorations.push(tableMarkDecorations["table-hidden"].range(line.from, line.to));
          }

          // Add the rendered table widget at the end
          decorations.push(
            Decoration.widget({
              widget: new TableWidget(tableContent, from, to, this.draftlyConfig),
              side: 1,
              block: false,
            }).range(to)
          );
        }
      },
    });
  }

  // ============================================
  // Auto-format
  // ============================================

  /**
   * Auto-format the table when the cursor exits the table range
   */
  private handleAutoFormat(view: EditorView): void {
    const tree = syntaxTree(view.state);
    const cursor = view.state.selection.main.head;

    // Find if cursor is currently in a table
    let currentTable: { from: number; to: number } | null = null;
    tree.iterate({
      enter: (node) => {
        if (node.name === "Table" && cursor >= node.from && cursor <= node.to) {
          currentTable = { from: node.from, to: node.to };
        }
      },
    });

    if (currentTable) {
      // We're inside a table — remember the range
      this.lastTableRange = currentTable;
    } else if (this.lastTableRange) {
      // We just exited a table — auto-format it
      const { from, to } = this.lastTableRange;

      // Validate range is still within document
      if (from >= 0 && to <= view.state.doc.length) {
        const tableText = view.state.sliceDoc(from, to);
        const formatted = formatTable(tableText);

        if (formatted !== tableText) {
          view.dispatch({
            changes: { from, to, insert: formatted },
          });
        }
      }

      this.lastTableRange = null;
    }
  }

  // ============================================
  // Keymap Handlers
  // ============================================

  /**
   * Insert a new 3×3 table at cursor position
   */
  private insertTable(view: EditorView): boolean {
    const { state } = view;
    const cursor = state.selection.main.head;
    const line = state.doc.lineAt(cursor);

    // Insert at the beginning of the next line if current line has content
    const insertPos = line.text.trim() ? line.to : line.from;

    const template = [
      "| Header 1 | Header 2 | Header 3 |",
      "| -------- | -------- | -------- |",
      "|          |          |          |",
    ].join("\n");

    const prefix = line.text.trim() ? "\n" : "";
    const suffix = "\n";

    view.dispatch({
      changes: {
        from: insertPos,
        insert: prefix + template + suffix,
      },
      selection: {
        anchor: insertPos + prefix.length + 2, // Position cursor in first header cell
      },
    });

    return true;
  }

  /**
   * Add a new row below the current row (Mod-Enter)
   */
  private addRow(view: EditorView): boolean {
    const tableInfo = this.getTableAtCursor(view);
    if (!tableInfo) return false;

    const { state } = view;
    const cursor = state.selection.main.head;
    const currentLine = state.doc.lineAt(cursor);

    // Parse the table to know the column count
    const parsed = parseTableMarkdown(state.sliceDoc(tableInfo.from, tableInfo.to));
    if (!parsed) return false;

    const colCount = parsed.headers.length;
    const emptyRow = "| " + Array.from({ length: colCount }, () => "  ").join(" | ") + " |";

    // Insert after the current line
    view.dispatch({
      changes: {
        from: currentLine.to,
        insert: "\n" + emptyRow,
      },
      selection: {
        anchor: currentLine.to + 3, // Position in first cell of new row
      },
    });

    return true;
  }

  /**
   * Add a new column after the current column (Mod-Shift-Enter)
   */
  private addColumn(view: EditorView): boolean {
    const tableInfo = this.getTableAtCursor(view);
    if (!tableInfo) return false;

    const { state } = view;
    const cursor = state.selection.main.head;

    // Find which column the cursor is in
    const currentLine = state.doc.lineAt(cursor);
    const lineText = currentLine.text;
    const cursorInLine = cursor - currentLine.from;

    // Count pipes before cursor to find column index
    let colIndex = -1;
    for (let i = 0; i < cursorInLine; i++) {
      if (lineText[i] === "|") colIndex++;
    }
    colIndex = Math.max(0, colIndex);

    // Get all lines of the table
    const tableText = state.sliceDoc(tableInfo.from, tableInfo.to);
    const lines = tableText.split("\n");

    // Insert a new column after colIndex in each line
    const newLines = lines.map((line, lineIdx) => {
      const cells = this.splitLineToCells(line);
      const insertAfter = Math.min(colIndex, cells.length - 1);

      if (lineIdx === 1) {
        // Delimiter row
        cells.splice(insertAfter + 1, 0, " -------- ");
      } else {
        cells.splice(insertAfter + 1, 0, "          ");
      }

      return "|" + cells.join("|") + "|";
    });

    view.dispatch({
      changes: {
        from: tableInfo.from,
        to: tableInfo.to,
        insert: newLines.join("\n"),
      },
    });

    return true;
  }

  /**
   * Handle Enter key inside a table.
   * - Last cell of last row: create a new row
   * - Empty last row: remove it and move cursor after table
   */
  private handleEnter(view: EditorView): boolean {
    const tableInfo = this.getTableAtCursor(view);
    if (!tableInfo) return false;

    const { state } = view;
    const cursor = state.selection.main.head;
    const cursorLine = state.doc.lineAt(cursor);
    const tableEndLine = state.doc.lineAt(tableInfo.to);

    // Check if cursor is on the last line of the table
    if (cursorLine.number !== tableEndLine.number) return false;

    // Check if cursor is in the last cell (after the second-to-last pipe)
    const lineText = cursorLine.text;
    const cursorOffset = cursor - cursorLine.from;
    const pipes: number[] = [];
    for (let i = 0; i < lineText.length; i++) {
      if (lineText[i] === "|") pipes.push(i);
    }

    // Cursor needs to be after the second-to-last pipe (in the last cell)
    if (pipes.length < 2) return false;
    const lastCellStart = pipes[pipes.length - 2]!;
    if (cursorOffset < lastCellStart) return false;

    // If this row is empty, remove it and move cursor after the table
    if (isRowEmpty(lineText)) {
      // Remove this row (including the preceding newline)
      const removeFrom = cursorLine.from - 1; // Include the newline before
      const removeTo = cursorLine.to;

      view.dispatch({
        changes: { from: Math.max(0, removeFrom), to: removeTo },
        selection: {
          anchor: Math.min(Math.max(0, removeFrom) + 1, view.state.doc.length),
        },
      });

      return true;
    }

    // Otherwise, create a new empty row
    const parsed = parseTableMarkdown(state.sliceDoc(tableInfo.from, tableInfo.to));
    if (!parsed) return false;

    const colCount = parsed.headers.length;
    const emptyRow = "| " + Array.from({ length: colCount }, () => "  ").join(" | ") + " |";

    view.dispatch({
      changes: {
        from: cursorLine.to,
        insert: "\n" + emptyRow,
      },
      selection: {
        anchor: cursorLine.to + 3, // Position in first cell of new row
      },
    });

    return true;
  }

  /**
   * Handle Tab key inside a table — move to next/previous cell
   */
  private handleTab(view: EditorView, backwards: boolean): boolean {
    const tableInfo = this.getTableAtCursor(view);
    if (!tableInfo) return false;

    const { state } = view;
    const cursor = state.selection.main.head;
    const tableText = state.sliceDoc(tableInfo.from, tableInfo.to);
    const lines = tableText.split("\n");

    // Collect all cell positions (skip delimiter row)
    const cellPositions: { lineFrom: number; start: number; end: number }[] = [];
    for (let li = 0; li < lines.length; li++) {
      if (li === 1) continue; // Skip delimiter row
      const line = lines[li]!;
      const lineFrom = tableInfo.from + lines.slice(0, li).reduce((sum, l) => sum + l.length + 1, 0);

      const pipes: number[] = [];
      for (let i = 0; i < line.length; i++) {
        if (line[i] === "|") pipes.push(i);
      }

      for (let p = 0; p < pipes.length - 1; p++) {
        const cellStart = pipes[p]! + 1;
        const cellEnd = pipes[p + 1]!;
        cellPositions.push({
          lineFrom,
          start: cellStart,
          end: cellEnd,
        });
      }
    }

    // Find which cell the cursor is currently in
    let currentCellIdx = -1;
    for (let i = 0; i < cellPositions.length; i++) {
      const cell = cellPositions[i]!;
      const absStart = cell.lineFrom + cell.start;
      const absEnd = cell.lineFrom + cell.end;
      if (cursor >= absStart && cursor <= absEnd) {
        currentCellIdx = i;
        break;
      }
    }

    if (currentCellIdx === -1) return false;

    // Move to next/previous cell
    const nextIdx = backwards ? currentCellIdx - 1 : currentCellIdx + 1;
    if (nextIdx < 0 || nextIdx >= cellPositions.length) return false;

    const nextCell = cellPositions[nextIdx]!;
    const cellText = state.sliceDoc(nextCell.lineFrom + nextCell.start, nextCell.lineFrom + nextCell.end);
    const trimStart = cellText.length - cellText.trimStart().length;
    const trimEnd = cellText.length - cellText.trimEnd().length;

    const selectFrom = nextCell.lineFrom + nextCell.start + (trimStart > 0 ? 1 : 0);
    const selectTo = nextCell.lineFrom + nextCell.end - (trimEnd > 0 ? 1 : 0);

    view.dispatch({
      selection: {
        anchor: selectFrom,
        head: selectTo,
      },
      scrollIntoView: true,
    });

    return true;
  }

  // ============================================
  // Helpers
  // ============================================

  /**
   * Find the Table node at the cursor position
   */
  private getTableAtCursor(view: EditorView): { from: number; to: number } | null {
    const tree = syntaxTree(view.state);
    const cursor = view.state.selection.main.head;

    let result: { from: number; to: number } | null = null;
    tree.iterate({
      enter: (node) => {
        if (node.name === "Table" && cursor >= node.from && cursor <= node.to) {
          result = { from: node.from, to: node.to };
        }
      },
    });

    return result;
  }

  /**
   * Split a table line into cells (keeping the whitespace around content)
   */
  private splitLineToCells(line: string): string[] {
    let trimmed = line.trim();
    if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
    if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
    return trimmed.split("|");
  }

  // ============================================
  // Preview Rendering
  // ============================================

  override renderToHTML(
    node: SyntaxNode,
    _children: string,
    ctx: {
      sliceDoc(from: number, to: number): string;
      sanitize(html: string): string;
    }
  ): string | null {
    if (node.name === "Table") {
      const content = ctx.sliceDoc(node.from, node.to);
      const parsed = parseTableMarkdown(content);

      if (!parsed) return null;

      const { headers, alignments, rows } = parsed;
      let html = '<div class="cm-draftly-table-widget">';
      html += '<table class="cm-draftly-table">';

      // Thead
      html += "<thead><tr>";
      headers.forEach((h, i) => {
        const align = alignments[i] || "left";
        html += `<th style="text-align: ${align}">${ctx.sanitize(h)}</th>`;
      });
      html += "</tr></thead>";

      // Tbody
      html += "<tbody>";
      rows.forEach((row) => {
        html += "<tr>";
        const colCount = Math.max(headers.length, row.length);
        for (let i = 0; i < colCount; i++) {
          const align = alignments[i] || "left";
          const cell = row[i] || "";
          html += `<td style="text-align: ${align}">${ctx.sanitize(cell) || "&nbsp;"}</td>`;
        }
        html += "</tr>";
      });
      html += "</tbody>";

      html += "</table></div>";
      return html;
    }

    // Sub-nodes are handled by the Table renderer
    if (
      node.name === "TableHeader" ||
      node.name === "TableDelimiter" ||
      node.name === "TableRow" ||
      node.name === "TableCell"
    ) {
      return "";
    }

    return null;
  }
}

// ============================================================================
// Theme
// ============================================================================

const theme = createTheme({
  default: {
    // Raw table lines — monospace when cursor is inside
    ".cm-draftly-table-line": {
      "--radius": "0.375rem",
      fontFamily: "var(--font-jetbrains-mono, monospace)",
      fontSize: "0.9rem",
      backgroundColor: "rgba(0, 0, 0, 0.02)",
      padding: "0 0.75rem !important",
      lineHeight: "1.6",
      borderLeft: "1px solid var(--color-border, #e2e8f0)",
      borderRight: "1px solid var(--color-border, #e2e8f0)",
    },

    ".cm-draftly-table-line-start": {
      borderTopLeftRadius: "var(--radius)",
      borderTopRightRadius: "var(--radius)",
      borderTop: "1px solid var(--color-border, #e2e8f0)",
    },

    ".cm-draftly-table-line-end": {
      borderBottomLeftRadius: "var(--radius)",
      borderBottomRightRadius: "var(--radius)",
      borderBottom: "1px solid var(--color-border, #e2e8f0)",
    },

    ".cm-draftly-table-delimiter-line": {
      opacity: "0.5",
    },

    // Hidden table text (when cursor is not in range)
    ".cm-draftly-table-hidden": {
      display: "none",
    },

    // Line decoration for rendered state — hide line breaks
    ".cm-draftly-table-rendered": {
      padding: "0 !important",
    },

    ".cm-draftly-table-rendered br": {
      display: "none",
    },

    // Rendered table widget container
    ".cm-draftly-table-widget": {
      cursor: "pointer",
      overflow: "auto",
      margin: "0.5rem 0",
    },

    // Table element
    ".cm-draftly-table": {
      width: "100%",
      borderCollapse: "separate",
      borderSpacing: "0",
      borderRadius: "0.5rem",
      overflow: "hidden",
      border: "1px solid var(--color-border, #e2e8f0)",
      fontFamily: "var(--font-sans, sans-serif)",
      fontSize: "0.9375rem",
      lineHeight: "1.5",
    },

    // Table header
    ".cm-draftly-table thead th": {
      padding: "0.625rem 0.875rem",
      fontWeight: "600",
      borderBottom: "2px solid var(--color-border, #e2e8f0)",
      backgroundColor: "rgba(0, 0, 0, 0.03)",
    },

    // Table cells
    ".cm-draftly-table td": {
      padding: "0.5rem 0.875rem",
      borderBottom: "1px solid var(--color-border, #e2e8f0)",
      borderRight: "1px solid var(--color-border, #e2e8f0)",
    },

    // Remove right border on last cell
    ".cm-draftly-table td:last-child, .cm-draftly-table th:last-child": {
      borderRight: "none",
    },

    // Remove bottom border on last row
    ".cm-draftly-table tbody tr:last-child td": {
      borderBottom: "none",
    },

    // Alternate row colors
    ".cm-draftly-table tbody tr:nth-child(even)": {
      backgroundColor: "rgba(0, 0, 0, 0.02)",
    },

    // Header cells right border
    ".cm-draftly-table thead th:not(:last-child)": {
      borderRight: "1px solid var(--color-border, #e2e8f0)",
    },

    // Hover effect on rows
    ".cm-draftly-table tbody tr:hover": {
      backgroundColor: "rgba(0, 0, 0, 0.04)",
    },

    // Inline code in table cells
    ".cm-draftly-table-inline-code": {
      fontFamily: "var(--font-jetbrains-mono, monospace)",
      fontSize: "0.85em",
      padding: "0.1em 0.35em",
      borderRadius: "0.25rem",
      backgroundColor: "rgba(0, 0, 0, 0.06)",
    },

    // Links in table cells
    ".cm-draftly-table-link": {
      color: "var(--color-link, #0969da)",
      textDecoration: "none",
    },

    ".cm-draftly-table-link:hover": {
      textDecoration: "underline",
    },

    // Math in table cells
    ".cm-draftly-table-math": {
      fontFamily: "var(--font-jetbrains-mono, monospace)",
      fontSize: "0.9em",
      color: "#6a737d",
    },
  },

  dark: {
    ".cm-draftly-table-line": {
      backgroundColor: "rgba(255, 255, 255, 0.03)",
    },

    ".cm-draftly-table thead th": {
      backgroundColor: "rgba(255, 255, 255, 0.05)",
    },

    ".cm-draftly-table tbody tr:nth-child(even)": {
      backgroundColor: "rgba(255, 255, 255, 0.02)",
    },

    ".cm-draftly-table tbody tr:hover": {
      backgroundColor: "rgba(255, 255, 255, 0.05)",
    },

    ".cm-draftly-table-inline-code": {
      backgroundColor: "rgba(255, 255, 255, 0.08)",
    },

    ".cm-draftly-table-link": {
      color: "var(--color-link, #58a6ff)",
    },

    ".cm-draftly-table-math": {
      color: "#8b949e",
    },
  },
});
