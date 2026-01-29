import { Extension } from "@codemirror/state";
import { KeyBinding } from "@codemirror/view";
import { MarkdownConfig } from "@lezer/markdown";
import { MarklyConfig } from "./markly";

/**
 * Context passed to plugin lifecycle methods
 */
export interface PluginContext {
  /** Current configuration */
  config: MarklyConfig;
}

/**
 * Plugin configuration schema
 */
export interface PluginConfig {
  [key: string]: unknown;
}

/**
 * Markly Plugin interface
 * Plugins extend the editor with custom functionality
 */
export interface MarklyPlugin {
  /** Unique plugin identifier */
  name: string;

  /** Plugin version */
  version: string;

  /** CodeMirror 6 extensions to register */
  extensions?: Extension[];

  /** Markdown parser extensions */
  markdown?: MarkdownConfig;

  /** Optional: Keyboard shortcuts */
  keymap?: KeyBinding[];

  /** Optional: Configuration schema */
  config?: PluginConfig;

  /** Lifecycle: called when plugin is registered */
  onRegister?: (context: PluginContext) => void;

  /** Lifecycle: called when plugin is unregistered */
  onUnregister?: (context: PluginContext) => void;
}
