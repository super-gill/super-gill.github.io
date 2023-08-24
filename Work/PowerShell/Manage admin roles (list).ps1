#How to make custom roles

#Search for a role that includes the command you want to base the custom role around
get-managementrole -Cmdlet Get-DistributionGroup

#search for the cmdlt entries that exist on the parent
get-managementroleentry "Distribution groups\*"

#Create a new role
new-managementrole -name Dist-List-Admin -parent "Distribution Groups"

#ATM you can not pipe where-object with remove-managementroleentry so it must be done manually, below is 
#what i used when i created the above role. you can run these all at once in the ISE on a fresh page
#You must leave at least one cmdlt in the role or prepare for abundant errors abound
remove-ManagementRoleEntry  -Identity dist-list-admin\Get-AcceptedDomain
remove-ManagementRoleEntry  -Identity dist-list-admin\Get-DynamicDistributionGroup
remove-ManagementRoleEntry  -Identity dist-list-admin\Get-MailboxPreferredLocation
remove-ManagementRoleEntry  -Identity dist-list-admin\Get-OrganizationalUnit
remove-ManagementRoleEntry  -Identity dist-list-admin\Get-UnifiedAuditSetting
remove-ManagementRoleEntry  -Identity dist-list-admin\Set-OrganizationConfig
remove-ManagementRoleEntry  -Identity dist-list-admin\Set-UnifiedAuditSetting
remove-ManagementRoleEntry  -Identity dist-list-admin\Start-AuditAssistant
remove-ManagementRoleEntry  -Identity dist-list-admin\Write-AdminAuditLog
remove-ManagementRoleEntry  -Identity dist-list-admin\Remove-ExoJob
remove-ManagementRoleEntry  -Identity dist-list-admin\Get-ExoJob
remove-ManagementRoleEntry  -Identity dist-list-admin\Stop-ExoJob
remove-ManagementRoleEntry  -Identity dist-list-admin\Receive-ExoJob
remove-ManagementRoleEntry  -Identity dist-list-admin\Get-MessageRecallResult
remove-ManagementRoleEntry  -Identity dist-list-admin\Test-MailboxAssistant
remove-ManagementRoleEntry  -Identity dist-list-admin\Test-DatabaseEvent

#for reference, my piped remove- looks like this but it doesnt work yet :(
Get-ManagementRoleEntry  -Identity dist-list-admin* | Where-Object {$_.Name -ne 'Get-DistributionGroup'}
#and to remove all unwanted cmdlts:
Get-ManagementRoleEntry  -Identity dist-list-admin* | Where-Object {$_.Name -ne 'Get-DistributionGroup'} | Remove-ManagementRoleEntry


#Rerun get- to cinfirm the list of cmdlts
get-managementroleentry "Distribution groups\*"

#Assign the management role to a user OR create a role group and add the user in exchange online
New-ManagementRoleAssignment -Role dist-list-admin -user name@domain.com