# Add `?? undefined` to nullable Image src and Button "outline" usages.
# Idempotent.
$ErrorActionPreference = 'SilentlyContinue'
$root = 'C:\projects\HMovies'

# Recursively find all .tsx files
$files = Get-ChildItem -Path $root -Recurse -Filter '*.tsx' -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch 'node_modules|\.next' }

foreach ($f in $files) {
  $txt = [System.IO.File]::ReadAllText($f.FullName)
  $orig = $txt
  # Coerce nullable Image src props to undefined
  $txt = $txt -replace 'src=\{details\.posterUrl\}',          'src={details.posterUrl ?? undefined}'
  $txt = $txt -replace 'src=\{details\.backdropUrl\}',        'src={details.backdropUrl ?? undefined}'
  $txt = $txt -replace 'src=\{poster\}',                       'src={poster ?? undefined}'
  $txt = $txt -replace 'src=\{imageUrl\(backdrop \|\| poster \|\| ""\)\}', 'src={imageUrl(backdrop || poster || "") ?? undefined}'
  # variant outline -> secondary
  $txt = $txt -replace 'variant="outline"', 'variant="secondary"'
  # href={x.posterUrl} -> href={x.posterUrl ?? undefined}
  $txt = $txt -replace 'href=\{details\.posterUrl\}',          'href={details.posterUrl ?? undefined}'
  $txt = $txt -replace 'href=\{details\.backdropUrl\}',        'href={details.backdropUrl ?? undefined}'
  # ImageResponse metadata title pass
  if ($txt -ne $orig) {
    $enc = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($f.FullName, $txt, $enc)
    Write-Host "patched: $($f.FullName.Substring($root.Length + 1))"
  }
}
Write-Host "done"
