---
name: Project Overview
description: Overview of the project structure, commands, and development workflow.
---

# Clinic Appointment Booking

A web application scaffolded by **Blacksmith CLI**. Check `blacksmith.config.json` at the project root for the project type (`fullstack`, `backend`, or `frontend`) and configuration.

## Project Structure

The structure depends on the project type configured in `blacksmith.config.json`:

**Fullstack** (`type: "fullstack"`) — Express backend + React frontend in subdirectories:
```
Clinic Appointment Booking/
├── backend/              # Express project
│   ├── src/
│   │   ├── config/       # env, Zod, OpenAPI registry
│   │   ├── db/           # Prisma client
│   │   ├── middleware/   # auth, validation, error handling
│   │   ├── modules/      # one folder per resource
│   │   └── utils/        # errors, pagination, tokens
│   ├── prisma/           # schema.prisma and migrations
│   └── package.json
├── frontend/             # React + Vite project
│   ├── src/
│   │   ├── api/          # API client and hooks
│   │   ├── features/     # Feature modules (auth, etc.)
│   │   ├── pages/        # Top-level pages
│   │   ├── router/       # React Router setup
│   │   └── shared/       # Shared components, hooks, utils
│   └── package.json
├── blacksmith.config.json
└── CLAUDE.md
```

**Backend-only** (`type: "backend"`) — Express project at root:
```
Clinic Appointment Booking/
├── src/
├── prisma/
├── package.json
└── blacksmith.config.json
```

**Frontend-only** (`type: "frontend"`) — React project at root:
```
Clinic Appointment Booking/
├── src/
│   ├── api/
│   ├── pages/
│   ├── router/
│   └── shared/
├── package.json
└── blacksmith.config.json
```

## Commands

| Command | Fullstack | Backend | Frontend |
|---|---|---|---|
| `blacksmith dev` | Express + Vite + sync | Express only | Vite only |
| `blacksmith sync` | Regenerate frontend types | N/A | N/A |
| `blacksmith make:resource <Name>` | Both ends | Backend only | Frontend only |
| `blacksmith build` | Both | tsc build | Vite build |
| `blacksmith eject` | Remove Blacksmith | Remove Blacksmith | Remove Blacksmith |

## Development Workflow

**Fullstack:**
1. Define the Prisma model, Zod schemas, service, and routes in the backend
2. Run `blacksmith sync` to generate TypeScript types and API client
3. Build frontend features using the generated hooks and types

**Backend-only:**
1. Define the Prisma model, Zod schemas, service, and routes
2. Run migrations and test endpoints

**Frontend-only:**
1. Build pages and components
2. Create API hooks in `src/api/hooks/` for data fetching
