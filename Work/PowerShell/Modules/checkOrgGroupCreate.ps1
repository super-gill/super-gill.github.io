# Connect to the portals
$credential = Get-Credential
Connect-ExchangeOnline -Credential $credential >$null
Connect-AzureAD -Credential $credential >$null

# Store organization settings
$organizationSettings = Get-OrganizationConfig

# Check and display group creation status
if ($organizationSettings.GroupCreationEnabled -eq $true) {
    Write-Host "`nGroup creation is enabled.`n" -ForegroundColor Yellow
}
else {
    Write-Host "`nGroup creation is disabled.`n" -ForegroundColor Yellow
}

Write-Host ""
$organizationSettings | Select-Object -Property *
