# Elidune UI

A React single-page application for [Elidune](https://elidune.b-612.fr), a library management system. It provides catalog access, loans, circulation, statistics, and administration in a responsive UI with light/dark themes.

**Repository:** [github.com/elidune/elidune-ui](https://github.com/elidune/elidune-ui) · **Issues:** [GitHub Issues](https://github.com/elidune/elidune-ui/issues)

## Features

### All authenticated users

- **Catalog**: Search and browse bibliographic records, with specimen (copy) availability
- **My loans**: Current loans, history, renewals
- **Events**: Library events calendar
- **Profile**: Language, theme, password, two-factor authentication (TOTP and email); trusted devices for 2FA

### Librarians

- **Users**: Account management
- **Loans & holds**: Circulation and reservations
- **Inventory**: Specimen-level management
- **Statistics**: Activity and catalog metrics
- **Cataloguing**: Create/edit bibliographic records, Z39.50 search, ISO import
- **Events**: Manage library events
- **Library**: Library information and presentation

### Administrators

- **Settings**: Loan rules and system parameters exposed by the API

## Prerequisites

- **Node.js** 20 or newer (aligned with the provided `Dockerfile`)
- **npm** 9+ (this repo ships a `package-lock.json`; use `npm ci` in CI and Docker)
- An **Elidune backend** exposing the REST API expected by this client (see [API integration](#api-integration))

## Installation

```bash
git clone https://github.com/elidune/elidune-ui.git
cd elidune-ui
npm ci
```

For local development you can use `npm install` instead of `npm ci`.

## API integration

The client uses a fixed base path **`/api/v1`** (see `src/services/api.ts`). There is no runtime-configurable API URL in the bundle: the browser must load the SPA from an origin where `/api` is routed to your Elidune API (reverse proxy or same host).

- **Development**: Vite proxies `/api` to `http://localhost:8080` (see `vite.config.ts`), so you only need the backend on port 8080 and `npm run dev`.
- **Production**: Terminate TLS and forward `/api` to the API service (the included `nginx.conf` proxies `/api` to `http://backend:8080` for Docker-style deployments).

## Getting started

### Development

```bash
npm run dev
```

The app is served at **http://localhost:3000** (see `vite.config.ts`) with HMR.

### Production build

```bash
npm run build
```

Output is in `dist/`. The build runs `tsc -b` then `vite build`.

### Preview the production build

```bash
npm run preview
```

## Project structure

```
elidune-ui/
├── public/              # Static assets
├── src/
│   ├── components/      # By domain (auth, common, items, loans, …)
│   ├── contexts/        # Auth, theme, language, library
│   ├── hooks/
│   ├── pages/
│   ├── services/        # api.ts — HTTP client
│   ├── types/
│   ├── utils/
│   ├── locales/         # i18n JSON (en, fr, de, es)
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── Dockerfile
├── nginx.conf           # Used by the Docker image (SPA + /api proxy)
├── vite.config.ts
├── package.json
└── tsconfig.json
```

## Authentication

JWT is stored in `localStorage`. Routes are gated by **account type** (see `src/types` and `App.tsx`):

| Account type   | Typical access |
|----------------|----------------|
| Guest          | Catalog-oriented access as allowed by the API |
| Reader         | Catalog, personal loans, profile |
| Librarian      | Circulation, users, stats, cataloguing tools, events, … |
| Administrator  | Librarian features plus admin settings |

## Scripts

| Command           | Description |
|-------------------|-------------|
| `npm run dev`     | Vite dev server |
| `npm run build`   | Typecheck + production build |
| `npm run preview` | Serve `dist/` locally |
| `npm run lint`    | ESLint |

## Technology stack

- React 19, TypeScript, Vite 7
- Tailwind CSS 4 (`@tailwindcss/vite`)
- React Router 7
- TanStack Query 5
- Axios, i18next, lucide-react, Recharts

## Docker

Build and run (serves the SPA on port 80; configure backend hostname in `nginx.conf` or your orchestration):

```bash
docker build -t elidune-ui .
docker run -p 8081:80 elidune-ui
```

The UI is then available at **http://localhost:8081** (map another host port if 8081 is in use).

The image builds static assets with `npm run build`; API routing is handled by nginx proxying `/api` to the backend service name expected in `nginx.conf` (e.g. `backend:8080`).

## Internationalization

UI strings are loaded from `src/locales/` for **English**, **French**, **German**, and **Spanish** (`SUPPORTED_LANGUAGES` in `src/locales/index.ts`). The detector uses local storage and the browser language.

## License

This project is licensed under the **GNU Affero General Public License v3.0 or later** (AGPL-3.0-or-later). See the [`LICENSE`](./LICENSE) file.

If you run a modified version of this software as a network service, AGPL obligations apply—see the license text and [GNU’s explanation of the Affero GPL](https://www.gnu.org/licenses/agpl-3.0.html).

## Contributing

Bug reports and pull requests are welcome via [GitHub Issues](https://github.com/elidune/elidune-ui/issues) and pull requests against this repository. Please run `npm run build` before submitting a change, and fix ESLint issues in any files you touch (`npm run lint`).
