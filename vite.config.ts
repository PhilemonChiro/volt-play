import { defineConfig } from 'vite';

// Top-level await in main.ts needs a modern target.
export default defineConfig({ build: { target: 'es2022' } });
