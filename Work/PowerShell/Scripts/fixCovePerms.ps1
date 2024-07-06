# Used to remove special permissions in SharePoint including share links and remove the target user from Teams
# Written by Jason Mcdill
$appVersion = 1

# Global variables
[bool]$whatIf = $true
[string]$userUPN
[string]$adminURL
[string]$adminUPN
[string]$sassMe = "Invalid answer"
[bool]$firstRun = $true

# Convert to boolean 
function convertAnswer {
    param (
        [string]$answer
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
        [string]$url
    )

    $urlPattern = '^https:\/\/[a-zA-Z0-9-]+\.sharepoint\.com\/$'

    if ($url -match $urlPattern) {
        return $true
    }
    else {
        return $false
    }
}

# Display header
function showHeader {
    Clear-Host
    Write-Host "##############################################################" -ForegroundColor Cyan
    Write-Host "#                                                            #" -ForegroundColor Cyan
    Write-Host "#   " -ForegroundColor Cyan -NoNewline; Write-Host "Remove target users from SharePoint and Teams for Cove" -ForegroundColor Yellow -NoNewline; Write-Host "   #" -ForegroundColor Cyan
    Write-Host "#   " -ForegroundColor Cyan -NoNewline; Write-host "Written by Jason Prime" -ForegroundColor Yellow -NoNewline; Write-host "                                   #" -ForegroundColor Cyan
    Write-Host "#   " -ForegroundColor Cyan -NoNewline; Write-Host "Version $appVersion" -ForegroundColor Yellow -NoNewline; Write-Host  "                                                #" -ForegroundColor Cyan
    Write-Host "#                                                            #" -ForegroundColor Cyan
    Write-Host "##############################################################" -ForegroundColor Cyan

    if ($env:USERNAME.ToLower() -eq "daniel.whitford") {
        Write-Host ""
        Write-Host "WARNING: A DANIEL IS DETECTED" -ForegroundColor Red
        Write-Host ""
    }
    elseif ($env:USERNAME.ToLower() -eq "neels.steyn") {
        Write-Host ""
        Write-Host "WARNING: FILTHY SOUTH-AFRICAN MODE ENABLED" -ForegroundColor Red
        Write-Host ""
    }
}


function showInstructions {
    showHeader
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
    Write-Host "*It is strongly recommended to use the test run first*" -ForegroundColor Green
    Write-Host ""
    Write-Host -NoNewLine 'Press any key to continue...'
    $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown') # listen for a keypress
    getOptions
}

# Display task status
function taskStatus {
    showHeader
    Write-Host ""

    # Remind the user the status of WhatIf
    if ($whatIf) {
        Write-Host "> This is a test run" -ForegroundColor Green
    }
    else {
        Write-Host "> This is a live run, changes will be applied!" -ForegroundColor Red
    }

    # Remind the user the status of SP and Teams changes
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
    
    ShowHeader
    Write-Host ""
    Write-Host "SharePoint permissions editor" -ForegroundColor Green
    Write-Host ""
}

# Ask if we are enabling WhatIf
function askWhatIf {
    try {
        $whatIf = Read-Host -Prompt "Do you want to test run before making changes? (recommended!) (Yes or No)" 
        $whatIf = convertAnswer -answer $whatIf
        if ($null -eq $whatIf) {
            Write-Host $sassMe -ForegroundColor Yellow
            $whatIf = $true
            Start-Sleep -Seconds 4
            askWhatIf  # Retry
        }
        return $whatIf
    }
    catch {
        Write-Host "ERROR in askWhatIf(): $_" -ForegroundColor Red
        Write-Host $sassMe -ForegroundColor Yellow
        Start-Sleep -Seconds 3
        askWhatIf  # Retry
    }
}

# Ask if we are making changes to SharePoint
function askChangeSP {
    try {
        $changeSP = Read-Host -Prompt "Do you want to remove the user from SharePoint? (Yes or No)" 
        $changeSP = convertAnswer -answer $changeSP
        if ($null -eq $changeSP) {
            Write-Host $sassMe -ForegroundColor Yellow
            $changeSP = $null
            Start-Sleep -Seconds 4
            askChangeSP  # Retry
        }
        return $changeSP
    }
    catch {
        Write-Host "ERROR in askChangeSP(): $_" -ForegroundColor Red
        Write-Host $sassMe -ForegroundColor Yellow
        Start-Sleep -Seconds 3
        askChangeSP  # Retry
    }
}

# Ask if we are making changes to Teams
function askChangeTeams {
    try {
        $changeTeams = Read-Host -Prompt "Do you want to remove the user from Teams? (Yes or No)" 
        $changeTeams = convertAnswer -answer $changeTeams
        if ($null -eq $changeTeams) {
            Write-Host $sassMe -ForegroundColor Yellow
            $changeTeams = $null
            Start-Sleep -Seconds 4
            askChangeTeams  # Retry
        }
        return $ChangeTeams
    }
    catch {
        Write-Host "ERROR in askChangeTeams(): $_" -ForegroundColor Red
        Write-Host $sassMe -ForegroundColor Yellow
        Start-Sleep -Seconds 3
        askChangeTeams  # Retry
    }
}

# Ask for the target users UPN
function askUserUPN {
    try {
        $userUPN = Read-Host -Prompt "Please provide the target user's email address"
        if (-not (validateEmail -emailAddress $userUPN)) {
            Write-Host """$userUPN""" " Does not look like a valid email address" -ForegroundColor Red
            $userUPN = $null
            Start-Sleep -seconds 3
            askUserUPN # Retry
        }
        return $userUPN
    }
    catch {
        Write-Host "ERROR in askUserUPN(): $_" -ForegroundColor Red
        Write-Host $sassMe -ForegroundColor Yellow
        Start-Sleep -Seconds 3
        askUserUPN  # Retry
    }
}

function runPermissionChanges {
    # Run the selected permission change functions
    if ($changeSP) {
        Write-Host "doSharePoint selected "$changeSP
        prepSharePoint
    }
    if ($changeTeams) {
        Write-Host "doTeams selected "$changeTeams
        doTeams
    }
}

# Run the question functions to gather inputs and options
function getOptions {
    showHeader

    # Check if this is the first run
    if ($firstRun -eq $false -and $whatIf) {
        Write-Host ""
        $runLive = Read-Host -Prompt "Do you want to perform a live run? (Yes or No)"
        convertAnswer -answer $runLive
        if ($runLive) {
            runPermissionChanges
        }
    }
    else {
        Write-Host ""
        Write-Host "Please follow the prompts below to proceed." -ForegroundColor Green
        Write-Host ""
    
        $whatIf = askWhatIf
        $changeSP = askChangeSP
        $changeTeams = askChangeTeams
        $userUPN = askUserUPN
        
        runPermissionChanges
    }
}

# Gather additional SharePoint details
function prepSharePoint {
    taskStatus
    Write-Host "The portal address must include all slashes and the scheme or it will be rejected" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "I.E. https://contoso-admin.sharepoint.com/" -ForegroundColor Yellow
    Write-Host ""
    
    $adminURL = Read-Host -Prompt "Please provide the SharePoint admin URL"
    
    # Validate URL
    if (-not (validateURL -url $adminURL)) {
        Write-Host """$adminURL""" " does not look like a valid SharePoint portal URL" -ForegroundColor Red
        Start-Sleep -seconds 3
        doSharePoint
        return
    }

    $adminUPN = Read-Host -Prompt "Please provide an Exchange Administrator email address"
    
    # Validate email entry
    if (-not (Validate-Email -emailAddress $adminUPN)) {
        Write-Host """$adminUPN""" " does not look like a valid email address" -ForegroundColor Red
        Start-Sleep -seconds 3
        doSharePoint
        return
    }

    # Run the WhatIf failsafe
    if ($whatIf -ne $true) {
        whatIfFalse
    }
    else {
        doSharePoint
    }
}

# Get the user to confirm they dont want to run a WhatIf first
function whatIfFalse {
    taskStatus
    Write-Host "This is a LIVE run. Please confirm the details are correct before continuing." -ForegroundColor Green
    Write-Host ""
    Write-Host "The account being removed is: $userUPN" -ForegroundColor Green
    Write-Host "The SharePoint tenant being accessed is: $adminURL" -ForegroundColor Green
    Write-Host "The administrator account being used to make changes is: $adminUPN" -ForegroundColor Green
    Write-Host ""
    
    $confirmPrompt = Read-Host -Prompt "Are these details correct?"
    $confirmPrompt = convertAnswer -answer $confirmPrompt

    if ($confirmPrompt) {
        doSharePoint
    }
    else {
        Write-Host "Restarting selection..." -ForegroundColor Yellow
        Start-Sleep -Seconds 3
        getOptions  # Restart options selection
    }
}

# Perform SharePoint actions
function doSharePoint {
    if ($changeSP) {
        # Connect to SPO and create an array
        showHeader
        Write-Host ""
        Write-Host "Editing SharePoint, please log in and wait..." -ForegroundColor Yellow

        $null = Connect-SPOService -Url $adminURL
        $siteUrls = (Get-SPOSite | Where-Object url -notlike "*-my.sharepoint.com*").url

        foreach ($site in $siteUrls) {
            # Check or add the site collection admin
            try {
                $user = Get-SPOUser -Site $site -LoginName $adminUPN -ErrorAction Stop
                if ($user.IsSiteCollectionAdmin) {
                    Write-Host "$adminUPN already an admin of $site"
                }
                else {
                    Set-SPOUser -Site $site -LoginName $adminUPN -IsSiteCollectionAdmin $true
                    Write-Host "$adminUPN added as admin to $site"
                }
            }
            catch {
                Write-Host "Error adding admin to" $site ": " $_ -ForegroundColor Red
            }

            # Try to delete the user
            try {
                $user = Get-SPOUser -Site $site -LoginName $userUPN -ErrorAction Stop
                if ($whatIf -eq $false) {
                    Remove-SPOUser -Site $site -LoginName $userUPN -ErrorAction Stop
                    if ($?) {
                        Write-Host "Removed user from $site" -ForegroundColor Green
                    }
                    else {
                        Write-Host "Remove failed for $site" -ForegroundColor Red
                    }
                }
                else {
                    Write-Host "Would remove $userUPN from $site" -ForegroundColor Yellow
                }
            }
            catch {
                Write-Host $_ -ForegroundColor Red
            }
            Set-SPOUser -Site $site -LoginName $adminUPN -IsSiteCollectionAdmin $true
            Write-Host "$adminUPN removed from $site"
            Write-Host "_______________________________`n"
        }
    }
    else {
        return
    }
}

# Perform Teams actions
function doTeams {
    if ($changeTeams) {
        Write-Host ""
        Write-Host "Editing Teams, please log in and wait..." -ForegroundColor Yellow
        Connect-MicrosoftTeams

        $teamResult = @()
        $teams = Get-Team

        foreach ($team in $teams) {
            try {
                if (Get-TeamUser -GroupId $team.GroupId | Where-Object user -Like $userUPN) {
                    if ($whatIf -eq $false) {
                        Remove-TeamUser -GroupId $team.GroupId -User $userUPN
                        $teamResult += $team.DisplayName
                        Write-Host "$userUPN was removed from $team.DisplayName" -ForegroundColor Green
                    }
                    else {
                        Write-Host ">> Would remove $userUPN from $team.DisplayName" -ForegroundColor Yellow
                        $teamResult += $team.DisplayName
                    }
                }
                else {
                    Write-Host "$userUPN not found in $team.DisplayName" -ForegroundColor Red
                }
            }
            catch {
                Write-Host "Error in doTeams(): $_" -ForegroundColor Red
            }
            Write-Host "_______________________`n"
        }

        if ($whatIf -eq $false) {
            Write-Host "The following Teams were edited:`n" -ForegroundColor Green
            $teamResult | ForEach-Object { Write-Host $_ -ForegroundColor Green }
        }
        else {
            Write-Host "The following Teams would have been edited:`n" -ForegroundColor Yellow
            $teamResult | ForEach-Object { Write-Host $_ -ForegroundColor Yellow }
        }
    }
    if ($whatIf) {
        $firstRun = $false
        getOptions
    }
    else {
        return
    }
}

# Start the script
showInstructions
