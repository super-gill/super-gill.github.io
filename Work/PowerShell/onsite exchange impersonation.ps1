#Set Exchange admin impersonation privs
New-ManagementRoleAssignment –Name:MigrationimpersonationAssignment –Role:applicationimpersonation –User:[DOMAIN\USER]
Get-ExchangeServer | Add-ADPermission -User [DOMAIN\USER] -extendedRights ms-Exch-EPI-Impersonation -InheritanceType none
Get-MailboxDatabase | Add-ADPermission -User [DOMAIN\USER] -extendedRights ms-Exch-EPI-May-Impersonate -InheritanceType none