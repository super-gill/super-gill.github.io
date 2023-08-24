#############
############# DIRSYNC #############

Start-ADSyncSyncCycle -PolicyType Initial
Start-ADSyncSyncCycle -PolicyType Delta

#enable or disable dirsync
Set-MsolDirSyncEnabled -EnableDirSync [ $true or $false ] # -Force -TenantId [ID]