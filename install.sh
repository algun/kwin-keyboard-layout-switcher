#!/usr/bin/env bash
set -euo pipefail

SCRIPT_ID="keyboard-layout-switcher"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_TYPE="KWin/Script"

usage() {
    cat <<EOF
Usage: $(basename "$0") [install|reinstall|uninstall|enable|disable]

  install     Install the KWin script (default)
  reinstall   Remove then install again
  uninstall   Remove the script
  enable      Enable the script and ask KWin to reload
  disable     Disable the script and ask KWin to reload
EOF
}

have_cmd() {
    command -v "$1" >/dev/null 2>&1
}

packagetool() {
    if have_cmd kpackagetool6; then
        kpackagetool6 "$@"
    elif have_cmd kpackagetool5; then
        kpackagetool5 "$@"
    else
        echo "error: kpackagetool6 (or kpackagetool5) not found" >&2
        exit 1
    fi
}

writeconfig() {
    if have_cmd kwriteconfig6; then
        kwriteconfig6 "$@"
    elif have_cmd kwriteconfig5; then
        kwriteconfig5 "$@"
    else
        echo "error: kwriteconfig6 (or kwriteconfig5) not found" >&2
        exit 1
    fi
}

reconfigure_kwin() {
    if have_cmd qdbus6; then
        qdbus6 org.kde.KWin /KWin reconfigure >/dev/null 2>&1 || true
    elif have_cmd qdbus-qt6; then
        qdbus-qt6 org.kde.KWin /KWin reconfigure >/dev/null 2>&1 || true
    elif have_cmd qdbus; then
        qdbus org.kde.KWin /KWin reconfigure >/dev/null 2>&1 || true
    else
        echo "warning: qdbus not found; enable/disable the script from System Settings or relogin"
    fi
}

is_installed() {
    packagetool --type="$PACKAGE_TYPE" --list 2>/dev/null | grep -q "${SCRIPT_ID}" || return 1
}

do_install() {
    if is_installed; then
        echo "Updating existing install of ${SCRIPT_ID}..."
        packagetool --type="$PACKAGE_TYPE" --upgrade "$SCRIPT_DIR"
    else
        echo "Installing ${SCRIPT_ID}..."
        packagetool --type="$PACKAGE_TYPE" --install "$SCRIPT_DIR"
    fi
    do_enable
    echo "Done. Configure via System Settings → Window Management → KWin Scripts → Keyboard Layout Switcher → Configure"
}

do_uninstall() {
    if ! is_installed; then
        echo "${SCRIPT_ID} is not installed"
        return 0
    fi
    do_disable
    echo "Removing ${SCRIPT_ID}..."
    packagetool --type="$PACKAGE_TYPE" --remove "$SCRIPT_ID"
    echo "Done."
}

do_enable() {
    echo "Enabling ${SCRIPT_ID}..."
    writeconfig --file kwinrc --group Plugins --key "${SCRIPT_ID}Enabled" true
    reconfigure_kwin
}

do_disable() {
    echo "Disabling ${SCRIPT_ID}..."
    writeconfig --file kwinrc --group Plugins --key "${SCRIPT_ID}Enabled" false
    reconfigure_kwin
}

cmd="${1:-install}"
case "$cmd" in
    install)
        do_install
        ;;
    reinstall)
        do_uninstall || true
        do_install
        ;;
    uninstall|remove)
        do_uninstall
        ;;
    enable)
        do_enable
        ;;
    disable)
        do_disable
        ;;
    -h|--help|help)
        usage
        ;;
    *)
        echo "error: unknown command: $cmd" >&2
        usage >&2
        exit 1
        ;;
esac
