﻿<#

Set-ExecutionPolicy RemoteSigned
$UserCredential = Get-Credential
$Session = New-PSSession -ConfigurationName Microsoft.Exchange -ConnectionUri https://outlook.office365.com/powershell-liveid/ -Credential $UserCredential -Authentication  Basic -AllowRedirection
Import-PSSession $Session
Get-Mailbox

Connect-MsolService

#>


Write-Host "Finding Azure Active Directory Accounts..."
$Users = Get-MsolUser -All | where {$_.isLicensed -eq $true} | ? { $_.UserType -ne "Guest" } #where {$_.isLicensed -eq $true} | 
$Report = [System.Collections.Generic.List[Object]]::new()
Write-Host "Processing" $Users.Count "accounts..." 
ForEach ($User in $Users) {
    $MFAEnforced = $User.StrongAuthenticationRequirements.State
    $MFAPhone = $User.StrongAuthenticationUserDetails.PhoneNumber
    $DefaultMFAMethod = ($User.StrongAuthenticationMethods | ? { $_.IsDefault -eq "True" }).MethodType
    If (($MFAEnforced -eq "Enforced") -or ($MFAEnforced -eq "Enabled")) {
        Switch ($DefaultMFAMethod) {
            "OneWaySMS" { $MethodUsed = "One-way SMS" }
            "TwoWayVoiceMobile" { $MethodUsed = "Phone call verification" }
            "PhoneAppOTP" { $MethodUsed = "Hardware token or authenticator app" }
            "PhoneAppNotification" { $MethodUsed = "Authenticator app" }
        }
    }
    Else {
        $MFAEnforced = "Not Enabled"
        $MethodUsed = "MFA Not Used" 
    }
  
    $ReportLine = [PSCustomObject] @{
        User        = $User.UserPrincipalName
        Name        = $User.DisplayName
        MFAUsed     = $MFAEnforced
        MFAMethod   = $MethodUsed 
        PhoneNumber = $MFAPhone
    }
                 
    $Report.Add($ReportLine) 
}

Write-Host "Report is in c:\temp\MFAUsers.CSV"
$Report | Select User, Name, MFAUsed, MFAMethod, PhoneNumber | Sort Name | Out-GridView
$Report | Sort Name | Export-CSV -NoTypeInformation -Encoding UTF8 c:\temp\MFAUsers.csv