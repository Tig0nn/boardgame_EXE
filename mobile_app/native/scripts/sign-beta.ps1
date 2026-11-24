#Requires -Version 7.0
param(
  [Parameter(Mandatory)][string]$UnsignedApk,
  [Parameter(Mandatory)][ValidatePattern('^[A-Fa-f0-9]{64}$')][string]$ExpectedSha256,
  [Parameter(Mandatory)][string]$OutputApk,
  [switch]$CreateKeystore
)
$ErrorActionPreference = 'Stop'
$folder = Join-Path $env:LOCALAPPDATA 'EXE/signing'
$keystore = Join-Path $folder 'exe-beta.jks'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$sid = $identity.User
$tools = Join-Path $env:ANDROID_HOME 'build-tools/36.0.0'
$keytool = (Get-Command keytool.exe -ErrorAction Stop).Source
$java = Join-Path (Split-Path -Parent $keytool) 'java.exe'
$signer = Join-Path $tools 'lib/apksigner.jar'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
foreach ($file in @($UnsignedApk, $OutputApk, $keystore)) {
  $absolute = [IO.Path]::GetFullPath($file)
  if ($absolute.Equals($repo, 'OrdinalIgnoreCase') -or $absolute.StartsWith($repo + [IO.Path]::DirectorySeparatorChar, 'OrdinalIgnoreCase')) { throw 'Keys and signing artifacts must remain outside the repository' }
}
if (!(Test-Path -LiteralPath $UnsignedApk) -or (Get-FileHash -LiteralPath $UnsignedApk).Hash -ne $ExpectedSha256) { throw 'Unsigned APK checksum mismatch' }
if (Test-Path -LiteralPath $OutputApk) { throw 'Refusing to overwrite a signed APK' }
if ($CreateKeystore -and (Test-Path -LiteralPath $keystore)) { throw 'KEYSTORE_ALREADY_EXISTS: stopped without modifying it' }
if (!$CreateKeystore -and !(Test-Path -LiteralPath $keystore)) { throw 'Existing Beta keystore is required' }
if (!(Test-Path -LiteralPath $folder)) { New-Item -ItemType Directory -Path $folder | Out-Null }
if ((Get-Item -LiteralPath $folder -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Signing directory must not be a link' }
. (Join-Path $PSScriptRoot 'protect-signing-directory.ps1')
Protect-SigningDirectory $folder

# Only this separate interactive process sees the password. Child command lines contain environment variable names, never values.
function Invoke-PrivateTool([string]$Executable, [string[]]$Arguments, [string]$Password) {
  $start = [Diagnostics.ProcessStartInfo]::new($Executable)
  $start.UseShellExecute=$false; $start.CreateNoWindow=$true
  $start.RedirectStandardOutput=$true; $start.RedirectStandardError=$true
  foreach($argument in $Arguments) { $start.ArgumentList.Add($argument) }
  if($Password) { $start.Environment['EXE_BETA_KEY_PASSWORD']=$Password }
  $process=[Diagnostics.Process]::new(); $process.StartInfo=$start
  try {
    [void]$process.Start()
    $stdout=$process.StandardOutput.ReadToEndAsync(); $stderr=$process.StandardError.ReadToEndAsync()
    $process.WaitForExit()
    $text=$stdout.GetAwaiter().GetResult(); [void]$stderr.GetAwaiter().GetResult()
    if($process.ExitCode) { throw 'Signing tool failed; no secret output was logged. Check password/tool configuration before retrying.' }
    return $text
  } finally { $start.Environment.Remove('EXE_BETA_KEY_PASSWORD') | Out-Null; $process.Dispose() }
}
$secret=$null; $confirmation=$null; $plain=$null; $confirmed=$null
try {
  $Host.UI.RawUI.WindowTitle='EXE Beta Signing - Owner password input'
  Write-Host 'EXE Beta signing. Password stays in this window/process. Never paste it into chat.'
  Write-Host 'Use one strong password for this PKCS12 keystore and its private key. Keep it in your password manager.'
  $secret=Read-Host 'Beta keystore password (hidden)' -AsSecureString
  $pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
  try { $plain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
  if($CreateKeystore) {
    if($plain.Length -lt 12) { throw 'Use a password of at least 12 characters' }
    $confirmation=Read-Host 'Confirm password (hidden)' -AsSecureString
    $pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($confirmation)
    try { $confirmed=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
    if($plain -cne $confirmed) { throw 'Passwords do not match; no key created' }
    $temporary=Join-Path $folder ('exe-beta-new-'+[guid]::NewGuid().ToString('N')+'.jks')
    [void](Invoke-PrivateTool $keytool @('-genkeypair','-storetype','PKCS12','-keystore',$temporary,'-alias','exe-beta','-keyalg','RSA','-keysize','3072','-sigalg','SHA256withRSA','-validity','10000','-dname','CN=EXE Android Beta, OU=Beta, O=EXE, C=VN','-storepass:env','EXE_BETA_KEY_PASSWORD','-keypass:env','EXE_BETA_KEY_PASSWORD') $plain)
    if(Test-Path -LiteralPath $keystore) { throw 'Keystore appeared during creation; temporary key preserved without overwriting' }
    Move-Item -LiteralPath $temporary -Destination $keystore
    Write-Host 'BETA_KEYSTORE_CREATED'
  }
  if ((Get-Item -LiteralPath $keystore -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Keystore must not be a link' }
  $keyAcl=[IO.FileSystemAclExtensions]::GetAccessControl([IO.FileInfo]::new($keystore), [Security.AccessControl.AccessControlSections]::Access)
  if(@($keyAcl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]) | Where-Object { $_.IdentityReference.Value -ne $sid.Value }).Count) { throw 'Keystore has permissions for an unexpected principal' }
  [void](Invoke-PrivateTool $java @('-jar',$signer,'sign','--ks',$keystore,'--ks-type','PKCS12','--ks-key-alias','exe-beta','--ks-pass','env:EXE_BETA_KEY_PASSWORD','--key-pass','env:EXE_BETA_KEY_PASSWORD','--out',$OutputApk,$UnsignedApk) $plain)
  $verified=Invoke-PrivateTool $java @('-jar',$signer,'verify','--print-certs',$OutputApk) ''
  $fingerprints=[regex]::Matches($verified,'(?m)^Signer #\d+ certificate SHA-256 digest: ([a-fA-F0-9]{64})\s*$')
  if($fingerprints.Count -ne 1) { throw 'Expected exactly one signing certificate' }
  $fingerprint=$fingerprints[0].Groups[1].Value.ToLowerInvariant()
  if($fingerprint -eq 'fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c') { throw 'Unexpected Android Debug certificate' }
  $result=[ordered]@{ status='BETA_SIGNED_APK_PASS';keystore=$keystore;alias='exe-beta';storeType='PKCS12';certificateSha256=$fingerprint;apk=$OutputApk;apkSha256=(Get-FileHash -LiteralPath $OutputApk).Hash;bytes=(Get-Item -LiteralPath $OutputApk).Length }
  $result | ConvertTo-Json | Set-Content -LiteralPath ($OutputApk+'.verification.json') -Encoding utf8
  Write-Host 'BETA_SIGNED_APK_PASS'
  Write-Host 'Create an encrypted offline backup of exe-beta.jks (for example a 7-Zip AES-256 archive using its GUI). Store its password separately. Do not copy keys into Git or chat.'
} finally {
  $plain=$null; $confirmed=$null
  if($secret) { $secret.Dispose() }; if($confirmation) { $confirmation.Dispose() }
}
