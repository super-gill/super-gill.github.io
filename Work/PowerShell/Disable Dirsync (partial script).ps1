#https://docs.microsoft.com/en-us/microsoft-365/enterprise/turn-off-directory-synchronization?view=o365-worldwide

Connect-MsolService
Set-MsolDirSyncEnabled -EnableDirSync $false