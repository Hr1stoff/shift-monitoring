import { defineConfig } from 'vite'
import fs from 'fs'
import path from 'path'

export default defineConfig({
  base: './',
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    https: {
      key: fs.readFileSync(path.resolve(__dirname, 'certs/key.pem')),
      cert: fs.readFileSync(path.resolve(__dirname, 'certs/cert.pem')),
    }
  }
})
