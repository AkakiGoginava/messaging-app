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

function Test-PullRequestBodyFile {
    # A pull-request description cannot be passed inline: this guard rejects
    # newlines in a command, and the Delivery Agent has no file-writing tool.
    # `--body-file` is therefore the only way to supply the structured
    # description `DELIVER PR` requires, and its content reaches a public pull
    # request without the guard seeing it on the command line.
    #
    # Body files must live directly in one designated directory. Validating an
    # arbitrary path was tried and abandoned: every check that reasons about a
    # path string is defeated by some form the author did not anticipate --
    # traversal, a junction on an intermediate directory, a UNC path, a
    # symlink, a hardlink. Requiring the resolved parent to equal one known
    # directory closes that whole class at once, and needs no link resolution,
    # so it behaves identically on Windows PowerShell and PowerShell Core.
    #
    # A hardlink or symlink placed directly inside the directory still points
    # wherever it likes, so content inspection below is the backstop rather
    # than an extra.
    #
    # Returns $true when a validated body file was supplied, $false when the
    # command uses no body file. Blocks rather than returning on any failure.
    param(
        [string]$Command,
        [string]$WorkingDirectory,
        [string]$ProjectPath,
        [string]$IssueKey
    )

    # `-F` is the documented short alias for `--body-file`, and `gh` honours
    # the last occurrence when several are supplied. Count flags and parsed
    # values separately so an unparseable value fails closed instead of
    # silently skipping validation.
    $flagPattern = '(?i)(?<![\w-])(?:--body-file|-F)(?![\w-])'
    $valuePattern = '(?i)(?<![\w-])(?:--body-file|-F)(?:\s*=\s*|\s+)' +
        '(?:"(?<path>[^"]*)"|''(?<path>[^'']*)''|(?<path>[^\s"'']+))'

    $flagCount = ([regex]::Matches($Command, $flagPattern)).Count
    if ($flagCount -eq 0) {
        return $false
    }
    if ($flagCount -gt 1) {
        Block-Action "only one --body-file or -F may be supplied"
    }

    $valueMatches = [regex]::Matches($Command, $valuePattern)
    if ($valueMatches.Count -ne 1) {
        Block-Action "the --body-file value could not be read"
    }

    $requestedPath = $valueMatches[0].Groups["path"].Value
    if ([string]::IsNullOrWhiteSpace($requestedPath)) {
        Block-Action "the --body-file value could not be read"
    }

    $bodyDirectory = [System.IO.Path]::GetFullPath(
        [System.IO.Path]::Combine($ProjectPath, ".claude", "pr-bodies")
    )
    $bodyPath = Get-NormalizedPath -Path $requestedPath -BasePath $WorkingDirectory

    # Direct child only. A junction or symlinked directory anywhere in the
    # chain produces a different parent, so it fails here without the guard
    # needing to resolve anything.
    $parentDirectory = [System.IO.Path]::GetDirectoryName($bodyPath)
    if ([string]::IsNullOrEmpty($parentDirectory)) {
        Block-Action "the pull-request body file must live in .claude/pr-bodies"
    }
    $pathComparison = if ([System.IO.Path]::DirectorySeparatorChar -eq "\") {
        [System.StringComparison]::OrdinalIgnoreCase
    }
    else {
        [System.StringComparison]::Ordinal
    }
    if (-not [string]::Equals(
            [System.IO.Path]::GetFullPath($parentDirectory).TrimEnd("\", "/"),
            $bodyDirectory.TrimEnd("\", "/"),
            $pathComparison
        )) {
        Block-Action "the pull-request body file must live in .claude/pr-bodies"
    }

    if ([System.IO.Path]::GetExtension($bodyPath) -notin @(".md", ".txt")) {
        Block-Action "the pull-request body file must be a .md or .txt file"
    }

    if (-not (Test-Path -LiteralPath $bodyPath -PathType Leaf)) {
        Block-Action "the pull-request body file '$requestedPath' does not exist"
    }

    if ((Get-Item -LiteralPath $bodyPath).Length -gt 65536) {
        Block-Action "the pull-request body file exceeds the 64 KB limit"
    }

    $body = Get-Content -LiteralPath $bodyPath -Raw
    if ([string]::IsNullOrWhiteSpace($body)) {
        Block-Action "the pull-request body file is empty"
    }

    # High-confidence credential shapes only. Broader heuristics would flag
    # ordinary prose about authentication work and train reviewers to bypass
    # this check.
    $secretPatterns = @(
        "gh[pousr]_[A-Za-z0-9]{16,}",
        "github_pat_[A-Za-z0-9_]{20,}",
        "-----BEGIN [A-Z ]*PRIVATE KEY-----",
        "\bAKIA[0-9A-Z]{16}\b",
        "\bxox[baprs]-[A-Za-z0-9-]{10,}",
        # A URL carrying inline credentials is unambiguous whatever the file
        # is called, and catches a single-line .env that the shape check
        # below would not reach.
        "[A-Za-z][A-Za-z0-9+.-]*://[^\s:@/]+:[^\s:@/]+@"
    )
    foreach ($secretPattern in $secretPatterns) {
        if ($body -match $secretPattern) {
            Block-Action "the pull-request body file contains a credential-shaped string"
        }
    }

    # Environment-file shape, whatever the file is called. This is what stops
    # a hardlink or symlink to `.env` that sits in the right directory with the
    # right extension: no name or link check can see through those, but the
    # content still looks like an env file. Three assignments rather than one,
    # so a pull-request body that documents a couple of variables still passes.
    $assignmentLines = [regex]::Matches(
        $body,
        '(?m)^\s*(?:export\s+)?[A-Z][A-Z0-9_]{2,}\s*='
    )
    if ($assignmentLines.Count -ge 3) {
        Block-Action "the pull-request body file looks like an environment file"
    }

    $escapedIssueKey = [regex]::Escape($IssueKey)
    if ($body -notmatch "(?i)Key:\s*$escapedIssueKey\b") {
        Block-Action "the pull-request body file must include 'Key: $IssueKey'"
    }

    return $true
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

    $hasValidatedBodyFile = Test-PullRequestBodyFile `
        -Command $command `
        -WorkingDirectory $eventWorkingDirectory `
        -ProjectPath $projectPath `
        -IssueKey $issueKey

    if ($command -match "^(?i)gh(?:\.exe)?\s+pr\s+create\b") {
        $escapedIssueKey = [regex]::Escape($issueKey)
        if ($command -notmatch "(?i)--base\s+main\b") {
            Block-Action "pull requests must explicitly target '--base main'"
        }
        if ($command -notmatch "(?i)--title\s+[`"']?$escapedIssueKey(?:\s|:|-)") {
            Block-Action "pull-request title must begin with Jira key $issueKey"
        }
        if (
            -not $hasValidatedBodyFile -and
            $command -notmatch "(?i)Key:\s*$escapedIssueKey\b"
        ) {
            Block-Action "pull-request description must include 'Key: $issueKey'"
        }
    }

    if ($command -match "^(?i)gh(?:\.exe)?\s+pr\s+merge\b") {
        Request-MergeApproval
    }

    exit 0
}

Block-Action "command is not in the Delivery allowlist"
