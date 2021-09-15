const arg = require('arg');
const fs = require('fs')
const fse = require('fs-extra')
const yaml = require('js-yaml')


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

const V1RulesDir = args['--source']
const OutputDir = args['--output']

//empty the output folder
fse.emptyDirSync(OutputDir + '/recommended')
fse.emptyDirSync(OutputDir + '/strict')
fse.emptyDirSync(OutputDir + '/risky')



fs.readdirSync(V1RulesDir).forEach(trustDirectory => {
    fs.readdirSync(V1RulesDir + trustDirectory).forEach(file => {
        processJSONRulesFile(file, V1RulesDir + trustDirectory + '/', trustDirectory)
    });
});


function processJSONRulesFile(filename, directory, trustDirectory){
    //skip testing rules
    if (filename.indexOf('_test.json') !== -1) return;
    const fileContent = fs.readFileSync(directory +filename, 'utf8')
    convertRule(fileContent, trustDirectory)
}

function convertRule(yamlRule, trustDirectory){
    let rule = yaml.load(yamlRule)

    rule.tags.category = 'attack_attempt';

    rule.conditions.forEach((_, i) => {
        op = rule.conditions[i].operation;
        delete rule.conditions[i].operation;
        rule.conditions[i].operator = op

        inputs = rule.conditions[i].parameters.inputs;
        inputs.forEach((_, j) => {
            address_and_key_path = inputs[j].split(':')

            new_input = {
                "address": address_and_key_path[0],
            }

            if (address_and_key_path.length > 0) {
                new_input["key_path"] = address_and_key_path[1]
            }

            inputs[j] = new_input;
        });
        rule.conditions[i].parameters.inputs = inputs;
    });
    delete rule.action;

    //write the rule depends on the trust
    yamlContents = yaml.dump(rule)
    writeRule(yamlContents, rule.id, trustDirectory)
}


function writeRule(contents, id, trustDirectory){
    let dir = OutputDir + '/' + trustDirectory + '/';
    let filename = id + '.yaml';
    fs.writeFileSync(dir + filename, contents)
}
