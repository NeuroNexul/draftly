import { Extension, Prec } from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  KeyBinding,
  keymap,
  rectangularSelection,
} from "@codemirror/view";
import {
  markdown,
  markdownKeymap,
  markdownLanguage,
} from "@codemirror/lang-markdown";
import type { MarkdownConfig } from "@lezer/markdown";
import { MarklyPlugin, PluginContext } from "./types";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { indentOnInput } from "@codemirror/language";

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

  /** Disable the built-in view plugin (for raw markdown mode) */
  disableViewPlugin?: boolean;

  /** Enable default keybindings */
  defaultKeybindings?: boolean;

  /** Enable history */
  history?: boolean;

  /** Enable indent with tab */
  indentWithTab?: boolean;

  /** Draw selection */
  drawSelection?: boolean;

  /** Highlight active line */
  highlightActiveLine?: boolean;

  /** Rectangular selection */
  rectangularSelection?: boolean;

  /** Line wrapping in raw markdown mode */
  lineWrapping?: boolean;
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
  const {
    plugins = [],
    extensions = [],
    keymap: configKeymap = [],
    disableViewPlugin = false,
    defaultKeybindings = true,
    history: configHistory = true,
    indentWithTab: configIndentWithTab = true,
    drawSelection: configDrawSelection = true,
    highlightActiveLine: configHighlightActiveLine = true,
    rectangularSelection: configRectangularSelection = true,
    lineWrapping: configLineWrapping = true,
  } = config;

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
    codeLanguages: languages,
    extensions: markdownExtensions,
    addKeymap: true,
    completeHTMLTags: true,
  });

  // Core CodeMirror extensions (in order)
  const baseExtensions: Extension[] = [
    ...(defaultKeybindings ? [keymap.of(defaultKeymap)] : []),
    ...(configHistory ? [history(), keymap.of(historyKeymap)] : []),
    ...(configIndentWithTab
      ? [indentOnInput(), keymap.of([indentWithTab])]
      : []),
    ...(configDrawSelection ? [drawSelection()] : []),
    ...(configHighlightActiveLine ? [highlightActiveLine()] : []),
    ...(configRectangularSelection ? [rectangularSelection()] : []),
  ];

  // Markly extensions
  const marklyExtensions: Extension[] = [];
  if (!disableViewPlugin || configLineWrapping)
    marklyExtensions.push(EditorView.lineWrapping);

  // Compose all extensions together
  const composedExtensions: Extension[] = [
    // Core markdown support (highest priority)
    Prec.high(markdownSupport),
    Prec.high(keymap.of(markdownKeymap)),

    // Core CodeMirror extensions
    ...baseExtensions,

    // Markly view plugin for rich rendering
    ...marklyExtensions,

    // Plugin extensions & keymaps
    ...pluginExtensions,
    pluginKeymaps.length > 0 ? keymap.of(pluginKeymaps) : [],

    // Config keymaps & extensions
    configKeymap.length > 0 ? keymap.of(configKeymap) : [],
    ...extensions,
  ];

  return composedExtensions;
}
