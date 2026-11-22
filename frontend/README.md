# ReciclaBairro - Front-end

Interface web do sistema de reciclagem: guia de materiais, pontos de coleta, calendário da coleta seletiva, pedidos de retirada e perfil, além dos painéis da equipe (gestão da cooperativa, coletor, indicadores e administração).

Feito com **React + TypeScript + Vite**. Os dados vêm da API REST do back-end.

## Como rodar

Pré-requisito: [Node.js](https://nodejs.org/) **20.19+ ou 22.12+** (exigência do Vite). Desenvolvido com Node 24.

```bash
cd frontend
npm install
npm run dev
```

Acesse http://localhost:5173.

Sem nenhuma configuração, o front usa a API publicada (`https://reciclabairro-api.vercel.app`).

### Usar o back rodando na sua máquina

```bash
cp .env.example .env
```

No `.env`, troque `VITE_API_PROXY` para `http://localhost:3000` e reinicie o `npm run dev`.

Deixe `VITE_API_URL=/api/v1`: as chamadas passam pelo proxy do Vite, então o navegador só fala com o `localhost:5173` e o CORS da API não atrapalha. Se você colocar a URL completa da API em `VITE_API_URL`, o navegador passa a chamar a API direto e ela recusa (CORS).

## Scripts

| Comando           | O que faz                                          |
| ----------------- | -------------------------------------------------- |
| `npm run dev`     | Servidor de desenvolvimento                        |
| `npm run build`   | Verifica os tipos e gera a versão final em `dist/` |
| `npm run preview` | Serve a versão gerada pelo build (com o mesmo proxy) |
| `npm run lint`    | Analisa o código                                   |

## Estrutura

```
src/
├── components/        # Componentes reutilizáveis (endereço, mapa, janelas, painéis)
│   └── layout/        # Menu lateral, barra superior, painéis de bairros e notificações
├── context/           # Estado global (login)
├── data/usuario.ts    # Tipos da conta (usuário e endereço)
├── hooks/             # Hooks reutilizáveis
├── pages/             # Uma tela por rota, cada uma com seu .css
│   ├── equipe/        # Telas da cooperativa e do coletor
│   └── admin/         # Telas da administração
├── services/          # Chamadas à API (api.ts) e conversão dos dados do back
├── styles/global.css  # Cores, fontes e estilos base
└── utils/             # Funções auxiliares (datas, validação, agenda)
```

## Integração com o back-end

Todas as chamadas passam por `api()` em `src/services/api.ts`, que lê a URL de `VITE_API_URL`, envia o token de login no cabeçalho `Authorization` e renova a sessão quando o token vence. Cada arquivo de `src/services/` converte os campos do back (em inglês) para os tipos do front (em português).
