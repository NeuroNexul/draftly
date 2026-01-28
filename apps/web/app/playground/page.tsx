"use client";

import { useState } from "react";
import { cn } from "@workspace/ui/lib/utils";
import Footer from "./footer";
import Header from "./header";
import Devbar from "./devbar";
import Sidebar from "./sidebar";

export default function Page() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [devbarOpen, setDevbarOpen] = useState(true);

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
          <Sidebar />
        </div>

        {/* Editor */}
        <div className="flex-1 h-full border-r flex items-center justify-center">
          <span className="text-muted-foreground font-mono">Editor</span>
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
      <Footer />
    </div>
  );
}
