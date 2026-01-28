import React from "react";

type Props = {};

export default function Footer({}: Props) {
  return (
    <footer className="h-10 w-full py-1 px-8 border-t flex items-center justify-between gap-6 font-mono text-sm text-muted-foreground">
      <div></div>
      <div className="flex items-center gap-4">
        <span>Words: xxx</span>
        <span>•</span>
        <span>Lines: xxx</span>
        <span>•</span>
        <span>Char: xxx</span>
      </div>
    </footer>
  );
}
