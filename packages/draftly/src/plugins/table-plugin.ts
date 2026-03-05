import { Decoration, EditorView, KeyBinding, BlockWrapper } from "@codemirror/view";
import { Extension, Range, RangeSet } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { DecorationContext, DecorationPlugin, PluginContext } from "../editor/plugin";
import { createTheme } from "../editor";
import { SyntaxNode } from "@lezer/common";
import { DraftlyConfig } from "../editor/draftly";
import { PreviewRenderer } from "../preview/renderer";
import { ThemeEnum } from "../editor/utils";

// ============================================================================
// Types
// ============================================================================

/** Column alignment parsed from the delimiter row */
type Alignment = "left" | "center" | "right";

/** Parsed table structure for preview rendering */
interface ParsedTable {
  headers: string[];
  alignments: Alignment[];
  rows: string[][];
}

type PreviewContextLike = {
  sliceDoc(from: number, to: number): string;
  sanitize(html: string): string;
};

type TableCellPosition = {
  lineFrom: number;
  start: number;
  end: number;
};

type EffectiveTableInfo = {
  from: number;
  to: number;
  startLineNumber: number;
  endLineNumber: number;
  delimiterLineNumber: number;
  alignments: Alignment[];
};

// ============================================================================
// Utilities
// ============================================================================

/**
 * Parse alignment from a delimiter cell (e.g. `:---:`, `---:`, `:---`, `---`)
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
 * Parse alignments from the delimiter row text.
 * Returns `null` when the line is not a valid GFM delimiter.
 */
function stripOuterPipes(lineText: string): string {
  let trimmed = lineText.trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
  return trimmed;
}

function splitTableLine(lineText: string): string[] {
  return stripOuterPipes(lineText).split("|");
}

function isTableRowLine(lineText: string): boolean {
  const trimmed = lineText.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return false;
  return getPipePositions(trimmed).length >= 2;
}

function splitTableAndTrailingMarkdown(markdown: string): { tableMarkdown: string; trailingMarkdown: string } {
  const lines = markdown.split("\n");
  if (lines.length < 2) return { tableMarkdown: markdown, trailingMarkdown: "" };

  const headerLine = lines[0] || "";
  const delimiterLine = lines[1] || "";
  if (!isTableRowLine(headerLine) || !isTableRowLine(delimiterLine)) {
    return { tableMarkdown: markdown, trailingMarkdown: "" };
  }

  const delimiterCells = splitTableLine(delimiterLine).map((cell) => cell.trim());
  if (!delimiterCells.every((c) => /^:?-+:?$/.test(c))) {
    return { tableMarkdown: markdown, trailingMarkdown: "" };
  }

  let endIndex = 1;
  for (let i = 2; i < lines.length; i++) {
    if (!isTableRowLine(lines[i] || "")) break;
    endIndex = i;
  }

  return {
    tableMarkdown: lines.slice(0, endIndex + 1).join("\n"),
    trailingMarkdown: lines.slice(endIndex + 1).join("\n"),
  };
}

function parseDelimiterAlignments(lineText: string): Alignment[] | null {
  const cells = splitTableLine(lineText);
  if (!cells.every((c) => /^\s*:?-+:?\s*$/.test(c))) return null;
  return cells.map(parseAlignment);
}

/**
 * Return the character offsets of every `|` in a line.
 */
function getPipePositions(lineText: string): number[] {
  const positions: number[] = [];
  for (let i = 0; i < lineText.length; i++) {
    if (lineText[i] === "|") positions.push(i);
  }
  return positions;
}

/**
 * Return merged replace ranges that hide each pipe and its adjacent
 * whitespace padding so visual gaps don't remain between rendered cells.
 */
function getPipeHideRanges(lineText: string): Array<{ from: number; to: number }> {
  const pipes = getPipePositions(lineText);
  if (!pipes.length) return [];

  const rawRanges = pipes.map((pipePos) => {
    let from = pipePos;
    let to = pipePos + 1;

    while (from > 0 && /\s/.test(lineText[from - 1]!)) from--;
    while (to < lineText.length && /\s/.test(lineText[to]!)) to++;

    return { from, to };
  });

  rawRanges.sort((a, b) => a.from - b.from);
  const merged: Array<{ from: number; to: number }> = [];
  for (const range of rawRanges) {
    const last = merged[merged.length - 1];
    if (!last || range.from > last.to) {
      merged.push({ ...range });
      continue;
    }
    last.to = Math.max(last.to, range.to);
  }

  return merged;
}

/**
 * Parse a full markdown table string into structured data (for preview).
 */
function parseTableMarkdown(markdown: string): ParsedTable | null {
  const { tableMarkdown } = splitTableAndTrailingMarkdown(markdown);
  const lines = tableMarkdown.split("\n");
  if (lines.length < 2) return null;

  const headerLine = lines[0] || "";
  const delimiterLine = lines[1] || "";
  if (!isTableRowLine(headerLine) || !isTableRowLine(delimiterLine)) return null;

  const parseCells = (lineText: string): string[] => splitTableLine(lineText).map((cell) => cell.trim());

  const headers = parseCells(headerLine);
  const delimiterCells = parseCells(delimiterLine);
  if (!delimiterCells.every((c) => /^:?-+:?$/.test(c.trim()))) return null;

  const alignments = delimiterCells.map(parseAlignment);
  const rows: string[][] = [];
  for (let i = 2; i < lines.length; i++) {
    const row = lines[i] || "";
    if (!isTableRowLine(row)) break;
    rows.push(parseCells(row));
  }

  return { headers, alignments, rows };
}

/**
 * Check whether a row is completely empty (all cells whitespace-only).
 */
function isRowEmpty(rowText: string): boolean {
  return splitTableLine(rowText).every((cell) => cell.trim() === "");
}

/**
 * Render a single cell through `PreviewRenderer` (for preview HTML).
 */
async function renderCellWithPreviewRenderer(text: string, config?: DraftlyConfig): Promise<string> {
  if (!text.trim()) return "&nbsp;";
  const renderer = new PreviewRenderer(
    text,
    config?.plugins || [],
    config?.markdown || [],
    config?.theme || ThemeEnum.AUTO,
    true
  );
  const html = await renderer.render();
  const m = html.match(/^\s*<p>([\s\S]*)<\/p>\s*$/i);
  if (m && m[1] !== undefined) return m[1];
  return html;
}

/**
 * Build a full `<table>` HTML string for preview rendering.
 */
async function renderTableToHtml(parsed: ParsedTable, config?: DraftlyConfig): Promise<string> {
  const { headers, alignments, rows } = parsed;
  let html = '<div class="cm-draftly-table-widget">';
  html += '<table class="cm-draftly-table">';

  html += '<thead><tr class="cm-draftly-table-row cm-draftly-table-header-row">';
  for (let i = 0; i < headers.length; i++) {
    const cell = headers[i] || "";
    const align = alignments[i] || "left";
    const rendered = await renderCellWithPreviewRenderer(cell, config);
    const isLastHeaderCell = i === headers.length - 1;
    html += `<th class="cm-draftly-table-cell cm-draftly-table-th${
      align === "center" ? " cm-draftly-table-cell-center" : align === "right" ? " cm-draftly-table-cell-right" : ""
    }${isLastHeaderCell ? " cm-draftly-table-cell-last" : ""}">${rendered}</th>`;
  }
  html += "</tr></thead>";

  html += "<tbody>";
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex]!;
    html += `<tr class="cm-draftly-table-row cm-draftly-table-body-row${
      rowIndex % 2 === 1 ? " cm-draftly-table-row-even" : ""
    }${rowIndex === rows.length - 1 ? " cm-draftly-table-row-last" : ""}">`;
    const colCount = Math.max(headers.length, row.length);
    for (let i = 0; i < colCount; i++) {
      const align = alignments[i] || "left";
      const cell = row[i] || "";
      const rendered = await renderCellWithPreviewRenderer(cell, config);
      const isLastBodyCell = i === colCount - 1;
      html += `<td class="cm-draftly-table-cell${
        align === "center" ? " cm-draftly-table-cell-center" : align === "right" ? " cm-draftly-table-cell-right" : ""
      }${isLastBodyCell ? " cm-draftly-table-cell-last" : ""}">${rendered}</td>`;
    }
    html += "</tr>";
  }
  html += "</tbody></table></div>";
  return html;
}

// ============================================================================
// Decorations
// ============================================================================

/** Replace decoration that hides a range entirely */
const pipeReplace = Decoration.replace({});

/**
 * Pre-built mark decorations keyed by `"th"|"td"` + alignment.
 * Each wraps cell content in a `<span>` with appropriate CSS classes.
 */
const cellDecorations = {
  "th-left": Decoration.mark({ class: "cm-draftly-table-cell cm-draftly-table-th" }),
  "th-center": Decoration.mark({ class: "cm-draftly-table-cell cm-draftly-table-th cm-draftly-table-cell-center" }),
  "th-right": Decoration.mark({ class: "cm-draftly-table-cell cm-draftly-table-th cm-draftly-table-cell-right" }),
  "th-left-last": Decoration.mark({ class: "cm-draftly-table-cell cm-draftly-table-th cm-draftly-table-cell-last" }),
  "th-center-last": Decoration.mark({
    class: "cm-draftly-table-cell cm-draftly-table-th cm-draftly-table-cell-center cm-draftly-table-cell-last",
  }),
  "th-right-last": Decoration.mark({
    class: "cm-draftly-table-cell cm-draftly-table-th cm-draftly-table-cell-right cm-draftly-table-cell-last",
  }),
  "td-left": Decoration.mark({ class: "cm-draftly-table-cell" }),
  "td-center": Decoration.mark({ class: "cm-draftly-table-cell cm-draftly-table-cell-center" }),
  "td-right": Decoration.mark({ class: "cm-draftly-table-cell cm-draftly-table-cell-right" }),
  "td-left-last": Decoration.mark({ class: "cm-draftly-table-cell cm-draftly-table-cell-last" }),
  "td-center-last": Decoration.mark({
    class: "cm-draftly-table-cell cm-draftly-table-cell-center cm-draftly-table-cell-last",
  }),
  "td-right-last": Decoration.mark({
    class: "cm-draftly-table-cell cm-draftly-table-cell-right cm-draftly-table-cell-last",
  }),
} as const;

type CellDecoKey = keyof typeof cellDecorations;

function getCellDeco(isHeader: boolean, alignment: Alignment, isLastCell: boolean): Decoration {
  const key: CellDecoKey = `${isHeader ? "th" : "td"}-${alignment}${isLastCell ? "-last" : ""}`;
  return cellDecorations[key];
}

/** Line decorations for the different row types */
const lineDecorations = {
  headerRow: Decoration.line({ class: "cm-draftly-table-row cm-draftly-table-header-row" }),
  delimiterRow: Decoration.line({ class: "cm-draftly-table-row cm-draftly-table-delimiter-row" }),
  bodyRow: Decoration.line({ class: "cm-draftly-table-row cm-draftly-table-body-row" }),
  bodyRowEven: Decoration.line({
    class: "cm-draftly-table-row cm-draftly-table-body-row cm-draftly-table-row-even",
  }),
  bodyRowLast: Decoration.line({ class: "cm-draftly-table-row-last" }),
};

/** Groups all table lines in one wrapper block. */
const tableBlockWrapper = BlockWrapper.create({
  tagName: "div",
  attributes: { class: "cm-draftly-table-wrapper" },
});

// ============================================================================
// Plugin
// ============================================================================

/**
 * Renders GFM tables in-editor and in preview with matching styles.
 *
 * Supports:
 * - Column alignment (`:---:`, `---:`, `:---`)
 * - Cell navigation with Tab / Shift-Tab
 * - Row/column insertion shortcuts
 * - Insert starter table with Mod-Shift-T
 */
export class TablePlugin extends DecorationPlugin {
  readonly name = "table";
  readonly version = "1.0.0";
  override decorationPriority = 20;
  override readonly requiredNodes = ["Table", "TableHeader", "TableDelimiter", "TableRow", "TableCell"] as const;

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
  // Extensions
  // ============================================

  /** Registers block wrappers so each table renders as one visual block. */
  override getExtensions(): Extension[] {
    return [EditorView.blockWrappers.of((view) => this.computeBlockWrappers(view))];
  }

  /**
   * Walk the syntax tree and produce a `RangeSet<BlockWrapper>` covering
   * every Table node in the document.
   */
  private computeBlockWrappers(view: EditorView): RangeSet<BlockWrapper> {
    const wrappers: Range<BlockWrapper>[] = [];
    const tree = syntaxTree(view.state);

    tree.iterate({
      enter: (node) => {
        if (node.name === "Table") {
          const table = this.getEffectiveTableInfo(view, node.from, node.to);
          if (!table) return;
          wrappers.push(tableBlockWrapper.range(table.from, table.to));
        }
      },
    });

    return BlockWrapper.set(wrappers, true);
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
  // Decorations
  // ============================================

  /** Builds row/cell decorations for visual table rendering in the editor. */
  buildDecorations(ctx: DecorationContext): void {
    const { view, decorations } = ctx;
    const tree = syntaxTree(view.state);

    tree.iterate({
      enter: (node) => {
        if (node.name !== "Table") return;

        const table = this.getEffectiveTableInfo(view, node.from, node.to);
        if (!table) return;

        for (let i = table.startLineNumber; i <= table.endLineNumber; i++) {
          const line = view.state.doc.line(i);
          const lineText = line.text;
          const pipes = getPipePositions(lineText);

          const isHeader = i === table.startLineNumber;
          const isDelimiter = i === table.delimiterLineNumber;
          const bodyRowIndex = i - table.delimiterLineNumber - 1;

          if (isHeader) {
            decorations.push(lineDecorations.headerRow.range(line.from));
          } else if (isDelimiter) {
            decorations.push(lineDecorations.delimiterRow.range(line.from));
          } else if (bodyRowIndex % 2 === 1) {
            decorations.push(lineDecorations.bodyRowEven.range(line.from));
          } else {
            decorations.push(lineDecorations.bodyRow.range(line.from));
          }

          if (!isHeader && !isDelimiter && i === table.endLineNumber) {
            decorations.push(lineDecorations.bodyRowLast.range(line.from));
          }

          if (isDelimiter) {
            if (line.from < line.to) {
              decorations.push(pipeReplace.range(line.from, line.to));
            }
            continue;
          }

          if (pipes.length < 2) continue;

          const pipeHideRanges = getPipeHideRanges(lineText);
          for (const range of pipeHideRanges) {
            decorations.push(pipeReplace.range(line.from + range.from, line.from + range.to));
          }

          for (let p = 0; p < pipes.length - 1; p++) {
            if (p < pipes.length - 1) {
              const cellStart = line.from + pipes[p]! + 1;
              const cellEnd = line.from + pipes[p + 1]!;
              const colIndex = p;
              const alignment = table.alignments[colIndex] || "left";
              const isLastCell = p === pipes.length - 2;

              if (cellStart < cellEnd) {
                decorations.push(getCellDeco(isHeader, alignment, isLastCell).range(cellStart, cellEnd));
              }
            }
          }
        }
      },
    });
  }

  // ============================================
  // Keymap Handlers
  // ============================================

  /** Inserts a blank 3×3 table at the current cursor line. */
  private insertTable(view: EditorView): boolean {
    const { state } = view;
    const cursor = state.selection.main.head;
    const line = state.doc.lineAt(cursor);

    const insertPos = line.text.trim() ? line.to : line.from;

    const template = [
      "| Header 1 | Header 2 | Header 3 |",
      "| -------- | -------- | -------- |",
      "|          |          |          |",
    ].join("\n");

    const prefix = line.text.trim() ? "\n" : "";
    const suffix = "\n";

    view.dispatch({
      changes: { from: insertPos, insert: prefix + template + suffix },
      selection: { anchor: insertPos + prefix.length + 2 },
    });

    return true;
  }

  /** Adds a new data row below the current row (Mod-Enter). */
  private addRow(view: EditorView): boolean {
    const tableInfo = this.getTableAtCursor(view);
    if (!tableInfo) return false;

    const { state } = view;
    const cursor = state.selection.main.head;
    const currentLine = state.doc.lineAt(cursor);

    const parsed = parseTableMarkdown(state.sliceDoc(tableInfo.from, tableInfo.to));
    if (!parsed) return false;

    const colCount = parsed.headers.length;
    const emptyRow = "| " + Array.from({ length: colCount }, () => "  ").join(" | ") + " |";

    view.dispatch({
      changes: { from: currentLine.to, insert: "\n" + emptyRow },
      selection: { anchor: currentLine.to + 3 },
    });

    return true;
  }

  /** Adds a new column after the current one (Mod-Shift-Enter). */
  private addColumn(view: EditorView): boolean {
    const tableInfo = this.getTableAtCursor(view);
    if (!tableInfo) return false;

    const { state } = view;
    const cursor = state.selection.main.head;
    const currentLine = state.doc.lineAt(cursor);
    const lineText = currentLine.text;
    const cursorInLine = cursor - currentLine.from;

    let colIndex = -1;
    for (let i = 0; i < cursorInLine; i++) {
      if (lineText[i] === "|") colIndex++;
    }
    colIndex = Math.max(0, colIndex);

    const tableText = state.sliceDoc(tableInfo.from, tableInfo.to);
    const lines = tableText.split("\n");

    const newLines = lines.map((line, lineIdx) => {
      const cells = this.splitLineToCells(line);
      const insertAfter = Math.min(colIndex, cells.length - 1);

      if (lineIdx === 1) {
        cells.splice(insertAfter + 1, 0, " -------- ");
      } else {
        cells.splice(insertAfter + 1, 0, "          ");
      }

      return "|" + cells.join("|") + "|";
    });

    view.dispatch({
      changes: { from: tableInfo.from, to: tableInfo.to, insert: newLines.join("\n") },
    });

    return true;
  }

  /**
   * Handle Enter inside a table.
   *
   * When the cursor is in the last cell of the last row:
   * - If the row has content → add a new empty row
   * - If the row is already empty → remove it and move below the table
   */
  private handleEnter(view: EditorView): boolean {
    const tableInfo = this.getTableAtCursor(view);
    if (!tableInfo) return false;

    const { state } = view;
    const cursor = state.selection.main.head;
    const cursorLine = state.doc.lineAt(cursor);
    const tableEndLine = state.doc.lineAt(tableInfo.to);

    if (cursorLine.number !== tableEndLine.number) return false;

    const lineText = cursorLine.text;
    const cursorOffset = cursor - cursorLine.from;
    const pipes: number[] = [];
    for (let i = 0; i < lineText.length; i++) {
      if (lineText[i] === "|") pipes.push(i);
    }

    if (pipes.length < 2) return false;
    const lastCellStart = pipes[pipes.length - 2]!;
    if (cursorOffset < lastCellStart) return false;

    // Empty last row → remove and exit
    if (isRowEmpty(lineText)) {
      const removeFrom = cursorLine.from - 1;
      const removeTo = cursorLine.to;

      view.dispatch({
        changes: { from: Math.max(0, removeFrom), to: removeTo },
        selection: { anchor: Math.min(Math.max(0, removeFrom) + 1, view.state.doc.length) },
      });

      return true;
    }

    // Non-empty last row → add new row
    const parsed = parseTableMarkdown(state.sliceDoc(tableInfo.from, tableInfo.to));
    if (!parsed) return false;

    const colCount = parsed.headers.length;
    const emptyRow = "| " + Array.from({ length: colCount }, () => "  ").join(" | ") + " |";

    view.dispatch({
      changes: { from: cursorLine.to, insert: "\n" + emptyRow },
      selection: { anchor: cursorLine.to + 3 },
    });

    return true;
  }

  /** Tab / Shift-Tab navigation between table cells. */
  private handleTab(view: EditorView, backwards: boolean): boolean {
    const tableInfo = this.getTableAtCursor(view);
    if (!tableInfo) return false;

    const { state } = view;
    const cursor = state.selection.main.head;
    const tableText = state.sliceDoc(tableInfo.from, tableInfo.to);
    const lines = tableText.split("\n");

    // Collect absolute cell positions, skipping the delimiter row.
    const cellPositions: TableCellPosition[] = [];
    let lineFrom = tableInfo.from;
    for (let li = 0; li < lines.length; li++) {
      if (li === 1) {
        lineFrom += lines[li]!.length + 1;
        continue;
      }
      const line = lines[li]!;

      const pipes: number[] = [];
      for (let i = 0; i < line.length; i++) {
        if (line[i] === "|") pipes.push(i);
      }

      for (let p = 0; p < pipes.length - 1; p++) {
        cellPositions.push({
          lineFrom,
          start: pipes[p]! + 1,
          end: pipes[p + 1]!,
        });
      }

      lineFrom += line.length + 1;
    }

    // Find the current cell.
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

    const nextIdx = backwards ? currentCellIdx - 1 : currentCellIdx + 1;
    if (nextIdx < 0 || nextIdx >= cellPositions.length) return false;

    const nextCell = cellPositions[nextIdx]!;
    const cellText = state.sliceDoc(nextCell.lineFrom + nextCell.start, nextCell.lineFrom + nextCell.end);
    const trimStart = cellText.length - cellText.trimStart().length;
    const trimEnd = cellText.length - cellText.trimEnd().length;
    const absCellStart = nextCell.lineFrom + nextCell.start;
    const absCellEnd = nextCell.lineFrom + nextCell.end;
    const isWhitespaceOnly = cellText.trim().length === 0;

    const selectFrom = isWhitespaceOnly ? absCellStart : absCellStart + trimStart;
    const selectTo = isWhitespaceOnly ? absCellEnd : absCellEnd - trimEnd;

    view.dispatch({
      selection: { anchor: selectFrom, head: selectTo },
      scrollIntoView: true,
    });

    return true;
  }

  // ============================================
  // Helpers
  // ============================================

  /** Finds the table syntax node containing the current cursor. */
  private getTableAtCursor(view: EditorView): { from: number; to: number } | null {
    const tree = syntaxTree(view.state);
    const cursor = view.state.selection.main.head;

    let result: { from: number; to: number } | null = null;
    tree.iterate({
      enter: (node) => {
        if (node.name !== "Table") return;
        const table = this.getEffectiveTableInfo(view, node.from, node.to);
        if (!table) return;
        if (cursor >= table.from && cursor <= table.to) result = { from: table.from, to: table.to };
      },
    });
    return result;
  }

  private getEffectiveTableInfo(view: EditorView, nodeFrom: number, nodeTo: number): EffectiveTableInfo | null {
    const startLine = view.state.doc.lineAt(nodeFrom);
    const endLine = view.state.doc.lineAt(nodeTo);

    if (!isTableRowLine(startLine.text)) return null;

    const delimiterLineNumber = startLine.number + 1;
    if (delimiterLineNumber > endLine.number) return null;

    const delimiterLine = view.state.doc.line(delimiterLineNumber);
    const alignments = parseDelimiterAlignments(delimiterLine.text);
    if (!alignments) return null;

    let effectiveEndLineNumber = delimiterLineNumber;
    for (let lineNumber = delimiterLineNumber + 1; lineNumber <= endLine.number; lineNumber++) {
      const line = view.state.doc.line(lineNumber);
      if (!isTableRowLine(line.text)) break;
      effectiveEndLineNumber = lineNumber;
    }

    const effectiveEndLine = view.state.doc.line(effectiveEndLineNumber);
    return {
      from: startLine.from,
      to: effectiveEndLine.to,
      startLineNumber: startLine.number,
      endLineNumber: effectiveEndLineNumber,
      delimiterLineNumber,
      alignments,
    };
  }

  /** Splits a raw table line into raw cell segments (without outer pipes). */
  private splitLineToCells(line: string): string[] {
    return splitTableLine(line);
  }

  // ============================================
  // Preview Rendering
  // ============================================

  override async renderToHTML(node: SyntaxNode, _children: string, _ctx: PreviewContextLike): Promise<string | null> {
    if (node.name === "Table") {
      const content = _ctx.sliceDoc(node.from, node.to);
      const { tableMarkdown, trailingMarkdown } = splitTableAndTrailingMarkdown(content);
      const parsed = parseTableMarkdown(tableMarkdown);
      if (!parsed) return null;

      const tableHtml = await renderTableToHtml(parsed, this.draftlyConfig);
      if (!trailingMarkdown.trim()) return tableHtml;

      const trailingRenderer = new PreviewRenderer(
        trailingMarkdown,
        this.draftlyConfig?.plugins || [],
        this.draftlyConfig?.markdown || [],
        this.draftlyConfig?.theme || ThemeEnum.AUTO,
        true
      );
      const trailingHtml = await trailingRenderer.render();
      return tableHtml + trailingHtml;
    }

    // Table sub-nodes are rendered by the parent table node.
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
    ".cm-draftly-table-wrapper, .cm-draftly-table-widget": {
      display: "table",
      width: "100%",
      borderCollapse: "separate",
      borderSpacing: "0",
      borderRadius: "0.5rem",
      overflow: "hidden",
      border: "1px solid var(--color-border, #e2e8f0)",
      fontFamily: "var(--font-sans, sans-serif)",
      fontSize: "0.9375rem",
      lineHeight: "1.5",

      "& .cm-draftly-table": {
        width: "100%",
        borderCollapse: "separate",
        borderSpacing: "0",
        tableLayout: "fixed",
      },

      "& .cm-draftly-table-row": {
        display: "table-row !important",

        "&.cm-draftly-table-header-row": {
          backgroundColor: "rgba(0, 0, 0, 0.03)",
          fontWeight: "600",
        },

        "&.cm-draftly-table-row-even": {
          backgroundColor: "rgba(0, 0, 0, 0.02)",
        },

        "&.cm-draftly-table-body-row:hover": {
          backgroundColor: "rgba(0, 0, 0, 0.04)",
        },

        "& .cm-draftly-table-cell": {
          display: "table-cell",
          padding: "0.35rem 0.875rem",
          borderBottom: "1px solid var(--color-border, #e2e8f0)",
          borderRight: "1px solid var(--color-border, #e2e8f0)",
          verticalAlign: "middle",
          textAlign: "left",

          "&.cm-draftly-table-cell-last": {
            borderRight: "none",
          },

          "&.cm-draftly-table-th": {
            fontWeight: "600",
            borderBottom: "3px solid var(--color-border, #e2e8f0)",
          },

          "&.cm-draftly-table-cell-center": {
            textAlign: "center",
          },

          "&.cm-draftly-table-cell-right": {
            textAlign: "right",
          },
        },

        "&.cm-draftly-table-row-last .cm-draftly-table-cell": {
          borderBottom: "none",
        },
      },
    },
  },

  dark: {
    ".cm-draftly-table-wrapper, .cm-draftly-table-widget": {
      border: "1px solid var(--color-border, #30363d)",

      "& .cm-draftly-table-row": {
        "&.cm-draftly-table-header-row": {
          backgroundColor: "rgba(255, 255, 255, 0.05)",
        },

        "&.cm-draftly-table-row-even": {
          backgroundColor: "rgba(255, 255, 255, 0.02)",
        },

        "&.cm-draftly-table-body-row:hover": {
          backgroundColor: "rgba(255, 255, 255, 0.05)",
        },

        "& .cm-draftly-table-cell": {
          borderColor: "var(--color-border, #30363d)",

          "&.cm-draftly-table-th": {
            borderBottomColor: "var(--color-border, #30363d)",
          },
        },
      },
    },
  },
});
