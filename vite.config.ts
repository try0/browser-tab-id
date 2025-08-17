import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts';
import banner from 'vite-plugin-banner';
import pkg from './package.json' assert { type: 'json' };

const isLib = process.env.BUILD_LIB === 'true';
const licenseBanner = `
/*!
 * @try0/browser-tab-id v${pkg.version}
 * (c) 2025 try0 MIT License.
 */
`.trim();

export default defineConfig({
    plugins: [
        dts({
            outDir: 'dist',
            rollupTypes: true,
        }),
        banner(licenseBanner), 
    ],
    base: "./",
    publicDir: isLib ? false : 'public',
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