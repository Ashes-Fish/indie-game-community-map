import { defineConfig } from 'vite';
import { resolve } from 'path';
export default defineConfig({
  base: './',
  server: { fs: { allow: [resolve(import.meta.dirname, '..')] }, port: 5181 },
  resolve: { dedupe: ['three'] },
  optimizeDeps: {
    include: [
      'three', 'n8ao', 'postprocessing',
      'three/addons/postprocessing/EffectComposer.js', 'three/addons/postprocessing/RenderPass.js', 'three/addons/postprocessing/ShaderPass.js',
      'three/addons/postprocessing/UnrealBloomPass.js', 'three/addons/postprocessing/OutputPass.js',
      'three/addons/postprocessing/SMAAPass.js', 'three/addons/utils/BufferGeometryUtils.js',
    ],
  },
  build: { target: 'es2020', chunkSizeWarningLimit: 2000, assetsInlineLimit: 0 },
});
