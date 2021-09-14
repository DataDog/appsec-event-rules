# Appsec event rules tools

## 1. Convert Sqreen WAF format to Datadog Appsec event format
This script will convert the rules from Sqreen WAF format to the new Datadog appsec event format.


### Usage
```
node tools/SqToDd.js --source /path/to/waf/rules --output ./rules
```



## 2. Build the rules
The script is used to build the rules into one file


### Usage
```
node tools/build.js --source ./rules --output ./build --collection "risky"
```
