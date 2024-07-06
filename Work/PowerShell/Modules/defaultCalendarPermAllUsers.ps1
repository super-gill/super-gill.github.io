#set the default calendar object to editor for every user

param (
    [bool]$WhatIf = $true,
    [string]$PermissionLevel = "editor"
)

function DoPerms {
    param (
        [bool]$WhatIf,
        [string]$PermissionLevel
    )

    Connect-ExchangeOnline

    foreach ($user in Get-Mailbox -RecipientTypeDetails UserMailbox) {
        $cal = $user.PrimarySmtpAddress.ToString() + ":\Calendar"
        if ($WhatIf) {

            Write-Host "Would set default to "$PermissionLevel" for "$user  
        }
        else {

            Set-MailboxFolderPermission -Identity $cal -User Default -AccessRights $AccessRights
        
        }
    }
}

DoPerms -WhatIf $WhatIf -PermissionLevel $PermissionLevel