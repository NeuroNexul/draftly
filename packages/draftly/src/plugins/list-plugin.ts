import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { Extension } from "@codemirror/state";
import { DecorationContext, DecorationPlugin } from "../plugin";

/**
 * Mark decorations for list items
 */
const listMarkDecorations = {
  "list-mark-ul": Decoration.mark({ class: "cm-draftly-list-mark-ul" }),
  "list-mark-ol": Decoration.mark({ class: "cm-draftly-list-mark-ol" }),
  "task-marker": Decoration.mark({ class: "cm-draftly-task-marker" }),
};

/**
 * Task checkbox widget
 */
export class TaskCheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean) {
    super();
  }

  eq(other: TaskCheckboxWidget): boolean {
    return other.checked === this.checked;
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement("span");
    wrap.className = `cm-draftly-task-checkbox ${this.checked ? "checked" : ""}`;
    wrap.setAttribute("aria-hidden", "true");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = this.checked;
    checkbox.tabIndex = -1;

    checkbox.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const pos = view.posAtDOM(wrap);
      // Find the task marker in the document and toggle it
      const line = view.state.doc.lineAt(pos);
      const match = line.text.match(/^(\s*[-*+]\s*)\[([ xX])\]/);
      if (match) {
        const markerStart = line.from + match[1]!.length + 1;
        const newChar = this.checked ? " " : "x";
        view.dispatch({
          changes: { from: markerStart, to: markerStart + 1, insert: newChar },
        });
      }
    });

    wrap.appendChild(checkbox);

    // Add a label for better accessibility and click area
    // const label = document.createElement("span");
    // wrap.appendChild(label);

    return wrap;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

/**
 * ListPlugin - Decorates markdown lists
 *
 * Handles:
 * - Unordered lists (bullet points) - Auto-styles markers (*, -, +)
 * - Ordered lists (numbered) - Auto-styles numbers (1., 2.)
 * - Task lists (checkboxes) - Replaces [ ]/[x] with interactive widget when not editing
 */
export class ListPlugin extends DecorationPlugin {
  readonly name = "list";
  readonly version = "1.0.0";

  /**
   * Moderate priority
   */
  override get decorationPriority(): number {
    return 20;
  }

  /**
   * Get the extensions for this plugin (theme)
   */
  override getExtensions(): Extension[] {
    return [listTheme];
  }

  /**
   * Build list decorations by iterating the syntax tree
   */
  override buildDecorations(ctx: DecorationContext): void {
    const { view, decorations } = ctx;
    const tree = syntaxTree(view.state);

    tree.iterate({
      enter: (node) => {
        const { from, to, name } = node;
        const line = view.state.doc.lineAt(from);
        const cursorInLine = ctx.cursorInRange(line.from, line.to);

        // Handle list markers (bullets, numbers)
        if (name === "ListMark") {
          // Determine list type by checking grandparent (BulletList vs OrderedList)
          // Parent is ListItem, Grandparent is the list container
          const parent = node.node.parent;
          const grandparent = parent?.parent;
          const listType = grandparent?.name;

          if (!cursorInLine) {
            if (listType === "OrderedList") {
              decorations.push(listMarkDecorations["list-mark-ol"].range(from, to));
            } else {
              // Default to generic/unordered for BulletList or others
              decorations.push(listMarkDecorations["list-mark-ul"].range(from, to));
            }
          }
        }

        // Handle task lists
        if (name === "TaskMarker") {
          const text = view.state.sliceDoc(from, to);
          const isChecked = text.includes("x") || text.includes("X");

          if (cursorInLine) {
            // If editing the line, just style the marker text
            decorations.push(listMarkDecorations["task-marker"].range(from, to));
          } else {
            // If not editing, REPLACE the marker text with the widget
            decorations.push(
              Decoration.replace({
                widget: new TaskCheckboxWidget(isChecked),
              }).range(from, to),
            );
          }
        }
      },
    });
  }
}

/**
 * Theme for list styling
 */
const listTheme = EditorView.theme({
  // Unordered List markers (*, -, +)
  ".cm-draftly-list-mark-ul": {
    position: "relative",
  },

  ".cm-draftly-list-mark-ul > span": {
    visibility: "hidden",
  },

  ".cm-draftly-list-mark-ul::after": {
    content: '"•"',
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    color: "var(--color-link)",
    fontWeight: "bold",
    pointerEvents: "none",
  },

  // Ordered List markers (1., 2.)
  ".cm-draftly-list-mark-ol": {
    color: "var(--draftly-highlight, #a4a4a4)",
    fontFamily: "monospace",
    marginRight: "2px",
  },

  // Task markers text ([ ] or [x]) - visible only when editing
  ".cm-draftly-task-marker": {
    color: "var(--draftly-highlight, #a4a4a4)",
    fontFamily: "monospace",
  },

  // Task Checkbox Widget
  ".cm-draftly-task-checkbox": {
    display: "inline-flex",
    verticalAlign: "middle",
    marginRight: "0.3em",
    cursor: "pointer",
    userSelect: "none",
    alignItems: "center",
    height: "1.2em",
  },

  ".cm-draftly-task-checkbox input": {
    cursor: "pointer",
    margin: 0,
    width: "1.1em",
    height: "1.1em",
    appearance: "none",
    border: "1px solid",
    borderRadius: "0.25em",
    backgroundColor: "transparent",
    position: "relative",
  },

  ".cm-draftly-task-checkbox.checked input::after": {
    content: '"✓"',
    position: "absolute",
    left: "1px",
    top: "-3px",
  },
});
