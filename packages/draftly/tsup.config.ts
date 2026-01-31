import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: [
    "@codemirror/state",
    "@codemirror/view",
    "@codemirror/language",
    "@codemirror/commands",
    "@lezer/markdown",
    "@lezer/common",
    "@lezer/highlight",
  ],
});
