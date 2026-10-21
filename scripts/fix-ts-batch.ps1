# Same batch fix but with proper path handling for files in [id] / [season] / [episode] dirs.
$ErrorActionPreference = 'Continue'
$root = 'C:\projects\HMovies'

$paths = @(
  "$root\components\detail\MovieDetailView.tsx",
  "$root\components\detail\TVDetailView.tsx",
  "$root\components\player\SeasonPicker.tsx",
  "$root\components\player\SourceList.tsx",
  "$root\components\browse\BrowseClient.tsx",
  "$root\components\browse\FilterSidebar.tsx",
  "$root\app\watch\tv\[id]\page.tsx",
  "$root\app\genres\[id]\page.tsx",
  "$root\app\genres\page.tsx",
  "$root\app\watch\movie\[id]\page.tsx",
  "$root\app\watch\tv\[id]\layout.tsx",
  "$root\lib\useSources.ts",
  "$root\lib\watchlist.ts",
  "$root\lib\data.ts",
  "$root\lib\types.ts"
)

foreach ($p in $paths) {
  if (-not (Test-Path -LiteralPath $p)) { Write-Host "skip: $p"; continue }
  $txt = [System.IO.File]::ReadAllText($p)
  $orig = $txt
  $txt = $txt -replace 'src=\{details\.posterUrl\}',          'src={details.posterUrl ?? undefined}'
  $txt = $txt -replace 'src=\{details\.backdropUrl\}',        'src={details.backdropUrl ?? undefined}'
  $txt = $txt -replace 'src=\{poster\}',                       'src={poster ?? undefined}'
  $txt = $txt -replace 'variant="outline"', 'variant="secondary"'
  if ($txt -ne $orig) {
    $enc = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($p, $txt, $enc)
    Write-Host "patched: $p"
  } else {
    Write-Host "  noop: $p"
  }
}
Write-Host "done"
