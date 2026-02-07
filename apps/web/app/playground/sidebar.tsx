"use client";

import React from "react";
import { Content } from "./types";
import { Button } from "@workspace/ui/components/button";
import { Plus, FileText } from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";
import CreateContentDialog from "./create-content-dialog";

type Props = {
  contents: Content[];
  currentContent: number;
  setCurrentContent: (content: number) => void;
  addNewContent: (title: string) => void;
};

export default function Sidebar({ contents, currentContent, setCurrentContent, addNewContent }: Props) {
  return (
    <div className="h-full w-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between">
        <h2 className="text-sm font-semibold">Contents</h2>
        <CreateContentDialog
          onCreateContent={addNewContent}
          trigger={
            <Button size="icon" variant="ghost">
              <Plus className="h-4 w-4" />
            </Button>
          }
        />
      </div>

      {/* Content List */}
      <div className="flex-1 overflow-y-auto">
        {contents.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">No contents yet</div>
        ) : (
          <ul className="py-2">
            {contents.map((content, index) => (
              <li key={content.id}>
                <button
                  onClick={() => setCurrentContent(index)}
                  className={cn(
                    "w-full px-3 py-2 flex items-center gap-2 text-left text-sm transition-colors hover:bg-accent",
                    currentContent === index && "bg-accent"
                  )}
                >
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{content.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
