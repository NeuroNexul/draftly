"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@workspace/ui/lib/utils";
import Footer from "./footer";
import Header from "./header";
import Devbar from "./devbar";
import Sidebar from "./sidebar";
import { Content } from "./types";
import { Button } from "@workspace/ui/components/button";
import { Loader2 } from "lucide-react";

import CodeMirror, { Extension, ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { githubDark, githubLight } from "@uiw/codemirror-theme-github";
import markly, { MarklyNode } from "markly";
import { useTheme } from "next-themes";

const STORAGE_KEY = "markly-playground-contents";
const STORAGE_CURRENT_KEY = "markly-playground-current";
const DEBOUNCE_MS = 500;

export type SaveStatus = "idle" | "saving" | "saved";

export default function Page() {
  const { theme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [devbarOpen, setDevbarOpen] = useState(true);

  const [contents, setContents] = useState<Content[]>([]);
  const [currentContent, setCurrentContent] = useState<number>(-1);

  const [showCode, setShowCode] = useState(false);
  const [showNodes, setShowNodes] = useState(false);
  const [nodes, setNodes] = useState<MarklyNode[]>([]);

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
      const updated = c.map((currentContent) => (currentContent.id === id ? { ...currentContent, content } : currentContent));
      saveToStorage(updated, currentContent);
      return updated;
    });
  }

  function addNewContent(title: string) {
    const newContent: Content = {
      id: crypto.randomUUID(),
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

  const defaultExtensions = useMemo<Extension[]>(
    () =>
      markly({
        plugins: [],
        markdown: [],
        extensions: [],
        keymap: [],
        disableViewPlugin: showCode,
        defaultKeybindings: true,
        history: true,
        indentWithTab: true,
        drawSelection: true,
        highlightActiveLine: true,
        rectangularSelection: true,
        lineWrapping: true,
        onNodesChange: (nodes) => {
          if (showNodes) setNodes(nodes);
        },
      }),
    [showCode, showNodes, setNodes],
  );

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
        showCode={showCode}
        setShowCode={setShowCode}
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
            "h-full border-r bg-background overflow-hidden transition-all duration-300 ease-in-out",
            "fixed xl:relative top-12 xl:top-0 bottom-10 xl:bottom-0 left-0 z-40 xl:z-auto",
            {
              "w-64": sidebarOpen,
              "w-0 xl:w-0": !sidebarOpen,
            },
          )}
        >
          <Sidebar contents={contents} currentContent={currentContent} setCurrentContent={handleSetCurrentContent} addNewContent={addNewContent} />
        </div>

        {/* Editor */}
        <div className="flex-1 h-full border-r flex items-center justify-center">
          {currentContent !== -1 ? (
            <CodeMirror
              id={"markly-editor"}
              ref={editor}
              autoFocus={false}
              className={"h-full w-full"}
              height="100%"
              width="100%"
              value={contents[currentContent]?.content}
              onChange={(value) => handleContentChange(contents[currentContent]!.id, value)}
              theme={theme?.includes("dark") ? githubDark : githubLight}
              extensions={[...defaultExtensions]}
              basicSetup={{
                lineNumbers: showCode,
                foldGutter: showCode,
                highlightActiveLine: showCode,
                highlightActiveLineGutter: showCode,
                highlightSelectionMatches: showCode,
              }}
            />
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
            "h-full bg-background overflow-hidden transition-all duration-300 ease-in-out",
            "fixed xl:relative top-12 xl:top-0 bottom-10 xl:bottom-0 right-0 z-40 xl:z-auto border-l xl:border-l-0",
            {
              "w-96": devbarOpen,
              "w-0 xl:w-0": !devbarOpen,
            },
          )}
        >
          <Devbar nodes={nodes} setShowNodes={setShowNodes} />
        </div>
      </main>

      {/* Footer */}
      <Footer counts={counts} />
    </div>
  );
}
