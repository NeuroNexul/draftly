"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { cn } from "@workspace/ui/lib/utils";
import { Button } from "@workspace/ui/components/button";
import { Loader2 } from "lucide-react";
import { v4 as uuid } from "uuid";

import Footer from "./footer";
import Header from "./header";
import Devbar from "./devbar";
import Sidebar from "./sidebar";
import { Content } from "./types";

import CodeMirror, { EditorView, Extension, ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { githubDark, githubLight } from "@uiw/codemirror-theme-github";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { allPlugins } from "draftly/src";
import { generateCSS, preview } from "draftly/src";
import { draftly, DraftlyNode, DraftlyPlugin, ThemeEnum } from "draftly/src";

// Plugin configuration - dynamic based on allPlugins
export type PluginConfig = Record<string, boolean>;

// Build default plugin config from allPlugins (all enabled by default)
const defaultPluginConfig: PluginConfig = Object.fromEntries(
  allPlugins.map((plugin) => [plugin.name.toLowerCase(), true])
);

// Configuration for devbar controls
export type PlaygroundConfig = {
  // Editor options
  editor: {
    baseStyles: boolean;
    defaultKeybindings: boolean;
    history: boolean;
    indentWithTab: boolean;
    highlightActiveLine: boolean;
    lineWrapping: boolean;
  };
  // Preview options
  preview: {
    includeBase: boolean;
    sanitize: boolean;
  };
  // Plugin toggles
  plugins: PluginConfig;
};

const defaultConfig: PlaygroundConfig = {
  editor: {
    baseStyles: true,
    defaultKeybindings: true,
    history: true,
    indentWithTab: true,
    highlightActiveLine: true,
    lineWrapping: true,
  },
  preview: {
    includeBase: true,
    sanitize: true,
  },
  plugins: defaultPluginConfig,
};

const STORAGE_KEY = "draftly-playground-contents";
const STORAGE_CURRENT_KEY = "draftly-playground-current";
const DEBOUNCE_MS = 500;

export type SaveStatus = "idle" | "saving" | "saved";

export default function Page() {
  const { theme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [devbarOpen, setDevbarOpen] = useState(true);

  const [contents, setContents] = useState<Content[]>([]);
  const [currentContent, setCurrentContent] = useState<number>(-1);

  const [mode, setMode] = useState<"live" | "view" | "code" | "output">("live");
  const [showNodes, setShowNodes] = useState(false);
  const [nodes, setNodes] = useState<DraftlyNode[]>([]);
  const [config, setConfig] = useState<PlaygroundConfig>(defaultConfig);

  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const savedIndicatorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const storedContents = localStorage.getItem(STORAGE_KEY);
    const storedCurrent = localStorage.getItem(STORAGE_CURRENT_KEY);

    if (storedContents) {
      try {
        const parsed = JSON.parse(storedContents) as Content[];
        setContents(parsed);
      } catch {
        console.error("Failed to parse stored contents");
      }
    }

    if (storedCurrent) {
      const parsedCurrent = parseInt(storedCurrent, 10);
      if (!isNaN(parsedCurrent)) {
        setCurrentContent(parsedCurrent);
      }
    }

    setIsLoading(false);
  }, []);

  // Debounced save to localStorage
  const saveToStorage = useCallback((data: Content[], current: number) => {
    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    if (savedIndicatorTimeoutRef.current) {
      clearTimeout(savedIndicatorTimeoutRef.current);
    }

    setSaveStatus("saving");

    saveTimeoutRef.current = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      localStorage.setItem(STORAGE_CURRENT_KEY, current.toString());
      setSaveStatus("saved");

      // Reset to idle after showing "saved" for a bit
      savedIndicatorTimeoutRef.current = setTimeout(() => {
        setSaveStatus("idle");
      }, 2000);
    }, DEBOUNCE_MS);
  }, []);

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (savedIndicatorTimeoutRef.current) clearTimeout(savedIndicatorTimeoutRef.current);
    };
  }, []);

  const counts = useMemo(() => {
    if (currentContent === -1) return { words: 0, lines: 0, char: 0 };
    const content = contents[currentContent];
    const words = content!.content.split(" ").length;
    const lines = content!.content.split("\n").length;
    const char = content!.content.length;
    return { words, lines, char };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentContent, contents[currentContent]?.content]);

  function handleContentChange(id: string, content: string) {
    setContents((c) => {
      const updated = c.map((currentContent) =>
        currentContent.id === id ? { ...currentContent, content } : currentContent
      );
      saveToStorage(updated, currentContent);
      return updated;
    });
  }

  function addNewContent(title: string) {
    const newContent: Content = {
      id: uuid(),
      title,
      content: `# ${title}\n\n## Hello World`,
    };
    const newContents = [...contents, newContent];
    const newIndex = contents.length;
    setContents(newContents);
    setCurrentContent(newIndex);
    saveToStorage(newContents, newIndex);
  }

  const editor = useRef<ReactCodeMirrorRef>(null);
  function handleSetCurrentContent(index: number) {
    setCurrentContent(index);
    saveToStorage(contents, index);
  }

  // Build active plugins list based on config
  const activePlugins = useMemo<DraftlyPlugin[]>(() => {
    return allPlugins.filter((plugin) => {
      const name = plugin.name.toLowerCase() as keyof PluginConfig;
      return config.plugins[name] ?? true;
    });
  }, [config.plugins]);

  const defaultExtensions = useMemo<Extension[]>(
    () =>
      draftly({
        theme:
          theme && theme !== "system" ? (theme.includes("dark") ? ThemeEnum.DARK : ThemeEnum.LIGHT) : ThemeEnum.AUTO,
        themeStyle: theme && theme.includes("dark") ? githubDark : githubLight,
        baseStyles: config.editor.baseStyles,
        plugins: activePlugins,
        markdown: [],
        extensions: [],
        keymap: [],
        disableViewPlugin: mode === "code",
        defaultKeybindings: config.editor.defaultKeybindings,
        history: config.editor.history,
        indentWithTab: config.editor.indentWithTab,
        highlightActiveLine: config.editor.highlightActiveLine,
        lineWrapping: config.editor.lineWrapping,
        onNodesChange: (nodes) => {
          if (showNodes) setNodes(nodes);
        },
      }),
    [theme, mode, showNodes, config.editor, activePlugins]
  );

  const content = useMemo(() => {
    if (currentContent === -1 || !["view", "output"].includes(mode)) return { html: "", css: "" };

    const html = preview(contents[currentContent]?.content || "", {
      theme: theme && theme !== "system" ? (theme.includes("dark") ? ThemeEnum.DARK : ThemeEnum.LIGHT) : ThemeEnum.AUTO,
      plugins: activePlugins,
      markdown: [],
      sanitize: config.preview.sanitize,
      wrapperTag: "div",
      wrapperClass: "draftly-preview h-full w-full max-w-[48rem] mx-auto overflow-auto",
    });

    const css = generateCSS({
      theme: theme && theme !== "system" ? (theme.includes("dark") ? ThemeEnum.DARK : ThemeEnum.LIGHT) : ThemeEnum.AUTO,
      plugins: activePlugins,
      wrapperClass: "draftly-preview",
      includeBase: config.preview.includeBase,
    });

    return { html, css };
  }, [currentContent, contents, theme, mode, activePlugins, config.preview]);

  if (isLoading) {
    return (
      <div className="min-h-svh h-svh flex flex-col items-center justify-center gap-3">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <span className="text-muted-foreground font-mono">Loading...</span>
      </div>
    );
  }

  return (
    <div className="min-h-svh h-svh flex flex-col">
      {/* Header */}
      <Header
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        devbarOpen={devbarOpen}
        setDevbarOpen={setDevbarOpen}
        saveStatus={saveStatus}
        mode={mode}
        setMode={setMode}
      />

      {/* Main */}
      <main className="flex-1 w-full flex flex-row overflow-hidden relative">
        {/* Mobile Backdrop */}
        <div
          className={`fixed inset-0 bg-black/50 z-30 xl:hidden transition-opacity duration-300 ${
            sidebarOpen || devbarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          onClick={() => {
            setSidebarOpen(false);
            setDevbarOpen(false);
          }}
        />

        {/* Sidebar */}
        <div
          className={cn(
            "h-full bg-background overflow-hidden transition-all duration-300 ease-in-out",
            "fixed xl:relative top-12 xl:top-0 bottom-10 xl:bottom-0 left-0 z-40 xl:z-auto",
            {
              "w-64": sidebarOpen,
              "w-0 xl:w-0": !sidebarOpen,
            }
          )}
        >
          <Sidebar
            contents={contents}
            currentContent={currentContent}
            setCurrentContent={handleSetCurrentContent}
            addNewContent={addNewContent}
          />
        </div>

        {/* Editor */}
        <div
          className={cn("flex-1 h-full mx-2 border rounded-lg overflow-hidden flex items-center justify-center", {
            "ml-0 max-xl:ml-2": sidebarOpen,
          })}
        >
          {currentContent !== -1 ? (
            mode === "view" ? (
              <div className="h-full w-full overflow-auto">
                <style dangerouslySetInnerHTML={{ __html: content.css }} />
                <div dangerouslySetInnerHTML={{ __html: content.html }} />
              </div>
            ) : mode === "output" ? (
              <div className="h-full w-full">
                <div className="h-full w-full grid grid-rows-2">
                  <div className="h-full w-full flex flex-col border-b-2">
                    <CodeMirror
                      key={`draftly-output-${mode}`}
                      id={"draftly-output"}
                      autoFocus={false}
                      className={"h-full w-full"}
                      height="100%"
                      width="100%"
                      value={content.html}
                      theme={theme?.includes("dark") ? githubDark : githubLight}
                      extensions={[html(), css(), EditorView.lineWrapping]}
                      readOnly
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck="false"
                    />
                  </div>
                  <div className="h-full w-full flex flex-col border-t-2">
                    <CodeMirror
                      key={`draftly-output-${mode}`}
                      id={"draftly-output"}
                      autoFocus={false}
                      className={"h-full w-full"}
                      height="100%"
                      width="100%"
                      value={content.css}
                      theme={theme?.includes("dark") ? githubDark : githubLight}
                      extensions={[css(), EditorView.lineWrapping]}
                      readOnly
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck="false"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <CodeMirror
                key={`draftly-editor-${mode}`}
                id={"draftly-editor"}
                ref={editor}
                autoFocus={false}
                className={"h-full w-full"}
                height="100%"
                width="100%"
                value={contents[currentContent]?.content}
                onChange={(value) => handleContentChange(contents[currentContent]!.id, value)}
                extensions={[...defaultExtensions]}
                basicSetup={{
                  lineNumbers: mode === "code",
                  foldGutter: mode === "code",
                  highlightActiveLine: mode === "code",
                  highlightActiveLineGutter: mode === "code",
                  highlightSelectionMatches: mode === "code",
                  drawSelection: false,
                }}
              />
            )
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center">
              <span className="text-muted-foreground font-mono whitespace-nowrap">No Content Selected</span>
              <Button className="mt-4" onClick={() => addNewContent(window.prompt("Enter Content Title") || "")}>
                Create New
              </Button>
            </div>
          )}
        </div>

        {/* Developer Panel */}
        <div
          className={cn(
            "h-full pr-2 bg-background overflow-hidden transition-all duration-300 ease-in-out",
            "fixed xl:relative top-12 xl:top-0 bottom-10 xl:bottom-0 right-0 z-40 xl:z-auto border-l xl:border-l-0",
            {
              "w-96": devbarOpen,
              "w-0 xl:w-0 pr-0": !devbarOpen,
            }
          )}
        >
          <Devbar nodes={nodes} setShowNodes={setShowNodes} config={config} setConfig={setConfig} />
        </div>
      </main>

      {/* Footer */}
      <Footer counts={counts} />
    </div>
  );
}
