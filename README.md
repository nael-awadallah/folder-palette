# FolderPalette

**Native folder icon customization for Material Icon Theme and vscode-icons.**

Keep the file icon theme you prefer. FolderPalette uses VS Code's native commands
and pickers, selects the provider from your active File Icon Theme, and bundles
separate offline catalogs. It ships no icon theme, Explorer replacement or provider artwork.

> **Development preview — customization writes are disabled for both providers.**
> Change and Reset expose prerequisites and read-only inspection. Manage lists
> existing associations and opens their native Settings entries. Saving, resetting
> or replacing customizations remains unavailable until provider safety is verified.
> This preview does not claim completed rendering, refresh or isolation support.

## Compatibility

| Provider | Catalog target | Extension ID | Theme ID |
|---|---|---|---|
| Material Icon Theme | 5.39.0 | `PKief.material-icon-theme` | `material-icon-theme` |
| vscode-icons | 13.0.0 | `vscode-icons-team.vscode-icons` | `vscode-icons` |

You need only your chosen provider. Both may be installed; the active exact theme
ID selects the adapter. Other versions are untested and gated, including vscode-icons
12.18.0. Windows x64 desktop VS Code **1.142.0** has installed-extension smoke coverage
for activation, routing and read-only commands. This is separate from provider
rendering acceptance. See [compatibility and current limits](documentation/compatibility.md).

## Install the development preview

1. Install your preferred provider from Extensions. Its gear menu's **Install
   Another Version…** lets you select an exact catalog target.
2. Run **Preferences: File Icon Theme** and choose that provider yourself.
3. Build the VSIX using the development instructions below, then run **Extensions:
   Install from VSIX…**. Reload if VS Code asks.
4. Open the Command Palette and run a FolderPalette command, or right-click one
   local Explorer folder for Change/Reset.

FolderPalette never installs or explicitly activates a provider, changes your
theme automatically, or requires both providers as dependencies. Unsupported/no
theme or an unavailable provider opens prerequisite help with explicit theme-picker
and provider details actions. Cancel changes nothing. Activation status alone
is not treated as proof of enablement.

Evaluate in disposable directories rather than a daily profile:

```powershell
code --user-data-dir ./evaluation/user-data --extensions-dir ./evaluation/extensions --install-extension ./artifacts/folder-palette-0.1.0-dev.2-local-test.vsix
code --new-window --user-data-dir ./evaluation/user-data --extensions-dir ./evaluation/extensions ./evaluation/workspace
```

Install/select the provider inside that same isolated instance. These example
evaluation directories are local-only and should not be committed.

## Commands and matching

| Command | Purpose in this preview |
|---|---|
| **FolderPalette: Change Folder Icon…** | Explain the active provider's closed write prerequisites |
| **FolderPalette: Reset Folder Icon…** | Select a local folder and inspect applicable stored rules |
| **FolderPalette: Manage Folder Associations…** | Inspect active-provider customizations, including missing original folders |

Only one explicit folder is targeted; multiple selection asks you to choose one.
There is no bulk edit or workspace crawl. Matching differs from storage:

- `src` matches repeated folder names; `backend/src` describes an immediate
  parent/name pair wherever it occurs, not an arbitrary full path. No globs.
- User/Workspace storage does not make matching unique to a path.
- Material-generated aliases belong only to Material. Named roots use its separate
  root-association map and the root basename, not a multi-root display alias.
- vscode-icons named-root editing is excluded. A single-root edit will never be
  simulated by changing the all-roots default.

When safe write policies are available, review shows the exact match, aliases,
icon, scope, native rule identity and fallback before Apply. Escape cancels and
Back revisits a step. Theme/version changes discard pending selections instead
of translating icon IDs. Pre-Apply cancellation makes no writes. Catalog search
uses provider-specific text labels, native IDs and keywords, without simulated
Codicon previews, runtime downloads or fabricated affected-folder counts.

## Reset and preservation

Reset is designed to remove one stored customization, never restore an entire
provider manifest. Removing Material's `src` from
`{"src":"images","docs":"book"}` leaves `{"docs":"book"}` in the selected
regular/root map and layer. Removing vscode-icons' `src` from
`[{"icon":"src","extensions":["src","source"],"format":"svg"}]` retains
`source` and its descriptor. Duplicate array members retain exact reviewed identities.

Unrelated keys, native fields, spelling/order, unknown icons and the inactive
provider's settings are preserved. Unsafe advanced modifiers such as `extends`,
`overrides`, disabling and unknown properties stay visible and read-only with a
Settings action. Broader rules, duplicate matches, inherited settings or defaults
can still supply an icon after reset; `{}`/`[]` does not promise blocked inheritance.
There is no gray/default replacement, migration between providers or rename repair.
These mutation paths remain disabled in this preview.

## Refresh, limits and troubleshooting

Material relies on its configuration listener. vscode-icons uses its listener or
its documented `vscode-icons.regenerateIcons` path only when a verified policy
requires it. Saved settings, requested apply and completed rendering are distinct;
a resolved command is not visual proof. Pending/failed apply preserves the saved
state: return to the saved provider, inspect its output/prompts, and use its
supported Apply Icons Customization action if appropriate. FolderPalette does not
change provider prompts or detection preferences to simplify refresh.

Check the active File Icon Theme, exact provider version, extension availability,
workspace trust and suppression presets. Material's `folders.theme: none`, or
vscode-icons' `hideFolders`/`foldersAllDefaultIcon`, can suppress custom icons.
Read the **FolderPalette** Output channel for provider/version/capability reasons;
full settings and unnecessary personal paths are omitted. Check the provider's
own output for regeneration errors. Restart a workflow after a theme change.

Material 5.39.0 showed User-over-Workspace rendering despite VS Code's effective
Workspace value and shared generated-theme interference between windows. User
scope alone does not establish isolation. vscode-icons apply, collision rendering
and isolation remain unverified. Both production policies permit **zero writes**.
No full screen-reader/high-contrast, expanded/collapsed, restart persistence or
multi-window rendering acceptance is claimed. macOS, Linux, remote/WSL/SSH/container
hosts, web and older versions are unverified; virtual workspaces are unsupported.
Customization additionally requires a trusted local desktop workspace.

There is no telemetry, account, backend or runtime network dependency.

## Development

Use Node **22.14.0+** and the committed lockfile. Unit checks need no installed provider.

```powershell
npm ci --ignore-scripts
npm run check
npm run package
npm run package:inspect -- artifacts/folder-palette-0.1.0-dev.2-local-test.vsix
```

`check` runs strict types, ESLint, units, offline catalog comparison and build.
`package` builds a VSIX with pinned `@vscode/vsce` and inspects the actual ZIP
against an exact allowlist, catalog versions/checksums, runtime and attribution.
Source maps, dependencies, source inputs, local diagnostics and secret filenames
are excluded. The inspection JSON records bytes, SHA-256 and all members.
The only external runtime module is VS Code's `vscode` API.

Per-provider commands include `catalog:material:generate`, `catalog:material:check`,
`catalog:vscode-icons:generate` and `catalog:vscode-icons:check`. Combined
`catalog:generate`/`catalog:check` use pinned local inputs offline. `catalog:fetch`
is an explicit maintenance-only network operation. See
[catalog maintenance](documentation/catalog-maintenance.md) and [notices](catalog/NOTICE.md).

For installed-VSIX tests, set `FOLDER_PALETTE_CODE_EXECUTABLE` to an existing Code.exe.
Optionally supply exact provider directories through `FOLDER_PALETTE_MATERIAL_DIRECTORY`
(5.39.0) and `FOLDER_PALETTE_VSCODE_ICONS_DIRECTORY` (13.0.0), then run
`npm run test:integration`. The runner copies providers and installs the inspected
artifact into fresh temporary user-data/extensions/workspace directories; each case
is bounded to 90 seconds. It downloads nothing automatically. Missing providers
are recorded as not-run; executed failures fail the command. Native smoke coverage
does not certify full customization, rendering or accessibility.

CI installs locked dependencies, checks, packages, prepares a pinned test host,
runs no-provider smoke and uploads development artifacts. It has no publishing step.

## License and feedback

MIT — Copyright (c) **2026 Nael Awadallah**. Upstream catalog MIT notices and
immutable source provenance are retained; no provider artwork is redistributed.
See [LICENSE](LICENSE) and [third-party notices](NOTICES.md).

Report reproducible issues at [GitHub Issues](https://github.com/nael-awadallah/folder-palette/issues).
Include VS Code/provider versions, active theme, expected behavior and sanitized
steps; avoid posting private settings or personal paths.
