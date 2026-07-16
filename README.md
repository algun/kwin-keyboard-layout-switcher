# Keyboard Layout Switcher

KWin script for KDE Plasma 6 that switches the keyboard layout based on the active application:

- **Whitelisted apps** → US layout (`us`)
- **Everything else** → default layout (`tr`)

The US-app list is editable from System Settings — no code changes or reinstall needed.

## Prerequisites

1. Plasma / KWin 6
2. Both layouts configured under **System Settings → Keyboard → Layouts** (e.g. `tr` and `us`)
3. Set **Switching Policy** to **Global**  
   (Application/Window policy remembers layouts per app and can fight this script)

Your `~/.config/kxkbrc` should look roughly like:

```ini
[Layout]
LayoutList=tr,us
Use=true
```

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

Then confirm it is enabled under **System Settings → Window Management → KWin Scripts**.

## Configure US apps

1. Open **System Settings → Window Management → KWin Scripts**
2. Select **Keyboard Layout Switcher**
3. Click **Configure**
4. Edit the list (one `resourceClass` per line, or comma-separated)
5. Optionally change the default / US layout short names
6. Apply — the script reloads the list automatically

### Finding a window's `resourceClass`

1. **System Settings → Window Management → Window Rules → Add New → Detect Window Properties**
2. Click the target window
3. Use the **Window class** value (lowercase) in the US apps list

You can also inspect active windows from a KWin console (`plasma-interactiveconsole --kwin`):

```javascript
print(workspace.activeWindow.resourceClass)
```

## Defaults

Out of the box, these classes use the US layout:

`konsole`, `kitty`, `alacritty`, `wezterm`, `ghostty`, `code`, `cursor`, `kate`, `org.kde.kate`, `jetbrains-idea`, `jetbrains-webstorm`

Default layout short name: `tr`  
US layout short name: `us`

## Troubleshooting

- **Layout never changes:** ensure both short names match entries from  
  `qdbus6 org.kde.keyboard /Layouts org.kde.KeyboardLayouts.getLayoutsList`
- **Wrong layout sticks after focus change:** set Switching Policy to **Global**
- **Logs:**  
  `journalctl -f QT_CATEGORY=js QT_CATEGORY=kwin_scripting`
