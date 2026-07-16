/*
    Keyboard Layout Switcher — KWin script
    Uses an alternative keyboard layout for selected apps, and the default
    layout for everything else.

    Note: org.kde.KeyboardLayouts.setLayout expects a D-Bus uint, but
    KWin's callDBus sends JS numbers as signed int, so that call fails.
    We switch by calling switchToNextLayout until getLayout matches.
*/

const DEFAULT_ALTERNATIVE_APPS = "";

let alternativeApps = {};
let defaultLayoutName = "";
let alternativeLayoutName = "";
let layoutIndices = {}; // shortName -> index
let layoutNamesByIndex = [];
let layoutCount = 0;
let lastAppliedIndex = -1;
let pendingIndex = -1;
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

function readConfigWithLegacy(key, legacyKey, fallback) {
    const value = readConfig(key, "");
    if (value !== undefined && value !== null && String(value).length > 0) {
        return String(value);
    }
    const legacy = readConfig(legacyKey, "");
    if (legacy !== undefined && legacy !== null && String(legacy).length > 0) {
        return String(legacy);
    }
    return fallback;
}

function shortNameFromEntry(entry) {
    if (entry === null || entry === undefined) {
        return "";
    }
    if (typeof entry === "string") {
        return entry.toLowerCase();
    }
    if (typeof entry === "object") {
        // Plasma 6: ["us", "", "English (US)"] or { shortName: "us", ... }
        const name = entry.shortName || entry.short_name || entry[0];
        return name ? String(name).toLowerCase() : "";
    }
    return String(entry).toLowerCase();
}

function resolveLayoutNames() {
    // Empty config fields mean "first" and "second" configured layouts
    if (!defaultLayoutName && layoutNamesByIndex.length > 0) {
        defaultLayoutName = layoutNamesByIndex[0];
    }
    if (!alternativeLayoutName && layoutNamesByIndex.length > 1) {
        alternativeLayoutName = layoutNamesByIndex[1];
    }
}

function applyNamedFallbackIndices() {
    // Only used when DBus layout list is unavailable but names are known
    if (!defaultLayoutName) {
        return;
    }
    layoutIndices = {};
    layoutNamesByIndex = [];
    layoutIndices[defaultLayoutName] = 0;
    layoutNamesByIndex[0] = defaultLayoutName;
    if (alternativeLayoutName && alternativeLayoutName !== defaultLayoutName) {
        layoutIndices[alternativeLayoutName] = 1;
        layoutNamesByIndex[1] = alternativeLayoutName;
    } else if (!alternativeLayoutName) {
        alternativeLayoutName = defaultLayoutName;
    }
    layoutCount = Object.keys(layoutIndices).length;
}

function loadConfig() {
    alternativeApps = parseAppList(
        readConfigWithLegacy("AlternativeApps", "UsApps", DEFAULT_ALTERNATIVE_APPS)
    );
    defaultLayoutName = String(readConfig("DefaultLayout", "")).trim().toLowerCase();
    alternativeLayoutName = String(
        readConfigWithLegacy("AlternativeLayout", "UsLayout", "")
    )
        .trim()
        .toLowerCase();

    // Wait for getLayoutsList so empty fields can mean first/second layout.
    // If the user set explicit names, we can apply before the reply arrives.
    if (defaultLayoutName && alternativeLayoutName) {
        applyNamedFallbackIndices();
        layoutsReady = true;
    } else {
        layoutsReady = false;
    }

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
            const byIndex = [];
            let count = 0;

            if (layouts && layouts.length !== undefined) {
                for (let i = 0; i < layouts.length; ++i) {
                    const name = shortNameFromEntry(layouts[i]);
                    if (name) {
                        next[name] = i;
                        byIndex[i] = name;
                        count += 1;
                    }
                }
            }

            if (count > 0) {
                layoutIndices = next;
                layoutNamesByIndex = byIndex;
                layoutCount = count;
                resolveLayoutNames();
            } else {
                applyNamedFallbackIndices();
            }

            layoutsReady = indexForLayout(defaultLayoutName) >= 0;
            print(
                "keyboard-layout-switcher: layouts ready count=" +
                    layoutCount +
                    " default=" +
                    defaultLayoutName +
                    "@" +
                    indexForLayout(defaultLayoutName) +
                    " alternative=" +
                    alternativeLayoutName +
                    "@" +
                    indexForLayout(alternativeLayoutName)
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

function finishSwitching() {
    switching = false;
    if (pendingIndex < 0) {
        return;
    }
    const next = pendingIndex;
    pendingIndex = -1;
    if (next !== lastAppliedIndex) {
        setLayoutIndex(next);
    }
}

function setLayoutIndex(targetIndex) {
    if (targetIndex < 0) {
        return;
    }

    // While a switch is in flight, remember the latest desired layout.
    // Dropping these requests made quick Alt-Tab (e.g. to Konsole) miss updates.
    if (switching) {
        pendingIndex = targetIndex;
        return;
    }

    if (targetIndex === lastAppliedIndex) {
        return;
    }

    switching = true;
    const desired = targetIndex;
    callDBus(
        "org.kde.keyboard",
        "/Layouts",
        "org.kde.KeyboardLayouts",
        "getLayout",
        function (current) {
            // A newer focus target may have arrived while getLayout was in flight
            const goal = pendingIndex >= 0 ? pendingIndex : desired;
            pendingIndex = -1;

            let cur = Number(current);
            if (cur === goal) {
                lastAppliedIndex = goal;
                finishSwitching();
                return;
            }

            const maxSteps = Math.max(layoutCount, 2) + 1;
            let steps = 0;

            function step() {
                const activeGoal = pendingIndex >= 0 ? pendingIndex : goal;
                if (pendingIndex >= 0) {
                    pendingIndex = -1;
                }

                if (cur === activeGoal) {
                    lastAppliedIndex = activeGoal;
                    print(
                        "keyboard-layout-switcher: switched to index " + activeGoal
                    );
                    finishSwitching();
                    return;
                }

                if (steps >= maxSteps) {
                    print(
                        "keyboard-layout-switcher: failed to reach layout index " +
                            activeGoal
                    );
                    finishSwitching();
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
                                step();
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

function windowMatchesAlternativeApps(window) {
    const resourceClass = window.resourceClass
        ? String(window.resourceClass).toLowerCase()
        : "";
    const resourceName = window.resourceName
        ? String(window.resourceName).toLowerCase()
        : "";

    if (resourceClass && Object.prototype.hasOwnProperty.call(alternativeApps, resourceClass)) {
        return true;
    }
    if (resourceName && Object.prototype.hasOwnProperty.call(alternativeApps, resourceName)) {
        return true;
    }
    return false;
}

function applyForWindow(window) {
    if (!layoutsReady || isSpecialWindow(window)) {
        return;
    }

    const useAlternative = windowMatchesAlternativeApps(window);
    const targetName = useAlternative ? alternativeLayoutName : defaultLayoutName;
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
