import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  // Relative production URLs let the built site live at a domain root or under
  // a static-hosting project path (GitHub Pages serves this repo from
  // /cipher-twins-game/) without changing application code.
  base: "./",
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html")
      }
    }
  }
});
