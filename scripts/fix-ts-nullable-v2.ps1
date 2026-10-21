# Final batch fix — adds ?? undefined to all nullable string props
# the Next.js Image / Link components reject. Idempotent.

$ErrorActionPreference = 'SilentlyContinue'
$root = 'C:\projects\HMovies'

# Patterns to fix. Each is a regex. We add ?? undefined wherever
# a `string | null` flows into a prop typed `string | undefined` or
# `string | Blob | undefined`.
$patterns = @(
  # src={something.posterUrl} or src={something.backdropUrl}
  'src=\{\s*[a-zA-Z_$.]+\.(posterUrl|backdropUrl|src)\s*\}',
  # href={something.posterUrl}
  'href=\{\s*[a-zA-Z_$.]+\.(posterUrl|backdropUrl|src)\s*\}',
  # title={...} - skip, not used in src/href contexts that fail
  # imageUrl(backdrop) - the image() helper returns string|undefined
  'src=\{imageUrl\(([a-zA-Z_$. ]+)\) ?\}'
)

# Components to scan
$files = Get-ChildItem -Path $root -Recurse -Filter '*.tsx' -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch 'node_modules|\.next' }

foreach ($f in $files) {
  $txt = [System.IO.File]::ReadAllText($f.FullName)
  $orig = $txt
  # 1) Add ?? undefined to .posterUrl / .backdropUrl / .src inside src={} or href={}
  $txt = [System.Text.RegularExpressions.Regex]::Replace($txt,
    'src=\{\s*([a-zA-Z_$.]+)\.(posterUrl|backdropUrl|src)\s*\}',
    'src={$1.$2 ?? undefined}')
  $txt = [System.Text.RegularExpressions.Regex]::Replace($txt,
    'href=\{\s*([a-zA-Z_$.]+)\.(posterUrl|backdropUrl|src)\s*\}',
    'href={$1.$2 ?? undefined}')
  # 2) Wrap imageUrl(...) in src={...} with ?? undefined
  $txt = [System.Text.RegularExpressions.Regex]::Replace($txt,
    'src=\{imageUrl\(([^)]+)\)\}',
    'src={imageUrl($1) ?? undefined}')
  if ($txt -ne $orig) {
    $enc = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($f.FullName, $txt, $enc)
    Write-Host "patched: $($f.FullName.Substring($root.Length + 1))"
  }
}
Write-Host "done"
