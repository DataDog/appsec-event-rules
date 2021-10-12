const fs = require('fs')
const arg = require('arg');
const yaml = require('js-yaml')

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


let outContentObj = {
    "version":"1.1",
    "events":[]
}
fs.readdirSync(SourceDir).forEach(file => {
    outContentObj.events.push(readYAMLfile(file))
});

writeJSONFile(outContentObj)
writeYAMLFile(outContentObj)

console.log('Build success with ', outContentObj.events.length, ' Event rules ')

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