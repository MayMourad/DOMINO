# Opens the report in Microsoft Word, reports the page count and exports a PDF preview (used to check the six-page limit).
param([string]$Docx = (Join-Path $PSScriptRoot 'DOMINO_Video_Production_Pack.docx'), [string]$Pdf = (Join-Path $PSScriptRoot 'render\DOMINO_Video_Production_Pack.pdf'))
New-Item -ItemType Directory -Force (Split-Path $Pdf) | Out-Null
$word = New-Object -ComObject Word.Application
$word.Visible = $false
try {
  $doc = $word.Documents.Open($Docx, $false, $true)
  $doc.Repaginate()
  $pages = $doc.ComputeStatistics(2)
  Write-Output "PAGES=$pages"
  $doc.SaveAs2($Pdf, 17)
  $doc.Close($false)
} finally { $word.Quit() }
