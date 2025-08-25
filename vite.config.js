import { defineConfig } from 'vite'

export default defineConfig({
  // GitHub Pages用のベースパス（リポジトリ名に合わせて変更）
  base: process.env.NODE_ENV === 'production' ? '/hemenzu/' : './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // 本番ビルドの最適化
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // PWAではconsole.logを残す（デバッグ用）
        drop_debugger: true
      }
    },
    rollupOptions: {
      output: {
        // チャンクサイズの最適化
        manualChunks: {
          'pdf-lib': ['jspdf']
        }
      }
    },
    // 大きなファイルに対する警告を無効化
    chunkSizeWarningLimit: 1000,
    // PWA用の設定
    sourcemap: false, // 本番ではソースマップを無効化
    target: 'es2015' // 幅広いブラウザサポート
  },
  server: {
    port: 3000,
    host: true
  },
  // 開発時のプレビュー設定
  preview: {
    port: 4173,
    host: true
  }
})
