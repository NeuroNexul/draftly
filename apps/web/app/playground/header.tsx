import { Button } from "@workspace/ui/components/button";
import { Check, Loader2, PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import React, { Dispatch, SetStateAction } from "react";
import type { SaveStatus } from "./page";
import { ThemeSwitcher } from "@/components/providers";

type Props = {
  sidebarOpen: boolean;
  setSidebarOpen: Dispatch<SetStateAction<boolean>>;
  devbarOpen: boolean;
  setDevbarOpen: Dispatch<SetStateAction<boolean>>;
  saveStatus: SaveStatus;
  showCode: boolean;
  setShowCode: Dispatch<SetStateAction<boolean>>;
};

export default function Header({
  sidebarOpen,
  setSidebarOpen,
  devbarOpen,
  setDevbarOpen,
  saveStatus,
  showCode,
  setShowCode,
}: Props) {
  return (
    <header className="h-12 w-full border-b flex items-center justify-between py-1 px-4 overflow-y-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="size-8 p-1" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <PanelLeftCloseIcon className="size-5" /> : <PanelLeftOpenIcon className="size-5" />}
        </Button>
        <h2 className="text-xl font-mono">draftly</h2>
      </div>
      <div className="flex items-center gap-2">
        {saveStatus !== "idle" && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {saveStatus === "saving" ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check className="size-3.5 text-green-500" />
                <span>Saved</span>
              </>
            )}
          </div>
        )}
        <ThemeSwitcher />
        <Button variant="outline" size="sm" onClick={() => setShowCode(!showCode)}>
          Toggle Code
        </Button>
        <Button variant="outline" size="sm" onClick={() => setDevbarOpen(!devbarOpen)}>
          Toggle Devbar
        </Button>
      </div>
    </header>
  );
}
