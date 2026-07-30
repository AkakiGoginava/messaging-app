$ErrorActionPreference = "Stop"

function Block-Action {
    param([string]$Message)

    [Console]::Error.WriteLine("Delivery guard blocked this action: $Message")
    exit 2
}

function Get-NormalizedPath {
    param(
        [string]$Path,
        [string]$BasePath
    )

    if ([System.IO.Path]::IsPathRooted($Path)) {
        return [System.IO.Path]::GetFullPath($Path)
    }

    return [System.IO.Path]::GetFullPath(
        [System.IO.Path]::Combine($BasePath, $Path)
    )
}

function Get-CurrentBranch {
    param([string]$ProjectPath)

    $previousErrorPreference = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    $insideWorkTree = & git -C $ProjectPath rev-parse --is-inside-work-tree 2>$null
    $insideWorkTreeExitCode = $LASTEXITCODE
    $ErrorActionPreference = $previousErrorPreference
    if ($insideWorkTreeExitCode -ne 0 -or $insideWorkTree.Trim() -ne "true") {
        Block-Action "the project is not an initialized Git working tree"
    }

    $ErrorActionPreference = "SilentlyContinue"
    $branch = (& git -C $ProjectPath symbolic-ref --short HEAD 2>$null).Trim()
    $branchExitCode = $LASTEXITCODE
    $ErrorActionPreference = $previousErrorPreference
    if ($branchExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($branch)) {
        Block-Action "the current Git branch could not be verified"
    }

    return $branch
}

function Assert-HeadCommit {
    param([string]$ProjectPath)

    $previousErrorPreference = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    $null = & git -C $ProjectPath rev-parse --verify HEAD 2>$null
    $headExitCode = $LASTEXITCODE
    $ErrorActionPreference = $previousErrorPreference
    if ($headExitCode -ne 0) {
        Block-Action "the base branch has no established commit"
    }
}

function Test-FeatureBranch {
    param([string]$Branch)

    return $Branch -match "^(feature|fix|chore|test|docs|refactor|build|ci)/(?<key>[A-Z][A-Z0-9]+-[0-9]+)-[a-z0-9][a-z0-9-]*$"
}

function Get-BranchIssueKey {
    param([string]$Branch)

    if (-not (Test-FeatureBranch -Branch $Branch)) {
        Block-Action "current branch '$Branch' is not a Jira-keyed delivery branch"
    }

    $null = $Branch -match "^(feature|fix|chore|test|docs|refactor|build|ci)/(?<key>[A-Z][A-Z0-9]+-[0-9]+)-"
    return $Matches["key"]
}

function Request-MergeApproval {
    $output = @{
        hookSpecificOutput = @{
            hookEventName = "PreToolUse"
            permissionDecision = "ask"
            permissionDecisionReason = (
                "Explicit merge gate: confirm that you personally approved " +
                "this current PR head and want the Delivery Agent to squash-merge it now."
            )
        }
    }

    [Console]::Out.WriteLine(($output | ConvertTo-Json -Depth 5 -Compress))
    exit 0
}

$rawInput = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($rawInput)) {
    Block-Action "the hook received no tool input"
}

try {
    $event = $rawInput | ConvertFrom-Json
}
catch {
    Block-Action "the hook received invalid JSON"
}

$projectPath = Get-NormalizedPath -Path $env:CLAUDE_PROJECT_DIR -BasePath (Get-Location).Path
$eventWorkingDirectory = if ([string]::IsNullOrWhiteSpace([string]$event.cwd)) {
    $projectPath
}
else {
    Get-NormalizedPath -Path ([string]$event.cwd) -BasePath $projectPath
}

$projectPrefix = $projectPath.TrimEnd("\", "/") + [System.IO.Path]::DirectorySeparatorChar
if (
    $eventWorkingDirectory -ne $projectPath -and
    -not $eventWorkingDirectory.StartsWith(
        $projectPrefix,
        [System.StringComparison]::OrdinalIgnoreCase
    )
) {
    Block-Action "the command working directory is outside the project"
}

$toolName = [string]$event.tool_name
if ($toolName -notin @("Bash", "PowerShell")) {
    Block-Action "unexpected guarded tool '$toolName'"
}

$command = ([string]$event.tool_input.command).Trim()
if ([string]::IsNullOrWhiteSpace($command)) {
    Block-Action "$toolName did not provide a command"
}

if ($command -match "[\r\n;|<>]" -or $command -match "&&|\|\|") {
    Block-Action "run exactly one Git or GitHub command at a time without redirection or chaining"
}

if ($command -match '\$\(|`|@''|@"') {
    Block-Action "shell interpolation and generated command bodies are not allowed"
}

if ($command -notmatch "^(?i)(git|gh)(?:\.exe)?\s+") {
    Block-Action "Delivery shell access is limited to Git and GitHub CLI"
}

$blockedPatterns = @(
    "(?i)^git(?:\.exe)?\s+(init|merge|rebase|reset|clean|cherry-pick|revert|tag|checkout|worktree)\b",
    "(?i)^git(?:\.exe)?\s+remote\s+(add|remove|rename|set-url|prune)\b",
    "(?i)^git(?:\.exe)?\s+commit\b[^\r\n]*(--amend|--fixup|--squash|--no-verify|-a\b|--all\b)",
    "(?i)^git(?:\.exe)?\s+push\b[^\r\n]*(--force|-f\b|--mirror|--delete|--no-verify)",
    "(?i)^git(?:\.exe)?\s+push\b[^\r\n]*(\bmain\b|\bmaster\b)",
    "(?i)^git(?:\.exe)?\s+branch\b",
    "(?i)^gh(?:\.exe)?\s+(api|secret|variable|workflow|release|gist|codespace)\b",
    "(?i)^gh(?:\.exe)?\s+repo\s+(create|delete|archive|rename|fork|sync)\b",
    "(?i)^gh(?:\.exe)?\s+pr\s+(review|close|reopen)\b",
    "(?i)^gh(?:\.exe)?\s+pr\s+create\b[^\r\n]*--head\s+(main|master)\b",
    "(?i)^gh(?:\.exe)?\s+pr\s+merge\b[^\r\n]*(--admin|--auto|-a\b)",
    "(?i)^gh(?:\.exe)?\s+pr\s+merge\b(?![^\r\n]*--squash)",
    "(?i)^gh(?:\.exe)?\s+[^\r\n]*--repo\b"
)

foreach ($pattern in $blockedPatterns) {
    if ($command -match $pattern) {
        Block-Action "the Git or GitHub command crosses the Delivery role boundary"
    }
}

$readOnlyGitPattern = "^(?i)git(?:\.exe)?\s+(status|diff|log|show|rev-parse|ls-remote)\b"
$remoteReadPattern = "^(?i)git(?:\.exe)?\s+remote(?:\s*$|\s+(-v|show|get-url)\b)"
$synchronizationPattern = "^(?i)git(?:\.exe)?\s+fetch\s+origin\s*$"
$fastForwardPullPattern = "^(?i)git(?:\.exe)?\s+pull\b[^\r\n]*--ff-only\b"
$switchMainPattern = "^(?i)git(?:\.exe)?\s+switch\s+(main|master)\s*$"
$switchFeaturePattern = "^(?i)git(?:\.exe)?\s+switch\s+(feature|fix|chore|test|docs|refactor|build|ci)/[A-Z][A-Z0-9]+-[0-9]+-[a-z0-9][a-z0-9-]*\s*$"
$createBranchPattern = "^(?i)git(?:\.exe)?\s+switch\s+-c\s+(feature|fix|chore|test|docs|refactor|build|ci)/[A-Z][A-Z0-9]+-[0-9]+-[a-z0-9][a-z0-9-]*\s*$"
$featureMutationPattern = "^(?i)git(?:\.exe)?\s+(add|commit|push)\b"
$readOnlyGitHubPattern = "^(?i)gh(?:\.exe)?\s+(auth\s+status|repo\s+view|run\s+(list|view|watch)|pr\s+(view|status|checks|diff|list))\b"
$pullRequestWritePattern = "^(?i)gh(?:\.exe)?\s+pr\s+(create|edit|ready|merge)\b"

if (
    $command -match $readOnlyGitPattern -or
    $command -match $remoteReadPattern -or
    $command -match $synchronizationPattern -or
    $command -match $switchMainPattern -or
    $command -match $readOnlyGitHubPattern
) {
    $null = Get-CurrentBranch -ProjectPath $projectPath
    exit 0
}

if ($command -match $switchFeaturePattern) {
    $null = Get-CurrentBranch -ProjectPath $projectPath
    Assert-HeadCommit -ProjectPath $projectPath
    exit 0
}

if ($command -match $createBranchPattern) {
    $branch = Get-CurrentBranch -ProjectPath $projectPath
    if ($branch -notin @("main", "master")) {
        Block-Action "new Jira branches may be created only from the base branch"
    }
    Assert-HeadCommit -ProjectPath $projectPath
    exit 0
}

if ($command -match $fastForwardPullPattern) {
    $branch = Get-CurrentBranch -ProjectPath $projectPath
    if ($branch -notin @("main", "master")) {
        Block-Action "fast-forward pull is allowed only on the base branch"
    }
    exit 0
}

if ($command -match $featureMutationPattern) {
    $branch = Get-CurrentBranch -ProjectPath $projectPath
    $issueKey = Get-BranchIssueKey -Branch $branch

    if ($command -match "^(?i)git(?:\.exe)?\s+add\b") {
        $addMatch = [regex]::Match(
            $command,
            "^(?i)git(?:\.exe)?\s+add\s+--\s+(?<paths>.+)$"
        )
        if (-not $addMatch.Success) {
            Block-Action "stage explicit approved paths using 'git add -- <paths>'"
        }

        $pathArguments = $addMatch.Groups["paths"].Value.Trim()
        if (
            $pathArguments -match "(^|\s)(?:\.|:/|-A|--all)(?:\s|$)" -or
            $pathArguments -match "[*?\[\]]" -or
            $pathArguments -match "(^|\s)--(?:\s|$)"
        ) {
            Block-Action "broad pathspecs are not allowed; name each approved path explicitly"
        }
    }

    if ($command -match "^(?i)git(?:\.exe)?\s+commit\b") {
        $escapedIssueKey = [regex]::Escape($issueKey)
        if ($command -notmatch "(?i)\s-m\s+[`"']?$escapedIssueKey(?:\s|:|-)") {
            Block-Action "commit title must begin with Jira key $issueKey"
        }
        if ($command -match "\s--\s+\S") {
            Block-Action "commit only the explicitly staged index; commit pathspecs are not allowed"
        }

        $stagedPaths = @(& git -C $projectPath diff --cached --name-only)
        if ($LASTEXITCODE -ne 0 -or $stagedPaths.Count -eq 0) {
            Block-Action "a Delivery commit requires explicitly staged approved changes"
        }

        $sensitivePathPattern = "(?i)(^|/)\.env($|\.)|\.(pem|key|p12|pfx)$"
        foreach ($stagedPath in $stagedPaths) {
            if ($stagedPath.Replace("\", "/") -match $sensitivePathPattern) {
                Block-Action "staged sensitive path '$stagedPath' cannot be committed"
            }
        }
    }

    if ($command -match "^(?i)git(?:\.exe)?\s+push\b") {
        $escapedBranch = [regex]::Escape($branch)
        $allowedPushPatterns = @(
            "^(?i)git(?:\.exe)?\s+push\s*$",
            "^(?i)git(?:\.exe)?\s+push\s+origin\s+$escapedBranch\s*$",
            "^(?i)git(?:\.exe)?\s+push\s+(?:-u|--set-upstream)\s+origin\s+$escapedBranch\s*$"
        )

        $isAllowedPush = $false
        foreach ($pattern in $allowedPushPatterns) {
            if ($command -match $pattern) {
                $isAllowedPush = $true
                break
            }
        }

        if (-not $isAllowedPush) {
            Block-Action "push only the current Jira branch to its matching origin branch"
        }
    }

    exit 0
}

if ($command -match $pullRequestWritePattern) {
    $branch = Get-CurrentBranch -ProjectPath $projectPath
    $issueKey = Get-BranchIssueKey -Branch $branch

    if (
        $command -match "^(?i)gh(?:\.exe)?\s+pr\s+(edit|ready|merge)\s+" -and
        $command -notmatch "^(?i)gh(?:\.exe)?\s+pr\s+(edit|ready|merge)\s+-"
    ) {
        Block-Action (
            "mutate only the pull request associated with the current Jira branch; " +
            "explicit PR identifiers are not allowed"
        )
    }

    if ($command -match "^(?i)gh(?:\.exe)?\s+pr\s+create\b") {
        $escapedIssueKey = [regex]::Escape($issueKey)
        if ($command -notmatch "(?i)--base\s+main\b") {
            Block-Action "pull requests must explicitly target '--base main'"
        }
        if ($command -notmatch "(?i)--title\s+[`"']?$escapedIssueKey(?:\s|:|-)") {
            Block-Action "pull-request title must begin with Jira key $issueKey"
        }
        if ($command -notmatch "(?i)Key:\s*$escapedIssueKey\b") {
            Block-Action "pull-request description must include 'Key: $issueKey'"
        }
    }

    if ($command -match "^(?i)gh(?:\.exe)?\s+pr\s+merge\b") {
        Request-MergeApproval
    }

    exit 0
}

Block-Action "command is not in the Delivery allowlist"
