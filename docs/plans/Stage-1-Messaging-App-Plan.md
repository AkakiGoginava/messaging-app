# Stage 1 - Messaging MVP and Human-Gated Agent Workflow

**Version:** 1.6  
**Date:** 2026-09-03  
**Status:** Project foundation  
**Source:** User-approved direction transferred from the prior project chat

## Revision history

| Version | Date | Status | Summary |
|---|---|---|---|
| 1.6 | 2026-09-03 | Project foundation | Made work-item priority a deliberate decision recorded at creation, in every epic, with the rubric held in `AGENTS.md`; added the Jira `Priority` field to one-time setup and recorded the two Jira behaviours that make a priority claim hard to verify. |
| 1.5 | 2026-08-26 | Project foundation | Replaced the one-story-per-vertical-slice unit of delivery with Story plus functionality-scoped Subtask decomposition, moved the branch, pull-request, and merge boundary to the subtask, and added task sizing rules and a story closeout pass; introduced two scope-separated standing epics for non-slice work, handled outside the subagent loop; removed the version from the plan filename. |
| 1.4 | 2026-08-03 | Project foundation | Password policy changed to a 12-128 character minimum with at least one uppercase letter and one digit, replacing the plain 15-128 character length rule. |
| 1.3 | 2026-07-30 | Project foundation | Removed generated PDF distribution and renderer requirements; Markdown is now the sole maintained plan artifact. |
| 1.2 | 2026-07-30 | Project foundation | Defined the exact setup-phase Figma file, page, draft-section, access, and evidence-link requirements. |
| 1.1 | 2026-07-30 | Project foundation | Aligned Issue Analyst permissions with the implemented comment-only workflow, added explicit agent-invocation confirmation, and defined setup-phase evidence verification. |
| 1.0 | 2026-07-28 | Project foundation | Established the Stage 1 MVP boundary, architecture, delivery workflow, quality gates, and maintenance rules. |

## 1. Summary and MVP Boundary

Create a responsive web messaging application in which two registered users can
find each other, start a private conversation, and exchange persistent text
messages in real time.

Stage 1 is complete when every MVP story has passed automated tests, been
reviewed by the user, and been squash-merged by a Claude Code delivery agent.
Production deployment is deferred.

### Included features

- Email/password registration, sign-in, session persistence, and logout.
- Unique username for discovering another registered user.
- Username search and creation of one-to-one conversations.
- Conversation list showing participant, latest message, and timestamp.
- Paginated message history.
- Sending and receiving plain-text messages in real time.
- Pending, failed, empty, loading, and disconnected UI states.
- Responsive desktop and mobile-browser layouts.
- Basic keyboard accessibility and visible focus states.
- Authorization preventing access to conversations belonging to other users.

### Explicitly deferred

- Group conversations, attachments, reactions, edit/delete, read receipts,
  typing indicators, presence, message search, push notifications, calls,
  blocking, moderation, end-to-end encryption, offline/PWA support, and
  production deployment.

## 2. Technology and Interface Design

### Recommended stack

| Area | Stage 1 choice | Purpose |
|---|---|---|
| Languages | TypeScript and SQL | One primary language across client, API, agents, and tests |
| Runtime/package management | Current Node.js LTS, pnpm workspaces, Turborepo | Reproducible monorepo with shared scripts and caching |
| Frontend | Next.js App Router, React, Tailwind CSS, shadcn/ui | Responsive interface with accessible components |
| Client data | TanStack Query, React Hook Form, Zod | API caching, forms, and client validation without Redux |
| Backend | NestJS with its standard Express adapter | Structured modules, guards, validation, and testable services |
| Realtime | NestJS WebSocket gateway and Socket.IO | Authenticated rooms and realtime message notifications |
| Database | PostgreSQL and Prisma ORM/Migrate | Relational storage, type-safe queries, and committed migrations |
| Sessions/security | `express-session`, PostgreSQL session store, Argon2id, Helmet, Nest throttling | Revocable server-side sessions and hardened authentication |
| API contract | REST, OpenAPI via `@nestjs/swagger`, generated TypeScript types | One documented contract shared with the web client |
| Unit/component tests | Vitest and React Testing Library | Fast tests for business logic and UI states |
| API/integration tests | Nest testing utilities, Supertest, Testcontainers | Real PostgreSQL and authorization testing |
| Browser tests | Playwright and axe accessibility checks | Multi-user flows, responsive UI, and accessibility |
| Local environment | Docker Compose | Consistent PostgreSQL and full-stack startup |
| CI | GitHub Actions | Type checking, linting, tests, build, and migration validation |
| Design/tracking/version control | Figma, Jira Cloud, GitHub | Design source, work source of truth, and code source of truth |

Use stable versions available at repository initialization and commit the
lockfile; dependency upgrades occur through separate Jira items.

### Architecture and public interfaces

- Monorepo areas: `apps/web`, `apps/api`, shared generated API types, and
  end-to-end tests.
- The web application proxies HTTP and Socket.IO traffic to the API so browser
  authentication remains same-origin.
- Passwords accept 12-128 characters, require at least one uppercase letter
  and one digit, and are stored only as Argon2id hashes.
  Sessions use PostgreSQL-backed opaque cookies with `HttpOnly`, `Secure` in
  HTTPS environments, and explicit `SameSite` protection.
- Core entities: `User`, `Conversation`, `ConversationMember`, `Message`, and
  the session store.
- Direct conversations have a canonical participant-pair key with a uniqueness
  constraint, preventing duplicate conversations.
- Messages contain a client-generated idempotency key, sender, conversation,
  body, and server timestamp. Bodies are trimmed and limited to 2,000
  characters.
- REST is the only message-write path; Socket.IO broadcasts committed results.
  This avoids different persistence behavior between HTTP and realtime paths.

Minimum endpoints:

- `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`,
  `GET /auth/me`
- `GET /users?query=` for username-prefix lookup
- `GET /conversations`, `POST /conversations/direct`
- `GET /conversations/:id/messages?cursor=&limit=`
- `POST /conversations/:id/messages`
- Consistent error envelope: `{ code, message, fieldErrors? }`

Realtime events:

- `conversation.created` informs both participants about a new direct
  conversation.
- `message.created` broadcasts a committed message to authorized conversation
  members.
- Socket connections authenticate from the server-side session, validate an
  explicit origin allowlist, enforce membership, limit payload size, and close
  when the session expires or the user logs out.

The choices align with the official
[NestJS WebSocket model](https://docs.nestjs.com/websockets/gateways),
[Prisma/NestJS integration](https://docs.prisma.io/docs/guides/frameworks/nestjs),
and
[OWASP session, password, and WebSocket guidance](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html).

## 3. Agents, Services, and Guardrails

All development agents are custom Claude Code agents. The user invokes them
individually; project permissions require user confirmation before the `Agent`
tool can spawn any of the six agents. A session started with
`claude --agent <name>` is already an explicit user action. No autonomous
coordinator agent, Jira trigger, unattended daemon, or event-driven
orchestration is introduced.

This does not mean there is no orchestrator. The interactive Claude Code
session the user drives is the coordinator: it invokes the agents, judges what
they return, and delivers standing-epic items directly. It is a role with
defined boundaries, not an absence. `AGENTS.md` holds its definition under
`Coordinator`.

| Agent/service | Responsibility | Permissions and limits |
|---|---|---|
| Figma Design Agent | Draft responsive auth, conversation-list, chat, and state frames through Figma MCP | Figma write access; no Jira creation or code merge |
| Issue Analyst Agent | Draft a story for user creation, or read an existing Jira item, Figma frames, and repository to verify Definition of Ready and prepare an implementation note | Read-only for code and Figma; may add a human-confirmed Jira comment; cannot create, edit, assign, transition, or mark an issue Ready |
| Implementer Agent | Write production code, migrations, and required tests using Claude Code | Feature-branch writes only; cannot push to `main`, approve, or merge |
| QA Agent | Run unit, integration, browser, accessibility, and security scenarios; add test-only changes | May edit tests; product-code failures return to the Implementer |
| Review Agent | Independently inspect the diff for correctness, authorization, regressions, unnecessary scope, and acceptance-criteria coverage | Read-only; publishes blocking/non-blocking findings |
| Delivery Agent | Create branches, commit/push approved work, open/update PRs, update Jira, and perform the final merge | Cannot edit product code or bypass protection; merges only after explicit user approval |
| Jira Cloud | Source of truth for scope, acceptance criteria, ownership, priority, status, and decisions | User personally reviews every work item and alone marks it `Ready`; the coordinating session (see `AGENTS.md`, `Coordinator`) may create items on per-call user confirmation, setting a priority per `Work item priority` |
| Figma | Source of truth for responsive UI and state designs | User must approve frames before related work becomes Ready |
| GitHub | Repository, PRs, reviews, checks, and audit history | Protected `main`; required checks and one human approval |
| GitHub Actions | Executes deterministic quality gates | No automatic merge |
| PostgreSQL/Docker | Local persistence and isolated integration environments | No production environment in Stage 1 |

Use Claude Code's custom-agent and MCP support with the official
[Claude Code agent model](https://code.claude.com/docs/en/sub-agents),
[Figma MCP server](https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server),
and
[Atlassian Rovo MCP server](https://developer.atlassian.com/cloud/rovo-mcp/).

### Required repository protection

- Protect `main`; prohibit direct pushes, force pushes, and branch-protection
  bypass.
- Require all CI checks, resolved conversations, and one approval from the user.
- Agents cannot approve their own PRs.
- Use squash merge and automatically delete merged branches.
- No secrets in repository files, prompts, logs, screenshots, Jira comments, or
  Figma annotations.
- The Delivery Agent must stop if approval, CI, Jira linkage, or required review
  evidence is missing.

## 4. Step-by-Step Workflow

### One-time setup

1. Create the GitHub repository and enable protected-branch rules.
2. Create a Jira project with `Backlog`, `Ready`, `In Progress`, `In Review`,
   and `Done`. Add the `Priority` field to the layout of every issue type in
   use, including subtasks and epics. A team-managed project omits it by
   default, and an issue then reports `Medium` because the field is unset, not
   because anyone chose it. See `Work item priority`.
3. Create the Stage 1 Jira epic, and the two standing epics described in
   `Standing epics and non-slice work`.
4. Prepare the setup-phase Figma structure:
   - Create one Figma Design file named `Messaging App`.
   - Ensure the user owns or administers the file and the identity authenticated
     through Figma MCP has edit access.
   - Create exactly these top-level pages, preserving capitalization:
     `Foundations`, `Flows`, and `Responsive Screens`.
   - In `Flows`, create one section named `Agent Drafts`.
   - In `Responsive Screens`, create one section named `Agent Drafts`.
   - Treat both `Agent Drafts` sections as the only setup-authorized write
     targets for the Figma Design Agent. Existing content elsewhere remains
     human-owned.
   - Record six non-secret links in
     `docs/setup/Stage-1-Setup-Evidence.md`: the file, each of the three pages,
     and each of the two `Agent Drafts` sections. Page links should identify the
     selected page; section links should be copied from the selected section
     and contain a `node-id`.
   - Do not create components, variables, styles, flows, screen designs, or
     approval records merely to complete setup. Those belong to later design
     work, and file or section existence does not imply design approval.
5. Connect Claude Code to the official Figma and Atlassian MCP servers and
   authenticate GitHub CLI with least-privilege access.
6. Add the six Claude Code agent definitions, require user confirmation before
   `Agent(<name>)` tool invocation, and prohibit delegation between roles.
7. Establish the monorepo, Docker Compose environment, CI checks, issue
   template, and PR template through an initial enablement ticket.
8. Create one Jira story per vertical slice under the Stage 1 epic, then split
   each story into functionality-scoped subtasks as described in `Story and
   task decomposition`. The story is the umbrella record; the subtask is the
   unit of branch, pull request, and merge. The Stage 1 stories are:
   - Registration, sign-in, session, and logout.
   - User discovery and direct-conversation creation.
   - Conversation list and persisted message history.
   - Sending messages and idempotent persistence.
   - Realtime delivery, reconnection, and logout invalidation.
   - Responsive states, accessibility, and final security hardening.
   Create the subtasks for one story at a time, immediately before that story
   starts, so each breakdown reflects the current merged state of `main`.
9. Complete `docs/setup/Stage-1-Setup-Evidence.md` for the setup artifacts that
   exist at this phase. Mark later design, story, product, and CI evidence
   `Not applicable yet` rather than treating it as a setup blocker.

### Story and task decomposition

A story states user value and the complete acceptance criteria for one vertical
slice. It never carries a branch, a pull request, or code of its own.

A subtask delivers one functionality-scoped increment of its parent story and
carries exactly one branch, one pull request, and one merge.

Split along capability, not along architectural layer. A subtask should be a
thin vertical strip that is observable on its own. Split a single capability
into separate server and interface subtasks only when that capability alone
exceeds the limits below.

Every subtask must satisfy all of the following:

- It delivers one capability, expressible as a coherent group of the parent
  story's acceptance criteria.
- It is independently mergeable: `main` stays green, migrations apply cleanly
  to a clean database, and no production code is left unreachable except the
  behaviour the subtask itself introduces.
- It fits one Implementer run without resumption, and targets at most roughly
  400 changed lines of production code, excluding generated files, lockfiles,
  and snapshots.
- It carries its own testable acceptance criteria and required tests.

Sizing signals:

- Expect two to five subtasks per story. More than six means the story is
  really two stories.
- If an Implementer needs a second run for any reason other than QA or review
  findings, the subtask was too large. Land what is complete and move the
  remainder into a new subtask instead of extending the current one.
- Subtasks are created by the user, or by the coordinating session on per-call
  user confirmation. Only the user marks each one `Ready`.

### Work item priority

Every work item carries a priority chosen when it is created, in every epic —
the Stage 1 product epic, both standing epics, and any hardening epic alike.
The five bands and the rules attached to them are defined once, in `AGENTS.md`
under `Coordinator` → `Priority`, and are not restated here so the two
documents cannot drift apart.

Priority is a scheduling signal only. It is not one of the human gates: raising
or lowering it grants no approval, withholds none, and never substitutes for
marking an item `Ready`, approving a pull request, or authorizing a merge.

Two Jira behaviours make a priority claim harder to verify than it looks, and
both were measured in this project on 2026-09-03:

- **Create metadata does not describe what a create call accepts.**
  `getJiraIssueTypeMetaWithFields` continued to omit `priority` from the field
  list for both Task and Story after the field was added to the project layout,
  while a create call setting it succeeded. Confirm a field against a real
  write rather than concluding from metadata that one is unavailable.
- **Setting a priority that already reads `Medium` is a silent no-op.** It
  produces no changelog entry and does not move the `updated` timestamp, so an
  unset field and a deliberate `Medium` are indistinguishable through the API.
  A "every item has a priority" check therefore cannot be evidenced for the
  `Medium` band, and a report that claims otherwise is overstating what was
  observed.

State the proposed priority and its one-line reason in the same confirmation
prompt that asks the user to approve creating the item, so the priority is
approved alongside the item rather than set afterwards without review.

### Standing epics and non-slice work

Not all work is a product vertical slice. Agent-workflow hardening, repository
and CI tooling, and governance changes have no user-facing acceptance criteria
and no Figma context, and their items are mutually independent rather than
increments of one capability.

Such work lives under a standing epic that stays open for the life of the
project and receives items as they are found. Stage 1 has two, and each item
belongs to exactly one:

- `Agent workflow hardening` holds work that **governs how the agents work**:
  role definitions, the handoff contract, guard hooks, agent permissions, and
  the delivery workflow itself.
- `Repository and CI tooling` holds work that affects **any contributor**,
  human or agent: Git and line-ending configuration, package scripts, CI
  workflow behaviour, and build or test plumbing.

A standing epic differs from a story in three ways:

- Its children are Tasks at story level, not subtasks. Each is independently
  marked `Ready` and carries its own branch, pull request, and merge.
- The story layer and `Story closeout` do not apply. Unrelated tooling fixes
  share no acceptance criteria, so an end-to-end closeout pass would verify
  nothing.
- It is never completed. Stage 1 completion does not require it to be empty.

Each item still obeys the sizing rules in `Story and task decomposition`.

Admission criteria. An item belongs in a standing epic only when all of the
following hold:

- It matches the positive scope of exactly one standing epic above. Do not
  admit an item merely because it is not product code: that test admits
  everything and is how a focused epic becomes a dumping ground.
- For `Agent workflow hardening` specifically, the test is whether the fix
  *governs* the agents, not whether it *affects* them. A CI script that can
  report green on a broken branch affects every agent run, but it is a CI
  concern, not an agent control.
- It is not a Stage 1 product behaviour, and not maintenance of a product
  artifact such as a design file. Both stay under the Stage 1 epic.
- It is independently mergeable and does not depend on an unmerged product
  story.
- It is recorded with the evidence that produced it: the commit observed, the
  file and line, and the role that found it.

Execution model. Standing-epic items are handled directly by the user and the
orchestrating Claude Code session. They do not run the Implementer, QA, Review,
or Delivery agents, and the `Repeat for every Ready subtask` loop does not
apply to them.

The gates that remain are the ones that do not depend on a subagent:

- Protected `main`, required CI checks, and no bypass.
- One pull request per item, reviewed and approved by the user.
- The user authorizes every merge.
- Jira transitions and evidence recorded on the item.

This is a deliberate trade. These items are small, meta, and mostly touch
repository governance and tooling rather than product behaviour, so the agent
loop costs more than it returns. The cost is that no independent role reads the
change before the user does, and two items already in this epic exist precisely
because coordinator-authored controls looked correct until an independent role
read them. A Review pass on an individual item is at the coordinator's
discretion under `AGENTS.md`, `Independent review of coordinator work`, which
requires the judgement and its reason to be recorded. The user may also ask for
one directly; nothing here forbids it.

Scheduling and blocking:

- Work standing-epic items between stories rather than inside one, so a
  product story is not interrupted by unrelated tooling changes.
- An item that blocks a product story is marked as blocking that story and must
  merge before the story's first subtask starts.

Deferring an item into a standing epic is the user's decision, not an agent's.
An agent that finds qualifying work reports it with its evidence and stops. It
does not silently defer the item, and it does not silently fix it inside an
unrelated issue.

### Design and task preparation

1. Invoke the Figma Design Agent with the Stage 1 feature boundary.
2. Have it draft desktop and mobile-width frames for auth, conversation list,
   active chat, loading, empty, error, and disconnected states.
3. Personally review and approve or revise the designs.
4. Ask the Issue Analyst Agent to draft each Jira story with user value, scope,
   non-goals, acceptance criteria, Figma links, API/data impact, dependencies,
   and test expectations, together with a proposed subtask breakdown that
   satisfies `Story and task decomposition`. The breakdown must map every
   acceptance criterion to exactly one subtask and state the intended order.
5. Personally edit and approve the story and its subtasks, creating them or
   confirming their creation by the coordinating session. Only the user may
   mark an issue `Ready`.

### Per story, before its first subtask

1. Confirm the story has approved Figma frames covering its screens and states.
2. Review the proposed subtask breakdown against current `main`, create the
   subtasks, and mark only the first one `Ready`.
3. Record the parent story key on every subtask so downstream handoffs can cite
   the story instead of restating it.

### Repeat for every Ready subtask

This loop covers subtasks under a product story. Standing-epic Tasks are
handled directly by the user and the orchestrator instead; see `Standing epics
and non-slice work`.

1. Select one `Ready` subtask and manually invoke the Issue Analyst Agent with
   its key. It verifies readiness against the parent story rather than
   re-deriving story-level context, confirming that the subtask has testable
   acceptance criteria, bounded scope, satisfied dependencies on earlier
   subtasks, and one-PR feasibility. It comments only after user confirmation,
   stops if anything is missing, and does not transition the issue.
2. Invoke the Delivery Agent to create `type/JIRA-KEY-short-description` from
   current `main` using the subtask key, link the branch, and transition the
   subtask to `In Progress`. Transition the parent story to `In Progress` on
   its first subtask only.
3. Invoke the Implementer Agent. It reads the subtask, its parent story, and
   Figma, implements only the subtask's scope, adds migrations and tests, and
   records decisions in the PR-ready summary.
4. Invoke the QA Agent. It runs the complete affected test set and verifies the
   subtask's acceptance criteria. Test failures return to the Implementer;
   repeat until clean.
5. Invoke the Review Agent. It performs an independent read-only review,
   emphasizing authorization, session handling, WebSocket membership, data
   isolation, error states, and scope beyond the subtask.
6. Resolve blocking findings through another Implementer -> QA -> Review loop.
7. Invoke the Delivery Agent to push the branch, open a PR, link the subtask,
   its parent story, and Figma, summarize the change and evidence, and
   transition the subtask to `In Review`.
8. GitHub Actions runs all required gates. The agent may diagnose failures, but
   code corrections return to the Implementer.
9. Personally inspect code quality and either request changes or approve the
   PR.
10. For requested changes, repeat the Implementer -> QA -> Review -> Delivery
    cycle.
11. After approval, explicitly instruct the Delivery Agent to merge.
12. The Delivery Agent rechecks approval, required CI, unresolved discussions,
    and current branch state; squash-merges without bypassing protection.
13. The Delivery Agent transitions the subtask to `Done` and adds the PR, merge
    commit, and test summary. The parent story stays open.
14. Mark the next subtask `Ready` and repeat. When a merged subtask changed a
    shared interface, revalidate the remaining subtasks' scope against the new
    `main` before starting them.

### Story closeout

1. After the last subtask merges, invoke the Delivery Agent to create
   `chore/STORY-KEY-story-closeout` from current `main`. QA never validates on
   `main` directly, because the QA guard blocks work on a protected branch.
2. Invoke the QA Agent on that branch to verify the parent story's complete
   acceptance criteria end to end, including the interactions between subtasks
   that no single subtask covered.
3. Gaps in behaviour become new subtasks under the same story, never
   amendments to merged work. Missing story-level test coverage that QA adds on
   the closeout branch ships as its own reviewed pull request.
4. On a clean story acceptance pass with no test additions, delete the closeout
   branch unmerged.
5. Instruct the Delivery Agent to transition the story to `Done` with links to
   every merged PR and the closeout evidence. The story itself closes without a
   feature pull request.
6. Handle follow-up work through new Jira items rather than
   silently expanding a completed story.

## 5. Test Plan, Acceptance, and Plan Maintenance

### Mandatory automated scenarios

- Register, sign in, restore a session, log out, and reject expired or invalid
  sessions.
- Reject duplicate email/username without leaking account details.
- Prevent unauthenticated access and cross-user access to conversations or
  messages.
- Prevent unauthorized Socket.IO origins, missing sessions, and non-member room
  access.
- Start only one direct conversation for the same user pair.
- Send a message once when the same idempotency key is retried.
- Exchange messages between two isolated browser contexts and retain them after
  reload.
- Paginate message history without gaps or duplicates.
- Show pending, failed, disconnected, empty, and reconnecting states.
- Operate at representative desktop and mobile widths with keyboard-accessible
  controls.
- Apply migrations to a clean PostgreSQL database and build both applications
  successfully.

Every PR must pass formatting, linting, strict type checking, unit/component
tests, API integration tests, browser tests for affected flows, migration
validation, and production builds. Playwright supplies browser isolation,
traces, and cross-browser support as documented in its
[official testing guide](https://playwright.dev/docs/intro).

### Stage 1 completion criteria

- All listed MVP behaviors are merged through protected PRs.
- Every Jira story links to approved Figma frames, and every subtask under it
  links to exactly one merged PR.
- No critical/high security findings or unresolved blocking review comments
  remain.
- Two users can complete the full direct-message flow on desktop and mobile
  browser widths.
- Deferred features remain absent from the implementation and backlog unless
  the user creates new work.
- Open items in a standing epic do not block Stage 1 completion, except any
  item marked as blocking a product story.

### Updateable plan artifact

Maintain one authoritative deliverable:

- `docs/plans/Stage-1-Messaging-App-Plan.md` as the editable and
  distributable source.

The filename carries no version. The current version lives in the document
header and the revision history, so a version bump never renames the file or
invalidates a reference to it. Do not reintroduce a versioned filename.

Future refinements update the Markdown source, append a revision-history row,
increment the version in the header, and validate the document structure and
links. Generated PDF copies are not required or maintained.

### Assumptions

- Stage 1 targets a responsive web application and one-to-one messaging only.
- The custom backend runs on Node.js with local PostgreSQL through Docker
  Compose.
- Figma designs are agent-drafted but human-approved.
- Jira items are created by the user, or by the coordinating session on
  per-call user confirmation. The user alone marks an item `Ready` and is the
  required GitHub reviewer.
- Agents perform all implementation, validation, PR, Jira-transition, and merge
  operations after task creation.
- The user manually invokes every agent and gives the explicit merge command;
  this is the Stage 1 substitute for an *unattended* orchestrator. The
  interactive session is the coordinator; see `AGENTS.md`, `Coordinator`.
- Hosting, observability infrastructure, automated deployments, Jira-triggered
  agents, and Claude Agent for Jira are candidates for later stages.

## 6. Decision Register

| Decision | Stage 1 position |
|---|---|
| Product boundary | Responsive web, direct messaging only |
| Persistence | PostgreSQL through Prisma |
| Authentication | Revocable PostgreSQL-backed server sessions |
| Message write path | REST only; Socket.IO broadcasts committed results |
| Conversation uniqueness | Canonical participant-pair key with a database uniqueness constraint |
| Delivery control | Human-reviewed, protected, squash-merged pull requests |
| Work decomposition | Story per vertical slice; functionality-scoped subtask is the unit of branch, PR, and merge |
| Non-slice work | Two standing epics — `Agent workflow hardening` (governs the agents) and `Repository and CI tooling` (affects any contributor) — holding independent story-level Tasks; never completed and do not gate Stage 1 |
| Work item priority | Chosen at creation in every epic against the rubric in `AGENTS.md`; a scheduling signal, never a gate; parked or blocked items are `Lowest` whatever their subject matter |
| Agent orchestration | Manual invocation only; `Agent(<name>)` requires user confirmation and `claude --agent <name>` is user-started; no unattended coordinator |
| Deployment | Deferred beyond Stage 1 |

## 7. Official References

| Reference | Official URL |
|---|---|
| NestJS WebSocket gateways | [https://docs.nestjs.com/websockets/gateways](https://docs.nestjs.com/websockets/gateways) |
| Prisma with NestJS | [https://docs.prisma.io/docs/guides/frameworks/nestjs](https://docs.prisma.io/docs/guides/frameworks/nestjs) |
| OWASP WebSocket Security Cheat Sheet | [https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html) |
| OWASP Session Management Cheat Sheet | [https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) |
| OWASP Password Storage Cheat Sheet | [https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) |
| Playwright testing | [https://playwright.dev/docs/intro](https://playwright.dev/docs/intro) |
| Claude Code subagents | [https://code.claude.com/docs/en/sub-agents](https://code.claude.com/docs/en/sub-agents) |
| Claude Code permissions | [https://code.claude.com/docs/en/permissions](https://code.claude.com/docs/en/permissions) |
| Figma MCP server | [https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server](https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server) |
| Atlassian Rovo MCP server | [https://developer.atlassian.com/cloud/rovo-mcp/](https://developer.atlassian.com/cloud/rovo-mcp/) |
