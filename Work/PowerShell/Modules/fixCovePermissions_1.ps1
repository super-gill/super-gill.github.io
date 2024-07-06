# Used to remove special permissions in SharePoint including share links and remove the target user from Teams
# Written by Jason Mcdill
$appVersion = 1

# to do
# declare all the variable types
# convert function names to camel case
# move the global variables to paramaters and pass to functions explicitly
# remove the heaps of redundant code from the copy pastes in sp and teams scripts

# Global parameters

[bool]$whatIf = $true,
[string]$userUPN,

# SharePoint parameters
[string]$adminURL,
[string]$adminUPN,

# Teams parameters
$teamsUserUPN = $userUPN #dont hate me i cant be btohered to fix the teams part

# Other variables
$adminIsAdmin = $false #not used anymore
$kashdjks = "What part of ''YES OR NO'' was unclear? dont sass me." 

# Convert to boolen 
function ConvertAnswer {
    param (
        $answer
    )

    switch ($answer.ToLower()) {
        "yes" { return $true }
        "no" { return $false }
        "y" { return $true }
        "n" { return $false }
        default {
            return $null
        }
    }
}

# Validate email addresses
function validateEmail {
    param (
        [string]$emailAddress
    )
    
    $emailPattern = '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    
    if ($emailAddress -match $emailPattern) {
        return $true
    }
    else {
        return $false
    }
}

# Validate the URL
function validateURL {
    param (
        [string]$adminURL
    )

    $urlPattern = '^https:\/\/[a-zA-Z0-9-]+\.sharepoint\.com\/$'

    if ($adminURL -match $urlPattern) {
        return $true
    }
    else {
        return $false
    }
}

# Display header
function ShowHeader {
    Clear-Host
    Write-Host "##############################################################" -ForegroundColor Cyan
    Write-Host "#                                                            #" -ForegroundColor Cyan
    Write-Host "#   "-ForegroundColor Cyan -NoNewline; Write-Host "Remove target users from SharePoint and Teams for Cove" -ForegroundColor Yellow -NoNewline; Write-Host "   #" -ForegroundColor Cyan
    Write-Host "#   "-ForegroundColor Cyan -NoNewline; Write-host "Written by Jason Prime"-ForegroundColor Yellow -NoNewline; Write-host "                                   #" -ForegroundColor Cyan
    Write-Host "#   "-ForegroundColor Cyan -NoNewline; Write-Host "Version "$appVersion -ForegroundColor Yellow -NoNewline; Write-Host  "                                               #" -ForegroundColor Cyan
    Write-Host "#                                                            #" -ForegroundColor Cyan
    Write-Host "##############################################################" -ForegroundColor Cyan
}

function showInstructions {
    
    ShowHeader
    Write-Host "" -ForegroundColor Green
    Write-Host "You will need the following to complete this successfully:"  -ForegroundColor Green
    Write-Host ""
    Write-Host "If you are editing SharePoint:" -ForegroundColor Green
    Write-Host "> A user account with at least the SharePoint administrator role" -ForegroundColor Green
    Write-Host "> The UPN of the above administrator account" -ForegroundColor Green
    Write-Host "> The UPN of the target user account you will be removing" -ForegroundColor Green
    Write-Host "> The URL of the SharePoint admin panel" -ForegroundColor Green
    Write-Host ""
    Write-Host "If you are editing Teams permissions:" -ForegroundColor Green
    Write-Host "> A global administrator account" -ForegroundColor Green
    Write-Host "> The UPN of the target user account you will be removing" -ForegroundColor Green
    Write-Host ""
    Write-Host -NoNewLine 'Press any key to continue...'
    $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
    GetOptions
}

# Display task status
function TaskStatus {
    ShowHeader
    Write-Host ""
    if ($whatIf) {
        Write-Host "> This is a test run" -ForegroundColor Green
    }
    else {
        Write-Host "> This is a live run, changes will be applied!" -ForegroundColor Red
    }

    Write-Host ""
    if ($changeSP -eq $false -or $whatIf) {
        Write-Host "> We won't edit SharePoint" -ForegroundColor Green
    }
    elseif ($changeSP) {
        Write-Host "> We will make changes to SharePoint" -ForegroundColor Red
    }
    
    if ($changeTeams -eq $false -or $whatIf) {
        Write-Host "> We won't edit Teams" -ForegroundColor Green
    }
    else {
        Write-Host "> We will make changes to Teams" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "SharePoint permissions editor" -ForegroundColor Green
    Write-Host ""
}

function askWhatIf {
    try {
        $whatIf = Read-Host -Prompt "Do you want to test run before making changes? (recommended!) (Yes or No)" 
        $whatIf = ConvertAnswer -answer $whatIf
        Write-Host $whatIf
        if ($whatIf -eq $null) {
            Write-Host $kashdjks -ForegroundColor Yellow
            Start-Sleep -Seconds 4
            askWhatIf  # Retry the function call
        }    
    }
    catch {
        Write-Host "ERROR in askWhatIf(): $_" -ForegroundColor Red
        Write-Host $kashdjks -ForegroundColor Yellow
        Start-Sleep -Seconds 3
        askWhatIf  # Restart options selection
    } #return $whatIf
}

function askChangeSP {
    try {
        $changeSP = Read-Host -Prompt "Do you want to remove the user from SharePoint? (Yes or No)" 
        $changeSP = ConvertAnswer -answer $changeSP
        Write-Host $changeSP
        if ($changeSP -eq $null) {
            Write-Host $kashdjks -ForegroundColor Yellow
            Start-Sleep -Seconds 4
            askChangeSP  # Retry the function call
        }    
    }
    catch {
        Write-Host "ERROR in askChangeSP(): $_" -ForegroundColor Red
        Write-Host $kashdjks -ForegroundColor Yellow
        Start-Sleep -Seconds 3
        askChangeSP  # Restart options selection
    } #return $changeSP

}

function askChangeTeams {
    try {
        $changeTeams = Read-Host -Prompt "Do you want to remove the user from Teams? (Yes or No)" 
        $changeTeams = ConvertAnswer -answer $changeTeams
        Write-Host $changeTeams
        if ($changeTeams -eq $null) {
            Write-Host $kashdjks -ForegroundColor Yellow
            Start-Sleep -Seconds 4
            askChangeTeams  # Retry the function call
        }    
    }
    catch {
        Write-Host "ERROR in askChangeTeams(): $_" -ForegroundColor Red
        Write-Host $kashdjks -ForegroundColor Yellow
        Start-Sleep -Seconds 3
        askChangeTeams  # Restart options selection
    } #return $ChangeTeams

}

function askUserUPN {
    try {
        $userUPN = Read-Host -Prompt "Please provide the target user's email address"
        if (-not (validateEmail -emailAddress $userUPN)) {
            Write-Host """$userUPN""" " Does not look like a valid email address" -ForegroundColor Red
            Start-Sleep -seconds 3
            askUserUPN
        }    
    } 
    catch {
        Write-Host "ERROR in askUserUPN(): $_" -ForegroundColor Red
        Write-Host $kashdjks -ForegroundColor Yellow
        Start-Sleep -Seconds 3
        askUserUPN  # Restart options selection
    } 
    Write-Host $UserUPN
    #return $UserUPN

}

Write-Host $askWhatIfAns = askWhatIf
Write-Host $askChangeSPAns = askChangeSP
Write-Host $askChangeTeamsAns = askChangeTeams
Write-Host $askUserUPNAns = askUserUPN
                
if ($changeSP) {
    DoSharePoint
}
if ($changeTeams) {
    DoTeams
}


# Prompt user for options

function GetOptions {
    ShowHeader
    
    Write-Host ""
    Write-Host "Please follow the prompts below to proceed." -ForegroundColor Green
    Write-Host ""

    $askWhatIfAns = askWhatIf
    # Write-Host "Test Run: $askWhatIfAns"

    $askChangeSPAns = askChangeSP
    # Write-Host "Change SharePoint: $askChangeSPAns"

    $askChangeTeamsAns = askChangeTeams
    # Write-Host "Change Teams: $askChangeTeamsAns"

    $askUserUPNAns = askUserUPN
    # Write-Host "User UPN: $askUserUPNAns"
                
    if ($ChangeSP) {
        DoSharePoint
    }
    if ($ChangeTeams) {
        DoTeams
    }
}

# Gather SharePoint details
function DoSharePoint {
    TaskStatus
    Write-Host "The portal address must include all slashes and the scheme or it will be rejected" -ForegroundColor Yellow
    Write-Host ""
    Write-host "I.E. https://contoso-admin.sharepoint.com/" -ForegroundColor Yellow
    Write-Host ""
    $adminURL = Read-Host -Prompt "Please provide the SharePoint admin URL"
    #validate URL
    if (-not (validateURL -adminURL $adminURL)) {
        Write-Host """$adminURL""" " Does not look like a valid SP portal URL" -ForegroundColor Red
        Start-Sleep -seconds 3
        DoSharePoint
        return
    }

    $adminUPN = Read-Host -Prompt "Please provide an Exchange Administrator email address"
    #Validate email entry
    if (-not (validateEmail -emailAddress $adminUPN)) {
        Write-Host """$adminUPN""" " Does not look like a valid email address" -ForegroundColor Red
        Start-Sleep -seconds 3
        DoSharePoint
        return
    }

    if ($whatIf -ne $true) {
        WhatIfFalse
    }
    else {
        SharePoint
    }
}

# WhatIf failsafe
function WhatIfFalse {
    TaskStatus
    Write-Host "This is a LIVE run. Please confirm the details are correct before continuing." -ForegroundColor Green
    Write-Host ""
    Write-Host "The account being removed is: $userUPN" -ForegroundColor Green
    Write-Host "The SharePoint tenant being accessed is: $adminURL" -ForegroundColor Green
    Write-Host "The administrator account being used to make changes is: $adminUPN" -ForegroundColor Green
    Write-Host ""
    $confirmPrompt = Read-Host -Prompt "Are these details correct?"
    $confirmPrompt = ConvertAnswer -answer $confirmPrompt

    if ($confirmPrompt) {
        SharePoint
    }
    else {
        Write-Host $kashdjks -ForegroundColor Yellow
        Start-Sleep -Seconds 3
        GetOptions  # Restart options selection
    }
}

# Perform SharePoint actions
function SharePoint {

    if ($changeSP) {
        # Connect to SPO and create an array

        ShowHeader
        Write-Host ""
        Write-Host "Editing SharePoint, please log in and wait..." -ForegroundColor Yellow

        $null = Connect-SPOService -Url $adminURL
        $siteUrls = (Get-SPOSite | Where-Object url -notlike "*-my.sharepoint.com*").url

        foreach ($site in $siteUrls) {
            # Check or add the site collection admin
            if ($user.IsSiteCollectionAdmin) {
                $adminIsAdmin = $true
                Write-Host $adminUPN" Already an admin of "$site
            }
            else { 
                set-SPOUser -Site $site -LoginName $adminUPN -IsSiteCollectionAdmin $true
                $adminIsAdmin = $false
                Write-Host $adminUPN" Added admin to "$site
            }
   
            # Try to delete the user
            try {
                $user = Get-SPOUser -Site $site -LoginName $userUPN -ErrorAction Stop
           
                if ( $whatif -eq $false ) {
                    Remove-SPOUser -Site $site -LoginName $userUPN -ErrorAction Stop
                    if ($?) { Write-Output "Removed user from $site" } else { Write-Output "Remove failed for $site" }
                }
                else { Write-Host "Would remove" $user.loginname }
            }

            catch {
                Write-Host "ERROR in SharePoint(): $_"
            }
            Write-Host "_______________________________`n"
        } 

    }
    else { return }
}

# Perform Teams actions
function DoTeams {
    
    if ($changeTeams) {
        
        # ShowHeader
        Write-Host ""
        Write-Host "Editing Teams, please log in and wait..." -ForegroundColor Yellow
        Connect-MicrosoftTeams
        

        $teamResult = @()

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
            catch { Write-Host "ERROR in DoTeams(): $_" }
            Write-Host "_______________________`n"
        }

    }

    if ( $whatIf -eq $false ) {
        Write-Host "The following Teams were edited:`n" $teamResult "`n`n"
    }
    else { Write-Host "The following Teams would have been edited:`n" $teamResult "`n`n" }
}


# Start the script
# Start-Sleep -seconds 30
showInstructions
