# Compatibility and safety

FolderPalette is a development preview. Both production provider policies currently
permit **zero configuration writes**. Catalog recognition and installed-extension
smoke tests do not qualify icon rendering or native mutation safety.

| Area | Material Icon Theme | vscode-icons |
|---|---|---|
| Exact catalog target | 5.39.0 | 13.0.0 |
| Extension ID | `PKief.material-icon-theme` | `vscode-icons-team.vscode-icons` |
| Active theme ID | `material-icon-theme` | `vscode-icons` |
| Native associations | Object map | Array of descriptors and match members |
| Named roots | Separate basename association map | Editing excluded; no all-roots substitute |
| Writes in this preview | Disabled | Disabled |
| Installed activation/routing/read-only command smoke | Passed on Windows desktop baseline | Passed on Windows desktop baseline |
| Full customization / Explorer / apply qualification | Incomplete | Incomplete |
| Reliable Workspace isolation | Unsupported by observed shared-theme behavior | Unverified |
| Workspace-folder storage | Unsupported | Unsupported |

Windows x64 desktop VS Code 1.142.0 is the exercised baseline. Installed-artifact
smoke covers each provider independently, both installed with each active theme,
no/unsupported theme, a missing selected provider, suppression, native picker
dismissal and theme changes during prerequisites. Automated native mutation tests
use controlled capability fixtures; those fixtures never enable production writes.

Material 5.39.0 showed User settings winning a same-key rendered conflict despite
VS Code reporting Workspace as effective, and two windows sharing generated icon
data. Storing rules in User settings alone does not prove rendering isolation.
vscode-icons also requires independent apply, precedence, collision and isolation
qualification. Neither a configuration save nor a resolved regeneration command
proves rendering completion.

The preview does not certify actual set/reset/manage mutation, provider prompts,
cancel/reload/failure recovery, Explorer closed/open states or restart persistence,
full keyboard/screen-reader/high-contrast behavior, or multi-window isolation.
Other provider versions and macOS/Linux/remote/WSL/SSH/container/web hosts remain
unverified. Virtual workspaces are unsupported. A future write policy must require
a trusted local workspace and a verified provider-specific scope/match/apply path.

Suppression preferences remain user-owned: Material's `folders.theme: none` and
vscode-icons' `hideFolders`/`foldersAllDefaultIcon` are explained without changing
them. Unknown/advanced native customizations remain visible and preserved; unsafe
modifier cases remain read-only. Unknown versions never inherit a support claim.

Catalog source/version pins and upstream notices are shipped under `catalog/`.
Review runtime behavior independently before changing any capability evidence or
write gate. See [catalog maintenance](catalog-maintenance.md) for data updates.
