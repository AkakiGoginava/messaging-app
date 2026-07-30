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

`docs/plans/Stage-1-Messaging-App-Plan-v1.3.md`

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

## Role separation

Agents must operate only within their named role:

- Issue Analyst: story drafting and readiness analysis with read-only code and
  Figma access; may add a human-confirmed Jira comment but cannot create,
  transition, or mark an issue Ready.
- Implementer: production code and required tests on an authorized feature
  branch.
- QA: validation and test-only changes.
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
- Repository: branch, base and head commit when available, working-tree status,
  and changed-file list.
- Validation: commands, result, and the repository state they covered.

Reuse unchanged summaries and direct links instead of fetching or rereading
whole artifacts. Reinspect a source when a marker is missing or changed, the
current role must independently validate it, or the source is needed for a
decision. QA must independently execute applicable checks, Review must inspect
the complete diff, and Delivery must reverify current approval and merge
evidence.

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
