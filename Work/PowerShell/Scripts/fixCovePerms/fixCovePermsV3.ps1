# Used to remove special permissions in SharePoint including share links and remove the target user from Teams
# Written by Jason Mcdill

# Changes:
# Added parameter for showHelp and comment based help option
# Moved the key global variables to params so they can be addressed from the cli (in future)
# Removed the hard fail if the session is elevated - this was for logging but i never implemented the logging
# Removed hilarious but not very professional messages
# Updated comments and added more inline comments on complex logic
# Seperated the SP specific questions to their own functions so they can be handled independently
# Changed the name of whatIfFalse() to userConfirm and made it mandatory regardless of $whatIf value

# Issues:
# There is no way for me to currently implement no UI without re-writing changeSP() and doTeams() (disabled the feature if its attempted)
# userConfirm does not recieve $adminURL and $adminUPN through the parameters on the function call
# The script throws if the spo and teams modules are not installed, catching this and providing feedback would be better

param (
    [bool]$showHelp = $false,
    [bool]$whatIf = $true,
    [bool]$isadmin,
    [string]$userUPN,
    [string]$adminURL,
    [string]$adminUPN
)

# Global variables (not addressible in the CLI)
[string]$sassMe = "Invalid answer"
[int]$version = 3
[string]$scriptName = [system.io.path]::GetFileName($PSCommandPath)
[string]$author = "Jason Mcdill"

# My version of comment help, less good looking and more lines of code.
if ($showHelp) {
    
    Clear-Host
    Write-Host "Showing help" -ForegroundColor Yellow
    
    Write-Host ""
    
    Write-Host "Title: " -ForegroundColor Yellow
    Write-Host $scriptName
    
    Write-Host ""
    
    Write-Host "Version: " -ForegroundColor Yellow
    Write-Host $version
    
    Write-Host ""
    
    Write-Host "Description: " -ForegroundColor Yellow
    Write-Host "This script guides the user through removing the permissions in SPO and Teams that Cove backup sees and cant remove."

    Write-Host ""

    Write-Host "Elevation: " -ForegroundColor Yellow
    Write-Host "This script does not required elevation."

    Write-Host ""

    Write-Host "Example 1:  " -ForegroundColor Yellow
    Write-Host "Run with the UI (recommended)"
    Write-Host "$($scriptName)"
    
    Write-Host ""

    Write-Host "Example 1:  " -ForegroundColor Yellow
    Write-Host "Run without a UI (experimental)"
    Write-Host "$($scriptName) -userUPN username@contoso.com" 
    Write-Host "   -adminURL https://contoso-admin.sharepoint.com/" 
    Write-Host "   -adminUPN admin@contoso.com" 
    Write-Host "   -whatIf"$"true"
    
    Write-Host ""

    Write-Host "Example 2:  " -ForegroundColor Yellow
    Write-Host "Run the comment help"
    Write-Host "$($scriptName) -showHelp"$"true"

    Write-Host ""

    Write-Host "Author: " -ForegroundColor Yellow
    Write-Host $author
    
    Write-Host ""
    exit
}

# General function to convert a yes/no value to boolean 
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

# General function to validate email addresses
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

# Check if the current PowerShell session is running as administrator

function checkAdminSession {
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

    if ($isAdmin) {
        showHeader
        Write-Host ""
        Write-Host "Do not run this as an administrator, restart PowerShell as the logged in user."
        Write-Host ""
        Write-Host -NoNewLine 'Press any key to continue...'
        $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown') # listen for a keypress
        Clear-Host
        Start-Sleep -seconds 5
        showInstructions
    }
    else {
        showInstructions
    }
}

# General function to validate the URL
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

# Display the header
function showHeader {
    Clear-Host
    if ($isadmin) { Write-Host "[Running as administrator]" }
    Write-Host "##############################################################" -ForegroundColor Cyan
    Write-Host "#                                                            #" -ForegroundColor Cyan
    Write-Host "#   " -ForegroundColor Cyan -NoNewline; Write-Host "Remove target users from SharePoint and Teams for Cove" -ForegroundColor Yellow -NoNewline; Write-Host "   #" -ForegroundColor Cyan
    Write-Host "#   " -ForegroundColor Cyan -NoNewline; Write-host "Written by Jason Prime" -ForegroundColor Yellow -NoNewline; Write-host "                                   #" -ForegroundColor Cyan
    Write-Host "#   " -ForegroundColor Cyan -NoNewline; Write-Host "Version $version" -ForegroundColor Yellow -NoNewline; Write-Host  "                                                #" -ForegroundColor Cyan
    Write-Host "#                                                            #" -ForegroundColor Cyan
    Write-Host "##############################################################" -ForegroundColor Cyan
}

# Display the instructions splash
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
    Write-Host "*It is strongly recommended to use the test run feature first*" -ForegroundColor Green
    Write-Host ""
    Write-Host "Both the Teams and SP PowerShell modules are required and" -ForegroundColor Yellow
    Write-Host "can be installed from the Digital Origin Company Portal app" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Run "" .\$($scriptName) -getHelp"$"true "" for more info" -ForegroundColor Yellow
    Write-Host ""
    Write-Host -NoNewLine 'Press any key to continue...'
    $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown') # listen for a keypress
    getOptions
}

# Present the current configuration of the script to the user
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
    
    Write-Host ""
    Write-Host "SharePoint permissions editor" -ForegroundColor Green
    Write-Host ""
}

# Ask if we are enabling WhatIf
function askWhatIf {
    try {
        showHeader
        Write-Host ""
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
        showHeader
        Write-Host ""
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
        showHeader
        Write-Host ""
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
        showHeader
        Write-Host ""
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
        Write-Host "doSharePoint selected"$changeSP
        prepSharePoint
    }
    if ($changeTeams) {
        Write-Host "doTeams selected"$changeTeams
        doTeams
    }
}

# Run the question functions to gather inputs and options
function getOptions {
    showHeader

    Write-Host ""
    Write-Host "Please follow the prompts below to proceed." -ForegroundColor Green
    Write-Host ""
    
    $whatIf = askWhatIf
    $changeSP = askChangeSP
    $changeTeams = askChangeTeams
    $userUPN = askUserUPN
        
    runPermissionChanges
}

# Ask for and validate the SPO portal URL
function askAdminURL {
    taskStatus
    Write-Host "The portal address must include all slashes and the scheme or it will be rejected" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "I.E. https://contoso-admin.sharepoint.com/" -ForegroundColor Yellow
    Write-Host ""
    $adminURL = Read-Host -Prompt "Please provide the SharePoint admin URL"
    if (-not (validateURL -url $adminURL)) {
        Write-Host """$adminURL""" " does not look like a valid SharePoint portal URL" -ForegroundColor Red
        $adminURL = $null
        Start-Sleep -seconds 3
        askAdminURL
        
    } return
}

# Ask for and validate the SP admin UPN
function askAdminUPN {
    taskStatus
    Write-Host "The portal address must include all slashes and the scheme or it will be rejected" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "I.E. https://contoso-admin.sharepoint.com/" -ForegroundColor Yellow
    Write-Host ""
    $adminUPN = Read-Host -Prompt "Please provide an Exchange Administrator email address"
    if (-not (validateEmail -emailAddress $adminUPN)) {
        Write-Host """$adminUPN""" " does not look like a valid email address" -ForegroundColor Red
        $adminUPN = $null
        Start-Sleep -seconds 3
        askAdminUPN
    } return
}

# Gather additional SharePoint details
function prepSharePoint {

    $adminURL = askAdminURL
    $adminUPN = askadminUPN

    # Let the user check and confirm their inputs
    userConfirm -userUPN $userUPN -adminURL $adminURL -adminUPN $adminUPN
}

# Perform SharePoint actions
function doSharePoint {
    if ($changeSP) {
        # Connect to SPO and create an array
        showHeader
        Write-Host ""
        Write-Host "Editing SharePoint, please log in and wait..." -ForegroundColor Yellow

        function connectSPO {

            param (
                [string]$adminURL
            )

            try {
                $null = Connect-SPOService -Url $adminURL 
            } 
            catch {
                Write-Host ""
                Write-Host "Connecting to SharePoint Online failed: " -ForegroundColor Red 
                Write-Host "Ensure the module is installed" -ForegroundColor Red 
                Write-Host "Check the details you entered are correct" -ForegroundColor Red 
                Write-Host ""
                Write-Host "Restarting the SharePoint editor"
                Write-Host ""
                $adminUPN = $null
                Start-Sleep -seconds 5
                askAdminUPN
            }
        }

        connectSPO -adminURL $adminURL

        $siteUrls = (Get-SPOSite | Where-Object url -notlike "*-my.sharepoint.com*").url # Create an array of the site names and exclude the OneDrive site

        foreach ($site in $siteUrls) {
            # Check or add the site collection admin
            try {
                Write-Host $site
                $user = Get-SPOUser -Site $site -LoginName $adminUPN -ErrorAction Stop > $null # check if adminURL is already a site collection admin
                if ($user.IsSiteCollectionAdmin) {
                    Write-Host "$adminUPN already an admin"
                }
                else {
                    Set-SPOUser -Site $site -LoginName $adminUPN -IsSiteCollectionAdmin $true > $null
                    Write-Host "$adminUPN added as admin"
                }
            }
            catch {
                Write-Host "Error adding admin to" $site ": " $_ -ForegroundColor Red
            }

            # Try to delete the user
            try {
                $user = Get-SPOUser -Site $site -LoginName $userUPN -ErrorAction Stop > $null # Check if the user is present in the site
                if ($whatIf -eq $false) {
                    Remove-SPOUser -Site $site -LoginName $userUPN -ErrorAction Stop > $null # Remove the user if whatIf is false
                    if ($?) {
                        Write-Host "Removed user" -ForegroundColor Green
                    }
                    else {
                        Write-Host "Remove failed" -ForegroundColor Red
                    }
                }
                else {
                    Write-Host "Would remove user" -ForegroundColor Yellow
                }
            }
            catch {
                Write-Host $_ -ForegroundColor Red
            }
            Set-SPOUser -Site $site -LoginName $adminUPN -IsSiteCollectionAdmin $true > $null # Remove adminUPN from site collection admin
            Write-Host "$adminUPN removed"
            Write-Host "_______________________________`n"
        }
        # if whatIf is true and we arent running Teams changes, ask the user if we should re-run the script live with the current settings
        if ($whatIf -and ($changeTeams -eq $false)) {
            $runLive = Read-Host -Prompt "Do you want to run this live with the current settings? (Yes or No)"
            convertAnswer -answer $runLive
            if ($runLive) {
                $whatIf = $false
                Write-Host "Called what if false with: userUPN: $($userUPN) adminURL: $($adminURL) adminUPN: $($adminUPN)" # This is for debug and needs removed
                Start-Sleep -Seconds 5
                userConfirm -userUPN $userUPN -adminURL $adminURL -adminUPN $adminUPN
            }
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
        
        try {
            Connect-MicrosoftTeams > $null
        }
        catch {
            Write-Host ""
            Write-Host "Connecting to Teams Online failed, is the module installed?" -ForegroundColor Red
            Write-Host "Ensure the module is installed" -ForegroundColor Red 
            Write-Host "Check the details you entered are correct" -ForegroundColor Red 
            Write-Host ""
            Write-Host "Restarting the Teams editor..."
            Write-Host ""
            $adminUPN = $null
            Start-Sleep -Seconds 5
            askAdminUPN
        }

        $teamResult = @()
        $teams = Get-Team # Comprenhensive  array of Teams teams

        foreach ($team in $teams) {
            try {
                # If a user that matches the value of $userUPN is found as a member or owner of the team
                if (Get-TeamUser -GroupId $team.GroupId | Where-Object user -Like $userUPN) {
                    if ($whatIf -eq $false) {
                        Remove-TeamUser -GroupId $team.GroupId -User $userUPN
                        $teamResult += $team.DisplayName
                        Write-Host "$userUPN was removed from" $team.DisplayName -ForegroundColor Green
                    }
                    else {
                        Write-Host "Would remove $userUPN from $team" -ForegroundColor Yellow
                        $teamResult += $team.DisplayName # Add the Teams displayname to the results array, unlike SP the inital array contains all Team info
                    }
                }
                else {
                    Write-Host "$userUPN not found in " $team.DisplayName -ForegroundColor Red
                }
            }
            catch {
                Write-Host "Error in doTeams(): $_" -ForegroundColor Red
            }
            Write-Host "_______________________`n"
        }
        
        function reRunLive {
            # If $whatIf is true and $changeSP is true offer to re-run the changes live
            if ($whatIf -and $changeSP) {
                $runLive = Read-Host -Prompt "Do you want to run this live with the current settings?"
                convertAnswer -answer $runLive
                if ($runLive) {
                    $whatIf = $false
                    userConfirm -userUPN $userUPN -adminURL $adminURL -adminUPN $adminUPN
                }
            }
            # If $whatIf is true and $changeSP is false offer to re-run the changes live
            if ($whatIf -and -not $changeSP) {
                $runLive = Read-Host -Prompt "Do you want to run this live with the current settings?"
                convertAnswer -answer $runLive
                if ($runLive) {
                    $whatIf = $false
                    doTeams
                }
            }
        }
    }

    if ($whatIf -eq $false) {
        Write-Host "The following Teams were edited:`n" -ForegroundColor Green
        $teamResult | ForEach-Object { Write-Host $_ -ForegroundColor Green }
        Write-Host ""
        Write-Host ""
        reRunLive
    }
    else {
        Write-Host "The following Teams would have been edited:`n" -ForegroundColor Yellow
        $teamResult | ForEach-Object { Write-Host $_ -ForegroundColor Yellow }
        Write-Host ""
        Write-Host ""
        reRunLive

    }
}

# Get the user to confirm they dont want to run a WhatIf first
function userConfirm {

    # This function call requires parameters to complete correctly
    # userConfirm -userUPN $userUPN -adminURL $adminURL -adminUPN $adminUPN

    param (
        [string]$userUPN,
        [string]$adminURL,
        [string]$adminUPN
    )

    taskStatus
    if ($whatIf) {
        Write-Host "This is a TEST run. Please confirm the details are correct before continuing." -ForegroundColor Green
    }
    else { Write-Host "This is a LIVE run. Please confirm the details are correct before continuing." -ForegroundColor Yellow }
    Write-Host ""
    Write-Host "The account being removed is: $($userUPN)" -ForegroundColor Yellow
    Write-Host "The SharePoint tenant being accessed is: $($adminURL)" -ForegroundColor Yellow
    Write-Host "The administrator account being used to make changes is: $($adminUPN)" -ForegroundColor Yellow
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


# Start the script

if ($userUPN -ne "") {
    Write-Host ""
    Write-Host "Running the script without the UI has been disabled, restarting in UI mode..." -ForegroundColor Red
    Write-Host ""
    Start-Sleep -seconds 3
    checkAdminSession
}
checkAdminSession
