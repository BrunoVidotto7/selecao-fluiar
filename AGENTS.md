# AGENTS.md

Seleção Fluiar: a web app where interior architects manage clients and per-room shopping lists.
The repo holds two independent apps that are not connected yet:

- `ui/nextjs/`: Next.js 15 (App Router), React 19, plain JavaScript (no TypeScript). It runs on fake
  data from `lib/data.js`. Nothing is saved and there is no authentication.
- `api/`: REST API in Java 25 and Spring Boot. Its commands, rules and boundaries are in `api/AGENTS.md`.

Before working in `ui/`, read `ui/AGENTS.md`: it has the UI commands, rules and checks. The rest of
this file is for the whole repo.

User-facing text is Brazilian Portuguese. Code, identifiers, endpoints and JSON fields are English
(the UI has a few exceptions, listed in `ui/AGENTS.md`).

## Commands

There is no root build.

## Definition of done

While iterating, run only the affected test file. Before finishing, run the checks for every app
you changed:

| Changed | Run | Expected |
| --- | --- | --- |
| `ui/` | "Before you finish" in `ui/AGENTS.md` | As listed there. |
| `api/` | "Definition of done" in `api/AGENTS.md` | As listed there. |

## Git

- Commit messages are one short imperative sentence ending with a period, like the existing
  history: `Validate the whole purchase link, not only its start.`
- There is no root `.gitignore`. Check `git status` before `git add` and never commit
  `node_modules/`, `.next/`, `api/target/` or `ui/.playwright-mcp/` (browser tool output).

## Boundaries

Ask first:

- Adding or upgrading any dependency.
- Adding a tool, language or framework (for example TypeScript, Playwright, Tailwind).

Always, when a dependency change is approved:

- Use a version published at least 7 days ago, pinned exactly. Never `latest` or open ranges.

Never:

- Commit secrets. Real values come from environment variables.
- Edit generated output: `node_modules/`, `.next/`, `api/target/`.
