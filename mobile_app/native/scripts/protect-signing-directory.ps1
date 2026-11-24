function Protect-SigningDirectory([string]$Directory) {
  $ErrorActionPreference = 'Stop'
  $item = Get-Item -LiteralPath $Directory -Force
  if (!$item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Signing directory must be a real directory' }
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
  # icacls changes only this directory's DACL: no owner, SACL, elevation, reset or recursive operation.
  & icacls.exe $item.FullName /grant:r "*$($sid.Value):(OI)(CI)F" /inheritance:r /Q | Out-Null
  if ($LASTEXITCODE) { throw 'Unable to restrict signing directory DACL as the current Windows user' }
  $section = [Security.AccessControl.AccessControlSections]::Access
  $acl = [IO.FileSystemAclExtensions]::GetAccessControl([IO.DirectoryInfo]::new($item.FullName), $section)
  $otherSids = @($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]) | ForEach-Object { $_.IdentityReference.Value } | Where-Object { $_ -ne $sid.Value } | Select-Object -Unique)
  foreach ($other in $otherSids) {
    & icacls.exe $item.FullName /remove:g "*$other" /remove:d "*$other" /Q | Out-Null
    if ($LASTEXITCODE) { throw 'Unable to remove an unexpected signing-directory DACL entry' }
  }
  & icacls.exe $item.FullName /remove:d "*$($sid.Value)" /Q | Out-Null
  if ($LASTEXITCODE) { throw 'Unable to remove a conflicting current-user deny entry' }
  $actual = [IO.FileSystemAclExtensions]::GetAccessControl([IO.DirectoryInfo]::new($item.FullName), $section)
  $rules = @($actual.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
  if (!$actual.AreAccessRulesProtected -or !$rules.Count -or @($rules | Where-Object {
      $_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -ne $sid.Value -or
      $_.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow
    }).Count) { throw 'Signing directory DACL verification failed' }
  $required = [Security.AccessControl.FileSystemRights]::FullControl
  if (!@($rules | Where-Object { ($_.FileSystemRights -band $required) -eq $required -and
      ($_.InheritanceFlags -band [Security.AccessControl.InheritanceFlags]::ContainerInherit) -and
      ($_.InheritanceFlags -band [Security.AccessControl.InheritanceFlags]::ObjectInherit) }).Count) { throw 'Signing directory lacks an inheritable current-user grant' }
}
