# Use literal file paths (no wildcards) and read the whole file.
$ErrorActionPreference = 'SilentlyContinue'
$paths = @(
  'C:\projects\HMovies\components\detail\MovieDetailView.tsx',
  'C:\projects\HMovies\components\detail\TVDetailView.tsx'
)
foreach ($p in $paths) {
  $txt = [System.IO.File]::ReadAllText($p)
  $orig = $txt
  $txt = $txt.Replace(
    '<ShareBtn icon={<Facebook className="h-4 w-4" />} label="FB" onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, "_blank")} />',
    '<ShareBtn icon={<Share2 className="h-4 w-4" />} label="FB" onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, "_blank")} />'
  )
  $txt = $txt.Replace(
    '<ShareBtn icon={<Twitter className="h-4 w-4" />} label="X" onClick={() => window.open(`https://twitter.com/intent/tweet?url=${url}`, "_blank")} />',
    '<ShareBtn icon={<Share2 className="h-4 w-4" />} label="X" onClick={() => window.open(`https://twitter.com/intent/tweet?url=${url}`, "_blank")} />'
  )
  $txt = $txt.Replace(
    '<ShareBtn icon={<Linkedin className="h-4 w-4" />} label="In" onClick={() => window.open(`https://www.linkedin.com/sharing/share-site/?url=${url}`, "_blank")} />',
    '<ShareBtn icon={<Share2 className="h-4 w-4" />} label="In" onClick={() => window.open(`https://www.linkedin.com/sharing/share-site/?url=${url}`, "_blank")} />'
  )
  if ($txt -ne $orig) {
    $enc = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($p, $txt, $enc)
    Write-Host "patched: $p"
  } else {
    Write-Host "noop: $p"
  }
}
