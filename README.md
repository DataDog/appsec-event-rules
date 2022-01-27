# Appsec Event Rules
This repo contains default AppSec Event rules, created by our security team. 

## Rules
rules lives in `rules` folder and there is three main collections of the rules
- recommended: this is the rules that currently bundles with the Appsec libraries
- strict: Under developed rules which can generate some false positives
- risky: Under developed rules which can generate alot false positives


## Rule Structure Example
Every rule must have `id`, `name` and `conditions`

Example: 

```
id: crs-913-110
name: Found request header associated with Acunetix security scanner
tags:
  type: security_scanner
  crs_id: '913110'
  category: attack_attempt
conditions:
  - parameters:
      inputs:
        - address: server.request.headers.no_cookies
      list:
        - acunetix-product
        - (acunetix web vulnerability scanner
        - acunetix-scanning-agreement
        - acunetix-user-agreement
    operator: phrase_match
transformers:
  - lowercase
```
## Build the rules
Based on the rules collection you want to generate, you can generate it by running the following script

```
node tools/build.js --source ./rules --output ./build --collection "recommended"
```

## Validation
This repository currently represents the source of truth: the rules present here are shipped to clients.  

The CI has a rule validation step (see the [schema sub folder](https://github.com/DataDog/appsec-event-rules/tree/main/schemas)).
Any rule validation must currently be enforced in this repository.
