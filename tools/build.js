require('dotenv').config()
const fs = require('fs')
const arg = require('arg');
const yaml = require('js-yaml')
const path = require('path');
const { process_params } = require('express/lib/router');

const args = arg({
    // Types
    '--help':    Boolean,
    '--source':    String,      // --source <string> or --source=<string>
    '--output':    String,      // --output <string> or --output=<string>
    '--collection': String, //the rule collection (recommended,strict, risky)
    '--version': String,
    // Aliases
    '-s':        '--source',
    '-o':        '--output',
    '-c':        '--collection',
});

if (!args['--source']) return console.error('Error: Missing required argument: --source [the rules source directory]')
if (!args['--output']) return console.error('Error: Missing required argument: --output [the rules output directory]')
if (!args['--collection']) return console.error('Error: Missing required argument: --collection [the rules collection] (eg. recommended)')


const Collection = args['--collection'];
const SourceDir = args['--source'] + '/' + Collection;
const OutputDir = args['--output']
const RulesVersion = args['--version'] || process.env.CURRENT_RULES_VERSION;

let outContentObj = {
    "version":"2.2",
    "metadata":{
        "rules_version":RulesVersion
    },
    "rules":[]
}
fs.readdirSync(SourceDir).forEach(file => {
    if(path.extname(file) !== '.yaml') return; //skip md files
    ruleData = readYAMLfile(file);
    ruleData["test_vectors"] = undefined;
    outContentObj.rules.push(ruleData)
});

writeJSONFile(outContentObj)
writeYAMLFile(outContentObj)

console.log('Build success with ', outContentObj.rules.length, ' Event rules ')

function readYAMLfile(file){
    try {
        const doc = yaml.load(fs.readFileSync(SourceDir + '/' + file, 'utf8'));
        return doc
    } catch (e) {
        console.error(e);
        console.error('Failed load/parse the file: ', file)
    }
}

function writeYAMLFile(obj){
    let yamlContents = yaml.dump(obj)
    fs.writeFileSync(OutputDir + '/' +  Collection + '.yaml', yamlContents)
}

function writeJSONFile(obj){
    fs.writeFileSync(OutputDir + '/' +  Collection + '.json', JSON.stringify(obj, null, 2))
}