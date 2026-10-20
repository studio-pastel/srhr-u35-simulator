import { defineConfig, type Plugin } from 'vite';
import { contentFiles, loadRawContent } from './scripts/lib/load-content';
import { validateContent } from './src/engine/validate';

const VIRTUAL = 'virtual:content';
const RESOLVED = '\0' + VIRTUAL;

/** content/*.yaml を検証して JSON にし、virtual:content として渡す（§2.2） */
function contentPlugin(production: boolean): Plugin {
  const allowUnverified = process.env.ALLOW_UNVERIFIED === '1';
  return {
    name: 'srhr-content',
    resolveId(id) {
      return id === VIRTUAL ? RESOLVED : undefined;
    },
    load(id) {
      if (id !== RESOLVED) return undefined;
      for (const f of contentFiles()) this.addWatchFile(f);
      const r = validateContent(loadRawContent(), { production, allowUnverified });
      if (r.errors.length || !r.content) this.error(`コンテンツ検証に失敗しました：\n${r.errors.join('\n')}`);
      const unverified = [...new Set(r.unverifiedUses.map((u) => u.statId))];
      return `export default ${JSON.stringify(r.content)};\nexport const unverifiedStats = ${JSON.stringify(unverified)};\n`;
    },
    handleHotUpdate(ctx) {
      if (ctx.file.includes('/content/')) {
        const mod = ctx.server.moduleGraph.getModuleById(RESOLVED);
        if (mod) ctx.server.moduleGraph.invalidateModule(mod);
        ctx.server.ws.send({ type: 'full-reload' });
        return [];
      }
      return undefined;
    },
  };
}

export default defineConfig(({ command }) => ({
  base: './',
  plugins: [contentPlugin(command === 'build')],
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  build: {
    target: 'es2022',
    // CSP（§13.2）の下で動くよう、インラインのスクリプト・データURIを出さない
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    sourcemap: false,
  },
}));
