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

function Invoke-Guard {
    param(
        [string]$Guard,
        [string]$ToolName,
        [hashtable]$ToolInput
    )

    $event = @{
        tool_name = $ToolName
        cwd = $testRoot
        tool_input = $ToolInput
    } | ConvertTo-Json -Depth 6 -Compress

    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = "powershell.exe"
    $startInfo.Arguments = (
        "-NoProfile -ExecutionPolicy Bypass -File `"$Guard`""
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
        [string]$StdoutPattern = ""
    )

    $allowed = $Result.ExitCode -eq 0
    if ($allowed -ne $ShouldAllow) {
        throw (
            "$Name expected allow=$ShouldAllow but exit code was " +
            "$($Result.ExitCode). stderr: $($Result.Stderr)"
        )
    }

    if (
        -not [string]::IsNullOrWhiteSpace($StdoutPattern) -and
        $Result.Stdout -notmatch $StdoutPattern
    ) {
        throw "$Name did not emit expected output pattern '$StdoutPattern'."
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

    foreach ($case in $cases) {
        $result = Invoke-Guard `
            -Guard $case.Guard `
            -ToolName $case.Tool `
            -ToolInput $case.Input
        Assert-GuardResult `
            -Name $case.Name `
            -Result $result `
            -ShouldAllow $case.Allow `
            -StdoutPattern $case.Output
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
