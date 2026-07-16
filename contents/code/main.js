/*
    Keyboard Layout Switcher — KWin script
    Forces a configured layout (default: us) for whitelisted apps,
    otherwise restores the default layout (default: tr).

    Note: org.kde.KeyboardLayouts.setLayout expects a D-Bus uint, but
    KWin's callDBus sends JS numbers as signed int, so that call fails.
    We switch by calling switchToNextLayout until getLayout matches.
*/

const DEFAULT_US_APPS =
    "konsole,kitty,alacritty,wezterm,ghostty,code,cursor,kate,org.kde.kate,jetbrains-idea,jetbrains-webstorm";

let usApps = {};
let defaultLayoutName = "tr";
let usLayoutName = "us";
let layoutIndices = {}; // shortName -> index
let layoutCount = 0;
let lastAppliedIndex = -1;
let layoutsReady = false;
let switching = false;

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

function shortNameFromEntry(entry) {
    if (entry === null || entry === undefined) {
        return "";
    }
    if (typeof entry === "string") {
        return entry.toLowerCase();
    }
    if (typeof entry === "object") {
        // Plasma 6: ["tr", "", "Turkish"] or { shortName: "tr", ... }
        const name = entry.shortName || entry.short_name || entry[0];
        return name ? String(name).toLowerCase() : "";
    }
    return String(entry).toLowerCase();
}

function applyFallbackIndices() {
    layoutIndices = {};
    layoutIndices[defaultLayoutName] = 0;
    if (usLayoutName !== defaultLayoutName) {
        layoutIndices[usLayoutName] = 1;
    }
    layoutCount = Object.keys(layoutIndices).length;
}

function loadConfig() {
    usApps = parseAppList(readConfig("UsApps", DEFAULT_US_APPS));
    defaultLayoutName = String(readConfig("DefaultLayout", "tr")).trim().toLowerCase() || "tr";
    usLayoutName = String(readConfig("UsLayout", "us")).trim().toLowerCase() || "us";

    // Ready immediately with LayoutList-order fallback (tr,us → 0,1)
    applyFallbackIndices();
    layoutsReady = true;

    refreshLayoutIndices(function () {
        applyForWindow(workspace.activeWindow);
    });
}

function refreshLayoutIndices(done) {
    callDBus(
        "org.kde.keyboard",
        "/Layouts",
        "org.kde.KeyboardLayouts",
        "getLayoutsList",
        function (layouts) {
            const next = {};
            let count = 0;

            if (layouts && layouts.length !== undefined) {
                for (let i = 0; i < layouts.length; ++i) {
                    const name = shortNameFromEntry(layouts[i]);
                    if (name) {
                        next[name] = i;
                        count += 1;
                    }
                }
            }

            if (count > 0) {
                layoutIndices = next;
                layoutCount = count;
            } else {
                applyFallbackIndices();
            }

            layoutsReady = true;
            print(
                "keyboard-layout-switcher: layouts ready count=" +
                    layoutCount +
                    " default=" +
                    defaultLayoutName +
                    "@" +
                    indexForLayout(defaultLayoutName) +
                    " us=" +
                    usLayoutName +
                    "@" +
                    indexForLayout(usLayoutName)
            );

            if (typeof done === "function") {
                done();
            }
        }
    );
}

function indexForLayout(name) {
    const key = String(name || "").toLowerCase();
    if (Object.prototype.hasOwnProperty.call(layoutIndices, key)) {
        return layoutIndices[key];
    }
    return -1;
}

function setLayoutIndex(targetIndex) {
    if (targetIndex < 0 || switching) {
        return;
    }
    if (targetIndex === lastAppliedIndex) {
        return;
    }

    switching = true;
    callDBus(
        "org.kde.keyboard",
        "/Layouts",
        "org.kde.KeyboardLayouts",
        "getLayout",
        function (current) {
            let cur = Number(current);
            if (cur === targetIndex) {
                lastAppliedIndex = targetIndex;
                switching = false;
                return;
            }

            const maxSteps = Math.max(layoutCount, 2) + 1;
            let steps = 0;

            function step() {
                if (steps >= maxSteps) {
                    print(
                        "keyboard-layout-switcher: failed to reach layout index " +
                            targetIndex
                    );
                    switching = false;
                    return;
                }
                steps += 1;
                callDBus(
                    "org.kde.keyboard",
                    "/Layouts",
                    "org.kde.KeyboardLayouts",
                    "switchToNextLayout",
                    function () {
                        callDBus(
                            "org.kde.keyboard",
                            "/Layouts",
                            "org.kde.KeyboardLayouts",
                            "getLayout",
                            function (value) {
                                cur = Number(value);
                                if (cur === targetIndex) {
                                    lastAppliedIndex = targetIndex;
                                    switching = false;
                                    print(
                                        "keyboard-layout-switcher: switched to index " +
                                            targetIndex
                                    );
                                } else {
                                    step();
                                }
                            }
                        );
                    }
                );
            }

            step();
        }
    );
}

function isSpecialWindow(window) {
    if (!window) {
        return true;
    }
    if (window.desktopWindow || window.dock || window.toolbar || window.menu || window.splash) {
        return true;
    }
    if (window.normalWindow === false) {
        return true;
    }
    return false;
}

function windowMatchesUsApps(window) {
    const resourceClass = window.resourceClass
        ? String(window.resourceClass).toLowerCase()
        : "";
    const resourceName = window.resourceName
        ? String(window.resourceName).toLowerCase()
        : "";

    if (resourceClass && Object.prototype.hasOwnProperty.call(usApps, resourceClass)) {
        return true;
    }
    if (resourceName && Object.prototype.hasOwnProperty.call(usApps, resourceName)) {
        return true;
    }
    return false;
}

function applyForWindow(window) {
    if (!layoutsReady || isSpecialWindow(window)) {
        return;
    }

    const useUs = windowMatchesUsApps(window);
    const targetName = useUs ? usLayoutName : defaultLayoutName;
    const index = indexForLayout(targetName);
    if (index < 0) {
        print(
            "keyboard-layout-switcher: layout '" +
                targetName +
                "' not found in configured layouts"
        );
        return;
    }

    print(
        "keyboard-layout-switcher: focus class=" +
            window.resourceClass +
            " -> " +
            targetName +
            " (" +
            index +
            ")"
    );
    setLayoutIndex(index);
}

function onWindowActivated(window) {
    applyForWindow(window);
}

print("keyboard-layout-switcher: loading");
loadConfig();
workspace.windowActivated.connect(onWindowActivated);

if (options && options.configChanged) {
    options.configChanged.connect(function () {
        lastAppliedIndex = -1;
        loadConfig();
    });
}
