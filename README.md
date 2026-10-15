<h1 align="center">FolderPalette</h1>

<p align="center"><strong>Your folders. Your theme. A clearer Explorer.</strong></p>

<p align="center">
  Native folder-association tools for <strong>Material Icon Theme</strong> and <strong>vscode-icons</strong>.
</p>

<p align="center">
  <a href="https://github.com/nael-awadallah/folder-palette"><img src="https://img.shields.io/badge/version-0.1.0-4FD1C5?style=flat-square&amp;labelColor=18212B" alt="Version 0.1.0"></a>
  <a href="#compatibility"><img src="https://img.shields.io/badge/VS%20Code-1.142%2B-8FAFC0?style=flat-square&amp;labelColor=18212B" alt="VS Code 1.142 or later; Windows desktop tested"></a>
  <a href="https://github.com/nael-awadallah/folder-palette/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-E5B567?style=flat-square&amp;labelColor=18212B" alt="MIT license"></a>
  <a href="#current-preview"><img src="https://img.shields.io/badge/status-development%20preview-D9986A?style=flat-square&amp;labelColor=18212B" alt="Development preview"></a>
</p>

<p align="center">
  <a href="#get-started">Get started</a> ·
  <a href="#commands">Commands</a> ·
  <a href="#compatibility">Compatibility</a> ·
  <a href="https://github.com/nael-awadallah/folder-palette/issues">Report an issue</a>
</p>

Keep the icon theme you already use. FolderPalette brings provider-aware commands,
readable native pickers, and separate offline icon catalogs to VS Code. It ships
no theme of its own and never requires you to install both providers.

## Current preview

> **Version 0.1.0 is a development preview. Saving, resetting, and replacing folder
> customizations are disabled for both providers while compatibility verification
> is incomplete.** You can inspect existing associations and open their native
> Settings entries. This version does not claim complete icon rendering or refresh support.

What you can explore today:

- **Follow your active theme.** The selected File Icon Theme chooses the provider;
  installing another provider does not silently switch it.
- **Understand existing rules.** Inspect match text, native icon IDs, storage,
  inheritance, conflicts, and advanced rules, even if the original folder is gone.
- **Keep native settings intact.** Unknown icons and advanced descriptors remain
  visible. Unsupported mutations stay read-only with an Open Settings action.
- **Use bundled catalogs.** Provider-specific metadata includes 267 Material choices
  and 199 vscode-icons choices, with no runtime catalog downloads.

No telemetry, accounts, backend, automatic provider installation, or workspace crawl.

## Get started

1. Install **one** provider: [Material Icon Theme](https://marketplace.visualstudio.com/items?itemName=PKief.material-icon-theme)
   or [vscode-icons](https://marketplace.visualstudio.com/items?itemName=vscode-icons-team.vscode-icons).
   See the exact catalog targets below; use **Install Another Version…** when needed.
2. Run **Preferences: File Icon Theme** and choose that provider yourself.
3. In Extensions, open the **…** menu, choose **Install from VSIX…**, and select
   `folder-palette-0.1.0.vsix`. Reload if prompted. Build the file with the
   [development commands](#development) if you do not already have it.
4. Open the Command Palette and run **FolderPalette: Manage Folder Associations…**
   to inspect the active provider's stored customizations.

FolderPalette never changes your theme automatically. An unsupported theme or
unavailable provider opens prerequisite help with explicit theme-picker and
extension-details actions. Cancel leaves settings unchanged.

For an isolated evaluation:

```powershell
code --user-data-dir ./evaluation/user-data --extensions-dir ./evaluation/extensions --install-extension ./artifacts/folder-palette-0.1.0.vsix
code --new-window --user-data-dir ./evaluation/user-data --extensions-dir ./evaluation/extensions ./evaluation/workspace
```

Install and select the provider inside that same instance. Evaluation directories
stay local and are excluded from source control.

## Commands

| Command | What it does in this preview |
| --- | --- |
| **FolderPalette: Change Folder Icon…** | Explains the active provider's customization prerequisites. |
| **FolderPalette: Reset Folder Icon…** | Selects one local folder and inspects its applicable stored rules. |
| **FolderPalette: Manage Folder Associations…** | Lists the active provider's customizations and opens their native Settings entries. |

Change and Reset also appear when you right-click a local Explorer folder.
Multiple selected folders require choosing one target; there is no bulk edit.
Native pickers support search, Escape to cancel, and Back where available.
A theme or provider-version change clears stale selections rather than translating icon IDs.

## Compatibility

| Provider | Catalog target | Extension ID | Active theme ID |
| --- | --- | --- | --- |
| Material Icon Theme | **5.39.0** | `PKief.material-icon-theme` | `material-icon-theme` |
| vscode-icons | **13.0.0** | `vscode-icons-team.vscode-icons` | `vscode-icons` |

Installed-extension checks cover **Windows x64 desktop VS Code 1.142.0**, each
provider alone, and both installed with either theme active. These checks cover
activation, routing, read-only inspection, cancellation, and theme-switch handling;
they do not establish full customization or Explorer rendering support.

Other provider versions, including vscode-icons 12.18.0, remain untested and gated.
macOS, Linux, remote hosts, WSL, SSH, containers, web, and older VS Code versions
are unverified. Virtual workspaces are unsupported. Future customization also
requires a trusted local desktop workspace and a verified provider policy.

Read [compatibility and current limits](documentation/compatibility.md) for the
provider-specific scope, refresh, and isolation details.

## How folder matching works

**Matching and storage answer different questions.** `src` matches repeated folder
names. `backend/src` identifies an immediate parent/name pair wherever it occurs;
it is not an arbitrary full path. User or Workspace storage does not make a rule
unique to one directory. Globs and wildcards are not supported.

Material generates its own name variants and has a separate named-root association
map. Root matching uses the folder basename, not its workspace display alias.
vscode-icons named-root editing is excluded; FolderPalette never substitutes a
change to every root's default icon for a single-root edit.

The mutation workflows are designed around reviewing one exact stored rule:

| Native format | Example of a selected-rule removal |
| --- | --- |
| Material object | Removing `src` from `{"src":"images","docs":"book"}` retains `docs`. |
| vscode-icons array | Removing `src` from a descriptor matching `["src","source"]` retains `source` and the descriptor's other fields. |

These writes remain disabled in 0.1.0. When compatibility permits them, review must
explain the native identity, icon, scope, aliases, conflicts, and remaining fallback
before Apply. Inherited rules, broader matches, duplicates, or provider defaults
may still supply an icon after removal; empty `{}` or `[]` does not block inheritance.
Unrelated settings, the inactive provider, and unsafe advanced modifiers are preserved.

## Troubleshooting

- **No customization actions?** Writes are intentionally disabled in this preview.
  Check the **FolderPalette** Output channel for provider and capability details.
- **Wrong or missing provider?** Check **Preferences: File Icon Theme**, the installed
  version, and whether the provider is available in this window. An installed or
  active extension alone does not select its adapter.
- **Icons suppressed?** Material's `folders.theme: none`, or vscode-icons'
  `hideFolders` / `foldersAllDefaultIcon` presets, can suppress custom icons.
  FolderPalette explains these settings without changing them for you.
- **Icons differ across windows?** Material 5.39.0 has observed shared generated-theme
  interference and User-over-Workspace rendering. User storage alone does not prove
  isolation. vscode-icons rendering and isolation remain unverified.

Saving a setting, requesting provider refresh, and completing rendering are separate
outcomes. Material uses its configuration listener; vscode-icons has its documented
regeneration path. Pending or failed refresh must preserve saved settings and stay
visible; provider prompts, output, and supported apply actions remain provider-owned.
Full apply/failure, persistence, accessibility, and multi-window acceptance are pending.

## Development

Use **Node.js 22.14.0 or later** and the committed lockfile. Unit checks need no
installed theme provider.

```powershell
npm ci --ignore-scripts
npm run check
npm run package
npm run package:inspect -- artifacts/folder-palette-0.1.0.vsix
```

The VSIX is written to `artifacts/folder-palette-0.1.0.vsix`. Packaging checks the
actual archive against a strict file allowlist, catalog versions and checksums,
runtime code, and license notices. Dependencies, source maps, and local diagnostics
are excluded. The extension's only external runtime module is VS Code's `vscode` API.

| Task | Command |
| --- | --- |
| Generate or check both catalogs offline | `npm run catalog:generate` / `npm run catalog:check` |
| Check Material catalog | `npm run catalog:material:check` |
| Check vscode-icons catalog | `npm run catalog:vscode-icons:check` |
| Test the installed VSIX | `npm run test:integration` |

For installed-extension tests, set `FOLDER_PALETTE_CODE_EXECUTABLE` to an existing
Code.exe. Optional exact provider directories use `FOLDER_PALETTE_MATERIAL_DIRECTORY`
and `FOLDER_PALETTE_VSCODE_ICONS_DIRECTORY`. Tests use fresh temporary profiles,
copy provider installations, and have a 90-second limit per case. The runner never
downloads a host or provider automatically. Missing providers are recorded as not run.

[Catalog maintenance](documentation/catalog-maintenance.md) explains pinned sources,
per-provider generation, and the explicit maintenance-only network fetch. CI checks,
packages, tests the installed artifact, and uploads build outputs without publishing.

## Feedback

[Open an issue](https://github.com/nael-awadallah/folder-palette/issues) with your
VS Code and provider versions, active theme, expected behavior, and steps to reproduce.
Please omit private settings and personal paths.

## License

[MIT](https://github.com/nael-awadallah/folder-palette/blob/main/LICENSE) · Copyright
(c) **2026 Nael Awadallah**.

Provider catalog metadata retains its upstream licenses and immutable provenance.
No provider artwork is redistributed. See [third-party notices](NOTICES.md).
