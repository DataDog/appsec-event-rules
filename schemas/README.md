## How to

With python3:

```bash
    pip install -r schemas/requirements.txt
    jsonschema --instance build/recommended.json schemas/schema.json
    jsonschema --instance build/strict.json schemas/schema.json
    jsonschema --instance build/risky.json schemas/schema.json
```

## What is validated ?

All `json` files presents in `build` directories.
