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

## Working principles

KISS: every solution proposed, discussed or implemented is the simplest one that works. Avoid
overengineering, and keep designs, code, explanations and decisions clear enough for a junior
engineer to follow.

- Prefer the simpler option.
- Add comments only when necessary.
- Keep documentation concise. No emojis.
- Avoid unnecessary defensive programming.
- Follow the existing conventions of the code you are changing.
- Avoid unrelated changes.

## Code quality

For requests to implement, fix or refactor code, load the global `code-quality` skill before
designing or editing. That standing instruction authorizes its independent `code-quality-reviewer`
subagent; use one reviewer at a time. Explanation-only or read-only investigation requests skip it.

The skill's `engineering-guide.md` holds the detailed design criteria, review evidence and completion
gates. Read it on demand, and keep any stricter project contract or verification rule above it.
Reuse planning evidence the project already has instead of duplicating it.

Behavior changes need RED-GREEN-REFACTOR; behavior-preserving refactors need characterization before
the edit. Passing tests and self-review do not replace an independent review. Never report completion
with valid blocking findings, unverified mandatory criteria, stale review evidence or failed
applicable checks. Never weaken criteria or tests, or change project rules, to obtain approval.

For a full review of a branch, PR or diff, use the `review-code` skill, which routes the work to the
`complete-review-*` subagents.

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
