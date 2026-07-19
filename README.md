# Keyboard Layout Switcher

Per-app keyboard layout switching for **KDE Plasma 6 / KWin 6**.

Automatically switches between a **default** and an **alternative** layout based on the focused window — useful if you type in one language day-to-day but want QWERTY/`us` (or another layout) in terminals, editors, and browsers.

- **Listed apps** → alternative layout (e.g. `us`)
- **Everything else** → default layout (e.g. `de`, `tr`, `fr`, `ru`, …)

Configure the app list and layout short names from System Settings — no code edits required.

## Works on

Any Linux desktop running **Plasma 6** with **KWin**, including:

| Distro | Notes |
|--------|--------|
| [KDE neon](https://neon.kde.org/) | Upstream Plasma reference |
| [Fedora KDE](https://fedoraproject.org/spins/kde/) / Kinoite | Fedora’s official KDE spin |
| [Kubuntu](https://kubuntu.org/) | Ubuntu + Plasma |
| [openSUSE Tumbleweed](https://www.opensuse.org/) | Rolling Plasma 6 |
| [Arch Linux](https://archlinux.org/) | `plasma-desktop` / `kwin` |
| [CachyOS](https://cachyos.org/) | Arch-based, KDE edition |
| [EndeavourOS](https://endeavouros.com/) | Arch-based, Plasma option |
| [Manjaro KDE](https://manjaro.org/) | Arch-based |
| [Garuda Linux](https://garudalinux.org/) | KDE Dragonized / similar |
| [NixOS](https://nixos.org/) | `services.desktopManager.plasma6` |
| [Debian](https://www.debian.org/) | Plasma 6 on Testing/Sid (and newer stable when available) |

Wayland and X11 sessions are both fine as long as KWin is the window manager.

## Prerequisites

1. Plasma / KWin 6 (see distros above)
2. At least two layouts under **System Settings → Keyboard → Layouts**

Example `~/.config/kxkbrc`:

```ini
[Layout]
LayoutList=de,us
Use=true
```

If you leave the layout fields empty in the script config, the **first** layout is treated as default and the **second** as alternative.

## Install

```bash
./install.sh
```

Other commands:

```bash
./install.sh reinstall
./install.sh uninstall
./install.sh enable
./install.sh disable
```

Or manually:

```bash
kpackagetool6 --type=KWin/Script --install .
kwriteconfig6 --file kwinrc --group Plugins --key keyboard-layout-switcherEnabled true
qdbus6 org.kde.KWin /KWin reconfigure
```

Then enable it under **System Settings → Window Management → KWin Scripts**.

## Configure

1. **System Settings → Window Management → KWin Scripts**
2. Select **Keyboard Layout Switcher → Configure**
3. Add window classes that should use the **alternative** layout
4. Optionally set default / alternative layout short names (XKB names like `us`, `de`, `tr`)
5. Apply — the script reloads automatically

### Finding a window's `resourceClass`

1. **System Settings → Window Management → Window Rules → Add New → Detect Window Properties**
2. Click the target window
3. Use the **Window class** value (usually lowercase) in the app list

Or from a KWin console (`plasma-interactiveconsole --kwin`):

```javascript
print(workspace.activeWindow.resourceClass)
```

## Releasing

Releases are automated via GitHub Actions.

### Fully automatic (recommended)

1. Bump `KPlugin.Version` in [`metadata.json`](metadata.json) (e.g. `1.0.2`)
2. Commit and push to `master`

The **Tag release** workflow creates `v<version>` from `metadata.json`, then the **Release** workflow builds and publishes the `.kwinscript`.

### Manual tag (also works)

```bash
# metadata.json version must match the tag (without the v prefix)
git tag v1.0.2
git push origin v1.0.2
```

### Fallback

Actions → **Release** → Run workflow → enter an existing tag (e.g. `v1.0.1`).

Local package smoke-test:

```bash
./scripts/package.sh
```

**KDE Store:** still manual — download the release asset and upload it at [store.kde.org](https://store.kde.org) under Plasma → KWin Scripts. There is no public Store upload API to automate.

## Troubleshooting

- **Layout never changes:** short names must match configured layouts:
  ```bash
  qdbus6 org.kde.keyboard /Layouts org.kde.KeyboardLayouts.getLayoutsList
  ```
- **Wrong layout sticks after focus change:** confirm the window’s `resourceClass` is in the alternative-apps list (or not, for default layout)
- **Is the script loaded?**
  ```bash
  qdbus6 org.kde.KWin /Scripting org.kde.kwin.Scripting.isScriptLoaded keyboard-layout-switcher
  ```
- **Logs:**
  ```bash
  journalctl -f | rg keyboard-layout-switcher
  ```

## License

MIT
