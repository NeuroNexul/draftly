import React from "react";

type Props = {};

export default function Sidebar({}: Props) {
  return (
    <div className="h-full w-full grid place-items-center">
      <span className="text-muted-foreground font-mono whitespace-nowrap">
        Sidebar
      </span>
    </div>
  );
}
