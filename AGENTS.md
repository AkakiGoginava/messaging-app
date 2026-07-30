# Messaging App Agent Guardrails

## Governing plan

The authoritative Stage 1 scope and workflow are defined in:

`docs/plans/Stage-1-Messaging-App-Plan-v1.0.md`

Read that plan before performing project work. When another instruction
conflicts with it, stop and ask the user which source should prevail.

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

## Role separation

Agents must operate only within their named role:

- Issue Analyst: read-only readiness analysis.
- Implementer: production code and required tests on an authorized feature
  branch.
- QA: validation and test-only changes.
- Reviewer: independent read-only review.
- Delivery: branches, commits, pushes, pull requests, Jira transitions, and
  merges after required evidence and user approval.
- Figma Designer: design artifacts only.

Do not delegate between these roles or absorb another role's responsibilities.

## Security

- Never place secrets in repository files, prompts, logs, screenshots, Jira
  comments, or Figma annotations.
- Enforce authentication, conversation membership, and cross-user data
  isolation at server boundaries.
- Do not bypass branch protection, required checks, review, or user approval.
