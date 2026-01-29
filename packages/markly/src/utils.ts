import { EditorView } from "@codemirror/view";

/**
 * Check if cursor is within the given range
 */
export function cursorInRange(
  view: EditorView,
  from: number,
  to: number,
): boolean {
  const selection = view.state.selection.main;
  return selection.from <= to && selection.to >= from;
}

/**
 * Check if any selection overlaps with the given range
 */
export function selectionOverlapsRange(
  view: EditorView,
  from: number,
  to: number,
): boolean {
  for (const range of view.state.selection.ranges) {
    if (range.from <= to && range.to >= from) {
      return true;
    }
  }
  return false;
}
