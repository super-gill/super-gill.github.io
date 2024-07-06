# Use this to remove target user from all Teams teams so it no longer appears in Cove.
# Jason Mcdill for updates
# 1

param(
    $teamsUserUPN,
    $whatIf = $true
)

if ($env:USERNAME.ToLower() = "daniel.whitford") {
    Write-Host ""
    Write-Host "WARNING: A DANIEL IS DETECTED" -ForegroundColor Red
    Write-Host ""
}

$version = 1
Write-Host "Version "$version

Connect-MicrosoftTeams

$teamResult = @()

if ( $teamsUserUPN -eq $null ) {
    Write-Host "you must provide the following details`n-teamsUserUPN`n-whatIf`nI.E.: .\removeTeamsUser.ps1 -teamsUserUPN user@pecan.org.uk -whitIf $false"
    Write-Host "`n CTRL-C to exit"
    Start-Sleep -seconds 30
}
else {

    $teams = (get-team)
    foreach ($team in $teams) { 
        try {
            if ( Get-TeamUser -GroupId $team.GroupId | where-object user -Like $teamsUserUPN ) {
                if ( $WhatIf -eq $false ) {
                    [void](Remove-TeamUser -GroupId $team.GroupId -User $teamsUserUPN)
                    $teamResult += ($team.DisplayName)
                    Write-Host $teamsUserUPN" was removed from "$team.DisplayName
                }
                else {
                    Write-Host ">> Would remove $teamsUserUPN from " $team.displayName 
                    $teamResult += ($team.DisplayName)
                }
            }
            else { Write-Host $teamsUserUPN " not found in "$team.DisplayName }
        }
        catch { Write-Host "ERROR: $_" }
        Write-Host "_______________________`n"
    }

}

if ( $whatIf -eq $false ) {
Write-Host "The following Teams were edited:`n" $teamResult "`n`n"
} else { Write-Host "The following Teams would have been edited:`n" $teamResult "`n`n" }