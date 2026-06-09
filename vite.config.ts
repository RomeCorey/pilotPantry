import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'ingredient-api',
      configureServer(server) {
        server.middlewares.use('/api/ingredients', (req, res, next) => {
          if (req.method !== 'POST') {
            next()
            return
          }

          let body = ''
          req.on('data', (chunk) => {
            body += chunk
          })
          req.on('end', () => {
            try {
              const { categoryFile, itemKey, item } = JSON.parse(body)
              const filePath = path.resolve(
                __dirname,
                'categories',
                `${categoryFile}.json`
              )

              if (!fs.existsSync(filePath)) {
                res.statusCode = 404
                res.end(JSON.stringify({ error: 'Category file not found' }))
                return
              }

              const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
              if (data.items[itemKey]) {
                res.statusCode = 409
                res.end(
                  JSON.stringify({ error: 'Ingredient key already exists' })
                )
                return
              }

              data.items[itemKey] = item
              fs.writeFileSync(
                filePath,
                `${JSON.stringify(data, null, 2)}\n`
              )

              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: true }))
            } catch {
              res.statusCode = 500
              res.end(JSON.stringify({ error: 'Failed to save ingredient' }))
            }
          })
        })
      },
    },
  ],
})
