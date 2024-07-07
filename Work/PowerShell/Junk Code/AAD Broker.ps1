$rand = get-random
$userName = $Env:UserName
$newName = "Microsoft.AAD.BrokerPlugin_cw5n1h2txyewy." + $rand
$filePath = "c:\users\" + $userName + "\appdata\local\packages\Microsoft.AAD.BrokerPlugin_cw5n1h2txyewy"
write-output $newName`n$filePath

# Rename-Item -path $filePath -NewName $newName


