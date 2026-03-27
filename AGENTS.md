# AGENTS.md — elidune-ui

Library management SPA (Elidune) built with React 19 + TypeScript + Vite.

## Stack

| Layer | Technology |
|-------|------------|
| Framework | React 19, TypeScript ~5.9 |
| Build | Vite 7, `tsc -b && vite build` |
| Styling | Tailwind CSS v4 (via `@tailwindcss/vite`) |
| Routing | React Router v7 |
| Server state | TanStack React Query v5 (`staleTime: 5 min, retry: 1`) |
| HTTP | Axios — single `ApiService` class in `src/services/api.ts` |
| i18n | i18next + react-i18next — French locale in `src/locales/fr/translation.json` |
| Icons | lucide-react |
| Charts | Recharts |
| Lint | ESLint 9 (`rtk lint`) |

## Project structure

```
src/
  App.tsx               # Root — providers + routes
  services/api.ts       # Single ApiService class (all API calls)
  types/index.ts        # All shared types + permission helpers
  contexts/             # AuthContext, ThemeContext, LanguageContext, LibraryContext
  pages/                # One file per page (large files are normal here)
  components/           # Organized by domain: auth/ common/ items/ loans/ stats/ users/ specimen/
  hooks/                # Organized by domain (same structure as components)
  utils/                # apiError.ts · callNumber.ts · codeLabels.ts
  locales/fr/           # translation.json (single locale for now)
```

## Key conventions

### API calls
- All calls go through the `ApiService` singleton in `src/services/api.ts`. Never use `axios` or `fetch` directly in components or hooks.
- The base URL is `/api/v1` (proxied by Vite in dev).

### Types
- All shared types live in `src/types/index.ts`. Add new types there.
- Permission helpers (`isAdmin`, `isLibrarian`, `canManage*`) are defined in `types/index.ts` — use them, don't inline role checks.

### Route guards
Three wrappers in `App.tsx`:
- `ProtectedRoute` — requires authentication
- `LibrarianRoute` — requires `isLibrarian(account_type)`
- `AdminRoute` — requires `isAdmin(account_type)`

Role hierarchy: `Guest < Reader < Librarian < Administrator`

### i18n
- All user-visible strings must go through `useTranslation()` / `t('key')`.
- Translation keys live in `src/locales/fr/translation.json`.
- Always add the French translation when adding a new key.

### Contexts
| Context | Purpose |
|---------|---------|
| `AuthContext` | JWT token, current user, login/logout |
| `ThemeContext` | dark / light mode |
| `LanguageContext` | active locale |
| `LibraryContext` | library info (name, address…) |

### Components
- Functional components only; no class components.
- Co-locate domain logic in the matching `hooks/<domain>/` folder.
- Common UI building blocks go in `components/common/`.

## Coding Conventions
- factorize as much as possible, reuse existing code and create new factorisations on changes
- avoid multi call to same rest apis, reuse data


### Data fetching
- Use TanStack Query (`useQuery` / `useMutation`) for all server state.
- Pass the `ApiService` method directly as `queryFn`; don't duplicate fetch logic.

## Commands

```bash
pnpm dev          # Start dev server (Vite)
pnpm build        # tsc -b && vite build
rtk lint          # ESLint (token-optimised)
rtk tsc           # Type-check only (token-optimised)
```

## Important domain notes

- An **Item** is a bibliographic record; a **Specimen** is a physical copy of an item.
- `ItemShort.specimens` replaces the deprecated `nb_specimens` / `nb_available` fields.
- `MediaType` values are camelCase strings matching the server enum (e.g. `printedText`, `videoDvd`).
- `day_of_week` in schedule slots: `0 = Monday`, `6 = Sunday`.
- Loan overdue status is provided directly by the API (`is_overdue`); don't recompute it client-side.
