# pxa-frontend — CLAUDE.md

## Stack & Versões

| Tecnologia | Versão | Propósito |
|---|---|---|
| Next.js | 14 (App Router) | Framework principal, SSR/SSG |
| React | 18 | UI library |
| TypeScript | 5 | Tipagem estática |
| Tailwind CSS | 3 | Estilização utility-first |
| Zustand | 4 | State management global |
| Zod | 3 | Validação de schemas |
| Canvas 2D API | nativa | Renderização pixel art |
| next-themes | latest | Dark/light mode |
| socket.io-client | 4 | WebSocket para presença real-time |
| @supabase/supabase-js | 2 | Client Supabase |

## Estrutura de Pastas

```
pxa-frontend/
├── public/
│   ├── sprites/              ← Sprite sheets dos personagens (.png)
│   ├── tiles/                ← Tilesets do escritório (.png)
│   └── fonts/                ← Fontes pixel art
├── src/
│   ├── app/                  ← App Router (Next.js 14)
│   │   ├── layout.tsx        ← Root layout (ThemeProvider, Press Start 2P font)
│   │   ├── page.tsx          ← Página principal (escritório + sidebar)
│   │   ├── globals.css       ← Tailwind + CSS vars pixel art
│   │   ├── login/page.tsx    ← Login com Discord OAuth
│   │   └── dashboard/page.tsx ← Painel admin
│   ├── components/
│   │   ├── ui/               ← Button, Modal, Input, Badge, Loading
│   │   └── canvas/           ← OfficeCanvas (componente principal do jogo)
│   ├── engine/               ← Game engine leve
│   │   ├── game-loop.ts      ← requestAnimationFrame com delta time
│   │   ├── sprite-sheet.ts   ← Carregamento de sprite sheets
│   │   ├── state-machine.ts  ← FSM dos estados do personagem
│   │   ├── pathfinding.ts    ← BFS para movimentação
│   │   ├── tilemap.ts        ← Renderer de tiles (chão, paredes)
│   │   ├── renderer.ts       ← Renderer principal (personagens, mesas, etc.)
│   │   └── types.ts          ← Tipos do engine
│   ├── hooks/                ← use-game-loop, use-canvas, use-discord-presence, use-supabase-realtime
│   ├── stores/               ← Zustand: office-store, user-store, discord-store
│   ├── lib/                  ← supabase/client, supabase/server, api, constants
│   ├── schemas/              ← Zod: member, desk, office
│   └── types/                ← discord, office, character
├── tailwind.config.ts
├── next.config.js
├── tsconfig.json
└── .env.local.example
```

## Regras de Desenvolvimento

### Componentes

1. **Nomenclatura**: PascalCase para componentes, kebab-case para arquivos
2. **Server vs Client Components**: Default é Server Component. Use `'use client'` APENAS com hooks, eventos, ou Canvas API
3. **Props**: Sempre tipar com interface dedicada no mesmo arquivo
4. **Sem prop drilling** além de 2 níveis — use Zustand store

### Estilização com Tailwind CSS

1. **Sem CSS custom** exceto para animações do Canvas
2. **Responsividade**: mobile-first com `sm:`, `md:`, `lg:`
3. **Dark mode**: via `dark:` variant, toggle com next-themes

### Botões (padrão obrigatório)

```tsx
// Variantes: 'primary' | 'secondary' | 'ghost' | 'danger'
// Tamanhos: 'sm' | 'md' | 'lg'
// primary  → bg-indigo-600 hover:bg-indigo-700 text-white
// secondary → bg-zinc-700 hover:bg-zinc-600 text-zinc-100
// ghost    → bg-transparent hover:bg-zinc-800 text-zinc-300
// danger   → bg-red-600 hover:bg-red-700 text-white
```

### Canvas e Game Engine

1. **Canvas sempre em `<canvas>` nativo** — sem bibliotecas pesadas
2. **Game loop** via `requestAnimationFrame` com delta time
3. **Sprites**: 32x32px por frame, 4 direções, 4 frames por animação
4. **Zoom**: apenas inteiro (1x, 2x, 3x, 4x) para pixel-perfect
5. **State machine** para personagens:
   ```
   idle → walking → sitting → typing (online)
                              → focused (dnd)
                  → drinking_coffee (idle)
                  → sleeping (offline)
   ```
6. **Renderização em layers**: Floor → Furniture → Characters → UI overlays

### Rotas API (Route Handlers)

- Validar body com Zod
- Retornar `NextResponse.json()` com status correto
- Tratar erros com try/catch

### Supabase no Frontend

1. **Client-side**: `createBrowserClient()`
2. **Server-side**: `createServerClient()` com cookies do Next.js
3. **Realtime**: Subscribe em `postgres_changes`
4. **Nunca expor service_role key** — apenas `anon` key

### Performance

1. **Sprites**: Preload com Image() API
2. **Canvas**: Offscreen canvas para tiles estáticos
3. **Re-renders**: Zustand selectors granulares

## Variáveis de Ambiente (.env.local)

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_WEBSOCKET_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

## Comandos

```bash
npm run dev        # Desenvolvimento (porta 3000)
npm run build      # Build de produção
npm run lint       # ESLint + TypeScript check
```
