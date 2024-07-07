#Mailbox managemet

#Add calendar permission, also works for public folder access
Add-Mailboxfolderpermission -Identity [user id]:\calendar -user [user id] -Accessrights [level]
Add-Mailboxfolderpermission -Identity [user id]:\contacts -user [user id] -Accessrights [level]

#Remove / set a forward
Set-Mailbox paulie -ForwardingAddress $NULL -ForwardingSmtpAddress $NULL


#autoreply with schedule
Set-MailboxAutoReplyConfiguration -Identity tony@contoso.com -AutoReplyState Scheduled -StartTime "7/10/2018 08:00:00" -EndTime "7/15/2018 17:00:00" -InternalMessage "Internal auto-reply message"

#autoreply without schedule
Set-MailboxAutoReplyConfiguration -Identity tony@contoso.com -AutoReplyState Enabled -InternalMessage "Internal auto-reply message." -ExternalMessage "External auto-reply message."
