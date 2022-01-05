import os
import json
import re
from jsonschema import Draft7Validator, draft7_format_checker, RefResolver

MAX_TAG_LENGTH = 200

def _crawl_schemas():
    for root, _, files in os.walk("schemas"):
        for f in files:
            if f.endswith(".json"):
                yield os.path.join(root, f)


def _crawl_rules_builds():
    for root, _, files in os.walk("."):
        if re.match(r"\./v\d+/build", root):
            for f in files:
                if f.endswith(".json"):
                    yield os.path.join(root, f)


def _get_schema_validator():

    store = {}

    base_uri = f"file://{os.path.dirname(os.path.realpath(__file__))}/"

    for filename in _crawl_schemas():
        schema = json.load(open(filename))
        try:
            json.dump(schema, open(filename, "w"), indent=2)  # lint
        except:
            pass
        schema_id = base_uri + filename[len("schemas/") :]
        schema["$id"] = schema_id
        Draft7Validator.check_schema(schema)
        store[schema_id] = schema

    schema = store[f"{base_uri}schema.json"]

    resolver = RefResolver(base_uri=base_uri, referrer=schema, store=store)
    return Draft7Validator(
        schema, resolver=resolver, format_checker=draft7_format_checker
    )


def _validate_with_schema(validator, rule):
    if validator.is_valid(rule):
        return True

    errors = sorted(validator.iter_errors(rule), key=lambda e: e.path)

    for error in errors:
        path = "".join([f"[{repr(i)}]" for i in error.path])
        print(f"{error.message} on instance {path}")
        for suberror in sorted(error.context, key=lambda e: e.schema_path):
            print(list(suberror.schema_path), suberror.message, sep=", ")

    return False


def _validate_tags(rule):
    '''
    Validates tags against Datadog requirements.
    See https://docs.datadoghq.com/getting_started/tagging/
    :param rule: the rule to validate
    :return: True if the rule is valid tag-wise, False otherwise
    '''
    is_success = True

    for tag_key in rule["tags"]:
        tag_value = rule["tags"][tag_key]
        tag = tag_key + tag_value

        if len(tag) > MAX_TAG_LENGTH:
            print(f"Tag '{tag_key}: {tag_value}' has a length "
                  f"greater than {MAX_TAG_LENGTH}")
            is_success = False

        if not tag_key[0].isalpha():
            print(f"Tag '{tag_key}: {tag_value}' must start with a letter")
            is_success = False

        if tag_value.endswith(':'):
            print(f"Tag '{tag_key}: {tag_value}' has a value ending with ':'")
            is_success = False

        if not re.match(r"^[\w_\-:./]+$", tag):
            print(f"Tag '{tag_key}: {tag_value}' cannot have "
                  "a special character")
            is_success = False

    return is_success


def _validate_parameter(operator, parameters, parameter_key):
    if len(parameters[parameter_key]) == 0:
        print(f"{operator} condition missing {parameter_key} field")
        return False

    return True


def _validate_conditions(rule):
    is_success = True

    for condition in rule["conditions"]:
        operator = condition["operator"]

        if operator == "match_regex":
            parameters = condition["parameters"]

            is_success &= _validate_parameter("match_regex", parameters,
                                              "regex")
            is_success &= _validate_parameter("match_regex", parameters,
                                              "inputs")

            if "options" in parameters:
                for option in parameters["options"]:
                    if option != "case_sensitive" and option != "min_length":
                        print("invalid option for match_regex condition "
                              f"'{option}'")
                        is_success = False

        if operator == "phrase_match":
            parameters = condition["parameters"]

            is_success &= _validate_parameter("phrase_match", parameters,
                                              "list")
            is_success &= _validate_parameter("phrase_match", parameters,
                                              "inputs")

    return is_success


def _validate_custom(rules):
    # Duplicated from the AppSec service, ingesting the rules
    # https://github.com/DataDog/dd-go/blob/prod/domains/appsec/apps/appsec/rules.go#L59

    # We only validate currently supported rules
    if rules["version"] < "2":
        return True

    is_success = True

    for rule in rules["rules"]:
        is_success &= _validate_tags(rule)
        is_success &= _validate_conditions(rule)

    return is_success


def main():

    validator = _get_schema_validator()

    is_success = True

    for filename in _crawl_rules_builds():
        rule = json.load(open(filename))

        print(f"Validating {filename}")
        is_success &= _validate_with_schema(validator, rule)
        is_success &= _validate_custom(rule)

    if not is_success:
        exit(1)


main()
