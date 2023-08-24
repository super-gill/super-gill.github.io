#Group and Distro management

#list groups
Get-UnifiedGroup

#list distribution lists
Get-DistributionGroup

#enable external senders in a 365 group
Set-UnifiedGroup -Identity engineering@carillion.com -RequireSenderAuthenticationEnabled $false

#enable external senders in a distribution list
Set-DistributionGroup -identity engineering@carillion.com -RequireSenderAuthenticationEnabled $false