Set-ExecutionPolicy RemoteSigned
Install-Module -Name ExchangeOnlineManagement -force
Import-Module ExchangeOnlineManagement
Connect-ExchangeOnline
#get-mailbox | format-list displayname,userprincipalname

#disconnect-exchangeonline