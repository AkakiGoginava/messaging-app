$ErrorActionPreference = "Stop"

function Block-Action {
    param([string]$Message)

    [Console]::Error.WriteLine("QA guard blocked this action: $Message")
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

function Get-ProjectRelativePath {
    param(
        [string]$Path,
        [string]$ProjectPath
    )

    $baseUri = New-Object System.Uri(
        $ProjectPath.TrimEnd("\", "/") +
        [System.IO.Path]::DirectorySeparatorChar
    )
    $targetUri = New-Object System.Uri($Path)
    return [System.Uri]::UnescapeDataString(
        $baseUri.MakeRelativeUri($targetUri).ToString()
    ).Replace("/", [System.IO.Path]::DirectorySeparatorChar)
}

function Assert-FeatureBranch {
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
    $branch = (& git -C $ProjectPath rev-parse --abbrev-ref HEAD 2>$null).Trim()
    $branchExitCode = $LASTEXITCODE
    $ErrorActionPreference = $previousErrorPreference
    if ($branchExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($branch)) {
        Block-Action "the current Git branch could not be verified"
    }

    $allowedBranch = "^(feature|fix|chore|test|docs|refactor|build|ci)/[A-Z][A-Z0-9]+-[0-9]+-[a-z0-9][a-z0-9-]*$"
    if ($branch -in @("main", "master") -or $branch -notmatch $allowedBranch) {
        Block-Action (
            "current branch '$branch' is not an allowed Delivery-created " +
            "type/JIRA-KEY-short-description branch"
        )
    }
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
    Block-Action "the tool working directory is outside the project"
}

$toolName = [string]$event.tool_name
if ($toolName -in @("Edit", "Write")) {
    $requestedPath = [string]$event.tool_input.file_path
    if ([string]::IsNullOrWhiteSpace($requestedPath)) {
        Block-Action "$toolName did not provide a file path"
    }

    $targetPath = Get-NormalizedPath -Path $requestedPath -BasePath $eventWorkingDirectory
    if (
        $targetPath -ne $projectPath -and
        -not $targetPath.StartsWith(
            $projectPrefix,
            [System.StringComparison]::OrdinalIgnoreCase
        )
    ) {
        Block-Action "file edits must remain inside the project"
    }

    $relativePath = Get-ProjectRelativePath -Path $targetPath -ProjectPath $projectPath
    $normalizedRelativePath = $relativePath.Replace("\", "/")

    $protectedPatterns = @(
        "(^|/)\.git(/|$)",
        "(^|/)\.claude(/|$)",
        "^\.mcp\.json$",
        "^AGENTS\.md$",
        "^docs/plans(/|$)",
        "^output/pdf(/|$)",
        "^scripts/render_stage1_plan\.py$",
        "(^|/)\.env($|\.)",
        "\.(pem|key|p12|pfx)$",
        "(^|/)package\.json$",
        "(^|/)pnpm-lock\.yaml$",
        "(^|/)package-lock\.json$",
        "(^|/)yarn\.lock$"
    )

    foreach ($pattern in $protectedPatterns) {
        if ($normalizedRelativePath -match $pattern) {
            Block-Action "the protected path '$normalizedRelativePath' is outside the QA role"
        }
    }

    $allowedTestPatterns = @(
        "(^|/)(test|tests|__tests__|e2e|playwright|fixtures|mocks|__mocks__|__snapshots__)(/|$)",
        "\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$",
        "\.snap$",
        "(^|/)(playwright|vitest|jest)\.config\.(ts|js|mjs|cjs)$"
    )

    $isTestOnlyPath = $false
    foreach ($pattern in $allowedTestPatterns) {
        if ($normalizedRelativePath -match $pattern) {
            $isTestOnlyPath = $true
            break
        }
    }

    if (-not $isTestOnlyPath) {
        Block-Action "QA may edit test-only files, not '$normalizedRelativePath'"
    }

    Assert-FeatureBranch -ProjectPath $projectPath
    exit 0
}

if ($toolName -in @("Bash", "PowerShell")) {
    $command = [string]$event.tool_input.command
    if ([string]::IsNullOrWhiteSpace($command)) {
        Block-Action "$toolName did not provide a command"
    }

    $blockedCommandPatterns = @(
        "(?i)\bgit(?:\.exe)?\s+(commit|push|checkout|switch|merge|rebase|reset|clean|cherry-pick|revert|tag|pull|fetch|branch)\b",
        "(?i)(^|[\s;&|])gh(?:\.exe)?(\s|$)",
        "(?i)(^|[\s;&|])hub(?:\.exe)?(\s|$)",
        "(?i)(^|[\s;&|])jira(?:\.exe)?(\s|$)",
        "(?i)\b(npm|pnpm|yarn)\s+(install|add|remove|update|upgrade|uninstall|link|publish)\b",
        "(?i)\bdocker\s+push\b",
        "(?i)\bkubectl\s+(apply|delete|patch|replace|create)\b",
        "(?i)\bterraform\s+(apply|destroy|import)\b",
        "(?i)\b(eslint|prettier)\b[^\r\n]*(--fix|--write)\b",
        "(?i)\bbiome\b[^\r\n]*(--write)\b",
        "(?i)\bRemove-Item\b[^\r\n]*\b-Recurse\b",
        "(?i)\brm\b[^\r\n]*\s-[^\r\n\s]*r[^\r\n\s]*f",
        "(?i)\brmdir\b[^\r\n]*/s\b",
        "(?i)\bdel\b[^\r\n]*/s\b",
        "(?i)(^|[\\/])\.claude([\\/]|$)",
        "(?i)(^|[\\/])\.git([\\/]|$)",
        "(?i)(^|[\\/])docs[\\/]plans([\\/]|$)",
        "(?i)(^|[\\/])output[\\/]pdf([\\/]|$)",
        "(?i)(^|[\\/])AGENTS\.md\b",
        "(?i)(^|[\\/])\.mcp\.json\b",
        "(?i)(^|[\\/])scripts[\\/]render_stage1_plan\.py\b"
    )

    foreach ($pattern in $blockedCommandPatterns) {
        if ($command -match $pattern) {
            Block-Action "the shell command crosses the QA role boundary"
        }
    }

    Assert-FeatureBranch -ProjectPath $projectPath
    exit 0
}

Block-Action "unexpected guarded tool '$toolName'"
