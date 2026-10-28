$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$pp = New-Object -ComObject PowerPoint.Application
try {
  $p = $pp.Presentations.Open((Join-Path $here 'DOMINO_Presentation.pptx'), $true, $false, $false)
  $p.SaveAs((Join-Path $here 'DOMINO_Presentation.pdf'), 32)
  Write-Host ("slides: " + $p.Slides.Count)
  $p.Close()
} finally { $pp.Quit() }
