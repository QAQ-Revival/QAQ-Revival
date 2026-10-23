import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const fromRoot = relative => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  root: fromRoot('./app/src/renderer/'),
  base: './',
  publicDir: false,
  build: {
    outDir: fromRoot('./app/out/renderer/'),
    emptyOutDir: true,
    target: 'chrome142',
    manifest: true,
    sourcemap: false,
    rolldownOptions: {
      input: {
        main: fromRoot('./app/src/renderer/index.html'),
        overlay: fromRoot('./app/src/renderer/overlay/index.html'),
        sidePanel: fromRoot('./app/src/renderer/overlay/side-panel.html')
      }
    }
  }
});
