# Stage 1 Setup Evidence

Use this checklist during project setup. It distinguishes evidence required
now from evidence that becomes required only when designs and Jira stories are
prepared.

Do not copy credentials, tokens, private messages, personal data, or sensitive
screenshots into this file. Direct links, object identifiers, dates, and
redacted command results are sufficient.

## Evidence status

Use one of these values:

- `Verified`: inspected directly and consistent with the Stage 1 plan.
- `Pending`: required during setup but not yet complete.
- `Not applicable yet`: belongs to a later design or story-preparation step.

## GitHub

### Repository and default branch

- Status: `Verified`
- Repository URL: https://github.com/AkakiGoginava/messaging-app
- Default branch: `main`
- Verified by: Codex using the public repository page, public repository API,
  and local `origin`
- Verification date: 2026-07-30

Verify with:

```powershell
gh repo view --json nameWithOwner,url,defaultBranchRef
```

### Ruleset and pull-request controls

- Status: `Verified`
- Ruleset URL:
  https://github.com/AkakiGoginava/messaging-app/rules/19967754
- Target branches: Default branch only (`~DEFAULT_BRANCH`, currently `main`)
- Required approving reviews: 1
- Required code-owner review: Yes
- Required conversation resolution: Yes
- Force-push protection: Yes (`non_fast_forward`)
- Branch-deletion protection: Yes (`deletion`)
- Feature branches are not targeted by this ruleset, so they can be pushed
  directly and automatically deleted after merge.
- Bypass actors: None listed by the ruleset API
- Required status checks: `Not applicable yet` until CI is created
- Allowed merge methods in ruleset: Merge, squash, and rebase; the Delivery
  guard remains squash-only
- Verification date: 2026-07-30

Verify the rules that apply to `main`, rather than relying only on the ruleset
name or its active status:

```powershell
gh api repos/OWNER/REPOSITORY/rules/branches/main
```

During setup, status checks may be `Not applicable yet` until the enablement
ticket creates CI workflows. Before the first implementation PR is marked
ready for review, repeat this check and confirm every required CI check appears
in the applicable rules.

### Merge settings and ownership

- Status: `Verified`
- Squash merge enabled: Yes
- Automatic merge disabled: Yes
- Delete branch on merge enabled: Yes
- `CODEOWNERS` assigns the user: Yes; `* @akakiGoginava` on `main`
- Verification date: 2026-07-30

Verify repository merge settings:

```powershell
gh repo view --json mergeCommitAllowed,rebaseMergeAllowed,squashMergeAllowed,deleteBranchOnMerge
```

The Delivery guard requires squash merge even when GitHub exposes additional
merge methods.

## Jira

### Project and workflow

- Status: `Verified`
- Jira site URL: https://akakigoginava2808.atlassian.net
- Project key: `MA`
- Project URL: https://akakigoginava2808.atlassian.net/browse/MA
- Workflow or board URL:
  https://akakigoginava2808.atlassian.net/jira/software/projects/MA/boards/35
- Confirmed statuses: `Backlog`, `Ready`, `In Progress`, `In Review`, `Done`
- Verification date: 2026-07-30

Open the project and inspect its workflow or board configuration. Confirm the
five required statuses exist and are usable by the project. A project homepage
alone is not sufficient evidence of the workflow.

### Stage 1 epic

- Status: `Verified`
- Epic key: `MA-1`
- Epic URL: https://akakigoginava2808.atlassian.net/browse/MA-1
- Created by the user: Independently confirmed; reporter is Akaki Goginava
- Scope verification: Verified;
- Verification date: 2026-07-30

Open the epic directly and verify that it identifies the Stage 1 messaging MVP
without deferred features.

### Vertical-slice stories

- Status: `Not applicable yet`
- Project enablement—monorepo, local environment, CI, templates, and documentation: `Verified`
- Registration, sign-in, session, and logout: `Not applicable yet`
- User discovery and direct-conversation creation: `Not applicable yet`
- Conversation list and persisted message history: `Not applicable yet`
- Sending messages and idempotent persistence: `Not applicable yet`
- Realtime delivery, reconnection, and logout invalidation:
  `Not applicable yet`
- Responsive states, accessibility, and security hardening:
  `Not applicable yet`

These story keys become required only after the Issue Analyst drafts them and
the user reviews and creates the final Jira work items. Only the user may mark
them `Ready`.

For each created story, verify:

- The user created the final work item.
- Scope, non-goals, acceptance criteria, dependencies, and tests are present.
- Approved Figma links are present when UI behavior is affected.
- Jira history shows that the user marked the item `Ready`.

## Figma

### File and page structure

- Status: `Verified`
- Figma file URL:
  https://www.figma.com/design/SPnGuNbO2fWr3Aqmol3BJF/Messaging-App-%E2%80%94-Product-Design
- File key: `SPnGuNbO2fWr3Aqmol3BJF`
- `Foundations` page link:
  https://www.figma.com/design/SPnGuNbO2fWr3Aqmol3BJF/Messaging-App-%E2%80%94-Product-Design?node-id=0-1
- `Flows` page link:
  https://www.figma.com/design/SPnGuNbO2fWr3Aqmol3BJF/Messaging-App-%E2%80%94-Product-Design?node-id=1-2
- `Responsive Screens` page link:
  https://www.figma.com/design/SPnGuNbO2fWr3Aqmol3BJF/Messaging-App-%E2%80%94-Product-Design?node-id=1-3
- `Agent Drafts` section link in `Flows`:
  https://www.figma.com/design/SPnGuNbO2fWr3Aqmol3BJF/Messaging-App-%E2%80%94-Product-Design?node-id=24-2
- `Agent Drafts` section link in `Responsive Screens`:
  https://www.figma.com/design/SPnGuNbO2fWr3Aqmol3BJF/Messaging-App-%E2%80%94-Product-Design?node-id=17-2
- Verified section sizes: `Flows` 3200 x 2000; `Responsive Screens`
  5200 x 3200
- Verification method: Direct visual inspection in Figma; all three page names
  and both empty, top-level `Agent Drafts` sections were confirmed
- Verification date: 2026-07-30

Open each direct link and confirm the page or section name. When using Figma
MCP, verify the authenticated identity, file metadata, and target section
before allowing design writes. The complete setup evidence is six links: the
file, the three named pages, and the two `Agent Drafts` sections. Page links
must identify the selected page, and section links must identify the selected
section with a `node-id`.

No components, variables, styles, flows, screens, or design approval evidence
is required during setup.

### Drafts and approval

- Status: `Not applicable yet`
- Draft frame links: `Not applicable yet`
- Desktop and mobile coverage: `Not applicable yet`
- Required state coverage: `Not applicable yet`
- User approval evidence: `Not applicable yet`
- Approval date: `Not applicable yet`

A Figma link does not prove approval. Approval evidence must be an explicit
user statement tied to the listed frame links or version. Until that exists,
the Issue Analyst and Implementer must treat the designs as unapproved.

## Connected tooling

### MCP connections

- Status: `Verified`
- Atlassian connected: Yes; both configured Atlassian entries reported
  connected
- Figma connected: Yes
- Verification date: 2026-07-30

Verify with:

```powershell
claude mcp list
```

Record only connection status. Never copy authentication material.

### GitHub CLI

- Status: `Verified`
- Active delivery account: `akakiGoginavaAgent`
- Human reviewer account: `AkakiGoginava` is authenticated but inactive in
  GitHub CLI, keeping it eligible to review pull requests opened by the
  delivery account
- Git protocol: HTTPS
- Verification date: 2026-07-30

Verify with:

```powershell
gh auth status
```

Confirm `akakiGoginavaAgent` is active for branch pushes, pull-request creation,
and authorized merges. Confirm `AkakiGoginava` remains available as the human
reviewer. Do not record either token or its value.

## Agent workflow

### Definitions, invocation gates, and guards

- Status: `Verified`
- Six agent definitions present: Yes
- `CLAUDE.md` imports `AGENTS.md`: Yes
- Agent invocation confirmation configured: Yes, for all six custom agents
- Guard and configuration checks passed: Yes; all configuration checks and all
  22 guard checks passed
- Verification date: 2026-07-30

Verify locally:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\test_agent_guards.ps1
```

The check verifies the six manual invocation prompts, shared role structure,
compact artifact snapshots, restricted Atlassian tool exposure, and guarded
operations. Restart Claude Code after changing agent definitions because agents
loaded at session start do not automatically refresh.

## Setup completion decision

- Overall status: `Pending`
- Items correctly marked `Not applicable yet`: CI status checks, approved Figma
  drafts, and the six vertical-slice stories
- User review date: Pending

Setup evidence is complete when the repository controls, Jira project and epic,
Figma file structure, MCP connections, GitHub CLI identity, and six agent
definitions are verified. Product code, CI status checks, approved frames, and
vertical-slice stories may remain `Not applicable yet` until their corresponding
plan steps begin.
