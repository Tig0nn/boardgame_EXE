#Requires -Version 7.0
param([Parameter(Mandatory)][string]$OutputDirectory, [switch]$Offline)
$ErrorActionPreference = 'Stop'
$native = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$repo = [IO.Path]::GetFullPath((Join-Path $native '../..'))
$output = [IO.Path]::GetFullPath($OutputDirectory)
if ($output.Equals($repo, 'OrdinalIgnoreCase') -or $output.StartsWith($repo + [IO.Path]::DirectorySeparatorChar, 'OrdinalIgnoreCase')) { throw 'Output must be outside the repository' }
$config = (Get-Content -LiteralPath (Join-Path $native 'app.json') -Raw | ConvertFrom-Json).expo
if ($config.android.package -ne 'vn.exe.boardgame.nativeapp' -or $config.android.versionCode -lt 2) { throw 'Invalid Beta identity/version' }
if ($env:EXPO_PUBLIC_EXE_API_ORIGIN -ne 'https://exe-staging-backend.onrender.com' -or
    $env:EXPO_PUBLIC_SUPABASE_URL -ne 'https://yqikecqeijeaygmmjdyg.supabase.co' -or
    !$env:EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.StartsWith('sb_publishable_') -or
    $env:EXPO_PUBLIC_EXE_WHATIF_GEMINI -ne '0') { throw 'Explicit staging public configuration and Gemini OFF are required' }
if (!(Test-Path -LiteralPath $output)) { New-Item -ItemType Directory -Path $output | Out-Null }
$apk = Join-Path $output ('EXE-Beta-v' + $config.android.versionCode + '-UNSIGNED.apk')
if (Test-Path -LiteralPath $apk) { throw 'Refusing to overwrite an existing artifact' }
$buildLog = Join-Path $output 'android-build.log'
$env:EXE_ANDROID_BETA = '1'
$env:NODE_ENV = 'production'; $env:CI = '1'; $env:EXPO_NO_TELEMETRY = '1'; $env:EXPO_NO_DOTENV = '1'
Push-Location $native
try {
  & node node_modules/expo/bin/cli prebuild --platform android --no-install *> (Join-Path $output 'prebuild.log')
  if ($LASTEXITCODE) { throw 'Expo prebuild failed' }
  Set-Location android
  $arguments = @(':app:assembleRelease', '-PreactNativeArchitectures=arm64-v8a,x86_64', '--max-workers=4', '--console=plain')
  if ($Offline) { $arguments += '--offline' }
  & .\gradlew.bat @arguments *> $buildLog
  if ($LASTEXITCODE) { throw 'Android build failed' }
  $unsigned = Join-Path $native 'android/app/build/outputs/apk/release/app-release-unsigned.apk'
  if (!(Test-Path -LiteralPath $unsigned)) { throw 'Expected unsigned release APK missing; no debug-signed fallback is permitted' }
  $tools = Join-Path $env:ANDROID_HOME 'build-tools/36.0.0'
  $badging = & (Join-Path $tools 'aapt.exe') dump badging $unsigned
  if ($LASTEXITCODE -or !($badging -match "^package: name='vn.exe.boardgame.nativeapp' versionCode='$($config.android.versionCode)'")) { throw 'APK identity/version mismatch' }
  if ($badging -match 'application-debuggable' -or !(($badging -match '^native-code:') -like "*'arm64-v8a'*")) { throw 'APK must be non-debuggable with ARM64 libraries' }
  Copy-Item -LiteralPath $unsigned -Destination $apk
  [ordered]@{ unsignedApk=$apk; sha256=(Get-FileHash -LiteralPath $apk).Hash; versionCode=$config.android.versionCode; package=$config.android.package } |
    ConvertTo-Json | Set-Content -LiteralPath (Join-Path $output 'unsigned-manifest.json') -Encoding utf8
  'BETA_UNSIGNED_BUILD_PASS'
} finally { Pop-Location; Remove-Item Env:EXE_ANDROID_BETA -ErrorAction SilentlyContinue }
