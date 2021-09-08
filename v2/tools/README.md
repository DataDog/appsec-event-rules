# Appsec event rules tools

## 1. Convert v1 format to v2 format
This script will convert the rules from the v1 format to the new v2 format.


### Usage
```
node tools/UpgradeFromV1.js --source ../v1/rules --output ./rules
```



## 2. Build the rules
The script is used to build the rules into one file


### Usage
```
node tools/build.js --source ./rules --output ./build --collection "risky"
```
