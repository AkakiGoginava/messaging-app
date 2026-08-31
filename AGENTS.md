# Messaging App Agent Guardrails

## Project orientation

This file provides durable project context for every Codex chat started from
the repository root. Codex discovers it directly; Claude Code loads it through
`CLAUDE.md`.

Use `README.md` as the entry point for project setup, prerequisites, efficient
handoffs, and the exact example invocation for each custom agent. Follow those
invocation patterns when drafting a command for the user instead of inventing a
different format.

Keep chat-specific goals, artifact links, approval references, issue keys, and
branch names in the current prompt or handoff. Do not add temporary task state
to this file.

## Governing plan

The authoritative Stage 1 scope and workflow are defined in:

`docs/plans/Stage-1-Messaging-App-Plan.md`

For normal role work, inspect only the plan sections needed for the current
decision. Read the complete plan for setup or plan changes, and whenever scope,
architecture, or instructions are ambiguous. When another instruction
conflicts with the plan, stop and ask the user which source should prevail.

## Stage 1 boundary

Stage 1 is a responsive web application for registered users to discover one
another, create a one-to-one conversation, and exchange persistent text
messages in real time.

Do not silently introduce deferred functionality, including groups,
attachments, reactions, message editing or deletion, read receipts, typing
indicators, presence, search, push notifications, calls, blocking, moderation,
end-to-end encryption, offline/PWA support, or production deployment.

## Human gates

Only the user may:

- Approve Figma designs.
- Create final Jira work items.
- Mark a Jira item Ready.
- Approve a pull request.
- Authorize the final merge.

Missing approval is a blocker, not permission to infer approval.

GitHub delivery uses `akakiGoginavaAgent` to push feature branches and open
pull requests. The Delivery Agent must request `AkakiGoginava` as the human
reviewer. Do not open an agent-delivered pull request as `AkakiGoginava`,
because GitHub does not allow the pull-request author to approve their own
change.

Project permissions require a fresh user confirmation before any of the six
custom agents can be spawned through Claude Code's `Agent` tool. Starting a
session with `claude --agent <name>` is already an explicit user action.

## Unit of work

A Story is one vertical slice. It holds user value, the complete acceptance
criteria, and the approved Figma links. It never has a branch, a pull request,
or code of its own.

A Subtask is one functionality-scoped increment of its parent story, and it is
the unit of branch, pull request, and merge. Every agent loop runs against one
Subtask. Cite the parent story key for context instead of restating it.

A Subtask must be independently mergeable, must fit one Implementer run, and
should stay near or below roughly 400 changed lines of production code. Work
that outgrows its Subtask becomes a new Subtask; it does not expand the current
one.

After the last Subtask merges, QA verifies the parent story end to end on a
Delivery-created closeout branch cut from `main`, never on `main` itself,
before Delivery closes the story.

Not all work is a slice. Agent-workflow, tooling, and governance items live
under a standing epic as independent story-level Tasks — `Agent workflow
hardening` for what governs the agents, `Repository and CI tooling` for what
affects any contributor. They are handled directly by the user and the
orchestrating session, not by the Implementer, QA, Review, or Delivery agents,
and they have no parent story and no closeout pass.
Deferring an item there is the user's decision: report qualifying work with its
evidence, and never silently defer it or silently fix it inside an unrelated
issue.

## Role separation

Agents must operate only within their named role:

- Issue Analyst: story drafting, subtask-breakdown proposals, and readiness
  analysis with read-only code and Figma access; may add a human-confirmed Jira
  comment but cannot create, transition, or mark an issue Ready.
- Implementer: production code and required tests on an authorized feature
  branch.
- QA: subtask validation, story-closeout verification against `main`, and
  test-only changes.
- Reviewer: independent read-only review.
- Delivery: branches, commits, pushes, pull requests, Jira transitions, and
  merges after required evidence and user approval.
- Figma Designer: design artifacts only.

Do not delegate between these roles or absorb another role's responsibilities.

## Context and evidence reuse

An upstream handoff is a navigation index, not proof. Start by comparing its
artifact snapshot with current state:

- Jira: issue key, status, and updated timestamp.
- Figma: file key, node IDs or direct links, and the user's approval reference.
- Repository: branch, base and head commit, working-tree status, and
  changed-file list. The head commit is mandatory: an unanchored repository
  claim cannot be checked for decay.
- Validation: commands, result, and the repository state they covered.

Reuse unchanged summaries and direct links instead of fetching or rereading
whole artifacts. Reinspect a source when a marker is missing or changed, the
current role must independently validate it, or the source is needed for a
decision. QA must independently execute applicable checks, Review must inspect
the complete diff, and Delivery must reverify current approval and merge
evidence.

Claims decay. Anchor every claim about repository state to the commit you
observed it at, and re-verify against current head before restating it. This
applies to your own earlier findings, not only to an upstream handoff: a
finding repeated across handoffs gains the appearance of corroboration without
gaining evidence.

When you restate something you did not verify in the current turn, say where it
came from and when. Never assert provenance — that a value, comment, or
artifact derives from an approved source — unless you checked that source.

Every agent handoff must begin with the compact artifact snapshot above. Do not
paste complete Jira issues, Figma payloads, diffs, logs, or test output when a
direct link, file/line reference, command result, and concise finding suffice.
Do not spend handoff context restating the role boundary; report any attempted
or blocked out-of-role action only when it affected the result.

## Security

- Never place secrets in repository files, prompts, logs, screenshots, Jira
  comments, or Figma annotations.
- Enforce authentication, conversation membership, and cross-user data
  isolation at server boundaries.
- Do not bypass branch protection, required checks, review, or user approval.
- A permission rule in `.claude/settings.json` is keyed to a tool's fully
  qualified name, which embeds the MCP server name. It therefore constrains
  only the server names it spells out. Registering the same API under a second
  name — a different capitalization, or a user-scope duplicate of a project
  server — defeats every rule written against the first name. When adding a
  Jira or Figma rule, cover every registered spelling, and prefer removing a
  duplicate registration over mirroring rules across both.
- Report a control that does not enforce what it claims; never route around it
  quietly, and never treat its existence as proof that it works.
