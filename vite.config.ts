import vue from '@vitejs/plugin-vue'

export default {
  base: '/ffmpeg-merge/',
  plugins: [vue()],
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  build: {
    outDir: 'docs',
  }
}
