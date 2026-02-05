import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import * as fs from 'fs'
import * as path from 'path'

// Firebase Messaging SW에 환경변수를 주입하는 플러그인
function firebaseSwPlugin(): Plugin {
  return {
    name: 'firebase-sw-env',
    writeBundle() {
      const swPath = path.resolve('dist', 'firebase-messaging-sw.js')
      if (fs.existsSync(swPath)) {
        let content = fs.readFileSync(swPath, 'utf-8')
        content = content
          .replace('__FIREBASE_API_KEY__', process.env.VITE_FIREBASE_API_KEY || '')
          .replace('__FIREBASE_AUTH_DOMAIN__', process.env.VITE_FIREBASE_AUTH_DOMAIN || '')
          .replace('__FIREBASE_PROJECT_ID__', process.env.VITE_FIREBASE_PROJECT_ID || '')
          .replace('__FIREBASE_STORAGE_BUCKET__', process.env.VITE_FIREBASE_STORAGE_BUCKET || '')
          .replace('__FIREBASE_MESSAGING_SENDER_ID__', process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '')
          .replace('__FIREBASE_APP_ID__', process.env.VITE_FIREBASE_APP_ID || '')
        fs.writeFileSync(swPath, content)
        console.log('✅ firebase-messaging-sw.js 환경변수 주입 완료')
      }
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo-192.png', 'logo-512.png'],
      manifest: {
        name: 'FC실화 - 풋살 투표 시스템',
        short_name: 'FC실화',
        description: '풋살 팀 FC실화의 투표 및 관리 시스템',
        theme_color: '#22c55e',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/logo-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/logo-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallbackDenylist: [/^\/firebase-messaging-sw\.js$/],
        // FCM Service Worker를 PWA에 통합
        importScripts: ['/firebase-messaging-sw.js'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 24시간
              }
            }
          }
        ]
      }
    }),
    firebaseSwPlugin(),
  ],
})
