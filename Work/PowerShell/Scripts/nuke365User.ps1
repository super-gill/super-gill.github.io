# Function to Change Password
function Change-UserPassword {
    param (
        [string]$userUPN,
        [string]$newPassword
    )
    # Change the user's password
    Set-MsolUserPassword -UserPrincipalName $userUPN -NewPassword $newPassword -ForceChangePassword $false
}

# Function to Revoke Sessions
function Revoke-UserSessions {
    param (
        [string]$userUPN
    )
    # Revoke the user's sessions
    Revoke-AzureADUserAllRefreshToken -ObjectId (Get-AzureADUser -UserPrincipalName $userUPN).ObjectId
}

# Function to Convert User to Shared Mailbox
function Convert-ToSharedMailbox {
    param (
        [string]$userUPN
    )
    # Convert user to shared mailbox
    Set-Mailbox -Identity $userUPN -Type Shared
}

# Function to Remove Licenses
function Remove-UserLicenses {
    param (
        [string]$userUPN
    )
    # Placeholder
    # Pretty sure this requires MGGraph now
}

# Function to Remove from Groups
function Remove-UserFromGroups {
    param (
        [string]$userUPN
    )
    # Remove user from all groups
    $user = Get-AzureADUser -UserPrincipalName $userUPN
    $groups = Get-AzureADUserMembership -ObjectId $user.ObjectId
    foreach ($group in $groups) {
        Remove-AzureADGroupMember -ObjectId $group.ObjectId -MemberId $user.ObjectId
    }
}

# Function to Remove SharePoint Permissions
function Remove-SharePointPermissions {
    param (
        [string]$userUPN
    )
    # Placeholder
}

function Add-AutoReply {
    param (
        [string]$userUPN
    )
    # Placeholder
}

function Add-MailboxForward {
    param (
        [string]$userUPN
    )
    # Placeholder
}

function Add-MailboxPermissions {
    param (
        [string]$userUPN
    )
    # Placeholder
}

# Main Offboarding Function
function Offboard-User {
    param (
        [string]$userUPN
    )

    # Generate a new random password
    $newPassword = [System.Web.Security.Membership]::GeneratePassword(12, 3)

    # Change user password
    Change-UserPassword -userUPN $userUPN -newPassword $newPassword

    # Revoke user sessions
    Revoke-UserSessions -userUPN $userUPN

    # Convert user to shared mailbox
    Convert-ToSharedMailbox -userUPN $userUPN

    # Remove licenses
    Remove-UserLicenses -userUPN $userUPN

    # Remove user from all groups
    Remove-UserFromGroups -userUPN $userUPN

    # Remove SharePoint permissions
    Remove-SharePointPermissions -userUPN $userUPN
    
    # Add an autor-reply
    Add-AutoReply -userUPN $userUPN -message $placeHolder
    
    # Add a mail forward
    Add-MailboxForward -userUPN $userUPN -toAddress $placeHolder
    
    # Add mailbox permissions
    Add-MailboxPermissions -userUPN $userUPN -delegate $placeHolder

    Write-Output "User $userUPN has been offboarded successfully."
}

# Example usage
$userUPN = "user@example.com"
Offboard-User -userUPN $userUPN
