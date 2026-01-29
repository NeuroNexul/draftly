import { Extension, Prec } from "@codemirror/state";
import { KeyBinding, keymap } from "@codemirror/view";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import type { MarkdownConfig } from "@lezer/markdown";
import { MarklyPlugin, PluginContext } from "./types.js";

/**
 * Configuration options for the Markly editor
 */
export interface MarklyConfig {
  /** Plugins to load */
  plugins?: MarklyPlugin[];

  /** Additional markdown extensions for the parser */
  markdown?: MarkdownConfig[];

  /** Additional CodeMirror extensions */
  extensions?: Extension[];

  /** Additional keybindings */
  keymap?: KeyBinding[];
}

/**
 * Creates a Markly editor extension bundle for CodeMirror 6
 *
 * @param config - Configuration options for the editor
 * @returns CodeMirror Extension that can be added to EditorState
 *
 * @example
 * ```ts
 * import { EditorView } from '@codemirror/view';
 * import { EditorState } from '@codemirror/state';
 * import { markly } from 'markly';
 *
 * const view = new EditorView({
 *   state: EditorState.create({
 *     doc: '# Hello Markly',
 *     extensions: [markly()]
 *   }),
 *   parent: document.getElementById('editor')
 * });
 * ```
 */
export function markly(config: MarklyConfig = {}): Extension[] {
  const { plugins = [], extensions = [], keymap: configKeymap = [] } = config;

  // Collect all extensions from plugins
  const pluginExtensions: Extension[] = [];
  const pluginKeymaps: KeyBinding[] = [];
  const markdownExtensions: MarkdownConfig[] = [];

  // Create plugin context for lifecycle methods
  const pluginContext: PluginContext = { config };

  // Process each plugin
  for (const plugin of plugins) {
    // Call onRegister lifecycle hook
    plugin.onRegister?.(pluginContext);

    // Collect extensions
    if (plugin.extensions) {
      pluginExtensions.push(...plugin.extensions);
    }

    // Collect keymaps
    if (plugin.keymap) {
      pluginKeymaps.push(...plugin.keymap);
    }

    // Collect markdown parser extensions
    if (plugin.markdown) {
      markdownExtensions.push(plugin.markdown);
    }
  }

  // Add config-level markdown extensions
  if (config.markdown) {
    markdownExtensions.push(...config.markdown);
  }

  // Build the base markdown language support
  const markdownSupport = markdown({
    base: markdownLanguage,
    extensions: markdownExtensions,
  });

  // Compose all extensions together
  const composedExtensions: Extension[] = [
    // Core markdown support (highest priority)
    Prec.high(markdownSupport),

    // Plugin extensions
    ...pluginExtensions,

    // Plugin keymaps
    pluginKeymaps.length > 0 ? keymap.of(pluginKeymaps) : [],

    // Config keymaps
    configKeymap.length > 0 ? keymap.of(configKeymap) : [],

    // Additional config extensions
    ...extensions,
  ];

  return composedExtensions;
}
