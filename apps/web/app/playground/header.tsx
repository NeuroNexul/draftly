import { Button } from "@workspace/ui/components/button";
import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import React, { Dispatch, SetStateAction } from "react";

type Props = {
  sidebarOpen: boolean;
  setSidebarOpen: Dispatch<SetStateAction<boolean>>;
  devbarOpen: boolean;
  setDevbarOpen: Dispatch<SetStateAction<boolean>>;
};

export default function Header({
  sidebarOpen,
  setSidebarOpen,
  devbarOpen,
  setDevbarOpen,
}: Props) {
  return (
    <header className="h-12 w-full border-b flex items-center justify-between py-1 px-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 p-1"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? (
            <PanelLeftCloseIcon className="size-5" />
          ) : (
            <PanelLeftOpenIcon className="size-5" />
          )}
        </Button>
        <h2 className="text-xl font-mono">Markly</h2>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setDevbarOpen(!devbarOpen)}
      >
        Toggle Devbar
      </Button>
    </header>
  );
}
