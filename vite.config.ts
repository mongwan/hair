import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// 투표 페이지(/)와 결과 페이지(/result/) 두 개를 빌드
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        result: resolve(import.meta.dirname, 'result/index.html'),
      },
    },
  },
});
