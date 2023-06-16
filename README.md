# Manifest porter
**Work in progress**

This is a tool to port `orx` (for mutant-remix/orxporter) manifests to `toml` (for mutant-remix/mrxbuilder), through an intermediate `json` format.

This tool is mostly useless, as it was only intended to be used once. It is provided as-is, with no support.

## Usage
- Have node.js and yarn installed
- Put your .orx files in the `./manifest` directory
```
yarn
yarn start
```
- Your .toml files will be in the `./out` directory. They should be treated as a draft, and will most likely need to be manually edited.

## License
[AGPL 3](./LICENSE)
