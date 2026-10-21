# Coerce mediaType to non-undefined at the call sites.
$p = 'C:\projects\HMovies\components\player\SourceList.tsx'
$txt = [System.IO.File]::ReadAllText($p)
$txt = $txt.Replace('mediaType={mediaType}', 'mediaType={mediaType ?? "movie"}')
$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($p, $txt, $enc)
Write-Host "patched"
