import React from "react";

type Props = {};

export default function Devbar({}: Props) {
  return (
    <div className="h-full w-full grid place-items-center">
      <span className="text-muted-foreground font-mono text-center whitespace-nowrap">
        Developer Panel
      </span>
    </div>
  );
}
