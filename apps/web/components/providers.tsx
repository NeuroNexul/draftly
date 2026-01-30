"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { Button } from "@workspace/ui/components/button";
import { Moon, Sun, Monitor } from "lucide-react";

// =============================================
// THEME CONFIGURATION - Edit themes here
// =============================================
export const THEME_OPTIONS = [
  { value: "system", label: "System", icon: Monitor },
  { value: "default-light", label: "Light", icon: Sun },
  { value: "default-dark", label: "Dark", icon: Moon },
] as const;

// Extract theme values for the provider
const themeValues = THEME_OPTIONS.filter((t) => t.value !== "system").map((t) => t.value);
const themeClassMap = Object.fromEntries(themeValues.map((v) => [v, v]));

// =============================================
// Theme Switcher Component
// =============================================
export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Get current theme icon
  const CurrentIcon = THEME_OPTIONS.find((t) => t.value === theme)?.icon ?? Monitor;

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="size-8">
        <Monitor className="size-4" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8">
          <CurrentIcon className="size-4" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Select Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          {THEME_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              <option.icon className="size-4 mr-2" />
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// =============================================
// Providers Component
// =============================================
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      enableColorScheme
      themes={themeValues}
      value={themeClassMap}
    >
      {children}
    </NextThemesProvider>
  );
}
