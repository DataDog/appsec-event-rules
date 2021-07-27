const arg = require('arg');
const fs = require('fs')
const fse = require('fs-extra')
const yaml = require('js-yaml')

// Note the following operator is not supported right now.
// !@rx
// @exist && !@exist
// @detectSQLi
// @detectXSS
// @eq


const args = arg({
    // Types
    '--help':    Boolean,
    '--source':    String,      // --source <string> or --source=<string>
    '--output':    String,      // --output <string> or --output=<string>
 
    // Aliases
    '-s':        '--source',
    '-o':        '--output',  
});
 
if (!args['--source']) return console.error('Error: Missing required argument: --source [the rules source directory]')
if (!args['--output']) return console.error('Error: Missing required argument: --output [the rules output directory]')

const ShieldRulesDir = args['--source']
const OutputDir = args['--output']

const ADDRRS = {
    "ARGS": [
        '$http.server.query',
        '$http.server.body',
        '$http.server.path_params'
    ],
    "ARGS_NAMES": [], //NOT SUPPORTED
    "ARGS_GET": ['$http.server.query', '$http.server.path_params'],
    "ARGS_GET_NAMES":[], //NOT SUPPORTED
    "QUERY_STRING":["$http.server.query"],
    "REQUEST_COOKIES": ['$http.server.cookies'],
    "REQUEST_COOKIES_NAMES": [], //NOT SUPPORTED
    "REQUEST_HEADERS": ['$http.headers'],
    "REQUEST_HEADERS_NAMES":[],
    "REQUEST_FILENAME": [],  //NOT SUPPORTED
    "REQUEST_URI":['$http.target'], 
    "REQUEST_BASENAME":[], //NOT SUPPORTED
    "FILES":[],//NOT SUPPORTED
    "FILES_NAMES":[], //NOT SUPPORTED
    "REQUEST_HEADERS:x-filename": ['$http.headers:x-filename'],
    "REQUEST_HEADERS:x_filename": ['$http.headers:x_filename'],
    "REQUEST_HEADERS:x.filename": ['$http.headers:x.filename'],
    "REQUEST_HEADERS:x-file-name": ['$http.headers:x-file-name'],
    "REQUEST_HEADERS:content-length": ['$http.headers:content-length'],
    "REQUEST_HEADERS:content-type": ['$http.headers:content-type'],
    "REQUEST_HEADERS:x-up-devcap-post-charset": ['$http.headers:x-up-devcap-post-charset'],
    "REQUEST_HEADERS:user-agent": ['$http.user_agent'],
    "REQUEST_HEADERS:User-Agent": ['$http.user_agent'],
    "REQUEST_HEADERS:referer": ['$http.headers:referer'],
    "REQUEST_HEADERS:Referer": ['$http.headers:Referer'], 
    "REQUEST_METHOD":['$http.method'],
}

//empty the output folder
fse.emptyDirSync(OutputDir + '/recommended')
fse.emptyDirSync(OutputDir + '/strict')
fse.emptyDirSync(OutputDir + '/risky')



fs.readdirSync(ShieldRulesDir).forEach(file => {
    processJSONRulesFile(file, ShieldRulesDir)
});


function processJSONRulesFile(filename, directory){
    //skip testing rules
    if (filename.indexOf('_test.json') !== -1) return;
    // console.log(filename, '=============================>')
    const fileContent = fs.readFileSync(directory +filename, 'utf8')
    ruleset = JSON.parse(fileContent);
    ruleset.forEach(rule => {
        convertRule(rule)
    })
}

function convertRule(oldRule){
    let newRule = new Rule().generateID(oldRule.rule_id).setName(oldRule.msg)
    for(filter of oldRule.filters) {
        newRule.addCondition(filter)
        if(filter.transformations) newRule.addTransformer(filter.transformations); //add only if transformers exists in the old rule
    }
    newRule.addType(getRuleType(oldRule))
    if(oldRule.rule_id.length == 6){ //this is a crs rule
        newRule.addCRSID(oldRule.rule_id)
    }
    let ruleYamlContents = newRule.toYaml()
    if(!ruleYamlContents) return; //in case of unsupported rule

    //write the rule depends on the 
    writeRule(ruleYamlContents, newRule.getId(),oldRule.trust)

}


function writeRule(contents, id, trust){
    let dir = OutputDir;
    let filename = id + '.yaml';
    if(trust == 2){
        //recommended set
        dir += '/recommended/';
    }

    if(trust == 1){
        //strict set
        dir += '/strict/';
    }

    if(trust == 0){
        //risky set
        dir += '/risky/';
    }

    fs.writeFileSync(dir + filename, contents)

}


function getRuleType(oldRule){
    const ruleset = oldRule.ruleset

    if(ruleset === 'security_scanner') return 'security_scanner';
    if(ruleset === 'java_injection') return 'java_code_injection';
    if(ruleset === 'js_injection') return 'js_code_injection';
    if(ruleset === 'lfi') return 'lfi';
    if(ruleset === 'nosql_injection') return 'nosqli';
    //rule 933111 == "PHP Injection Attack: PHP Script File Upload Found" is actually unrestricted file upload attack not php code injection
    if(oldRule.rule_id == '933111') return 'unrestricted_file_upload';
    if(ruleset === 'php_eval') return 'php_code_injection';
    if(ruleset === 'protocol') return 'http_protocol_violation';
    if(ruleset === 'rfi') return 'rfi';
    //rule 932180 == "Restricted File Upload Attempt" is actually unrestricted file upload attack not shell injection
    if(oldRule.rule_id == '933111') return 'unrestricted_file_upload';
    if(ruleset === 'shell_injection') return 'command_injection';
    if(ruleset === 'sql_injection') return 'sqli';
    if(ruleset === 'xss') return 'xss';
    if(oldRule.rule_id == 'sqreen_000001') return 'ssrf';
    if(oldRule.rule_id == 'sqreen_000005') return 'csrf';

}


/**
 * 
  - id: tpj-ivk-wrx
    name: Nikto security scanner detection
    tags: 
        type: security_scanners
        mitre_attack: T1595
    conditions:
      - operation: match_regex
        parameters:
  	        inputs: 
                $http.headers.user_agent
            regex: \(nikto/[\d\.]+\)
    transformers:
      - lowercase  
    action: log
 */
function Rule(){
    this.rule = {
        id:null,
        name: null,
        tags:{},
        conditions: [],
        transformers:[],
        action: 'record'
    }
    this.canBeConverted = true; //this flag use to avoid generating rules that we are not yet support its operator (ex: libinjection operators)

    this.generateID = (ruleID) => {
        
        //CRS
        if(ruleID.length == 6){
            this.rule.id = 'crs-' + ruleID.slice(0, 3) + '-' + ruleID.slice(3, 6);
            return this;
        }
        
        //User Agent
        if(ruleID.indexOf('ua_') != -1){
            if(ruleID.length < 8) ruleID += 'x';
            this.rule.id = 'ua0-' + ruleID.slice(3, 6) + '-' + ruleID.slice(6, 9) + 'x'; 
            
            return this;
        }

        //SQR
        if(ruleID.indexOf('sqreen_') != -1){
            this.rule.id = 'sqr-' + ruleID.slice(7, 10) + '-' + ruleID.slice(10, 13);
            return this;
        }

        return this;
    }
    this.getId = () => {
        return this.rule.id
    }
    this.setName = name => {
        this.rule.name = name
        return this
    }
    this.addCondition = filter => {
        let condition = {}
        
        let inputs = []
        filter.targets.forEach(target => {
            if(target == '$match.0.match'){
                //unsupported target
                this.canBeConverted = false;
            }
            inputs.push(...ADDRRS[target])
        })

        if(inputs.length == 0){
            this.canBeConverted = false;
            console.log('No available addresses can be used:', filter.targets)
            return;
        }

        switch(filter.operator){
            case '@rx':
                condition.operation = "match_regex"
                condition.parameters = {
                    inputs: inputs,
                    regex: filter.value
                }
                if(filter.options){
                    condition.parameters.options = {}
                    //TODO: support the match_inter_transformers in the format & in the converter
                    if(filter.options.case_sensitive) condition.parameters.options.case_sensitive = filter.options.case_sensitive;
                    if(filter.options.min_length) condition.parameters.options.min_length = filter.options.min_length;
                }
            break
            case '@pm':
                condition.operation = "phrase_match"
                condition.parameters = {
                    inputs: inputs,
                    list: filter.value
                }
            break
            default:
                //unsupported operator
                this.canBeConverted = false;
                console.log('Unsupported operator:', filter.operator)
        }
        this.rule.conditions.push(condition)
    }

    this.addTransformer = transformers => {
        if(!this.rule.transformers) this.rule.transformers = [];
        this.rule.transformers.push(...transformers)
    }

    this.addType = type => {
        this.rule.tags.type = type
    }

    this.addCRSID = crsID => {
        this.rule.tags.crs_id = crsID
    }

    this.toYaml = () => {
        if(this.canBeConverted){
            console.log('√', this.rule.id)
            return yaml.dump(this.rule)
        }
        return false;
    }
}