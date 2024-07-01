
param(
    $userUPN,
    $whatIf = $true
)

Connect-MicrosoftTeams

$teamResult = @()


$teams = (get-team)
foreach ($team in $teams) { 
    try {
        if ( Get-TeamUser -GroupId $team.GroupId | where-object user -Like $userUPN ) {
            if ( $WhatIf -eq $false ) {
                Remove-TeamUser -GroupId $team.GroupId -User $userUPN
                $teamResult += ($team.DisplayName)S
                Write-Host $team.displayname
            }
            else {
                Write-Host ">> Would remove $userUPN from " $team.displayName 
                $teamResult += ($team.DisplayName)
            }
        }
        else { Write-Host $userUPN " not found in "$team.DisplayName }
    }
    catch { Write-Host "ERROR: $_" }
    Write-Host "_______________________`n"
}

Write-Host "The following Teams were edited:`n" $teamResult