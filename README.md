# Clinic appointment booking

Booking for one small clinic. Patients find a slot that is genuinely
free and take it themselves, the front desk sees the day at a glance,
and nobody arrives to be told their time was given to somebody else.

## What finished looks like

A stranger can open the URL, register, verify their email, book an
appointment that is genuinely free, get a reminder in time to do
something about it, and cancel it without ringing anybody. The clinic
opens their own screen and sees the day.

Finished does not mean running on a laptop. It means somebody who has
never met the person who built it can use it on the internet.

## The road map

Eight sprints. Each one makes a different part of that sentence true,
and the order is not arbitrary: take any sprint out and the sentence
stops being true.

| # | Sprint | What it makes possible |
|---|---|---|
| 1 | Getting in | Somebody can make an account and come back to it |
| 2 | The diary | A patient takes a free slot, and two cannot take the same one |
| 3 | Two sides of the desk | The clinic sees the day, a patient sees only their own |
| 4 | Changing plans | Cancelling and moving, and a freed slot going back on offer |
| 5 | Reminders people act on | Reminded in time to do something about it |
| 6 | Work that runs itself | Reminders fire with nobody pressing anything, and never twice |
| 7 | Opening the doors | A stranger signs up with an address they actually own |
| 8 | Put it where people are | It is on the internet, at its own address |

## The hard part

Two patients tapping the last Tuesday slot at the same instant. Sprint
two is where that is solved, and it is the reason this product is worth
building rather than reading about: the fix is not an `if` in a view,
and finding that out by racing your own code is the point.

## Working on it

The sprints, their briefs and the tickets under them are in Blacksmith.
Start with sprint one; each sprint opens as the one before it closes.

The reading attached to a sprint is worth opening before its first
ticket rather than after. It carries the parts a ticket deliberately
does not: what the alternatives were, and which one you are choosing
between.

## What this is built with

The whole product: an API and the screens that use it.

- **Express 5** in **TypeScript** for the API.
- **Prisma** for the models and the migrations, against the schema in `prisma/schema.prisma`.
- **Zod** for validating every request, and **zod-to-openapi** for the OpenAPI schema, served at `/api/schema/` and browsable at `/api/docs/`.
- **JWT** for authentication, in `src/modules/auth`.
- **React** with **Vite** for the dev server and the build.
- **Chakra UI** for components, and **React Router** for routes.
- **TanStack Query** for every call to the API, so caching and refetching are decided in one place.

## Setting it up

You need the CLI once: `npm install -g blacksmith-cli`.

```bash
blacksmith setup     # dependencies, Prisma client, migrations
blacksmith dev       # start it
```

The API answers on `http://localhost:8000`, and the app on `http://localhost:5173`.

Copy `backend/.env.example` to `backend/.env` before the first run. It is ignored by git and holds the JWT secret, the database URL and anything else this project should not carry in its history.

## Where the code lives

```
backend/
├── prisma/
│   └── schema.prisma    # your models, and the migrations they generate
├── src/
│   ├── config/          # environment, OpenAPI, Zod setup
│   ├── db/              # the Prisma client, made once
│   ├── middleware/      # authentication, validation, error handling
│   ├── modules/
│   │   └── auth/        # register, log in, refresh
│   ├── utils/           # errors, pagination, tokens
│   ├── app.ts           # where routes are mounted
│   └── index.ts
├── package.json
└── tsconfig.json

frontend/
└── src/
    ├── api/
    │   ├── generated/   # written by `blacksmith sync` — do not edit
    │   └── hooks/       # your queries and mutations
    ├── pages/           # one folder per page
    ├── features/        # auth, and anything else that spans pages
    ├── router/          # routes and layouts
    ├── shared/          # components and hooks used across pages
    └── styles/
```

## Day to day

| Command | What it does |
| --- | --- |
| `blacksmith dev` | Run it locally. |
| `blacksmith sync` | Regenerate the frontend API types and hooks from the backend schema. Run it after changing a Zod schema or a route. |
| `blacksmith make:resource Post` | Scaffold a Prisma model, Zod schemas, a service, a controller and routes, plus the hooks and pages that use them. |
| `blacksmith backend <command>` | Run an npm script in the backend, e.g. `blacksmith backend run migrate`. |
| `blacksmith frontend <command>` | Run an npm command in the frontend, e.g. `blacksmith frontend install axios`. |
| `blacksmith eject` | Remove Blacksmith and keep a plain Express and React project. Nothing here is a dependency on us. |
