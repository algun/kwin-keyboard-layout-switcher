# Keyboard Layout Switcher

KWin script for KDE Plasma 6 that switches the keyboard layout based on the active application:

- **Listed apps** → alternative layout (e.g. `us`)
- **Everything else** → default layout (e.g. `de`, `tr`, `fr`, …)

Configure the app list and layout short names from System Settings — no code edits required.

## Prerequisites

1. Plasma / KWin 6
2. At least two layouts under **System Settings → Keyboard → Layouts**
3. Set **Switching Policy** to **Global**  
   (Application/Window policy remembers layouts per app and can fight this script)

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

## Troubleshooting

- **Layout never changes:** short names must match configured layouts:
  ```bash
  qdbus6 org.kde.keyboard /Layouts org.kde.KeyboardLayouts.getLayoutsList
  ```
- **Wrong layout sticks after focus change:** set Switching Policy to **Global**
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
