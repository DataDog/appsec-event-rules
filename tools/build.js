require('dotenv').config()
const fs = require('fs')
const arg = require('arg');
const yaml = require('js-yaml')
const path = require('path');

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

if (args['--collection']) {
    processCollection(args['--collection']);
} else {
    processCollection('recommended');
    processCollection('strict');
    processCollection('risky');
}


function processCollection(collection){
    const sourceDir = args['--source'] + '/' + collection;
    const rulesVersion = args['--version'] || process.env.CURRENT_RULES_VERSION;

    let outContentObj = {
        "version":"2.2",
        "metadata":{
            "rules_version":rulesVersion
        },
        "rules":[]
    }
    fs.readdirSync(sourceDir).forEach(file => {
        if(path.extname(file) !== '.yaml') return; //skip md files
        ruleData = readYAMLfile(sourceDir, file);
        ruleData["test_vectors"] = undefined;
        outContentObj.rules.push(ruleData)
    });

    const filePath = args['--output'] + '/' +  collection;
    writeJSONFile(filePath, outContentObj)
    writeYAMLFile(filePath, outContentObj)

    console.log('Build success with ', outContentObj.rules.length, ' Event rules ')
}

function readYAMLfile(sourceDir, file){
    try {
        const doc = yaml.load(fs.readFileSync(sourceDir + '/' + file, 'utf8'));
        return doc
    } catch (e) {
        console.error(e);
        console.error('Failed load/parse the file: ', file)
    }
}

function writeYAMLFile(filePath, obj){
    fs.writeFileSync(filePath + '.yaml', yaml.dump(obj))
}

function writeJSONFile(filePath, obj){
    fs.writeFileSync(filePath + '.json', JSON.stringify(obj, null, 2))
}
