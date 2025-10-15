import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  root: ".",
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html')
      }
    }
  },
  server: {
    host: "::",
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        secure: false,
      },
      '/image': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        secure: false,
      },
      '/avatars': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        secure: false,
      },
    },
    fs: {
      allow: ["./client", "./shared","server/**"],
    },
  },

  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
}));
