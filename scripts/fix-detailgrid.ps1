# Loosen DetailGrid's row type so the conditional spread + tuple
# type doesn't fight us. The component only renders the icon, label,
# value, so we accept any 3-tuple shape.
$p = 'C:\projects\HMovies\components\detail\MovieDetailView.tsx'
$txt = [System.IO.File]::ReadAllText($p)
$txt = $txt.Replace(
  'function DetailGrid({ rows }: { rows: Array<[React.ReactNode, string, string]> }) {',
  'function DetailGrid({ rows }: { rows: Array<[React.ReactNode, string, string | null] | [React.ReactNode, string, string]> }) {'
)
$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($p, $txt, $enc)
Write-Host "patched MovieDetailView"

$p2 = 'C:\projects\HMovies\components\detail\TVDetailView.tsx'
$txt2 = [System.IO.File]::ReadAllText($p2)
$orig2 = $txt2
$txt2 = $txt2.Replace(
  'function DetailGrid({ rows }: { rows: Array<[React.ReactNode, string, string]> }) {',
  'function DetailGrid({ rows }: { rows: Array<[React.ReactNode, string, string | null] | [React.ReactNode, string, string]> }) {'
)
if ($txt2 -ne $orig2) {
  [System.IO.File]::WriteAllText($p2, $txt2, $enc)
  Write-Host "patched TVDetailView"
} else {
  Write-Host "TVDetailView: no DetailGrid to patch (or already patched)"
}
