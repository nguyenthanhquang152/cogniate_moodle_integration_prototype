// apps/player build (ADR-008): two browser entry files, no shared chunks.
//   dist/runtime.js  the runtime page script on the content origin (/_rt/assets/runtime.js)
//   dist/shell.js    the player shell script on the app origin (/_player/shell.js)
//   dist/runtime.css copied from public/
import { defineConfig } from 'vite';
import type { EnvironmentOptions } from 'vite';

function entry(name: 'runtime' | 'shell'): EnvironmentOptions {
  return {
    consumer: 'client',
    build: {
      emptyOutDir: name === 'runtime',
      lib: { entry: `src/${name}/main.ts`, formats: ['es'], fileName: () => `${name}.js` },
    },
  };
}

export default defineConfig({
  // Each script is served on a different origin. Bundle dependencies into each entry.
  environments: { runtime: entry('runtime'), shell: entry('shell') },
  builder: {
    async buildApp(builder) {
      for (const name of ['runtime', 'shell']) {
        const environment = builder.environments[name]!;
        // A watch rebuild must keep the other entry in the shared output folder.
        if (environment.config.build.watch) environment.config.build.emptyOutDir = false;
        await builder.build(environment);
      }
    },
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: false,
    rolldownOptions: { output: { codeSplitting: false } },
  },
});
