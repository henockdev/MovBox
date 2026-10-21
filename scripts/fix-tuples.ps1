# Fix the inner-tuple typing in detail view rows. The pattern
# `[<Icon />, "Label", "Value"]` is inferred as `Array<Element|string>`
# because of the outer wrapping. Cast to a 3-tuple.
$paths = @(
  'C:\projects\HMovies\components\detail\MovieDetailView.tsx',
  'C:\projects\HMovies\components\detail\TVDetailView.tsx'
)
$replacements = @(
  @{ from = '[[<Clapperboard key="d-icon" className="h-4 w-4" />, "Director", directors.map((d) => d.name).join(", ")]]'; to = '[[<Clapperboard key="d-icon" className="h-4 w-4" />, "Director", directors.map((d) => d.name).join(", ")] as [React.ReactNode, string, string]]' },
  @{ from = '[[<Pencil key="w-icon" className="h-4 w-4" />, "Writers", writers.map((w) => w.name).join(", ")]]'; to = '[[<Pencil key="w-icon" className="h-4 w-4" />, "Writers", writers.map((w) => w.name).join(", ")] as [React.ReactNode, string, string]]' },
  @{ from = '[[<Tv2 key="s-icon" className="h-4 w-4" />, "Source", details.source]]'; to = '[[<Tv2 key="s-icon" className="h-4 w-4" />, "Source", details.source] as [React.ReactNode, string, string]]' },
  @{ from = '[[<Building2 key="u-icon" className="h-4 w-4" />, "Uploaded by", details.uploadBy]]'; to = '[[<Building2 key="u-icon" className="h-4 w-4" />, "Uploaded by", details.uploadBy] as [React.ReactNode, string, string]]' },
  @{ from = '[[<Clock key="du-icon" className="h-4 w-4" />, "Duration", details.durationLabel]]'; to = '[[<Clock key="du-icon" className="h-4 w-4" />, "Duration", details.durationLabel] as [React.ReactNode, string, string]]' }
)
# For TV the labels differ
$tvReplacements = @(
  @{ from = '[[<Clapperboard key="d-icon" className="h-4 w-4" />, "Creator", creators.map((c) => c.name).join(", ")]]'; to = '[[<Clapperboard key="d-icon" className="h-4 w-4" />, "Creator", creators.map((c) => c.name).join(", ")] as [React.ReactNode, string, string]]' }
)
$replacements += $tvReplacements

foreach ($p in $paths) {
  $txt = [System.IO.File]::ReadAllText($p)
  $orig = $txt
  foreach ($r in $replacements) {
    $txt = $txt.Replace($r.from, $r.to)
  }
  if ($txt -ne $orig) {
    $enc = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($p, $txt, $enc)
    Write-Host "patched: $p"
  } else {
    Write-Host "  noop: $p"
  }
}
