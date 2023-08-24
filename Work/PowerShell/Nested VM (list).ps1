#############
############# Nested VMs #############
# https://docs.microsoft.com/en-us/virtualization/hyper-v-on-windows/user-guide/nested-virtualization
# There are hardware requirements that must be met for this to work

#Enable Nested Virtualization
Set-VMProcessor -VMName <VMName> -ExposeVirtualizationExtensions $true

#Disable Nested Virtualization
Set-VMProcessor -VMName <VMName> -ExposeVirtualizationExtensions $false

#Enable MAC Spoofing (preferred and performed on the first level of the switch)
Get-VMNetworkAdapter -VMName <VMName> | Set-VMNetworkAdapter -MacAddressSpoofing On

#Enable NAT (if MAC spoofing isnt available and is performed on the host VM regardless of level)
New-VMSwitch -Name VmNAT -SwitchType Internal
New-NetNat –Name LocalNAT –InternalIPInterfaceAddressPrefix “192.168.100.0/24”

#Assign an IP address to the adapter
Get-NetAdapter "vEthernet (VmNat)" | New-NetIPAddress -IPAddress 192.168.100.1 -AddressFamily IPv4 -PrefixLength 24

#Assign a DNS and IP address all in one
Get-NetAdapter "Ethernet" | New-NetIPAddress -IPAddress 192.168.100.2 -DefaultGateway 192.168.100.1 -AddressFamily IPv4 -PrefixLength 24
Netsh interface ip add dnsserver “Ethernet” address=<my DNS server>