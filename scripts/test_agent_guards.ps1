$ErrorActionPreference = "Stop"

$projectPath = [System.IO.Path]::GetFullPath(
    (Join-Path $PSScriptRoot "..")
)
$testRootBase = [System.IO.Path]::GetFullPath(
    (Join-Path $projectPath "tmp")
)
$testRoot = [System.IO.Path]::GetFullPath(
    (Join-Path $testRootBase ("agent-guard-tests-" + [guid]::NewGuid()))
)

if (-not $testRoot.StartsWith(
    $testRootBase.TrimEnd("\", "/") + [System.IO.Path]::DirectorySeparatorChar,
    [System.StringComparison]::OrdinalIgnoreCase
)) {
    throw "Refusing to create a guard-test directory outside the project tmp directory."
}

function Get-GuardShellExecutable {
    # Guard checks are invoked in a nested PowerShell process so each guard
    # hook is exercised exactly as Claude Code would run it: a fresh process
    # fed the tool-call JSON on stdin, asserting on its real exit code and
    # stdout. `pwsh` (PowerShell Core) is the interpreter both this
    # repository's Linux CI runner and any modern PowerShell install have in
    # common, so it is preferred; `powershell.exe` (Windows PowerShell) is
    # the fallback for machines that only ship the in-box interpreter. This
    # only resolves which executable runs the nested process — it does not
    # change any guard's allow/block logic.
    # `Get-Command` can return more than one match for a bare executable
    # name when several installations share the PATH (observed on
    # ubuntu-latest: /opt/microsoft/powershell/7/pwsh, /usr/bin/pwsh, and
    # /bin/pwsh simultaneously). Without narrowing to a single result,
    # PowerShell's array-to-string coercion would join every match into one
    # space-separated (and invalid) `FileName`, so always take exactly the
    # first match.
    $pwshCommand = Get-Command -Name "pwsh" -CommandType Application `
        -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($pwshCommand) {
        return $pwshCommand.Source
    }

    $windowsPowerShellCommand = Get-Command -Name "powershell.exe" `
        -CommandType Application -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($windowsPowerShellCommand) {
        return $windowsPowerShellCommand.Source
    }

    throw (
        "No PowerShell executable (pwsh or powershell.exe) was found to " +
        "run guard checks."
    )
}

$guardShellExecutable = Get-GuardShellExecutable
$guardShellIsPwsh = (
    [System.IO.Path]::GetFileNameWithoutExtension($guardShellExecutable)
) -eq "pwsh"

function Invoke-Guard {
    param(
        [string]$Guard,
        [string]$ToolName,
        [hashtable]$ToolInput,
        [string]$Cwd = ""
    )

    $event = @{
        tool_name = $ToolName
        cwd = if ([string]::IsNullOrEmpty($Cwd)) { $testRoot } else { $Cwd }
        tool_input = $ToolInput
    } | ConvertTo-Json -Depth 6 -Compress

    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $guardShellExecutable
    # `-ExecutionPolicy` only applies to Windows PowerShell; pwsh does not
    # enforce a restrictive default policy and does not accept the flag
    # identically across platforms, so it is only added for powershell.exe.
    $executionPolicyArgs = if ($guardShellIsPwsh) { "" } else {
        "-ExecutionPolicy Bypass "
    }
    $startInfo.Arguments = (
        "-NoProfile $executionPolicyArgs-File `"$Guard`""
    )
    $startInfo.WorkingDirectory = $testRoot
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardInput = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    $previousProjectDirectory = $env:CLAUDE_PROJECT_DIR
    try {
        $env:CLAUDE_PROJECT_DIR = $testRoot
        $null = $process.Start()
        $process.StandardInput.Write($event)
        $process.StandardInput.Close()
        $stdout = $process.StandardOutput.ReadToEnd()
        $stderr = $process.StandardError.ReadToEnd()
        $process.WaitForExit()
    }
    finally {
        $env:CLAUDE_PROJECT_DIR = $previousProjectDirectory
    }

    return @{
        ExitCode = $process.ExitCode
        Stdout = $stdout
        Stderr = $stderr
    }
}

function Assert-GuardResult {
    param(
        [string]$Name,
        [hashtable]$Result,
        [bool]$ShouldAllow,
        [string]$StdoutPattern = "",
        [string]$StderrPattern = ""
    )

    # A PreToolUse hook blocks a tool call only on exit code 2. Any other
    # non-zero exit is a hook error and the command proceeds. Asserting merely
    # "not zero" therefore scores a crash as a successful block, which is how
    # a guard that died on an unexpected exception passed every check in this
    # suite while providing no protection at all. Assert the exact contract.
    if ($ShouldAllow) {
        if ($Result.ExitCode -ne 0) {
            throw (
                "$Name expected the command to be allowed (exit 0) but exit " +
                "code was $($Result.ExitCode). stderr: $($Result.Stderr)"
            )
        }
    }
    elseif ($Result.ExitCode -ne 2) {
        $detail = if ($Result.ExitCode -eq 0) {
            "the command was allowed through"
        }
        else {
            "the guard failed open: only exit 2 blocks a tool call"
        }
        throw (
            "$Name expected a block (exit 2) but exit code was " +
            "$($Result.ExitCode) -- $detail. stderr: $($Result.Stderr)"
        )
    }

    if (
        -not [string]::IsNullOrWhiteSpace($StdoutPattern) -and
        $Result.Stdout -notmatch $StdoutPattern
    ) {
        throw "$Name did not emit expected output pattern '$StdoutPattern'."
    }

    # Exit 2 alone does not identify why a guard blocked. An odd working
    # directory reaches the "outside the project" rule and exits 2 through the
    # normal path, with no exception involved -- so a fault case that only
    # checks the exit code would pass even if the trap never fired. The fault
    # cases assert the trap's own message instead of inferring it, which also
    # removes the need to reason about which platform throws where.
    if (
        -not [string]::IsNullOrWhiteSpace($StderrPattern) -and
        $Result.Stderr -notmatch $StderrPattern
    ) {
        throw (
            "$Name did not emit expected stderr pattern '$StderrPattern'. " +
            "stderr: $($Result.Stderr)"
        )
    }
}

function Assert-AgentConfiguration {
    $claudePath = Join-Path $projectPath "CLAUDE.md"
    $claudeContent = Get-Content -LiteralPath $claudePath -Raw
    if ($claudeContent -notmatch "(?m)^@AGENTS\.md\r?$") {
        throw "CLAUDE.md must import AGENTS.md."
    }

    $settingsPath = Join-Path $projectPath ".claude/settings.json"
    $settings = Get-Content -LiteralPath $settingsPath -Raw |
        ConvertFrom-Json
    $expectedAgentPrompts = @(
        "Agent(figma-designer)",
        "Agent(issue-analyst)",
        "Agent(implementer)",
        "Agent(qa)",
        "Agent(review)",
        "Agent(delivery)"
    )
    foreach ($prompt in $expectedAgentPrompts) {
        if ($prompt -notin $settings.permissions.ask) {
            throw "Project permissions must ask before '$prompt'."
        }
    }

    $agentDirectory = Join-Path $projectPath ".claude/agents"
    $agentFiles = Get-ChildItem -LiteralPath $agentDirectory -Filter "*.md"
    if ($agentFiles.Count -ne 6) {
        throw "Expected exactly six custom agent definitions."
    }

    foreach ($agentFile in $agentFiles) {
        $content = Get-Content -LiteralPath $agentFile.FullName -Raw
        foreach ($heading in @("## Role", "## Role boundary", "## Handoff")) {
            if ($content -notmatch [regex]::Escape($heading)) {
                throw "$($agentFile.Name) is missing the '$heading' section."
            }
        }

        if ($content -notmatch "shared artifact snapshot") {
            throw "$($agentFile.Name) must use the shared artifact snapshot."
        }
        if ($content -match 'Read `AGENTS\.md`') {
            throw "$($agentFile.Name) redundantly rereads loaded project instructions."
        }
        if ($content -match "(?m)^memory:\s*") {
            throw "$($agentFile.Name) must not enable persistent role memory."
        }
        $unusedAtlassianTools = (
            "mcp__atlassian__(atlassianUserInfo|" +
            "getVisibleJiraProjects|searchJiraIssuesUsingJql)"
        )
        if ($content -match $unusedAtlassianTools) {
            throw "$($agentFile.Name) exposes an unnecessary Atlassian tool."
        }
    }

    $deliveryContent = Get-Content -LiteralPath (
        Join-Path $agentDirectory "delivery.md"
    ) -Raw
    foreach ($requiredIdentity in @(
        "akakiGoginavaAgent",
        "AkakiGoginava"
    )) {
        if ($deliveryContent -notmatch [regex]::Escape($requiredIdentity)) {
            throw (
                "Delivery Agent must preserve the GitHub identity split for " +
                "'$requiredIdentity'."
            )
        }
    }

    Write-Output "All agent configuration checks passed."
}

try {
    Assert-AgentConfiguration

    $null = New-Item -ItemType Directory -Path $testRoot
    & git -C $testRoot init --initial-branch main | Out-Null
    & git -C $testRoot config user.email "guard-tests@example.invalid"
    & git -C $testRoot config user.name "Agent Guard Tests"
    Set-Content -LiteralPath (Join-Path $testRoot "seed.txt") -Value "seed"
    & git -C $testRoot add -- seed.txt
    & git -C $testRoot commit -m "MSG-1 guard test seed" | Out-Null
    & git -C $testRoot switch --quiet -c feature/MSG-1-guard-test
    $null = New-Item -ItemType Directory -Path (Join-Path $testRoot "src")
    $null = New-Item -ItemType Directory -Path (Join-Path $testRoot "tests")

    # Pull-request body-file fixtures. The credential fixture is assembled at
    # runtime so no token-shaped literal exists in this file for a secret
    # scanner to flag.
    Set-Content -LiteralPath (Join-Path $testRoot "pr-body.md") -Value (
        "Key: MSG-1`n`nScope, migrations, and rollback notes."
    )
    Set-Content -LiteralPath (Join-Path $testRoot "pr-body-no-key.md") -Value (
        "Scope, migrations, and rollback notes."
    )
    Set-Content -LiteralPath (Join-Path $testRoot "pr-body-secret.md") -Value (
        "Key: MSG-1`n`nToken " + "ghp_" + ("A" * 20)
    )
    Set-Content -LiteralPath (Join-Path $testRoot ".env") -Value (
        "Key: MSG-1`nDATABASE_URL=postgresql://user:pw@host/db"
    )


    # Hidden-attribute body files. On Unix the Hidden attribute has no effect
    # on a name that does not begin with a dot, so these two cases degrade to
    # ordinary body-file cases there rather than failing. That is acceptable --
    # the fail-open they pin is Windows-only -- but it is stated here because
    # the over-long-path cases below are gated and warned about, and silently
    # weaker coverage is the pattern this issue exists to remove.
    #
    # Test-Path returns true for these but
    # Get-Item without -Force throws, which on main exited 1 -- so the command
    # proceeded with the body wholly unvalidated: no size cap, no credential
    # scan, no Jira-key check. A hidden .md arrives by ordinary means, such as
    # a copy that carried the attribute across.
    $hiddenBodyPath = Join-Path $testRoot "pr-body-hidden.md"
    Set-Content -LiteralPath $hiddenBodyPath -Value (
        "Key: MSG-1`n`nValid description in a hidden file."
    )
    (Get-Item -LiteralPath $hiddenBodyPath -Force).Attributes = "Hidden"

    $hiddenNoKeyPath = Join-Path $testRoot "pr-body-hidden-no-key.md"
    Set-Content -LiteralPath $hiddenNoKeyPath -Value (
        "No Jira key in this hidden file."
    )
    (Get-Item -LiteralPath $hiddenNoKeyPath -Force).Attributes = "Hidden"

    $implementerGuard = Join-Path $projectPath ".claude/hooks/implementer-guard.ps1"
    $qaGuard = Join-Path $projectPath ".claude/hooks/qa-guard.ps1"
    $reviewGuard = Join-Path $projectPath ".claude/hooks/review-guard.ps1"
    $deliveryGuard = Join-Path $projectPath ".claude/hooks/delivery-guard.ps1"
    $figmaGuard = Join-Path $projectPath ".claude/hooks/figma-designer-guard.ps1"

    $cases = @(
        @{
            Name = "Implementer allows read-only Git inspection"
            Guard = $implementerGuard
            Tool = "PowerShell"
            Input = @{ command = "git status --short" }
            Allow = $true
        },
        @{
            Name = "Implementer blocks delivery push"
            Guard = $implementerGuard
            Tool = "PowerShell"
            Input = @{ command = "git push" }
            Allow = $false
        },
        @{
            Name = "Implementer blocks full-path GitHub CLI"
            Guard = $implementerGuard
            Tool = "PowerShell"
            Input = @{
                command = "& 'C:\Program Files\GitHub CLI\gh.exe' pr list"
            }
            Allow = $false
        },
        @{
            Name = "Implementer blocks shell content rewriting"
            Guard = $implementerGuard
            Tool = "PowerShell"
            Input = @{ command = "Set-Content src/app.ts value" }
            Allow = $false
        },
        @{
            Name = "Implementer allows production Edit tool path"
            Guard = $implementerGuard
            Tool = "Edit"
            Input = @{ file_path = "src/app.ts" }
            Allow = $true
        },
        @{
            Name = "Implementer blocks governance Edit tool path"
            Guard = $implementerGuard
            Tool = "Edit"
            Input = @{ file_path = "AGENTS.md" }
            Allow = $false
        },
        @{
            Name = "QA allows test Edit tool path"
            Guard = $qaGuard
            Tool = "Edit"
            Input = @{ file_path = "tests/app.spec.ts" }
            Allow = $true
        },
        @{
            Name = "QA blocks production Edit tool path"
            Guard = $qaGuard
            Tool = "Edit"
            Input = @{ file_path = "src/app.ts" }
            Allow = $false
        },
        @{
            Name = "QA blocks package installation"
            Guard = $qaGuard
            Tool = "PowerShell"
            Input = @{ command = "pnpm install" }
            Allow = $false
        },
        @{
            Name = "QA blocks full-path GitHub CLI"
            Guard = $qaGuard
            Tool = "PowerShell"
            Input = @{
                command = "& 'C:\Program Files\GitHub CLI\gh.exe' auth token"
            }
            Allow = $false
        },
        @{
            Name = "Review allows read-only diff"
            Guard = $reviewGuard
            Tool = "PowerShell"
            Input = @{ command = "git diff -- seed.txt" }
            Allow = $true
        },
        @{
            Name = "Review blocks tests"
            Guard = $reviewGuard
            Tool = "PowerShell"
            Input = @{ command = "pnpm test" }
            Allow = $false
        },
        @{
            Name = "Delivery allows origin fetch"
            Guard = $deliveryGuard
            Tool = "PowerShell"
            Input = @{ command = "git fetch origin" }
            Allow = $true
        },
        @{
            Name = "Delivery blocks arbitrary fetch"
            Guard = $deliveryGuard
            Tool = "PowerShell"
            Input = @{ command = "git fetch https://example.invalid/repository.git" }
            Allow = $false
        },
        @{
            Name = "Delivery allows explicit staging path"
            Guard = $deliveryGuard
            Tool = "PowerShell"
            Input = @{ command = "git add -- seed.txt" }
            Allow = $true
        },
        @{
            Name = "Delivery blocks broad staging"
            Guard = $deliveryGuard
            Tool = "PowerShell"
            Input = @{ command = "git add -- ." }
            Allow = $false
        },
        @{
            Name = "Delivery blocks another branch push"
            Guard = $deliveryGuard
            Tool = "PowerShell"
            Input = @{ command = "git push origin feature/MSG-2-unrelated" }
            Allow = $false
        },
        @{
            Name = "Delivery blocks explicit unrelated PR edit"
            Guard = $deliveryGuard
            Tool = "PowerShell"
            Input = @{ command = "gh pr edit 999 --title unrelated" }
            Allow = $false
        },
        @{
            Name = "Delivery blocks explicit unrelated PR merge"
            Guard = $deliveryGuard
            Tool = "PowerShell"
            Input = @{ command = "gh pr merge 999 --squash" }
            Allow = $false
        },
        @{
            Name = "Delivery allows PR create with a valid body file"
            Guard = $deliveryGuard
            Tool = "PowerShell"
            Input = @{
                command = "gh pr create --base main --title 'MSG-1 guard test' --body-file pr-body.md"
            }
            Allow = $true
        },
        @{
            Name = "Delivery validates a hidden body file instead of skipping it"
            Guard = $deliveryGuard
            Tool = "PowerShell"
            Input = @{
                command = "gh pr create --base main --title 'MSG-1 guard test' --body-file pr-body-hidden.md"
            }
            Allow = $true
        },
        @{
            Name = "Delivery blocks a hidden body file missing the Jira key"
            Guard = $deliveryGuard
            Tool = "PowerShell"
            Input = @{
                command = "gh pr create --base main --title 'MSG-1 guard test' --body-file pr-body-hidden-no-key.md"
            }
            Allow = $false
        },
        @{
            Name = "Delivery blocks a body file missing the Jira key"
            Guard = $deliveryGuard
            Tool = "PowerShell"
            Input = @{
                command = "gh pr create --base main --title 'MSG-1 guard test' --body-file pr-body-no-key.md"
            }
            Allow = $false
        },
        @{
            Name = "Delivery blocks a body file containing a credential"
            Guard = $deliveryGuard
            Tool = "PowerShell"
            Input = @{
                command = "gh pr create --base main --title 'MSG-1 guard test' --body-file pr-body-secret.md"
            }
            Allow = $false
        },
        @{
            Name = "Delivery blocks a sensitive file as PR body"
            Guard = $deliveryGuard
            Tool = "PowerShell"
            Input = @{
                command = "gh pr create --base main --title 'MSG-1 guard test' --body-file .env"
            }
            Allow = $false
        },
        @{
            Name = "Delivery blocks a missing body file"
            Guard = $deliveryGuard
            Tool = "PowerShell"
            Input = @{
                command = "gh pr create --base main --title 'MSG-1 guard test' --body-file absent.md"
            }
            Allow = $false
        },
        @{
            Name = "Delivery blocks a non-text body file"
            Guard = $deliveryGuard
            Tool = "PowerShell"
            Input = @{
                command = "gh pr create --base main --title 'MSG-1 guard test' --body-file seed.txt.exe"
            }
            Allow = $false
        },
        @{
            Name = "Delivery validates a body file on PR edit"
            Guard = $deliveryGuard
            Tool = "PowerShell"
            Input = @{
                command = "gh pr edit --body-file pr-body-no-key.md"
            }
            Allow = $false
        },
        @{
            Name = "Delivery merge requests fresh approval"
            Guard = $deliveryGuard
            Tool = "PowerShell"
            Input = @{ command = "gh pr merge --squash" }
            Allow = $true
            Output = '"permissionDecision":"ask"'
        },
        @{
            Name = "Figma Designer blocks repository edits"
            Guard = $figmaGuard
            Tool = "Edit"
            Input = @{ file_path = "src/app.ts" }
            Allow = $false
        },
        @{
            Name = "Figma Designer blocks Jira access"
            Guard = $figmaGuard
            Tool = "mcp__atlassian__getJiraIssue"
            Input = @{}
            Allow = $false
        }
    )


    # MA-23 fail-closed cases. Each drives a guard into an unexpected
    # exception while running a command the guard would otherwise ALLOW, so a
    # fail-open shows up as exit 0. Using a command the guard blocks anyway
    # would pass whether or not the trap exists.
    #
    # Two fault shapes, because the obvious one is not portable. An over-long
    # path is the accident that actually occurs on Windows, where these guards
    # run, but Linux has no 260-character limit so GetFullPath succeeds there
    # and the case proves nothing. A NUL in the path throws ArgumentException
    # on both .NET Framework and .NET Core, so it exercises the trap in CI too.
    $overLongCwd = Join-Path $testRoot ("a" * 300)
    $nulCwd = $testRoot + [char]0 + "x"
    $isWindowsHost = [System.IO.Path]::DirectorySeparatorChar -eq "\"

    $faultGuards = @(
        @{ Name = "Delivery"; Guard = $deliveryGuard },
        @{ Name = "Implementer"; Guard = $implementerGuard },
        @{ Name = "QA"; Guard = $qaGuard },
        @{ Name = "Review"; Guard = $reviewGuard }
    )

    foreach ($faultGuard in $faultGuards) {
        $cases += @{
            Name = "$($faultGuard.Name) fails closed on a NUL in the working directory"
            Guard = $faultGuard.Guard
            Tool = "PowerShell"
            Input = @{ command = "git status --short" }
            Cwd = $nulCwd
            Allow = $false
            Stderr = "failed unexpectedly"
        }

        if ($isWindowsHost) {
            $cases += @{
                Name = "$($faultGuard.Name) fails closed on an over-long working directory"
                Guard = $faultGuard.Guard
                Tool = "PowerShell"
                Input = @{ command = "git status --short" }
                Cwd = $overLongCwd
                Allow = $false
                Stderr = "failed unexpectedly"
            }
        }
    }

    if (-not $isWindowsHost) {
        Write-Warning (
            "Skipped: over-long-path cases (no path-length limit on this " +
            "platform). The NUL cases cover the trap here."
        )
    }

    foreach ($case in $cases) {
        $result = Invoke-Guard `
            -Guard $case.Guard `
            -ToolName $case.Tool `
            -ToolInput $case.Input `
            -Cwd $case.Cwd
        Assert-GuardResult `
            -Name $case.Name `
            -Result $result `
            -ShouldAllow $case.Allow `
            -StdoutPattern $case.Output `
            -StderrPattern $case.Stderr
    }

    Write-Output "All $($cases.Count) agent guard checks passed."
}
finally {
    if (
        (Test-Path -LiteralPath $testRoot) -and
        $testRoot.StartsWith(
            $testRootBase.TrimEnd("\", "/") +
            [System.IO.Path]::DirectorySeparatorChar,
            [System.StringComparison]::OrdinalIgnoreCase
        )
    ) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}
