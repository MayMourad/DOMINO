# Opens DOMINO_AI_Usage_Report.docx in Microsoft Word, prints the page count and exports a PDF copy next to it.
param([string]$Docx = (Join-Path $PSScriptRoot 'DOMINO_AI_Usage_Report.docx'), [string]$Pdf = (Join-Path $PSScriptRoot 'DOMINO_AI_Usage_Report.pdf'))
$word = New-Object -ComObject Word.Application
$word.Visible = $false
try {
  $doc = $word.Documents.Open($Docx, $false, $true)
  $doc.Repaginate()
  Write-Output ("PAGES=" + $doc.ComputeStatistics(2))
  $doc.SaveAs2($Pdf, 17)
  $doc.Close($false)
} finally { $word.Quit() }
