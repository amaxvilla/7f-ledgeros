$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

$PatchPath = Join-Path $Root "7f-ledgeros-ts-fixes.patch"

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "7F LedgerOS - Claude TypeScript Repair" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

if (-not (Test-Path $PatchPath)) {
    Write-Error "Patch file not found: $PatchPath"
    exit 1
}

Write-Host "-- Checking Git repository --" -ForegroundColor Yellow
git status --short

Write-Host "`n-- Checking patch --" -ForegroundColor Yellow
git apply --check $PatchPath

if ($LASTEXITCODE -ne 0) {
    Write-Error "Patch does not apply cleanly. No changes were made."
    exit 1
}

Write-Host "-- Patch applies cleanly. Applying for real --" -ForegroundColor Yellow
git apply $PatchPath

if ($LASTEXITCODE -ne 0) {
    Write-Error "Patch application failed."
    exit 1
}

Write-Host "-- Patch applied successfully. --" -ForegroundColor Green

Write-Host "`n-- Regenerating Prisma client --" -ForegroundColor Yellow
pnpm run db:generate

if ($LASTEXITCODE -ne 0) {
    Write-Error "Prisma generate failed."
    exit 1
}

Write-Host "`n-- Building workspace packages --" -ForegroundColor Yellow
pnpm run build:packages

if ($LASTEXITCODE -ne 0) {
    Write-Error "Workspace package build failed."
    exit 1
}

Write-Host "`n-- Type-checking apps/api --" -ForegroundColor Yellow

Push-Location (Join-Path $Root "apps\api")

$tscOutput = & pnpm exec tsc --noEmit -p tsconfig.json 2>&1
$tscExit = $LASTEXITCODE

Pop-Location

$tscOutput | Tee-Object -FilePath (Join-Path $Root "tsc-output.txt")

if ($tscExit -eq 0) {
    Write-Host "`n0 TypeScript errors." -ForegroundColor Green
}
else {
    $errorCount = @(
        $tscOutput |
        Select-String -Pattern "error TS\d+"
    ).Count

    Write-Host "`n$errorCount TypeScript error(s) remain." -ForegroundColor Yellow
    Write-Host "Full output saved to: $Root\tsc-output.txt" -ForegroundColor Yellow
}

Write-Host "`n-- Running apps/api test suite --" -ForegroundColor Yellow

Push-Location (Join-Path $Root "apps\api")

$testOutput = & pnpm test 2>&1
$testExit = $LASTEXITCODE

Pop-Location

$testOutput | Tee-Object -FilePath (Join-Path $Root "test-output.txt")

if ($testExit -eq 0) {
    Write-Host "`nAPI tests passed." -ForegroundColor Green
}
else {
    Write-Host "`nAPI tests reported failures." -ForegroundColor Yellow
    Write-Host "Full output saved to: $Root\test-output.txt" -ForegroundColor Yellow
}

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "Repair script completed." -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

if ($tscExit -ne 0) {
    exit $tscExit
}

if ($testExit -ne 0) {
    exit $testExit
}

exit 0
