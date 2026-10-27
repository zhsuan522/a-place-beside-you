import { defineConfig } from 'vite';

// Local preview uses the site root; GitHub Pages serves this project under its repository path.
export default defineConfig({
  base: process.env.DEPLOY_TARGET === 'github-pages' ? '/a-place-beside-you/' : '/',
});
