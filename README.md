# Elidune UI

A Modern React application for [Elidune](https://elidune.b-612.fr), a library management system. It provides catalog access, loans, circulation, statistics, and administration.

**Live demo:** [elidune.b-612.fr](https://elidune.b-612.fr/) (credentials: admin/admin)

## Features — for library teams

Elidune UI is a **single web application**: after sign-in, each user only sees features allowed by their **account type** (see [Authentication](#authentication)). The **OPAC** (online public access catalogue) is the **reader-facing** part of that same application—it is not a separate product.

### OPAC — what readers can do

**Reader** accounts (and **Guest**, when the API allows it) typically get a public-catalogue experience:

- **Search the catalogue** with free text; refine with filters (material type, audience, and so on) and optional advanced criteria (title, author, ISBN).
- **Browse discovery entry points**: **collections** and **series**, then filtered result lists.
- **Open a bibliographic record**: full metadata, links to authors and related entities, a list of **copies** with availability, call numbers, and identifiers as you configure them.
- **Place a hold** on a borrowable copy when your loan policy allows it.
- **Track their loans**: current loans, history, and **renewals** within the rules defined on the server.
- **See the library calendar** (events) and a **home** area with reminders (e.g. overdue items) and, when data is present, **library context** (including opening hours where applicable).
- **Manage their profile**: interface language, light/dark theme, password, and optionally **two-factor authentication** (authenticator app or e-mail) and trusted devices—depending on what the API exposes.

Actual permissions (guest vs reader, holds, and so on) always depend on **Elidune**; the UI only displays and triggers what the API authorizes.

### Professional tools — librarians and administrators

**Librarian** and **Administrator** accounts retain the OPAC above and add back-office capabilities:

- **Circulation**: checkout, check-in, and other desk workflows your API provides.
- **Holds**: processing queues (pickup, cancellations, and so on, per your processes).
- **Patrons**: search accounts, patron records, and staff actions the API allows.
- **Cataloguing**: create and edit bibliographic records, manage **copies** (barcodes, location, availability-related fields); delete records when business rules permit.
- **Inventory**: **inventory sessions** (optional scope, e.g. by site), **scanner** input or **batch** barcodes, scan history, and **missing** items for the session.
- **Statistics**: summary indicators, loan/return trends over time, collection metrics (e.g. by year or source), **advanced** tabs when the API supplies them.
- **Outreach and branding**: update **library information** (copy, contact, data behind hours shown to patrons) and **manage events** that appear on the reader calendar.
- **Data loading**: **Z39.50** copy-cataloguing from configured targets and **ISO 2709 (MARC)** file import as implemented on the server.

### System administration — administrators only

**Administrator** accounts open **settings** to configure what the API exposes, for example:

- **Loan** rules and **patron / material** categories (loan periods, renewals, quotas as applicable).
- Cataloguing reference data: **material types**, **sources**, **Z39.50 servers**.
- **Maintenance** (messages or mode), **audit log**, and other server-level options depending on your deployment.

Business rules (required fields, blocks, hold policy) always follow your **Elidune** configuration; this client is the front end to those rules.

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
