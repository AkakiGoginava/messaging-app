# Messaging App

This project is governed by the Stage 1 plan:

- [Project plan](docs/plans/Stage-1-Messaging-App-Plan-v1.4.md)

Stage 1 is a responsive one-to-one messaging MVP with a human-gated agent
workflow. Production deployment and all explicitly deferred features remain
outside the current scope.

Implementation should begin with the one-time setup and enablement ticket
described in the plan.

## Getting started

### Prerequisites

- Node.js 22 or later (Node.js 24 LTS is used in development; see `engines`
  in the root `package.json`).
- [pnpm](https://pnpm.io) 10 (`corepack enable` activates the version pinned
  by `packageManager` in the root `package.json`).
- [Docker](https://www.docker.com) and Docker Compose v2, for local
  PostgreSQL.

### Clean installation

From a clean checkout, install dependencies using the committed lockfile
without modifying it:

```powershell
pnpm install --frozen-lockfile
```

### Database startup

1. Copy the root environment template and adjust values if needed (the
   defaults are local-development-only placeholders, not real credentials):

   ```powershell
   Copy-Item .env.example .env
   ```

2. Start PostgreSQL and wait for it to report healthy:

   ```powershell
   pnpm db:up
   docker compose ps
   ```

3. Copy the API environment template (its default `DATABASE_URL` matches the
   `docker-compose.yml` defaults):

   ```powershell
   Copy-Item apps/api/.env.example apps/api/.env
   ```

4. Apply migrations to the running database:

   ```powershell
   pnpm migrate:deploy
   ```

Stop the database with `pnpm db:down` (add `-v` manually via
`docker compose down -v` to also remove the data volume).

### Application startup

Run both apps in development mode from the repository root:

```powershell
pnpm dev
```

- Web (Next.js): http://localhost:3000
- API (NestJS): http://localhost:3001 (`PORT` in `apps/api/.env.example`)
- API OpenAPI/Swagger document: http://localhost:3001/docs

Each app also starts independently without a database connection or
authentication configuration, for example `pnpm --filter @messaging-app/api
run start:dev`.

### Shared API types

Regenerate the shared `@messaging-app/api-types` workspace from the API's
OpenAPI document after changing any API contract:

```powershell
pnpm generate:api-types
```

### Validation commands

Run from the repository root:

| Check                      | Command                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| Formatting                 | `pnpm format:check` (`pnpm format` to fix)                                                |
| Linting                    | `pnpm lint`                                                                               |
| Strict type checking       | `pnpm typecheck`                                                                          |
| Unit/component tests       | `pnpm test`                                                                               |
| Production builds          | `pnpm build`                                                                              |
| Prisma schema validation   | `pnpm prisma:validate`                                                                    |
| Migration deployment       | `pnpm migrate:deploy`                                                                     |
| Docker Compose validation  | `docker compose config`                                                                   |
| Shared API-type generation | `pnpm generate:api-types`                                                                 |
| Agent guard regression     | `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\test_agent_guards.ps1` |

GitHub Actions runs the equivalent checks, plus a clean-database migration
deploy against a Docker Compose-managed PostgreSQL instance, on every pull
request targeting `main`.

### Common local-environment failures

- **`pnpm install --frozen-lockfile` fails with a lockfile mismatch**: a
  dependency was added without committing the updated `pnpm-lock.yaml`. Run
  `pnpm install` locally, review the lockfile diff, and commit it.
- **Prisma commands fail with a connection error**: PostgreSQL is not
  running or `DATABASE_URL` in `apps/api/.env` does not match the Docker
  Compose configuration. Run `pnpm db:up` and confirm `docker compose ps`
  shows the `postgres` service as `healthy`.
- **`docker compose up` fails to bind port 5432**: another local PostgreSQL
  instance is already using the port. Set `POSTGRES_PORT` in the root `.env`
  to a free port and update `DATABASE_URL` in `apps/api/.env` to match.
- **`pnpm generate:api-types` fails**: it boots the API's Nest application
  context without a database connection; a failure usually indicates a
  TypeScript or module-wiring error in `apps/api/src`, not a database issue.

## Setup evidence

Use the [Stage 1 setup evidence checklist](docs/setup/Stage-1-Setup-Evidence.md)
to verify GitHub, Jira, Figma, MCP, and local CLI prerequisites without treating
future implementation artifacts as setup blockers. Record direct non-secret
links or command results and mark each item `Verified`, `Pending`, or `Not
applicable yet`.

Project permissions require confirmation whenever Claude Code tries to spawn
one of the six custom agents through the `Agent` tool, including automatic
delegation. Starting Claude Code with `claude --agent <name>` remains available
because launching that command is itself an explicit user action.

Project permissions also auto-approve read-only inspection inside the project
directory, so agents do not prompt to navigate or read the codebase. This
covers `Read`, `Glob`, and `Grep`, the shell equivalents `cd`, `pwd`, `ls`,
`cat`, `head`, `tail`, `grep`, `rg`, `find`, and `wc`, the read-only Git
commands `status`, `diff`, `log`, `show`, and `rev-parse`, and their PowerShell
counterparts. Every mutating command still requires confirmation, and each
agent's scoped hook still runs on every `Edit`, `Write`, `Bash`, and
`PowerShell` call regardless of permission mode, so this changes prompting
only and never widens a role boundary. Reading `.env`, `*.pem`, and `*.key` is
denied outright to keep credentials out of transcripts; `.env.example` remains
readable.

Run the guard regression checks after changing any agent hook:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\test_agent_guards.ps1
```

## Efficient handoffs

Claude Code loads the shared project guardrails from `CLAUDE.md`, which imports
`AGENTS.md`. Agent prompts therefore contain only role-specific instructions
and consult the governing plan sections relevant to the current decision.

Every agent handoff begins with this compact artifact snapshot:

```text
Jira: KEY | status | updated timestamp | direct link
Figma: file key | node links | explicit user-approval reference
Repository: branch | base | HEAD | working-tree status | changed files
Validation: command/result summary | repository state covered
Open items: blockers, findings, and next human gate
```

When agents run sequentially in one Claude Code session, refer to the prior
handoff instead of asking the next agent to rediscover the task. Across
sessions, paste only this snapshot and the role-specific result. The receiving
agent compares markers first, reuses unchanged links and summaries, and
reinspects only changed, missing, decision-critical, or independently verified
evidence.

This does not replace independent checks: QA reruns applicable validation,
Review reads the complete diff, and Delivery refreshes approval, CI, and merge
evidence. Project-scoped subagent memory is intentionally not enabled because
it grants memory-write tools and can preserve stale conclusions across tasks.

## Figma Designer

### Role

The human-gated Figma Designer is defined in
`.claude/agents/figma-designer.md`. It reads repository context without changing
it and creates design drafts through the official Figma MCP server.

### Prerequisites

Install the official Figma plugin for Claude Code:

`claude plugin install figma@claude-plugins-official`

Restart Claude Code, enter `/mcp`, select Figma, and complete the authentication
flow. Create one Figma Design file named `Messaging App`. The user must own or
administer it, and the Figma MCP identity must have edit access. Create these
top-level pages with the exact names `Foundations`, `Flows`, and
`Responsive Screens`.

Before invoking the agent:

1. Create a section named `Agent Drafts` inside `Flows`.
2. Create a second section named `Agent Drafts` inside `Responsive Screens`.
3. Copy and retain six links: the file, all three pages, and both `Agent Drafts`
   sections.
4. For each page, right-click its page name and copy its page link.
5. For each section, right-click the section and choose **Copy link to
   selection**. Confirm that the section URL contains a `node-id`.
6. Record the links in the setup evidence checklist.

No components, variables, styles, flows, screens, or design approvals are
required during setup. The two `Agent Drafts` sections are the only places the
Figma Designer may write.

### Invocation

```text
Use the figma-designer agent to draft the Stage 1 registration and sign-in flow.

Figma target:
https://www.figma.com/design/FILE_KEY/Messaging-App?node-id=123-456

Create desktop and mobile frames inside the linked Agent Drafts section.
Include loading, validation, failed, and success states.
Do not modify anything outside the linked section.
```

### Permissions and guardrails

The agent cannot edit repository files, use the shell, access Jira, perform Git
or GitHub operations, create new Figma files, modify shared libraries or Code
Connect mappings, or approve its own designs. The guard at
`.claude/hooks/figma-designer-guard.ps1` enforces the non-Figma role boundary,
and `.claude/settings.json` requires user confirmation for general Figma canvas
operations.

Only the user may approve a draft. The Issue Analyst and Implementer must not
treat a Figma link as approved design evidence until the user has explicitly
approved it.

### Handoff

The agent labels every top-level frame as a draft, checks screenshots after
creating it, and returns direct frame links, state and viewport coverage,
accessibility and responsive specifications, open decisions, and implementation
handoff notes.

## Issue Analyst

### Role

The Issue Analyst is defined in `.claude/agents/issue-analyst.md`. It drafts
stories for user creation and assesses existing issues against the Stage 1
Definition of Ready using read-only repository and Figma access.

### Prerequisites

- Authenticate the project-scoped Atlassian Rovo and Figma MCP connections from
  `.mcp.json`.
- For `DRAFT STORY`, provide one bounded Stage 1 slice and approved Figma links
  when UI behavior is affected.
- For `ASSESS READY ISSUE`, provide one existing Jira issue key.

### Invocation

```text
Use the issue-analyst agent in DRAFT STORY mode for the Stage 1 registration,
sign-in, session, and logout slice using the approved Figma frames.
```

```text
Use the issue-analyst agent in ASSESS READY ISSUE mode for PROJECT-123.
```

### Permissions and guardrails

The analyst can inspect approved Figma frames and may post a readiness-blocker
comment only after user confirmation. It cannot create or transition Jira
issues, mark an issue Ready, or modify repository files. The user personally
reviews and creates every final Jira work item.

### Handoff

`DRAFT STORY` returns a complete user-reviewable Jira story draft.
`ASSESS READY ISSUE` returns a readiness verdict, evidence table, blocking gaps,
implementation note, and the posted or proposed Jira comment.

## Implementer

### Role

The Implementer is defined in `.claude/agents/implementer.md`. It reads the Jira
issue and approved Figma frames, then implements exactly one approved Stage 1
vertical slice with required production code, migrations, and tests.

### Prerequisites

- The user marked the Jira issue `Ready`.
- The Issue Analyst reported no readiness blocker.
- Required Figma frames are explicitly user-approved.
- The Delivery Agent prepared the existing
  `type/JIRA-KEY-short-description` branch.

### Invocation

```text
Use the implementer agent for PROJECT-123 on the existing
feature/PROJECT-123-short-description branch.
```

### Permissions and guardrails

The scoped guard in `.claude/hooks/implementer-guard.ps1` blocks work outside a
Jira-keyed feature branch, protected project-governance files, Git delivery
commands, Jira commands, publishing, direct shell-based content rewriting, and
broad destructive commands.

The Implementer works in vertically ordered increments and validates each one
before starting the next, rather than deferring all validation to the end, so
an interrupted run leaves a verified partial state.

A run can end at a turn limit the agent cannot observe, so do not rely on it to
stop and summarize on its own. Scope each invocation to a specific increment
and keep the remaining increment list outside the agent. A slice larger than
one run is resumed on the same branch with a new scope, never restarted: state
what is already on disk so the resumed run does not rebuild it, and name the
files it must not touch. After a truncated run, read the working tree to
establish real progress rather than trusting the agent's last message.

The Implementer leaves an uncommitted working tree for the QA Agent.

### Handoff

The agent returns implemented acceptance criteria, changed files and migrations,
tests, exact validation results, security considerations, and known risks. It
does not commit, push, change Jira, or open a pull request.

## QA Agent

### Role

The independent QA Agent is defined in `.claude/agents/qa.md`. It validates the
Implementer's uncommitted work, acceptance criteria, and applicable approved
Figma frames. It may add test-only coverage but cannot repair production code.

### Prerequisites

- Provide the Jira key, existing Jira-keyed branch, and Implementer handoff.
- Required Figma frames must be explicitly user-approved.
- The Implementer's uncommitted work must be present on the current branch.

### Invocation

```text
Use the qa agent to validate PROJECT-123 on the existing
feature/PROJECT-123-short-description branch using the Implementer handoff.
```

### Permissions and guardrails

The scoped guard in `.claude/hooks/qa-guard.ps1` blocks production-code and
dependency edits, delivery commands, Jira writes, publishing, governance
changes, direct shell-based file mutation, mutating formatter scripts, and broad
destructive commands. Product-code failures are returned to the Implementer
with reproducible evidence.

### Handoff

The agent returns exactly one result classification, acceptance-criteria
evidence, commands and outcomes, test-only changes, and reproducible defects or
environmental blockers.

## Review Agent

### Role

The independent Review Agent is defined in `.claude/agents/review.md`. It
performs a read-only review of a QA-passing change for correctness,
authorization, security, data isolation, regressions, scope, and
acceptance-criteria coverage.

### Prerequisites

- Provide the Jira key, existing Jira-keyed branch, Implementer handoff, and a
  QA result of `PASS`.
- Required Figma frames must be explicitly user-approved.
- Provide the pull request when one already exists.

### Invocation

```text
Use the review agent for PROJECT-123 on the existing
feature/PROJECT-123-short-description branch using the Implementer and QA
handoffs.
```

### Permissions and guardrails

The scoped guard in `.claude/hooks/review-guard.ps1` permits only read-only Git
and GitHub inspection commands. The agent cannot edit files, run tests, publish
a review, approve a PR, change Jira, or perform delivery.

### Handoff

The agent returns a passing, changes-required, or insufficient-evidence result;
blocking and non-blocking findings; acceptance-criteria coverage; security and
regression assessments; and re-review conditions.

## Delivery Agent

### Role

The Delivery Agent is defined in `.claude/agents/delivery.md`. It performs
controlled branch, commit, push, pull-request, Jira-transition, and squash-merge
actions in one explicitly requested mode: `PREPARE BRANCH`, `DRAFT PR FOR CI`,
`DELIVER PR`, or `MERGE APPROVED PR`.

### Prerequisites

- Ensure GitHub CLI is on `PATH`, both project accounts are authenticated, and
  `gh auth status` reports `akakiGoginavaAgent` as the active delivery account.
  Keep `AkakiGoginava` inactive in GitHub CLI so that account remains eligible
  to review agent-opened pull requests. Switch with
  `gh auth switch --user akakiGoginavaAgent` when needed. Restart Claude Code
  after installing GitHub CLI or changing `PATH`.
- `PREPARE BRANCH` requires a user-marked `Ready` issue, approved Figma context
  when applicable, and a passing Issue Analyst result.
- `DRAFT PR FOR CI` requires only an Implementer handoff covering the approved
  scope and a diff limited to that work.
- `DELIVER PR` requires Implementer, QA `PASS`, and Review handoffs with no
  unresolved blocking findings.
- `MERGE APPROVED PR` requires a new explicit user merge instruction and all
  current approval, CI, review, and linkage evidence.

### Invocation

```text
Use the delivery agent in PREPARE BRANCH mode for PROJECT-123.
```

```text
Use the delivery agent in DRAFT PR FOR CI mode for PROJECT-123 using the
Implementer handoff.
```

```text
Use the delivery agent in DELIVER PR mode for PROJECT-123 using the Implementer,
QA, and Review handoffs.
```

```text
Use the delivery agent in MERGE APPROVED PR mode for PROJECT-123 PR 42.
I explicitly approve this merge.
```

### Permissions and guardrails

The scoped guard in `.claude/hooks/delivery-guard.ps1` permits only narrowly
defined Git and GitHub CLI operations. It blocks file edits, direct or forced
pushes to `main`, broad staging pathspecs, pushes to a branch other than the
current Jira branch, commit pathspecs, local merges, agent approvals, automatic
merges, administrator bypasses, command chaining, and unrelated shell commands.
A squash merge always produces a separate interactive user confirmation.

`DRAFT PR FOR CI` exists because the CI workflow triggers only on
`pull_request` targeting `main` and on `push` to `main`, so a feature-branch
push produces no CI signal. Checks that cannot run on a developer machine —
container-backed integration tests, migrations, and browser and accessibility
tests — otherwise stay unexecuted until after QA and Review have already
invested effort, and a failure there forces both to repeat. Opening a draft
pull request moves that evidence earlier.

The draft mode weakens no gate. It requests no reviewer, performs no Jira
transition, and GitHub refuses to merge a draft. Only `DELIVER PR` promotes the
draft with `gh pr ready`, and it still requires QA `PASS` and a clean Review.
A green CI run is never a substitute for either.

The guard rejects newlines in a command, so a pull-request description passed
on the command line must be a single line.
The Delivery Agent opens pull requests as `akakiGoginavaAgent` and requests
`AkakiGoginava` as the human reviewer.

Project permissions in `.claude/settings.json` deny Jira issue creation and
field editing through Rovo MCP and require user confirmation before Jira
comments or transitions.

### Handoff

The agent reports the mode performed, Jira issue and branch, completed actions,
commit and PR links, verified evidence, Jira updates, blockers, and the next
required human action.
