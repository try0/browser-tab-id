import { defineConfig } from 'vite'

const isLib = process.env.BUILD_LIB === 'true';

export default defineConfig({
    base: "./",
    build: isLib ? {
        lib: {
            entry: 'src/main.ts',
            name: 'BrowserTabId',
            fileName: (format) => `browser-tab-id.${format}.js`,
        },
        rollupOptions: {
            output: {
                exports: 'named',
            },
        },
        target: 'es2022',
        minify: true
    }
        : {
            outDir: 'dist-demo',
            rollupOptions: {
                input: 'index.html'
            }
        }
})