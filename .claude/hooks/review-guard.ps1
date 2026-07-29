$ErrorActionPreference = "Stop"

function Block-Action {
    param([string]$Message)

    [Console]::Error.WriteLine("Review guard blocked this action: $Message")
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
    Block-Action "run exactly one read-only Git or GitHub command at a time"
}

if ($command -match '\$\(|`|@''|@"') {
    Block-Action "shell interpolation and generated command bodies are not allowed"
}

if ($command -notmatch "^(?i)(git|gh)(?:\.exe)?\s+") {
    Block-Action "Review shell access is limited to read-only Git and GitHub CLI"
}

$allowedGitPatterns = @(
    "^(?i)git(?:\.exe)?\s+status\b",
    "^(?i)git(?:\.exe)?\s+diff\b",
    "^(?i)git(?:\.exe)?\s+log\b",
    "^(?i)git(?:\.exe)?\s+show\b",
    "^(?i)git(?:\.exe)?\s+rev-parse\b",
    "^(?i)git(?:\.exe)?\s+grep\b",
    "^(?i)git(?:\.exe)?\s+ls-files\b",
    "^(?i)git(?:\.exe)?\s+ls-tree\b",
    "^(?i)git(?:\.exe)?\s+ls-remote\b",
    "^(?i)git(?:\.exe)?\s+blame\b",
    "^(?i)git(?:\.exe)?\s+remote(?:\s*$|\s+(-v|show|get-url)\b)"
)

$allowedGitHubPatterns = @(
    "^(?i)gh(?:\.exe)?\s+auth\s+status\b",
    "^(?i)gh(?:\.exe)?\s+repo\s+view\b",
    "^(?i)gh(?:\.exe)?\s+run\s+(list|view|watch)\b",
    "^(?i)gh(?:\.exe)?\s+pr\s+(view|status|checks|diff|list)\b"
)

$isAllowed = $false
foreach ($pattern in ($allowedGitPatterns + $allowedGitHubPatterns)) {
    if ($command -match $pattern) {
        $isAllowed = $true
        break
    }
}

if (-not $isAllowed) {
    Block-Action "command is not in the Review read-only allowlist"
}

$branch = Get-CurrentBranch -ProjectPath $projectPath
$allowedBranch = "^(feature|fix|chore|test|docs|refactor|build|ci)/[A-Z][A-Z0-9]+-[0-9]+-[a-z0-9][a-z0-9-]*$"
if ($branch -notmatch $allowedBranch) {
    Block-Action "review requires a Jira-keyed feature branch, not '$branch'"
}

exit 0
