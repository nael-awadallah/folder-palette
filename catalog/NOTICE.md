# Catalog provenance and notices

FolderPalette's catalogs are provider-specific metadata. They do not include or redistribute SVG icon artwork, and they do not install either provider.

- Material Icon Theme: metadata generated from `material-icon-theme@5.39.0` using its documented npm API. Source: https://github.com/material-extensions/vscode-material-icon-theme/tree/92a9c5b25a5f4ae4c6a475fb99e434caffef5871 . See `material/LICENSE.upstream` for the upstream MIT notice and `material/provenance.json` for package integrity and policy. Built-in/custom clones and default-only/variant definitions are excluded from selectable choices.
- vscode-icons: folder descriptors and a Git asset-presence index derived from release 13.0.0, commit `866d4f48701ba71e39d309e9e519bcf2eaf1c3e2`. Source: https://github.com/vscode-icons/vscode-icons/tree/866d4f48701ba71e39d309e9e519bcf2eaf1c3e2 . The retained TypeScript file is data input interpreted without execution. See `vscode-icons/LICENSE.upstream` and `vscode-icons/provenance.json`.

Each upstream name/logo retains its owners' rights. No artwork or previews are redistributed. Any future artwork distribution requires a separate asset-license review. FolderPalette's own MIT license is provided at the project root.

`npm run catalog:fetch` is an explicit maintenance-only network action for pinned vscode-icons source inputs. `catalog:generate`, `catalog:check`, build, and runtime use only local inputs. Normal runtime never reads installed provider implementation files. The development-only Material package is pinned in the lockfile; neither provider's code is bundled into the extension.
