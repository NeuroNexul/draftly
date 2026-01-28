"use client";

import { useMemo, useState } from "react";
import { cn } from "@workspace/ui/lib/utils";
import Footer from "./footer";
import Header from "./header";
import Devbar from "./devbar";
import Sidebar from "./sidebar";
import { Content } from "./types";
import { Button } from "@workspace/ui/components/button";

export default function Page() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [devbarOpen, setDevbarOpen] = useState(true);
  const [contents, setContents] = useState<Content[]>([]);
  const [currentContent, setCurrentContent] = useState<number>(-1);

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
    setContents((c) =>
      c.map((currentContent) =>
        currentContent.id === id
          ? { ...currentContent, content }
          : currentContent,
      ),
    );
  }

  function addNewContent(title: string) {
    setContents((c) => [
      ...c,
      {
        id: crypto.randomUUID(),
        title,
        content: `# ${title}\n\n## Hello World`,
      },
    ]);
    setCurrentContent(contents.length);
  }

  return (
    <div className="min-h-svh h-svh flex flex-col">
      {/* Header */}
      <Header
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        devbarOpen={devbarOpen}
        setDevbarOpen={setDevbarOpen}
      />

      {/* Main */}
      <main className="flex-1 w-full flex flex-row overflow-hidden relative">
        {/* Mobile Backdrop */}
        <div
          className={`fixed inset-0 bg-black/50 z-30 xl:hidden transition-opacity duration-300 ${
            sidebarOpen || devbarOpen
              ? "opacity-100"
              : "opacity-0 pointer-events-none"
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
          <Sidebar
            contents={contents}
            currentContent={currentContent}
            setCurrentContent={setCurrentContent}
            addNewContent={addNewContent}
          />
        </div>

        {/* Editor */}
        <div className="flex-1 h-full border-r flex items-center justify-center">
          {currentContent !== -1 ? (
            <textarea
              className="w-full h-full resize-none p-4 outline-none"
              value={contents[currentContent]!.content}
              onChange={(e) =>
                handleContentChange(
                  contents[currentContent]!.id,
                  e.target.value,
                )
              }
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center">
              <span className="text-muted-foreground font-mono whitespace-nowrap">
                No Content Selected
              </span>
              <Button
                className="mt-4"
                onClick={() =>
                  addNewContent(window.prompt("Enter Content Title") || "")
                }
              >
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
          <Devbar />
        </div>
      </main>

      {/* Footer */}
      <Footer counts={counts} />
    </div>
  );
}
