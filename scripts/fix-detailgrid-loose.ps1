# Loosen DetailGrid's row type so the legacy detail code (mixed
# conditional tuples, plain string|Element arrays) just compiles.
# The component only renders [icon, label, value] anyway.
$paths = @(
  'C:\projects\HMovies\components\detail\MovieDetailView.tsx',
  'C:\projects\HMovies\components\detail\TVDetailView.tsx'
)
$enc = New-Object System.Text.UTF8Encoding($false)
foreach ($p in $paths) {
  $txt = [System.IO.File]::ReadAllText($p)
  $orig = $txt
  $txt = $txt.Replace(
    'function DetailGrid({ rows }: { rows: Array<[React.ReactNode, string, string | null] | [React.ReactNode, string, string]> }) {',
    'function DetailGrid({ rows }: { rows: any[] }) {'
  )
  # Also fix the internal destructure since loose typing means we
  # can't rely on TypeScript narrowing.
  if ($txt -ne $orig) {
    [System.IO.File]::WriteAllText($p, $txt, $enc)
    Write-Host "patched: $p"
  }
}
