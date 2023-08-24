
#Connect to Exchange Online PS
Set-ExecutionPolicy RemoteSigned
$UserCredential = Get-Credential
$Session = New-PSSession -ConfigurationName Microsoft.Exchange -ConnectionUri https://outlook.office365.com/powershell-liveid/ -Credential $UserCredential -Authentication  Basic -AllowRedirection
Import-PSSession $Session
Get-Mailbox





#############
############# DIRSYNC #############

Start-ADSyncSyncCycle -PolicyType Initial
Start-ADSyncSyncCycle -PolicyType Delta

#enable or disable dirsync
Set-MsolDirSyncEnabled -EnableDirSync [ $true or $false ] # -Force -TenantId [ID]

#############
############# Dummy Files #############
# https://www.windows-commandline.com/how-to-create-large-dummy-file/

# FSUTIL
fsutil file createnew [filename] [length]
fsutil file createnew [path\filename] [length]
# Example
fsutil file createnew c:\users\apprentice\destop\myfile.txt 65000

#############
############# Execution policy, "machinepolicy" and "userpolicy" are set by GP #############
# https://docs.microsoft.com/en-us/powershell/module/microsoft.powershell.security/set-executionpolicy?view=powershell-6

# Set the policy
Get-ExecutionPolicy -list
Set-ExecutionPolicy -scope [name from the list above] -ExecutionPolicy [level ie bypass remotesigned]
Set-executionpolicy remotesigned #sets localmachine as ep remote signed
Set-executionpolicy -ExecutionPolicy RemoteSigned -Scope LocalMachine #same as above but full length add -force to suppress prompts and really fuck things up

# Process is current PS session
Set-ExecutionPolicy -scope Process -ExecutionPolicy -ExecutionPolicy bypass

# CurrentUser is all PS sessions under the current logged on user
Set-ExecutionPolicy -scope CurrentUser -ExecutionPolicy bypass

# LocalMachine (DEFAULT) is all PS sessions for all users of the machine
Set-ExecutionPolicy -scope LocalMachine -ExecutionPolicy bypass

# Remove a policy, use it to unfuck the policy when you have -force 'd everything
Set-ExecutionPolicy -scope [name from the list above] -ExecutionPolicy undefined

#############
############# Nested VMs #############
# https://docs.microsoft.com/en-us/virtualization/hyper-v-on-windows/user-guide/nested-virtualization
# There are hardware requirements that must be met for this to work

#Enable Nested Virtualization
Set-VMProcessor -VMName <VMName> -ExposeVirtualizationExtensions $true

#Disable Nested Virtualization
Set-VMProcessor -VMName <VMName> -ExposeVirtualizationExtensions $false

#Enable MAC Spoofing (preferred and performed on the first level of the switch)
Get-VMNetworkAdapter -VMName <VMName> | Set-VMNetworkAdapter -MacAddressSpoofing On

#Enable NAT (if MAC spoofing isnt available and is performed on the host VM regardless of level)
New-VMSwitch -Name VmNAT -SwitchType Internal
New-NetNat –Name LocalNAT –InternalIPInterfaceAddressPrefix “192.168.100.0/24”

#Assign an IP address to the adapter
Get-NetAdapter "vEthernet (VmNat)" | New-NetIPAddress -IPAddress 192.168.100.1 -AddressFamily IPv4 -PrefixLength 24

#Assign a DNS and IP address all in one
Get-NetAdapter "Ethernet" | New-NetIPAddress -IPAddress 192.168.100.2 -DefaultGateway 192.168.100.1 -AddressFamily IPv4 -PrefixLength 24
Netsh interface ip add dnsserver “Ethernet” address=<my DNS server>

#############
############# Exchange Online #############
# https://docs.microsoft.com/en-us/powershell/exchange/exchange-online/connect-to-exchange-online-powershell/connect-to-exchange-online-powershell?view=exchange-ps

#Connect to Exchange Online PS
Set-ExecutionPolicy RemoteSigned
$UserCredential = Get-Credential
$Session = New-PSSession -ConfigurationName Microsoft.Exchange -ConnectionUri https://outlook.office365.com/powershell-liveid/ -Credential $UserCredential -Authentication  Basic -AllowRedirection
Import-PSSession $Session
Get-Mailbox

#End the session
Remove-PSSession $Session

#Useful commands for Exhchange Online
#Add calendar permission, also works for public folder access
Add-Mailboxfolderpermission -Identity [user id]:\calendar -user [user id] -Accessrights [level]
Add-Mailboxfolderpermission -Identity [user id]:\contacts -user [user id] -Accessrights [level]

#enable unlimited archive
Set-OrganizationConfig -AutoExpandingArchive

Add-Mailboxfolderpermission -Identity info@aminex-plc.com:\calendar -user jane.hywood@aminex-plc.com -AccessRights editor

#List Mailboxes and show forards
Get-Mailbox | select UserPrincipalName,ForwardingSmtpAddress,DeliverToMailboxAndForward
#As above but export to CSV
Get-Mailbox | select UserPrincipalName,ForwardingSmtpAddress,DeliverToMailboxAndForward | Export-csv .\users.csv -NoTypeInformation

#Remove / set a forward
Set-Mailbox paulie -ForwardingAddress $NULL -ForwardingSmtpAddress $NULL

#Get permissions that a specific user has
Get-Mailbox | Get-MailboxPermission -User [username]
Get-MailboxFolderPermission -Identity [user] -User [user]

#Add mailbox permission with automap tag, inhertiance
Add-Mailboxpermission -Identity [target mailbox] -user [user id] -AccessRights [level] -InheritanceType All -Automapping $false
Add-Mailboxpermission -Identity ben -user kally -AccessRights editor -InheritanceType All

#Delete MSOL user
Connect-MsolService
Remove-MsolUser -UserPrincipalName "alison.gamble@cila.co.uk" -Force -RemoveFromRecycleBin
Get-MsolUser -All -ReturnDeletedUsers 
Get-MsolUser -ReturnDeletedUsers | Remove-MsolUser -RemoveFromRecycleBin -Force

Remove-MsolUser -UserPrincipalName "davidchew@contoso.com"
Remove-MsolUser -UserPrincipalName "davidchew@contoso.com" -Force
Remove-MsolUser -UserPrincipalName "davidchew@contoso.com" -RemoveFromRecycleBin

#Set Exchange admin impersonation privs
New-ManagementRoleAssignment –Name:MigrationimpersonationAssignment –Role:applicationimpersonation –User:[DOMAIN\USER]
Get-ExchangeServer | Add-ADPermission -User [DOMAIN\USER] -extendedRights ms-Exch-EPI-Impersonation -InheritanceType none
Get-MailboxDatabase | Add-ADPermission -User [DOMAIN\USER] -extendedRights ms-Exch-EPI-May-Impersonate -InheritanceType none

#Add and remove aliases comma seperated for multiple addresses
Set-Mailbox "john nyota" -EmailAddresses @{remove="john@micentre.com"}
Set-Mailbox "Dan Jump" -EmailAddresses @{add="dan.jump@northamerica.contoso.com"}

#Add user to a group
Connect-MsolService
$groupid = Get-MsolGroup | Where-Object {$_.DisplayName -eq “GROUP NAME”}

#############
############# Powershell #############
# never got these to work so more power to you

Get-PSSnapin -Registered
Add-PSSnapin Microsoft.SharePoint.PowerShell