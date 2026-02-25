import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  base: "./",
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules/phaser")) {
            return "phaser";
          }
          if (id.includes("node_modules")) {
            return "vendor";
          }
        }
      }
    }
  },
});
