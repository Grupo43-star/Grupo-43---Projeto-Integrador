import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    server: {
      // Libera o túnel do ngrok (qualquer subdomínio; o endereço muda a cada sessão no plano grátis)
      allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app'],
      // Em desenvolvimento, /api vai para o back (VITE_API_PROXY). Assim o navegador
      // fala só com o localhost:5173 e o CORS da API não atrapalha.
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY || 'https://reciclabairro-api.vercel.app',
          changeOrigin: true,
        },
      },
    },
  }
})
