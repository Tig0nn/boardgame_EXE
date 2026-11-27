#Requires -Version 7.0
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../scripts/protect-signing-directory.ps1')
$fixture=Join-Path $env:LOCALAPPDATA ('EXE/signing-acl-test-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $fixture | Out-Null
$sections=[Security.AccessControl.AccessControlSections]::Access -bor [Security.AccessControl.AccessControlSections]::Owner
$before=[IO.FileSystemAclExtensions]::GetAccessControl([IO.DirectoryInfo]::new($fixture),$sections)
$owner=$before.GetOwner([Security.Principal.SecurityIdentifier]).Value
& icacls.exe $fixture /grant '*S-1-5-11:(OI)(CI)R' /Q | Out-Null
if($LASTEXITCODE){throw 'Could not prepare synthetic broad-grant fixture'}
Protect-SigningDirectory $fixture
$first=[IO.FileSystemAclExtensions]::GetAccessControl([IO.DirectoryInfo]::new($fixture),$sections)
if($first.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $owner){throw 'Owner changed'}
$beforeDacl=$first.GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::Access)
Protect-SigningDirectory $fixture
$after=[IO.FileSystemAclExtensions]::GetAccessControl([IO.DirectoryInfo]::new($fixture),$sections)
if($after.GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::Access) -ne $beforeDacl){throw 'DACL restriction is not idempotent'}
$placeholder=Join-Path $fixture 'placeholder.txt'
[IO.File]::WriteAllText($placeholder,'Synthetic ACL inheritance fixture, not a key.')
$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$fileAcl=[IO.FileSystemAclExtensions]::GetAccessControl([IO.FileInfo]::new($placeholder),[Security.AccessControl.AccessControlSections]::Access)
if(@($fileAcl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]) | Where-Object {$_.IdentityReference.Value -ne $sid}).Count){throw 'New file inherited another principal'}
$hash=(Get-FileHash -LiteralPath $placeholder).Hash
Protect-SigningDirectory $fixture
if((Get-FileHash -LiteralPath $placeholder).Hash -ne $hash){throw 'Existing file content changed'}
'SIGNING_ACL_TESTS_PASS: restrict mixed grants; preserve owner; idempotent; private file inheritance; file content preserved'
