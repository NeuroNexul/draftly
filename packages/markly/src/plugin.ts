import { Decoration, EditorView, KeyBinding, ViewUpdate, WidgetType } from "@codemirror/view";
import { Extension, Range } from "@codemirror/state";
import { MarkdownConfig } from "@lezer/markdown";
import { MarklyConfig } from "./markly";

/**
 * Context passed to plugin lifecycle methods
 */
export interface PluginContext {
  /** Current configuration */
  readonly config: MarklyConfig;
}

/**
 * Plugin configuration schema
 */
export interface PluginConfig {
  [key: string]: unknown;
}

/**
 * Decoration context passed to plugin decoration builders
 * Provides access to view state and decoration collection
 */
export interface DecorationContext {
  /** The EditorView instance (readonly) */
  readonly view: EditorView;

  /** Array to push decorations into (will be sorted automatically) */
  readonly decorations: Range<Decoration>[];

  /** Check if selection overlaps with a range (to show raw markdown) */
  selectionOverlapsRange(from: number, to: number): boolean;

  /** Check if cursor is within a range */
  cursorInRange(from: number, to: number): boolean;
}

/**
 * Abstract base class for all Markly plugins
 *
 * Implements OOP principles:
 * - Abstraction: abstract name/version must be implemented by subclasses
 * - Encapsulation: private _config, protected _context
 * - Inheritance: specialized plugin classes can extend this
 */
export abstract class MarklyPlugin {
  /** Unique plugin identifier (abstract - must be implemented) */
  abstract readonly name: string;

  /** Plugin version (abstract - must be implemented) */
  abstract readonly version: string;

  /** Plugin dependencies - names of required plugins */
  readonly dependencies: string[] = [];

  /** Private configuration storage */
  private _config: PluginConfig = {};

  /** Protected context - accessible to subclasses */
  protected _context: PluginContext | null = null;

  /** Get plugin configuration */
  get config(): PluginConfig {
    return this._config;
  }

  /** Set plugin configuration */
  set config(value: PluginConfig) {
    this._config = value;
  }

  /** Get plugin context */
  get context(): PluginContext | null {
    return this._context;
  }

  // ============================================
  // EXTENSION METHODS (overridable by subclasses)
  // ============================================

  /**
   * Return CodeMirror extensions for this plugin
   * Override to provide custom extensions
   */
  getExtensions(): Extension[] {
    return [];
  }

  /**
   * Return markdown parser extensions
   * Override to extend markdown parsing
   */
  getMarkdownConfig(): MarkdownConfig | null {
    return null;
  }

  /**
   * Return keybindings for this plugin
   * Override to add custom keyboard shortcuts
   */
  getKeymap(): KeyBinding[] {
    return [];
  }

  // ============================================
  // DECORATION METHODS (overridable by subclasses)
  // ============================================

  /**
   * Decoration priority (higher = applied later)
   * Override to customize priority. Default: 100
   */
  get decorationPriority(): number {
    return 100;
  }

  /**
   * Build decorations for the current view state
   * Override to contribute decorations to the editor
   *
   * @param ctx - Decoration context with view and decoration array
   */
  buildDecorations(_ctx: DecorationContext): void {
    // Default implementation does nothing
    // Subclasses override to add decorations
  }

  // ============================================
  // LIFECYCLE HOOKS (overridable by subclasses)
  // ============================================

  /**
   * Called when plugin is registered with Markly
   * Override to perform initialization
   *
   * @param context - Plugin context with configuration
   */
  onRegister(context: PluginContext): void | Promise<void> {
    this._context = context;
  }

  /**
   * Called when plugin is unregistered
   * Override to perform cleanup
   */
  onUnregister(): void {
    this._context = null;
  }

  /**
   * Called when EditorView is created and ready
   * Override to perform view-specific initialization
   *
   * @param view - The EditorView instance
   */
  onViewReady(_view: EditorView): void {
    // Default implementation does nothing
  }

  /**
   * Called on view updates (document changes, selection changes, etc.)
   * Override to react to editor changes
   *
   * @param update - The ViewUpdate with change information
   */
  onViewUpdate(_update: ViewUpdate): void {
    // Default implementation does nothing
  }

  // ============================================
  // ACCESSIBILITY METHODS (overridable by subclasses)
  // ============================================

  /**
   * Return ARIA attributes to add to the editor
   * Override to improve accessibility
   */
  getAriaAttributes(): Record<string, string> {
    return {};
  }

  // ============================================
  // VIEW CONTRIBUTIONS (overridable by subclasses)
  // ============================================

  /**
   * Return widget types this plugin provides
   * Override to contribute custom widgets
   */
  getWidgets(): WidgetType[] {
    return [];
  }

  // ============================================
  // PROTECTED UTILITIES (for subclasses)
  // ============================================

  /**
   * Helper to get current editor state
   * @param view - The EditorView instance
   */
  protected getState(view: EditorView) {
    return view.state;
  }

  /**
   * Helper to get current document
   * @param view - The EditorView instance
   */
  protected getDocument(view: EditorView) {
    return view.state.doc;
  }
}

/**
 * Base class for plugins that primarily contribute decorations
 * Extends MarklyPlugin with decoration-focused defaults
 */
export abstract class DecorationPlugin extends MarklyPlugin {
  /**
   * Decoration priority - lower than default for decoration plugins
   * Override to customize
   */
  override get decorationPriority(): number {
    return 50;
  }

  /**
   * Subclasses must implement this to provide decorations
   * @param ctx - Decoration context
   */
  abstract override buildDecorations(ctx: DecorationContext): void;
}

/**
 * Base class for plugins that add syntax/parser extensions
 * Extends MarklyPlugin with syntax-focused requirements
 */
export abstract class SyntaxPlugin extends MarklyPlugin {
  /**
   * Subclasses must implement this to provide markdown config
   */
  abstract override getMarkdownConfig(): MarkdownConfig;
}
