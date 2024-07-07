$MyIdentity = Read-Host -Prompt 'Enter the target mailbox and folder "name@domain.com:/folder" '
$MyUser = Read-Host -prompt 'Enter the users mailbox "name@domain.com" '

Remove-MailboxFolderPermission -Identity $MyIdentity -user $MyUser