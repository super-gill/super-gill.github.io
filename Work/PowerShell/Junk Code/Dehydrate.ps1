# Dehydrate: 
Get-OrganizationConfig | Format-Table Identity,IsDehydrated
Enable-OrganizationCustomization
Get-OrganizationConfig | Format-Table Identity,IsDehydrated