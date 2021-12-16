import os
import json
import re
from jsonschema import Draft7Validator, draft7_format_checker, RefResolver


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


def main():

    validator = _get_schema_validator()

    for filename in _crawl_rules_builds():
        instance = json.load(open(filename))

        print(f"Validating {filename}")
        if not validator.is_valid(instance):
            errors = sorted(validator.iter_errors(instance), key=lambda e: e.path)

            for error in errors:
                path = "".join([f"[{repr(i)}]" for i in error.path])
                print(f"{error.message} on instance {path}")
                for suberror in sorted(error.context, key=lambda e: e.schema_path):
                    print(list(suberror.schema_path), suberror.message, sep=", ")


main()
