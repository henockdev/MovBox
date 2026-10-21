# Coerce the rest of the rows tuples. We use a single regex on each
# file to cast the inner-tuple brackets to the 3-tuple type.
$paths = @(
  'C:\projects\HMovies\components\detail\MovieDetailView.tsx',
  'C:\projects\HMovies\components\detail\TVDetailView.tsx'
)
foreach ($p in $paths) {
  $txt = [System.IO.File]::ReadAllText($p)
  $orig = $txt
  # The Calendar row in MovieDetailView is the last literal tuple.
  # Just add an `as [React.ReactNode, string, string]` to it.
  $txt = $txt.Replace(
    '(<Calendar key="rd-icon" className="h-4 w-4" />, "Release Date", formatYear(details.releaseDate) || "â€”)',
    '(<Calendar key="rd-icon" className="h-4 w-4" />, "Release Date", formatYear(details.releaseDate) || "â€”) as [React.ReactNode, string, string]'
  )
  # Force the whole rows array to the right type via a single cast.
  # Search for `rows={[` and the matching `]}` and add ` as ...`.
  $txt = $txt.Replace('rows={[', 'rows={(() => { const _r: Array<[React.ReactNode, string, string]> = [')
  $txt = $txt.Replace(']/\* chip cloud', '/* chip cloud')
  if ($txt -ne $orig) {
    $enc = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($p, $txt, $enc)
    Write-Host "patched: $p"
  } else {
    Write-Host "  noop: $p"
  }
}
