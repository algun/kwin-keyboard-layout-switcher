/*
    Keyboard Layout Switcher — KWin script
    Forces a configured layout (default: us) for whitelisted apps,
    otherwise restores the default layout (default: tr).
*/

const DEFAULT_US_APPS =
    "konsole,kitty,alacritty,wezterm,ghostty,code,cursor,kate,org.kde.kate,jetbrains-idea,jetbrains-webstorm";

let usApps = {};
let defaultLayoutName = "tr";
let usLayoutName = "us";
let layoutIndices = {}; // shortName -> index
let lastAppliedIndex = -1;
let layoutsReady = false;

function parseAppList(value) {
    const apps = {};
    String(value || "")
        .toLowerCase()
        .split(/[\s,;]+/)
        .forEach((entry) => {
            const name = entry.trim();
            if (name.length > 0) {
                apps[name] = true;
            }
        });
    return apps;
}

function loadConfig() {
    usApps = parseAppList(readConfig("UsApps", DEFAULT_US_APPS));
    defaultLayoutName = String(readConfig("DefaultLayout", "tr")).trim().toLowerCase() || "tr";
    usLayoutName = String(readConfig("UsLayout", "us")).trim().toLowerCase() || "us";
    refreshLayoutIndices(function () {
        applyForWindow(workspace.activeWindow);
    });
}

function shortNameFromEntry(entry) {
    if (entry === null || entry === undefined) {
        return "";
    }
    if (typeof entry === "string") {
        return entry.toLowerCase();
    }
    if (typeof entry === "object") {
        const name = entry.shortName || entry.short_name || entry[0];
        return name ? String(name).toLowerCase() : "";
    }
    return String(entry).toLowerCase();
}

function refreshLayoutIndices(done) {
    callDBus(
        "org.kde.keyboard",
        "/Layouts",
        "org.kde.KeyboardLayouts",
        "getLayoutsList",
        function (layouts) {
            layoutIndices = {};
            layoutsReady = false;

            if (layouts && layouts.length !== undefined) {
                for (let i = 0; i < layouts.length; ++i) {
                    const name = shortNameFromEntry(layouts[i]);
                    if (name) {
                        layoutIndices[name] = i;
                    }
                }
            }

            // Fallback for common tr,us ordering when DBus parsing fails
            if (Object.keys(layoutIndices).length === 0) {
                layoutIndices[defaultLayoutName] = 0;
                if (usLayoutName !== defaultLayoutName) {
                    layoutIndices[usLayoutName] = 1;
                }
            }

            layoutsReady = true;
            if (typeof done === "function") {
                done();
            }
        }
    );
}

function indexForLayout(name) {
    const key = String(name || "").toLowerCase();
    if (layoutIndices.hasOwnProperty(key)) {
        return layoutIndices[key];
    }
    return -1;
}

function setLayoutIndex(index) {
    if (index < 0 || index === lastAppliedIndex) {
        return;
    }
    lastAppliedIndex = index;
    callDBus(
        "org.kde.keyboard",
        "/Layouts",
        "org.kde.KeyboardLayouts",
        "setLayout",
        index
    );
}

function isSpecialWindow(window) {
    if (!window) {
        return true;
    }
    // Ignore panels, desktop, and other non-normal windows
    if (window.desktopWindow || window.dock || window.toolbar || window.menu || window.splash) {
        return true;
    }
    if (window.normalWindow === false) {
        return true;
    }
    return false;
}

function shouldUseUsLayout(window) {
    const resourceClass = window.resourceClass
        ? String(window.resourceClass).toLowerCase()
        : "";
    return resourceClass.length > 0 && usApps.hasOwnProperty(resourceClass);
}

function applyForWindow(window) {
    if (!layoutsReady || isSpecialWindow(window)) {
        return;
    }

    const targetName = shouldUseUsLayout(window) ? usLayoutName : defaultLayoutName;
    const index = indexForLayout(targetName);
    if (index < 0) {
        print(
            "keyboard-layout-switcher: layout '" +
                targetName +
                "' not found in configured layouts"
        );
        return;
    }
    setLayoutIndex(index);
}

function onWindowActivated(window) {
    applyForWindow(window);
}

loadConfig();
workspace.windowActivated.connect(onWindowActivated);

if (options && options.configChanged) {
    options.configChanged.connect(function () {
        lastAppliedIndex = -1;
        loadConfig();
    });
}
