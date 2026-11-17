import { defineConfig } from 'vite';
import { resolve } from 'path';
import { rmSync, readdirSync } from 'fs';

// public/models/a_*.glb, b_*.glb are the P1 asset comparison (?asset=a|b, assets-src/README.md): served by the dev
// server, left out of the published build (about 1 MB nobody downloads)
const dropAssetComparison = {
  name: 'drop-asset-comparison',
  apply: 'build',
  writeBundle(opts) {
    const dir = resolve(opts.dir, 'models');
    for (const f of readdirSync(dir)) if (/^[ab]_.*.glb$/.test(f)) rmSync(resolve(dir, f));
  },
};
export default defineConfig({
  base: './',
  plugins: [dropAssetComparison],
  // /api/feedback：本地开发时转给 deploy/feedback-server.mjs（PORT=3201 node deploy/feedback-server.mjs）
  server: { fs: { allow: [resolve(import.meta.dirname, '..')] }, port: 5181, proxy: { '/api': 'http://127.0.0.1:3201' } },
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
