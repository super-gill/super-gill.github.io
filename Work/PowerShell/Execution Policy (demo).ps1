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