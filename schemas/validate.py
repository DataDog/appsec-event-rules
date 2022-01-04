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
    is_success = True

    for tag_key in rule["tags"]:
        tag_value = rule["tags"][tag_key]
        tag = tag_key + tag_value

        if len(tag) > MAX_TAG_LENGTH:
            print(f"Tag '{tag_key}: {tag_value}' has a length "
                  f"greater than {MAX_TAG_LENGTH}")
            is_success = False

        if tag_value.endswith(':'):
            print(f"Tag '{tag_key}: {tag_value}' has a value ending with ':'")
            is_success = False

        if re.search(r"[!@#$%^&*()+=\[\]{};'\"|,<>?]", tag):
            print(f"Tag '{tag_key}: {tag_value}' cannot have "
                  f"a special character")
            is_success = False

    return is_success


def _validate_conditions(rule):
    is_success = True

    for condition in rule["conditions"]:
        operator = condition["operator"]

        if operator == "match_regex":
            parameters = condition["parameters"]

            if len(parameters["regex"]) == 0:
                print(f"match_regex condition missing regex field")
                is_success = False

            if len(parameters["inputs"]) == 0:
                print(f"match_regex condition missing inputs field")
                is_success = False

            if "options" in parameters:
                for option in parameters["options"]:
                    if option != "case_sensitive" and option != "min_length":
                        print(f"invalid option for match_regex condition '{option}'")
                        is_success = False

        if operator == "phrase_match":
            parameters = condition["parameters"]

            if len(parameters["list"]) == 0:
                print(f"phrase_match condition missing list field")
                is_success = False

            if len(parameters["inputs"]) == 0:
                print(f"phrase_match condition missing inputs field")
                is_success = False

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
