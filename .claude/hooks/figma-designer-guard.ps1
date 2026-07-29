$ErrorActionPreference = "Stop"

function Block-Action {
    param([string]$Message)

    [Console]::Error.WriteLine(
        "Figma Designer guard blocked this action: $Message"
    )
    exit 2
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

$toolName = [string]$event.tool_name

if ($toolName -in @("Edit", "Write")) {
    Block-Action "repository writes are outside the Figma Designer role"
}

if ($toolName -in @("Bash", "PowerShell")) {
    Block-Action "shell access is outside the Figma Designer role"
}

if ($toolName -match "^mcp__atlassian__") {
    Block-Action "Jira access is outside the Figma Designer role"
}

Block-Action "unexpected guarded tool '$toolName'"
