# https://www.windows-commandline.com/how-to-create-large-dummy-file/

# FSUTIL
fsutil file createnew [filename] [length]
fsutil file createnew [path\filename] [length]
# Example
fsutil file createnew c:\users\apprentice\destop\myfile.txt 65000