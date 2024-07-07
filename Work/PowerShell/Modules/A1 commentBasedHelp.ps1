<#

.SYNOPSIS

.DESCRIPTION

.PARAMETER Name

.PARAMETER Extension

.INPUTS

.OUTPUTS

.EXAMPLE

.LINK

#>

param (
    [bool]$whatIf = $true,
    [bool]$showHelp = $false
)


if ($showHelp) {

    [string]$author = "Jason Mcdill"
    [int]$version = 1
    [string]$scriptName = [system.io.path]::GetFileName($PSCommandPath)

    Clear-Host
    Write-Host "Showing help" -ForegroundColor Yellow
    
    Write-Host ""
    
    Write-Host "Title: " -ForegroundColor Yellow
    Write-Host $scriptName
    
    Write-Host ""
    
    Write-Host "Version: " -ForegroundColor Yellow
    Write-Host $version
    
    Write-Host ""
    
    Write-Host "Description: " -ForegroundColor Yellow
    Write-Host "This module sets ""Adjust for best performance"" option in advanced system settings then enabled smooth text and contents while dragging"

    Write-Host ""
    
    Write-Host "Example 1:  " -ForegroundColor Yellow
    Write-Host ".\bestPerformance.ps1 -whatIf $true"
    
    Write-Host ""
    
    Write-Host "Example 2:  " -ForegroundColor Yellow
    Write-Host ".\bestPerformance.ps1 -whatIf $false"

    Write-Host ""

    Write-Host "Author: " -ForegroundColor Yellow
    Write-Host $author
    
    Write-Host ""
    exit
}