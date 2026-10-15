# Offline catalog maintenance

Catalog changes are explicit development actions, never runtime downloads.
Use Node 22.14+ and `npm ci --ignore-scripts`. The lockfile pins the documented
Material generator package at 5.39.0 and its integrity. vscode-icons source is
pinned to 13.0.0 commit `866d4f48701ba71e39d309e9e519bcf2eaf1c3e2`.

```powershell
npm.cmd run catalog:material:generate
npm.cmd run catalog:material:check
npm.cmd run catalog:vscode-icons:generate
npm.cmd run catalog:vscode-icons:check
npm.cmd run catalog:check
```

These use retained local inputs. `npm run catalog:fetch` is the explicit
network action that retrieves the already pinned vscode-icons source and Git
asset index. Generation interprets that TypeScript as static data without
executing it. Material uses the documented `generateManifest` API across
available packs. Generation checks valid folder identifiers and closed/open
asset pairs, including required light variants. File icons, default-only
definitions, independent variants, custom paths and unverified clones are
excluded. No artwork is copied.

To change an upstream version, review its source, native descriptor grammar,
asset/license terms and behavior first. Update pins/integrity together with
generation tests, provenance and the package inspector's expected counts and
versions. Run each generation/check, `npm run check`, `npm run package` and
installed-artifact integration. Review the generated diff and catalog hashes.
A new catalog does not establish runtime compatibility: preserve closed write
policies until real-host, apply, visual and isolation evidence exists.

Every generated catalog records schema/provider/version and per-entry native
association metadata. Each provenance file records immutable source URL/commit,
generator version, checksums/integrity, upstream license and artwork exclusion.
Keep the upstream license and catalog/NOTICE.md with all redistributed metadata.
