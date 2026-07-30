# Messaging App

This project is governed by the Stage 1 plan:

- [Editable project plan](docs/plans/Stage-1-Messaging-App-Plan-v1.0.md)
- [Polished PDF plan](output/pdf/Stage-1-Messaging-App-Plan-v1.0.pdf)

Stage 1 is a responsive one-to-one messaging MVP with a human-gated agent
workflow. Production deployment and all explicitly deferred features remain
outside the current scope.

Implementation should begin with the one-time setup and enablement ticket
described in the plan.

## Figma Designer

The project includes a human-gated Claude Code Figma Designer at
`.claude/agents/figma-designer.md`. It reads repository context without changing
it and creates design drafts through the official Figma MCP server.

Install the official Figma plugin for Claude Code:

`claude plugin install figma@claude-plugins-official`

Restart Claude Code, enter `/mcp`, select Figma, and complete the authentication
flow. The Messaging App Figma file should contain `Foundations`, `Flows`, and
`Responsive Screens` pages as defined in the Stage 1 plan.

Before invoking the agent:

1. Open `Flows` or `Responsive Screens` in the Messaging App Figma file.
2. Create a Figma section named `Agent Drafts`.
3. Right-click the section and choose **Copy link to selection**.
4. Use that section URL as the Figma target. Prefer a URL containing a
   `node-id` over a link to the file homepage.

Example:

```text
Use the figma-designer agent to draft the Stage 1 registration and sign-in flow.

Figma target:
https://www.figma.com/design/FILE_KEY/Messaging-App?node-id=123-456

Create desktop and mobile frames inside the linked Agent Drafts section.
Include loading, validation, failed, and success states.
Do not modify anything outside the linked section.
```

The agent labels every top-level frame as a draft, checks screenshots after
creating it, and returns direct frame links and implementation handoff notes.
It cannot edit repository files, use the shell, access Jira, perform Git or
GitHub operations, create new Figma files, modify shared libraries or Code
Connect mappings, or approve its own designs. The guard at
`.claude/hooks/figma-designer-guard.ps1` enforces the non-Figma role boundary,
and `.claude/settings.json` requires user confirmation for general Figma canvas
operations.

Only the user may approve a draft. The Issue Analyst and Implementer must not
treat a Figma link as approved design evidence until the user has explicitly
approved it.

## Issue Analyst

The project includes a read-only Claude Code Issue Analyst at
`.claude/agents/issue-analyst.md`. It uses the project-scoped Atlassian Rovo MCP
configuration in `.mcp.json`.

After authenticating Atlassian in Claude Code with `/mcp`, invoke it with:

`Use the issue-analyst agent to assess PROJECT-123.`

Replace `PROJECT-123` with the Jira issue key. The analyst returns a readiness
report and a Jira comment draft but cannot modify Jira or repository files.

## Implementer

The project includes a Claude Code Implementer at
`.claude/agents/implementer.md`. It may change code and tests only on an
existing Delivery-created branch matching `type/JIRA-KEY-short-description`.

Invoke it only after the issue is Ready and the Delivery Agent has prepared the
branch:

`Use the implementer agent for PROJECT-123 on the existing feature/PROJECT-123-short-description branch.`

The scoped guard in `.claude/hooks/implementer-guard.ps1` blocks work outside a
Jira-keyed feature branch, protected project-governance files, Git delivery
commands, Jira commands, publishing, and broad destructive commands. The
Implementer leaves an uncommitted working tree for the QA Agent.

## QA Agent

The project includes an independent Claude Code QA Agent at
`.claude/agents/qa.md`. It validates the Implementer's uncommitted work on the
same Jira-keyed branch and may edit only test files and test-runner
configuration.

Invoke it with the Jira key, existing branch, and Implementer handoff:

`Use the qa agent to validate PROJECT-123 on the existing feature/PROJECT-123-short-description branch using the Implementer handoff.`

The scoped guard in `.claude/hooks/qa-guard.ps1` blocks production-code and
dependency edits, delivery commands, Jira writes, publishing, governance
changes, and broad destructive commands. Product-code failures are returned to
the Implementer with reproducible evidence.

## Delivery Agent

The project includes a Claude Code Delivery Agent at
`.claude/agents/delivery.md`. It operates in one explicitly requested mode:
`PREPARE BRANCH`, `DELIVER PR`, or `MERGE APPROVED PR`.

Examples:

- `Use the delivery agent in PREPARE BRANCH mode for PROJECT-123.`
- `Use the delivery agent in DELIVER PR mode for PROJECT-123 using the Implementer, QA, and Review handoffs.`
- `Use the delivery agent in MERGE APPROVED PR mode for PROJECT-123 PR 42. I explicitly approve this merge.`

The scoped guard in `.claude/hooks/delivery-guard.ps1` permits only narrowly
defined Git and GitHub CLI operations. It blocks file edits, direct or forced
pushes to `main`, local merges, agent approvals, automatic merges,
administrator bypasses, command chaining, and unrelated shell commands. A
squash merge always produces a separate interactive user confirmation.

Project permissions in `.claude/settings.json` deny Jira issue creation and
field editing through Rovo MCP and require user confirmation before Jira
comments or transitions.

## Review Agent

The project includes an independent read-only Claude Code Review Agent at
`.claude/agents/review.md`. It reviews a QA-passing Jira branch for correctness,
authorization, security, data isolation, regressions, unnecessary scope, and
acceptance-criteria coverage.

Invoke it with:

`Use the review agent for PROJECT-123 on the existing feature/PROJECT-123-short-description branch using the Implementer and QA handoffs.`

The scoped guard in `.claude/hooks/review-guard.ps1` permits only read-only Git
and GitHub inspection commands. The agent cannot edit files, run tests, publish
a review, approve a PR, change Jira, or perform delivery.
