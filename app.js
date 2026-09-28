/* =========================================================
   HOKSTATION.GG
   FILE 6 / 8 — app.js

   CORE APPLICATION LAYER
   ---------------------------------------------------------
   Responsibilities:
   - Routing
   - Navigation
   - Search UI
   - Global modals
   - Toasts
   - Loader
   - Featured carousel
   - Mobile navigation
   - Account panel UI
   - Global error UI
   - Data freshness UI
   - Generic share/copy helpers
   - Generic confirmation modal
   - Event bus / application events

   Does NOT:
   - Handle Supabase authentication
   - Own hero/equipment/build rendering
   - Own account permissions
   - Store sensitive credentials
   - Replace features.js or account.js

   HTML SOURCE OF TRUTH:
   index.html
   ---------------------------------------------------------
   Dependency order:
   config.js
   ↓
   data.js
   ↓
   app.js
   ↓
   features.js
   ↓
   account.js
   ========================================================= */

(function () {
    "use strict";

    /* =======================================================
       GLOBAL NAMESPACE
       ======================================================= */

    const APP = {};
    const CONFIG = window.HOKSTATION_CONFIG || {};
    const DATA = window.HOKSTATION_DATA || {};

    window.HOKSTATION_APP = APP;


    /* =======================================================
       INTERNAL STATE
       ======================================================= */

    const state = {
        initialized: false,

        currentRoute: "home",
        previousRoute: null,

        search: {
            query: "",
            type: "all",
            open: false
        },

        mobileNavigationOpen: false,
        accountPanelOpen: false,

        featured: {
            index: 0,
            cards: [],
            initialized: false,
            timer: null
        },

        reducedMotion: false,

        lastDataStatus: null,

        confirmResolver: null,

        routeListeners: [],
        eventListeners: new Map(),

        lastShareData: {
            url: "",
            title: "",
            text: ""
        }
    };


    /* =======================================================
       ROUTES
       ======================================================= */

    const VALID_ROUTES = new Set([
        "home",
        "heroes",
        "hero-detail",
        "equipment",
        "builds",
        "build-lab",
        "compare",
        "patches",
        "data-history",
        "meta",
        "favorites",
        "community",
        "question-detail",
        "profile",
        "saved-builds",
        "activity",
        "settings",
        "admin",
        "notices",
        "search-results"
    ]);


    /* =======================================================
       DOM HELPERS
       ======================================================= */

    function $(selector, root) {
        return (root || document).querySelector(selector);
    }

    function $$(selector, root) {
        return Array.from(
            (root || document).querySelectorAll(selector)
        );
    }

    function byId(id) {
        return document.getElementById(id);
    }

    function exists(id) {
        return Boolean(byId(id));
    }

    function isElement(value) {
        return value instanceof Element;
    }


    /* =======================================================
       SAFE HTML / TEXT HELPERS
       ======================================================= */

    function escapeHTML(value) {
        if (value === null || value === undefined) {
            return "";
        }

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    APP.escapeHTML = escapeHTML;


    function safeText(value, fallback) {
        if (
            value === null ||
            value === undefined ||
            String(value).trim() === ""
        ) {
            return fallback || "";
        }

        return String(value);
    }


    function safeNumber(value, fallback) {
        const number = Number(value);

        return Number.isFinite(number)
            ? number
            : (fallback || 0);
    }


    /* =======================================================
       EVENT BUS
       ======================================================= */

    function on(eventName, handler) {
        if (
            typeof eventName !== "string" ||
            typeof handler !== "function"
        ) {
            return function () {};
        }

        if (!state.eventListeners.has(eventName)) {
            state.eventListeners.set(eventName, new Set());
        }

        state.eventListeners
            .get(eventName)
            .add(handler);

        return function unsubscribe() {
            const listeners =
                state.eventListeners.get(eventName);

            if (!listeners) {
                return;
            }

            listeners.delete(handler);
        };
    }


    function emit(eventName, detail) {
        const listeners =
            state.eventListeners.get(eventName);

        if (listeners) {
            listeners.forEach(function (handler) {
                try {
                    handler(detail);
                } catch (error) {
                    console.error(
                        "[HoKStation] Event handler error:",
                        error
                    );
                }
            });
        }

        try {
            document.dispatchEvent(
                new CustomEvent(
                    "hokstation:" + eventName,
                    {
                        detail: detail || {}
                    }
                )
            );
        } catch (error) {
            /* Older browser fallback is intentionally silent. */
        }
    }


    APP.on = on;
    APP.emit = emit;


    /* =======================================================
       LOADER
       ======================================================= */

    function setLoaderProgress(value) {
        const bar = byId("loader-progress-bar");
        const progress = $(".loader-progress");

        let percentage = Number(value);

        if (!Number.isFinite(percentage)) {
            percentage = 0;
        }

        percentage = Math.max(
            0,
            Math.min(100, percentage)
        );

        if (bar) {
            bar.style.width = percentage + "%";
        }

        if (progress) {
            progress.setAttribute(
                "aria-valuenow",
                String(Math.round(percentage))
            );
        }
    }


    function setLoaderStatus(message) {
        const element = byId("loader-status");

        if (element) {
            element.textContent =
                safeText(message, "Loading station...");
        }
    }


    function hideLoader() {
        const loader = byId("app-loader");

        if (!loader) {
            return;
        }

        setLoaderProgress(100);

        loader.classList.add("is-complete");
        loader.setAttribute("aria-hidden", "true");

        window.setTimeout(function () {
            loader.classList.add("hidden");
        }, state.reducedMotion ? 0 : 350);
    }


    APP.setLoaderProgress = setLoaderProgress;
    APP.setLoaderStatus = setLoaderStatus;
    APP.hideLoader = hideLoader;


    /* =======================================================
       TOAST SYSTEM
       ======================================================= */

    function showToast(message, type, duration) {
        const container = byId("toast-container");

        if (!container) {
            return null;
        }

        const toast = document.createElement("div");

        toast.className =
            "toast" +
            (type ? " toast-" + String(type) : "");

        toast.setAttribute("role", "status");

        const content = document.createElement("span");

        content.className = "toast-message";
        content.textContent =
            safeText(message, "Done.");

        toast.appendChild(content);

        container.appendChild(toast);

        window.requestAnimationFrame(function () {
            toast.classList.add("is-visible");
        });

        const timeout =
            Number.isFinite(Number(duration))
                ? Number(duration)
                : 3500;

        window.setTimeout(function () {
            toast.classList.remove("is-visible");

            window.setTimeout(function () {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, state.reducedMotion ? 0 : 250);
        }, timeout);

        return toast;
    }


    APP.toast = showToast;


    /* =======================================================
       GLOBAL ERROR
       ======================================================= */

    function showGlobalError(message) {
        const wrapper = byId("global-error");
        const text = byId("global-error-message");

        if (text) {
            text.textContent = safeText(
                message,
                "Some live features may be unavailable."
            );
        }

        if (wrapper) {
            wrapper.classList.remove("hidden");
            wrapper.setAttribute("aria-hidden", "false");
        }
    }


    function hideGlobalError() {
        const wrapper = byId("global-error");

        if (wrapper) {
            wrapper.classList.add("hidden");
            wrapper.setAttribute("aria-hidden", "true");
        }
    }


    APP.showGlobalError = showGlobalError;
    APP.hideGlobalError = hideGlobalError;


    /* =======================================================
       STATUS INDICATORS
       ======================================================= */

    function setStatusIndicator(element, status) {
        if (!element) {
            return;
        }

        element.classList.remove(
            "is-online",
            "is-warning",
            "is-error",
            "is-loading",
            "is-offline",
            "is-ready"
        );

        const normalized =
            String(status || "")
                .toLowerCase()
                .replace(/\s+/g, "-");

        if (
            normalized === "ready" ||
            normalized === "online" ||
            normalized === "fresh" ||
            normalized === "success"
        ) {
            element.classList.add("is-online");
        } else if (
            normalized === "warning" ||
            normalized === "stale" ||
            normalized === "partial"
        ) {
            element.classList.add("is-warning");
        } else if (
            normalized === "error" ||
            normalized === "offline"
        ) {
            element.classList.add("is-error");
        } else {
            element.classList.add("is-loading");
        }
    }


    function normalizeDataStatus(raw) {
        if (!raw) {
            return {
                state: "not-configured",
                label: "Data source not configured",
                lastUpdated: null,
                verifiedAt: null,
                source: null
            };
        }

        if (typeof raw === "string") {
            return {
                state: raw,
                label: raw,
                lastUpdated: null,
                verifiedAt: null,
                source: null
            };
        }

        const status =
            raw.state ||
            raw.status ||
            raw.dataState ||
            "unknown";

        let label =
            raw.label ||
            raw.message ||
            "";

        if (!label) {
            switch (String(status).toLowerCase()) {
                case "ready":
                case "online":
                case "fresh":
                    label = "Data ready";
                    break;

                case "loading":
                    label = "Loading data...";
                    break;

                case "stale":
                    label = "Data may be outdated";
                    break;

                case "error":
                    label = "Data unavailable";
                    break;

                case "not-configured":
                    label = "Data source not configured";
                    break;

                default:
                    label = "Data status unavailable";
            }
        }

        return {
            state: status,
            label: label,
            lastUpdated:
                raw.lastUpdated ||
                raw.last_updated ||
                null,
            verifiedAt:
                raw.verifiedAt ||
                raw.verified_at ||
                null,
            source: raw.source || null
        };
    }


    function formatDate(value) {
        if (!value) {
            return "—";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "—";
        }

        try {
            return new Intl.DateTimeFormat(
                undefined,
                {
                    year: "numeric",
                    month: "short",
                    day: "numeric"
                }
            ).format(date);
        } catch (error) {
            return date.toISOString().slice(0, 10);
        }
    }


    function updateDataStatusUI(rawStatus) {
        const status = normalizeDataStatus(rawStatus);

        state.lastDataStatus = status;

        const homeIndicator =
            byId("data-status-indicator");

        const homeText =
            byId("data-status-text");

        const homeDate =
            byId("data-last-updated");

        const patchIndicator =
            byId("patch-data-status");

        const patchText =
            byId("patch-data-status-text");

        const patchDate =
            byId("patch-data-date");

        const footerIndicator =
            byId("footer-status-dot");

        const footerText =
            byId("footer-status-text");

        setStatusIndicator(
            homeIndicator,
            status.state
        );

        setStatusIndicator(
            patchIndicator,
            status.state
        );

        setStatusIndicator(
            footerIndicator,
            status.state
        );

        if (homeText) {
            homeText.textContent = status.label;
        }

        if (patchText) {
            patchText.textContent = status.label;
        }

        const formattedDate =
            formatDate(status.lastUpdated);

        if (homeDate) {
            homeDate.textContent =
                status.lastUpdated
                    ? "Last update: " + formattedDate
                    : "Last update: —";
        }

        if (patchDate) {
            patchDate.textContent =
                status.lastUpdated
                    ? formattedDate
                    : "—";
        }

        if (footerText) {
            switch (
                String(status.state || "")
                    .toLowerCase()
            ) {
                case "ready":
                case "online":
                case "fresh":
                    footerText.textContent =
                        "Station Data Ready";
                    break;

                case "loading":
                    footerText.textContent =
                        "Loading Station Data";
                    break;

                case "stale":
                case "partial":
                case "warning":
                    footerText.textContent =
                        "Station Data Needs Review";
                    break;

                case "error":
                case "offline":
                    footerText.textContent =
                        "Station Data Unavailable";
                    break;

                default:
                    footerText.textContent =
                        "Data Source Not Configured";
            }
        }

        emit("data-status", status);
    }


    APP.updateDataStatusUI = updateDataStatusUI;


    /* =======================================================
       DATA COUNTS
       ======================================================= */

    function getCollectionCount(name) {
        try {
            if (
                DATA &&
                typeof DATA.getCollectionCount === "function"
            ) {
                return DATA.getCollectionCount(name);
            }

            if (
                DATA &&
                typeof DATA.getCollection === "function"
            ) {
                const collection =
                    DATA.getCollection(name);

                return Array.isArray(collection)
                    ? collection.length
                    : 0;
            }

            if (
                DATA &&
                Array.isArray(DATA[name])
            ) {
                return DATA[name].length;
            }
        } catch (error) {
            console.warn(
                "[HoKStation] Count error:",
                error
            );
        }

        return 0;
    }


    function updateHomeCounts() {
        const heroCount =
            byId("home-hero-count");

        const equipmentCount =
            byId("home-equipment-count");

        const buildCount =
            byId("home-build-count");

        if (heroCount) {
            heroCount.textContent =
                String(getCollectionCount("heroes"));
        }

        if (equipmentCount) {
            equipmentCount.textContent =
                String(getCollectionCount("equipment"));
        }

        if (buildCount) {
            buildCount.textContent =
                String(getCollectionCount("builds"));
        }
    }


    APP.updateHomeCounts = updateHomeCounts;


    /* =======================================================
       ROUTING HELPERS
       ======================================================= */

    function normalizeRoute(route) {
        if (!route) {
            return "home";
        }

        let value = String(route).trim();

        if (value.charAt(0) === "#") {
            value = value.slice(1);
        }

        if (value.charAt(0) === "/") {
            value = value.slice(1);
        }

        if (value.indexOf("?") !== -1) {
            value = value.split("?")[0];
        }

        if (value.indexOf("/") !== -1) {
            value = value.split("/")[0];
        }

        return VALID_ROUTES.has(value)
            ? value
            : "home";
    }


    function getHashRoute() {
        const hash =
            window.location.hash || "#home";

        return normalizeRoute(hash);
    }


    function getCurrentRoute() {
        return state.currentRoute;
    }


    APP.getCurrentRoute = getCurrentRoute;


    function updateActiveNavigation(route) {
        $$("[data-route]").forEach(function (element) {
            const target =
                normalizeRoute(
                    element.getAttribute("data-route")
                );

            element.classList.toggle(
                "is-active",
                target === route
            );
        });

        $$(".nav-link[data-route]").forEach(
            function (element) {
                const active =
                    normalizeRoute(
                        element.getAttribute("data-route")
                    ) === route;

                if (active) {
                    element.setAttribute(
                        "aria-current",
                        "page"
                    );
                } else {
                    element.removeAttribute(
                        "aria-current"
                    );
                }
            }
        );

        $$(".mobile-nav-link[data-route]").forEach(
            function (element) {
                const active =
                    normalizeRoute(
                        element.getAttribute("data-route")
                    ) === route;

                if (active) {
                    element.setAttribute(
                        "aria-current",
                        "page"
                    );
                } else {
                    element.removeAttribute(
                        "aria-current"
                    );
                }
            }
        );
    }


    function updateVisiblePage(route) {
        const sections =
            $$(".page-section[data-page]");

        sections.forEach(function (section) {
            const sectionRoute =
                section.getAttribute("data-page");

            const active =
                sectionRoute === route;

            section.classList.toggle(
                "is-active",
                active
            );

            section.hidden = !active;

            if (active) {
                section.setAttribute(
                    "aria-current",
                    "page"
                );
            } else {
                section.removeAttribute(
                    "aria-current"
                );
            }
        });
    }


    function scrollMainToTop() {
        const main = byId("main-content");

        if (main) {
            main.scrollTo({
                top: 0,
                behavior: state.reducedMotion
                    ? "auto"
                    : "smooth"
            });
        }

        window.scrollTo({
            top: 0,
            behavior: state.reducedMotion
                ? "auto"
                : "smooth"
        });
    }


    function notifyRouteChange(route, previousRoute) {
        const detail = {
            route: route,
            previousRoute: previousRoute
        };

        state.routeListeners.forEach(function (listener) {
            try {
                listener(detail);
            } catch (error) {
                console.error(
                    "[HoKStation] Route listener error:",
                    error
                );
            }
        });

        emit("route", detail);
    }


    function navigate(route, options) {
        const opts = options || {};
        const normalized = normalizeRoute(route);

        const previous =
            state.currentRoute;

        state.previousRoute = previous;
        state.currentRoute = normalized;

        if (opts.updateHash !== false) {
            const newHash = "#" + normalized;

            if (window.location.hash !== newHash) {
                if (opts.replace) {
                    history.replaceState(
                        null,
                        "",
                        newHash
                    );
                } else {
                    history.pushState(
                        null,
                        "",
                        newHash
                    );
                }
            }
        }

        updateVisiblePage(normalized);
        updateActiveNavigation(normalized);

        if (normalized === "search-results") {
            renderSearchResultsPage();
        }

        closeMobileNavigation();
        closeAccountPanel();

        if (!opts.preserveScroll) {
            scrollMainToTop();
        }

        notifyRouteChange(
            normalized,
            previous
        );

        return normalized;
    }


    APP.navigate = navigate;


    function setRoute(route, options) {
        return navigate(route, options);
    }


    APP.setRoute = setRoute;


    function onRouteChange(listener) {
        if (typeof listener !== "function") {
            return function () {};
        }

        state.routeListeners.push(listener);

        return function unsubscribe() {
            const index =
                state.routeListeners.indexOf(listener);

            if (index !== -1) {
                state.routeListeners.splice(
                    index,
                    1
                );
            }
        };
    }


    APP.onRouteChange = onRouteChange;


    function handleHashChange() {
        const route = getHashRoute();

        navigate(route, {
            updateHash: false,
            preserveScroll: false
        });
    }


    /* =======================================================
       SEARCH
       ======================================================= */

    function setSearchFilter(type) {
        const allowed = new Set([
            "all",
            "heroes",
            "equipment",
            "builds",
            "patches"
        ]);

        const value =
            allowed.has(type)
                ? type
                : "all";

        state.search.type = value;

        $$("[data-search-type]").forEach(
            function (button) {
                button.classList.toggle(
                    "is-active",
                    button.getAttribute(
                        "data-search-type"
                    ) === value
                );
            }
        );

        renderGlobalSearchResults();

        emit("search-filter", {
            type: value
        });
    }


    function getSearchTypeLabel(type) {
        switch (type) {
            case "heroes":
                return "Heroes";

            case "equipment":
                return "Equipment";

            case "builds":
                return "Builds";

            case "patches":
                return "Updates";

            default:
                return "All";
        }
    }


    function normalizeSearchResult(item, fallbackType) {
        if (!item) {
            return null;
        }

        if (typeof item === "string") {
            return {
                id: item,
                title: item,
                description: "",
                type: fallbackType || "all",
                route: null
            };
        }

        const type =
            item.type ||
            item.category ||
            item.kind ||
            fallbackType ||
            "all";

        return {
            id:
                item.id ||
                item.slug ||
                item.key ||
                item.value ||
                "",
            title:
                item.name ||
                item.title ||
                item.displayName ||
                item.display_name ||
                "Untitled",
            description:
                item.description ||
                item.subtitle ||
                item.summary ||
                "",
            type: type,
            route:
                item.route ||
                item.href ||
                null,
            slug:
                item.slug || null,
            raw: item
        };
    }


    function searchData(query, type) {
        if (
            !query ||
            String(query).trim().length === 0
        ) {
            return [];
        }

        try {
            if (
                DATA &&
                typeof DATA.search === "function"
            ) {
                const result =
                    DATA.search(
                        query,
                        type
                    );

                if (Array.isArray(result)) {
                    return result
                        .map(function (item) {
                            return normalizeSearchResult(
                                item,
                                type
                            );
                        })
                        .filter(Boolean);
                }
            }
        } catch (error) {
            console.error(
                "[HoKStation] Search error:",
                error
            );
        }

        return [];
    }


    function getResultRoute(result) {
        if (!result) {
            return "search-results";
        }

        if (result.route) {
            return normalizeRoute(result.route);
        }

        const type =
            String(result.type || "")
                .toLowerCase();

        const id =
            result.id ||
            result.slug;

        if (!id) {
            return "search-results";
        }

        /*
         * Domain-specific rendering/routing is ultimately owned
         * by features.js. app.js only supplies a safe destination.
         */

        switch (type) {
            case "hero":
            case "heroes":
                return "hero-detail";

            case "equipment":
            case "item":
                return "equipment";

            case "build":
            case "builds":
                return "build-lab";

            case "patch":
            case "patches":
            case "update":
                return "patches";

            default:
                return "search-results";
        }
    }


    function createSearchResultElement(result) {
        const wrapper =
            document.createElement("button");

        wrapper.type = "button";
        wrapper.className = "search-result-item";

        const title =
            document.createElement("strong");

        title.className = "search-result-title";
        title.textContent =
            safeText(
                result.title,
                "Untitled"
            );

        const meta =
            document.createElement("span");

        meta.className = "search-result-type";
        meta.textContent =
            getSearchTypeLabel(
                result.type
            );

        const description =
            document.createElement("span");

        description.className =
            "search-result-description";

        description.textContent =
            safeText(
                result.description,
                ""
            );

        wrapper.appendChild(title);
        wrapper.appendChild(meta);

        if (result.description) {
            wrapper.appendChild(description);
        }

        wrapper.addEventListener(
            "click",
            function () {
                emit("search-result-click", {
                    result: result
                });

                const route =
                    getResultRoute(result);

                navigate(route);

                /*
                 * Let features.js inspect the selected
                 * result and render the correct detail.
                 */
                emit("search-select", {
                    result: result,
                    route: route
                });

                closeSearch();
            }
        );

        return wrapper;
    }


    function renderGlobalSearchResults() {
        const container =
            byId("global-search-results");

        if (!container) {
            return;
        }

        const query =
            state.search.query.trim();

        if (!query) {
            container.innerHTML = "";

            const empty =
                document.createElement("div");

            empty.className =
                "empty-state compact";

            const icon =
                document.createElement("span");

            icon.className = "empty-icon";
            icon.textContent = "⌕";

            const heading =
                document.createElement("h3");

            heading.textContent =
                "Start searching";

            const paragraph =
                document.createElement("p");

            paragraph.textContent =
                "Search across the HoKStation database.";

            empty.appendChild(icon);
            empty.appendChild(heading);
            empty.appendChild(paragraph);

            container.appendChild(empty);

            return;
        }

        const results =
            searchData(
                query,
                state.search.type
            );

        container.innerHTML = "";

        if (results.length === 0) {
            const empty =
                document.createElement("div");

            empty.className =
                "empty-state compact";

            const icon =
                document.createElement("span");

            icon.className = "empty-icon";
            icon.textContent = "◇";

            const heading =
                document.createElement("h3");

            heading.textContent =
                "No results found";

            const paragraph =
                document.createElement("p");

            paragraph.textContent =
                "Try another search term or filter.";

            empty.appendChild(icon);
            empty.appendChild(heading);
            empty.appendChild(paragraph);

            container.appendChild(empty);

            return;
        }

        results
            .slice(0, 20)
            .forEach(function (result) {
                container.appendChild(
                    createSearchResultElement(result)
                );
            });
    }


    function renderSearchResultsPage() {
        const container =
            byId("search-results-page-content");

        const summary =
            byId("search-results-summary");

        if (!container) {
            return;
        }

        const query =
            state.search.query.trim();

        const results =
            searchData(
                query,
                state.search.type
            );

        if (summary) {
            if (!query) {
                summary.textContent =
                    "Enter a search term to explore the Station.";
            } else {
                summary.textContent =
                    results.length +
                    " result" +
                    (results.length === 1 ? "" : "s") +
                    " for “" +
                    query +
                    "”";
            }
        }

        container.innerHTML = "";

        if (!query) {
            const empty =
                document.createElement("div");

            empty.className = "empty-state";

            const icon =
                document.createElement("span");

            icon.className = "empty-icon";
            icon.textContent = "⌕";

            const heading =
                document.createElement("h3");

            heading.textContent =
                "Search the Station";

            const paragraph =
                document.createElement("p");

            paragraph.textContent =
                "Use the global search to find heroes, equipment, builds and updates.";

            empty.appendChild(icon);
            empty.appendChild(heading);
            empty.appendChild(paragraph);

            container.appendChild(empty);

            return;
        }

        if (results.length === 0) {
            const empty =
                document.createElement("div");

            empty.className = "empty-state";

            const heading =
                document.createElement("h3");

            heading.textContent =
                "No results found";

            const paragraph =
                document.createElement("p");

            paragraph.textContent =
                "Try a different term or search category.";

            empty.appendChild(heading);
            empty.appendChild(paragraph);

            container.appendChild(empty);

            return;
        }

        results.forEach(function (result) {
            container.appendChild(
                createSearchResultElement(result)
            );
        });
    }


    function performSearch(value) {
        state.search.query =
            safeText(value, "").trim();

        renderGlobalSearchResults();

        emit("search", {
            query: state.search.query,
            type: state.search.type
        });
    }


    function openSearch(options) {
        const opts = options || {};
        const panel =
            byId("global-search-panel");

        if (!panel) {
            return;
        }

        state.search.open = true;

        if (typeof opts.type === "string") {
            setSearchFilter(opts.type);
        }

        if (typeof opts.query === "string") {
            state.search.query = opts.query;
        }

        panel.classList.add("is-open");
        panel.setAttribute("aria-hidden", "false");

        const trigger =
            byId("search-trigger");

        if (trigger) {
            trigger.setAttribute(
                "aria-expanded",
                "true"
            );
        }

        const input =
            byId("global-search-input");

        if (input) {
            input.value =
                state.search.query;

            window.setTimeout(function () {
                input.focus();

                if (input.value) {
                    input.select();
                }
            }, state.reducedMotion ? 0 : 50);
        }

        renderGlobalSearchResults();

        emit("search-open");
    }


    function closeSearch() {
        const panel =
            byId("global-search-panel");

        if (!panel) {
            return;
        }

        state.search.open = false;

        panel.classList.remove("is-open");
        panel.setAttribute("aria-hidden", "true");

        const trigger =
            byId("search-trigger");

        if (trigger) {
            trigger.setAttribute(
                "aria-expanded",
                "false"
            );
        }

        emit("search-close");
    }


    APP.openSearch = openSearch;
    APP.closeSearch = closeSearch;
    APP.search = performSearch;
    APP.setSearchFilter = setSearchFilter;


    /* =======================================================
       MOBILE NAVIGATION
       ======================================================= */

    function openMobileNavigation() {
        const navigation =
            byId("mobile-navigation");

        if (!navigation) {
            return;
        }

        state.mobileNavigationOpen = true;

        navigation.classList.add("is-open");
        navigation.setAttribute(
            "aria-hidden",
            "false"
        );

        const trigger =
            byId("mobile-menu-trigger");

        if (trigger) {
            trigger.setAttribute(
                "aria-expanded",
                "true"
            );
        }

        emit("mobile-nav-open");
    }


    function closeMobileNavigation() {
        const navigation =
            byId("mobile-navigation");

        if (!navigation) {
            return;
        }

        state.mobileNavigationOpen = false;

        navigation.classList.remove("is-open");
        navigation.setAttribute(
            "aria-hidden",
            "true"
        );

        const trigger =
            byId("mobile-menu-trigger");

        if (trigger) {
            trigger.setAttribute(
                "aria-expanded",
                "false"
            );
        }

        emit("mobile-nav-close");
    }


    function toggleMobileNavigation() {
        if (state.mobileNavigationOpen) {
            closeMobileNavigation();
        } else {
            openMobileNavigation();
        }
    }


    APP.openMobileNavigation =
        openMobileNavigation;

    APP.closeMobileNavigation =
        closeMobileNavigation;

    APP.toggleMobileNavigation =
        toggleMobileNavigation;


    /* =======================================================
       ACCOUNT PANEL
       ======================================================= */

    function openAccountPanel() {
        const panel =
            byId("account-panel");

        if (!panel) {
            return;
        }

        state.accountPanelOpen = true;

        panel.classList.add("is-open");
        panel.setAttribute(
            "aria-hidden",
            "false"
        );

        const trigger =
            byId("account-trigger");

        if (trigger) {
            trigger.setAttribute(
                "aria-expanded",
                "true"
            );
        }

        emit("account-open");
    }


    function closeAccountPanel() {
        const panel =
            byId("account-panel");

        if (!panel) {
            return;
        }

        state.accountPanelOpen = false;

        panel.classList.remove("is-open");
        panel.setAttribute(
            "aria-hidden",
            "true"
        );

        const trigger =
            byId("account-trigger");

        if (trigger) {
            trigger.setAttribute(
                "aria-expanded",
                "false"
            );
        }

        emit("account-close");
    }


    function toggleAccountPanel() {
        if (state.accountPanelOpen) {
            closeAccountPanel();
        } else {
            openAccountPanel();
        }
    }


    APP.openAccountPanel =
        openAccountPanel;

    APP.closeAccountPanel =
        closeAccountPanel;

    APP.toggleAccountPanel =
        toggleAccountPanel;


    /* =======================================================
       AUTH MODAL UI
       ======================================================= */

    function openAuthModal(tab) {
        const modal =
            byId("auth-modal");

        if (!modal) {
            return;
        }

        modal.classList.add("is-open");
        modal.setAttribute(
            "aria-hidden",
            "false"
        );

        setAuthTab(
            tab || "login"
        );

        emit("auth-open", {
            tab: tab || "login"
        });
    }


    function closeAuthModal() {
        const modal =
            byId("auth-modal");

        if (!modal) {
            return;
        }

        modal.classList.remove("is-open");
        modal.setAttribute(
            "aria-hidden",
            "true"
        );

        emit("auth-close");
    }


    function setAuthTab(tab) {
        const allowed = new Set([
            "login",
            "register",
            "recovery"
        ]);

        const selected =
            allowed.has(tab)
                ? tab
                : "login";

        $$("[data-auth-tab]").forEach(
            function (button) {
                const active =
                    button.getAttribute(
                        "data-auth-tab"
                    ) === selected;

                button.classList.toggle(
                    "is-active",
                    active
                );
            }
        );

        $$("[data-auth-form]").forEach(
            function (form) {
                const active =
                    form.getAttribute(
                        "data-auth-form"
                    ) === selected;

                form.classList.toggle(
                    "hidden",
                    !active
                );
            }
        );

        const title =
            byId("auth-modal-title");

        if (title) {
            if (selected === "register") {
                title.textContent =
                    "Create your HoKStation account";
            } else if (selected === "recovery") {
                title.textContent =
                    "Reset your password";
            } else {
                title.textContent =
                    "Log in to HoKStation";
            }
        }

        emit("auth-tab", {
            tab: selected
        });
    }


    APP.openAuthModal = openAuthModal;
    APP.closeAuthModal = closeAuthModal;
    APP.setAuthTab = setAuthTab;


    /* =======================================================
       GENERIC MODAL UTILITIES
       ======================================================= */

    function getModalElement(idOrElement) {
        if (isElement(idOrElement)) {
            return idOrElement;
        }

        if (typeof idOrElement !== "string") {
            return null;
        }

        return byId(idOrElement);
    }


    function openModal(idOrElement) {
        const modal =
            getModalElement(idOrElement);

        if (!modal) {
            return false;
        }

        modal.classList.add("is-open");
        modal.setAttribute(
            "aria-hidden",
            "false"
        );

        emit("modal-open", {
            id: modal.id || null,
            element: modal
        });

        return true;
    }


    function closeModal(idOrElement) {
        const modal =
            getModalElement(idOrElement);

        if (!modal) {
            return false;
        }

        modal.classList.remove("is-open");
        modal.setAttribute(
            "aria-hidden",
            "true"
        );

        emit("modal-close", {
            id: modal.id || null,
            element: modal
        });

        return true;
    }


    function toggleModal(idOrElement) {
        const modal =
            getModalElement(idOrElement);

        if (!modal) {
            return false;
        }

        if (modal.classList.contains("is-open")) {
            return closeModal(modal);
        }

        return openModal(modal);
    }


    APP.openModal = openModal;
    APP.closeModal = closeModal;
    APP.toggleModal = toggleModal;


    /* =======================================================
       CONFIRM MODAL
       ======================================================= */

    function confirm(options) {
        const opts = options || {};

        const modal =
            byId("confirm-modal");

        const title =
            byId("confirm-modal-title");

        const message =
            byId("confirm-modal-message");

        const accept =
            byId("confirm-accept");

        const cancel =
            byId("confirm-cancel");

        if (!modal || !accept || !cancel) {
            return Promise.resolve(false);
        }

        if (title) {
            title.textContent =
                safeText(
                    opts.title,
                    "Are you sure?"
                );
        }

        if (message) {
            message.textContent =
                safeText(
                    opts.message,
                    "Please confirm this action."
                );
        }

        accept.textContent =
            safeText(
                opts.confirmText,
                "Confirm"
            );

        cancel.textContent =
            safeText(
                opts.cancelText,
                "Cancel"
            );

        openModal(modal);

        return new Promise(function (resolve) {
            state.confirmResolver = resolve;

            function finish(result) {
                if (
                    state.confirmResolver !== resolve
                ) {
                    return;
                }

                state.confirmResolver = null;

                closeModal(modal);

                resolve(result);
            }

            accept.__hokstationConfirmHandler =
                function () {
                    finish(true);
                };

            cancel.__hokstationConfirmHandler =
                function () {
                    finish(false);
                };
        });
    }


    APP.confirm = confirm;


    function resolveConfirm(result) {
        const accept =
            byId("confirm-accept");

        const cancel =
            byId("confirm-cancel");

        if (accept) {
            accept.__hokstationConfirmHandler = null;
        }

        if (cancel) {
            cancel.__hokstationConfirmHandler = null;
        }

        if (state.confirmResolver) {
            const resolver =
                state.confirmResolver;

            state.confirmResolver = null;

            closeModal("confirm-modal");

            resolver(Boolean(result));
        }
    }


    /* =======================================================
       FEATURED CAROUSEL
       ======================================================= */

    function getFeaturedCards() {
        const carousel =
            byId("featured-carousel");

        if (!carousel) {
            return [];
        }

        return $$(".featured-card", carousel);
    }


    function showFeatured(index, options) {
        const opts = options || {};

        const cards =
            state.featured.cards.length
                ? state.featured.cards
                : getFeaturedCards();

        if (!cards.length) {
            return;
        }

        let nextIndex =
            Number(index);

        if (!Number.isFinite(nextIndex)) {
            nextIndex = 0;
        }

        nextIndex =
            Math.round(nextIndex);

        if (nextIndex < 0) {
            nextIndex =
                cards.length - 1;
        }

        if (nextIndex >= cards.length) {
            nextIndex = 0;
        }

        state.featured.index =
            nextIndex;

        cards.forEach(function (card, i) {
            const active =
                i === nextIndex;

            card.classList.toggle(
                "is-active",
                active
            );

            card.setAttribute(
                "aria-hidden",
                active ? "false" : "true"
            );
        });

        emit("featured-change", {
            index: nextIndex,
            card: cards[nextIndex] || null
        });

        if (!opts.silent) {
            const card =
                cards[nextIndex];

            if (card) {
                const target =
                    card.getAttribute(
                        "data-featured-index"
                    );

                if (target !== null) {
                    state.featured.index =
                        Number(target);
                }
            }
        }
    }


    function nextFeatured() {
        showFeatured(
            state.featured.index + 1
        );
    }


    function previousFeatured() {
        showFeatured(
            state.featured.index - 1
        );
    }


    function stopFeaturedAutoPlay() {
        if (state.featured.timer) {
            window.clearInterval(
                state.featured.timer
            );

            state.featured.timer = null;
        }
    }


    function startFeaturedAutoPlay() {
        stopFeaturedAutoPlay();

        /*
         * No automatic scrolling by default.
         * It can be enabled explicitly through config.js.
         */

        const enabled =
            Boolean(
                CONFIG &&
                CONFIG.features &&
                CONFIG.features.featuredAutoPlay
            );

        if (
            !enabled ||
            state.reducedMotion
        ) {
            return;
        }

        const interval =
            safeNumber(
                CONFIG &&
                CONFIG.ui &&
                CONFIG.ui.featuredInterval,
                7000
            );

        state.featured.timer =
            window.setInterval(
                nextFeatured,
                Math.max(4000, interval)
            );
    }


    function initFeaturedCarousel() {
        const cards =
            getFeaturedCards();

        if (!cards.length) {
            return;
        }

        state.featured.cards =
            cards;

        state.featured.initialized =
            true;

        cards.forEach(function (card, index) {
            if (
                !card.hasAttribute(
                    "aria-hidden"
                )
            ) {
                card.setAttribute(
                    "aria-hidden",
                    index === 0
                        ? "false"
                        : "true"
                );
            }
        });

        showFeatured(0, {
            silent: true
        });

        startFeaturedAutoPlay();
    }


    APP.showFeatured = showFeatured;
    APP.nextFeatured = nextFeatured;
    APP.previousFeatured = previousFeatured;


    /* =======================================================
       SHARE / COPY
       ======================================================= */

    async function copyText(text) {
        const value =
            safeText(text, "");

        if (!value) {
            return false;
        }

        try {
            if (
                navigator.clipboard &&
                typeof navigator.clipboard.writeText ===
                    "function"
            ) {
                await navigator.clipboard.writeText(
                    value
                );

                return true;
            }
        } catch (error) {
            /* Fallback below. */
        }

        try {
            const textarea =
                document.createElement("textarea");

            textarea.value = value;
            textarea.setAttribute(
                "readonly",
                ""
            );

            textarea.style.position =
                "fixed";

            textarea.style.opacity = "0";

            document.body.appendChild(
                textarea
            );

            textarea.select();

            const copied =
                document.execCommand(
                    "copy"
                );

            textarea.remove();

            return copied;
        } catch (error) {
            return false;
        }
    }


    APP.copyText = copyText;


    async function nativeShare(data) {
        const shareData = {
            title:
                safeText(
                    data && data.title,
                    "HoKStation.gg"
                ),
            text:
                safeText(
                    data && data.text,
                    ""
                ),
            url:
                safeText(
                    data && data.url,
                    window.location.href
                )
        };

        if (
            navigator.share &&
            typeof navigator.share === "function"
        ) {
            try {
                await navigator.share(
                    shareData
                );

                return true;
            } catch (error) {
                /*
                 * AbortError means the user simply closed
                 * the native share sheet.
                 */
                if (
                    error &&
                    error.name === "AbortError"
                ) {
                    return false;
                }

                console.warn(
                    "[HoKStation] Native share failed:",
                    error
                );
            }
        }

        const copied =
            await copyText(
                shareData.url
            );

        if (copied) {
            showToast(
                "Share link copied.",
                "success"
            );
        } else {
            showToast(
                "Unable to share this link.",
                "error"
            );
        }

        return copied;
    }


    APP.nativeShare = nativeShare;


    function setShareData(data) {
        const input =
            byId("share-url");

        const shareData = {
            url:
                safeText(
                    data && data.url,
                    window.location.href
                ),
            title:
                safeText(
                    data && data.title,
                    "HoKStation.gg"
                ),
            text:
                safeText(
                    data && data.text,
                    ""
                )
        };

        state.lastShareData =
            shareData;

        if (input) {
            input.value =
                shareData.url;
        }

        const title =
            byId("share-modal-title");

        if (
            title &&
            data &&
            data.title
        ) {
            title.textContent =
                "Share " +
                safeText(
                    data.title,
                    "this build"
                );
        }

        return shareData;
    }


    APP.setShareData = setShareData;


    /* =======================================================
       REDUCED MOTION
       ======================================================= */

    function setReducedMotion(enabled, persist) {
        state.reducedMotion =
            Boolean(enabled);

        document.documentElement.classList.toggle(
            "reduced-motion",
            state.reducedMotion
        );

        if (persist !== false) {
            try {
                localStorage.setItem(
                    "hokstation_reduced_motion",
                    state.reducedMotion
                        ? "true"
                        : "false"
                );
            } catch (error) {
                /* Storage may be unavailable. */
            }
        }

        if (state.reducedMotion) {
            stopFeaturedAutoPlay();
        } else {
            startFeaturedAutoPlay();
        }

        emit("reduced-motion", {
            enabled: state.reducedMotion
        });
    }


    function loadReducedMotionPreference() {
        let enabled = false;

        try {
            enabled =
                localStorage.getItem(
                    "hokstation_reduced_motion"
                ) === "true";
        } catch (error) {
            enabled = false;
        }

        /*
         * Respect OS preference only when the user has not
         * explicitly saved a setting.
         */
        let hasSavedPreference = false;

        try {
            hasSavedPreference =
                localStorage.getItem(
                    "hokstation_reduced_motion"
                ) !== null;
        } catch (error) {
            hasSavedPreference = false;
        }

        if (
            !hasSavedPreference &&
            window.matchMedia &&
            window.matchMedia(
                "(prefers-reduced-motion: reduce)"
            ).matches
        ) {
            enabled = true;
        }

        setReducedMotion(
            enabled,
            false
        );
    }


    APP.setReducedMotion =
        setReducedMotion;


    /* =======================================================
       GENERIC DATA / FEATURE BRIDGE
       ======================================================= */

    function callDataInit() {
        if (
            DATA &&
            typeof DATA.init === "function"
        ) {
            try {
                const result =
                    DATA.init();

                if (
                    result &&
                    typeof result.then ===
                        "function"
                ) {
                    return result;
                }
            } catch (error) {
                console.error(
                    "[HoKStation] Data initialization error:",
                    error
                );

                showGlobalError(
                    "The data layer could not be initialized."
                );
            }
        }

        return Promise.resolve();
    }


    function callDataLoad() {
        if (
            DATA &&
            typeof DATA.loadAll === "function"
        ) {
            try {
                const result =
                    DATA.loadAll();

                if (
                    result &&
                    typeof result.then ===
                        "function"
                ) {
                    return result;
                }

                return Promise.resolve(result);
            } catch (error) {
                console.error(
                    "[HoKStation] Data loading error:",
                    error
                );

                return Promise.reject(error);
            }
        }

        return Promise.resolve();
    }


    function getCurrentDataStatus() {
        try {
            if (
                DATA &&
                typeof DATA.getDataFreshness ===
                    "function"
            ) {
                return DATA.getDataFreshness();
            }

            if (
                DATA &&
                DATA.status
            ) {
                return DATA.status;
            }
        } catch (error) {
            console.warn(
                "[HoKStation] Data status error:",
                error
            );
        }

        return {
            state: "not-configured",
            label: "Data source not configured"
        };
    }


    function subscribeToData() {
        if (
            DATA &&
            typeof DATA.subscribe ===
                "function"
        ) {
            try {
                DATA.subscribe(function (payload) {
                    updateHomeCounts();

                    const status =
                        payload &&
                        payload.status
                            ? payload.status
                            : getCurrentDataStatus();

                    updateDataStatusUI(
                        status
                    );

                    emit(
                        "data-ready",
                        payload || {}
                    );
                });
            } catch (error) {
                console.warn(
                    "[HoKStation] Data subscription failed:",
                    error
                );
            }
        }
    }


    /* =======================================================
       CLICK HANDLERS
       ======================================================= */

    function handleRouteClick(event) {
        const element =
            event.target.closest(
                "[data-route]"
            );

        if (!element) {
            return;
        }

        /*
         * Let normal external links work.
         */
        if (
            element.tagName === "A" &&
            element.target === "_blank"
        ) {
            return;
        }

        const route =
            element.getAttribute(
                "data-route"
            );

        if (!route) {
            return;
        }

        event.preventDefault();

        navigate(route);
    }


    function handleAccountRouteClick(event) {
        const element =
            event.target.closest(
                "[data-account-route]"
            );

        if (!element) {
            return;
        }

        const route =
            element.getAttribute(
                "data-account-route"
            );

        if (!route) {
            return;
        }

        event.preventDefault();

        /*
         * account.js decides whether the user is authenticated.
         * app.js only requests navigation.
         */
        emit("account-route-request", {
            route: route,
            element: element
        });
    }


    function handleAdminPanelClick(event) {
        const element =
            event.target.closest(
                "[data-admin-panel]"
            );

        if (!element) {
            return;
        }

        const panel =
            element.getAttribute(
                "data-admin-panel"
            );

        if (!panel) {
            return;
        }

        emit("admin-panel-request", {
            panel: panel,
            element: element
        });
    }


    /* =======================================================
       GENERIC MODAL CLICK HANDLING
       ======================================================= */

    function isModalOverlay(element) {
        return (
            element &&
            element.classList &&
            element.classList.contains(
                "modal-overlay"
            )
        );
    }


    function handleOverlayClick(event) {
        const target =
            event.target;

        if (!isModalOverlay(target)) {
            return;
        }

        /*
         * Only close when the actual backdrop is clicked,
         * not the modal card itself.
         */
        closeModal(target);
    }


    function bindModalCloseButton(
        buttonId,
        modalId
    ) {
        const button =
            byId(buttonId);

        if (!button) {
            return;
        }

        button.addEventListener(
            "click",
            function () {
                closeModal(modalId);
            }
        );
    }


    /* =======================================================
       GLOBAL CLICK WIRING
       ======================================================= */

    function bindGlobalControls() {
        document.addEventListener(
            "click",
            handleRouteClick
        );

        document.addEventListener(
            "click",
            handleAccountRouteClick
        );

        document.addEventListener(
            "click",
            handleAdminPanelClick
        );

        document.addEventListener(
            "click",
            handleOverlayClick
        );


        /* Search */

        const searchTrigger =
            byId("search-trigger");

        if (searchTrigger) {
            searchTrigger.addEventListener(
                "click",
                function () {
                    openSearch();
                }
            );
        }

        const searchClose =
            byId("search-close");

        if (searchClose) {
            searchClose.addEventListener(
                "click",
                closeSearch
            );
        }

        const searchInput =
            byId("global-search-input");

        if (searchInput) {
            searchInput.addEventListener(
                "input",
                function (event) {
                    performSearch(
                        event.target.value
                    );
                }
            );

            searchInput.addEventListener(
                "keydown",
                function (event) {
                    if (
                        event.key === "Enter"
                    ) {
                        event.preventDefault();

                        if (
                            state.search.query
                        ) {
                            navigate(
                                "search-results"
                            );
                        }
                    }
                }
            );
        }

        $$("[data-search-type]").forEach(
            function (button) {
                button.addEventListener(
                    "click",
                    function () {
                        setSearchFilter(
                            button.getAttribute(
                                "data-search-type"
                            )
                        );
                    }
                );
            }
        );


        /* Home / Heroes search buttons */

        const homeSearch =
            byId("home-search-button");

        if (homeSearch) {
            homeSearch.addEventListener(
                "click",
                function () {
                    openSearch();
                }
            );
        }

        const heroesSearch =
            byId("heroes-search-button");

        if (heroesSearch) {
            heroesSearch.addEventListener(
                "click",
                function () {
                    openSearch({
                        type: "heroes"
                    });
                }
            );
        }


        /* Mobile navigation */

        const mobileTrigger =
            byId("mobile-menu-trigger");

        if (mobileTrigger) {
            mobileTrigger.addEventListener(
                "click",
                toggleMobileNavigation
            );
        }

        const mobileClose =
            byId("mobile-menu-close");

        if (mobileClose) {
            mobileClose.addEventListener(
                "click",
                closeMobileNavigation
            );
        }


        /* Mobile account */

        const mobileAccount =
            byId("mobile-account-trigger");

        if (mobileAccount) {
            mobileAccount.addEventListener(
                "click",
                function () {
                    closeMobileNavigation();
                    openAccountPanel();
                }
            );
        }


        /* Account */

        const accountTrigger =
            byId("account-trigger");

        if (accountTrigger) {
            accountTrigger.addEventListener(
                "click",
                toggleAccountPanel
            );
        }

        const accountClose =
            byId("account-close");

        if (accountClose) {
            accountClose.addEventListener(
                "click",
                closeAccountPanel
            );
        }


        /* Auth */

        const loginOpen =
            byId("login-open");

        if (loginOpen) {
            loginOpen.addEventListener(
                "click",
                function () {
                    openAuthModal("login");
                }
            );
        }

        const registerOpen =
            byId("register-open");

        if (registerOpen) {
            registerOpen.addEventListener(
                "click",
                function () {
                    openAuthModal("register");
                }
            );
        }

        const authClose =
            byId("auth-modal-close");

        if (authClose) {
            authClose.addEventListener(
                "click",
                closeAuthModal
            );
        }

        $$("[data-auth-tab]").forEach(
            function (button) {
                button.addEventListener(
                    "click",
                    function () {
                        setAuthTab(
                            button.getAttribute(
                                "data-auth-tab"
                            )
                        );
                    }
                );
            }
        );

        const forgotPassword =
            byId("forgot-password-open");

        if (forgotPassword) {
            forgotPassword.addEventListener(
                "click",
                function () {
                    const loginEmail =
                        byId("login-email");

                    const recoveryEmail =
                        byId("recovery-email");

                    if (
                        loginEmail &&
                        recoveryEmail
                    ) {
                        recoveryEmail.value =
                            loginEmail.value;
                    }

                    setAuthTab("recovery");
                }
            );
        }

        const recoveryBack =
            byId("recovery-back");

        if (recoveryBack) {
            recoveryBack.addEventListener(
                "click",
                function () {
                    setAuthTab("login");
                }
            );
        }


        /* Generic modal close buttons */

        bindModalCloseButton(
            "equipment-selector-close",
            "equipment-selector-modal"
        );

        bindModalCloseButton(
            "question-modal-close",
            "question-modal"
        );

        bindModalCloseButton(
            "report-modal-close",
            "report-modal"
        );

        bindModalCloseButton(
            "share-modal-close",
            "share-modal"
        );


        /* Confirm */

        const confirmAccept =
            byId("confirm-accept");

        if (confirmAccept) {
            confirmAccept.addEventListener(
                "click",
                function () {
                    if (
                        typeof confirmAccept
                            .__hokstationConfirmHandler ===
                            "function"
                    ) {
                        confirmAccept
                            .__hokstationConfirmHandler();
                    } else {
                        resolveConfirm(true);
                    }
                }
            );
        }

        const confirmCancel =
            byId("confirm-cancel");

        if (confirmCancel) {
            confirmCancel.addEventListener(
                "click",
                function () {
                    if (
                        typeof confirmCancel
                            .__hokstationConfirmHandler ===
                            "function"
                    ) {
                        confirmCancel
                            .__hokstationConfirmHandler();
                    } else {
                        resolveConfirm(false);
                    }
                }
            );
        }


        /* Global error */

        const errorClose =
            byId("global-error-close");

        if (errorClose) {
            errorClose.addEventListener(
                "click",
                hideGlobalError
            );
        }


        /* Featured carousel */

        const featuredPrevious =
            byId("featured-prev");

        if (featuredPrevious) {
            featuredPrevious.addEventListener(
                "click",
                previousFeatured
            );
        }

        const featuredNext =
            byId("featured-next");

        if (featuredNext) {
            featuredNext.addEventListener(
                "click",
                nextFeatured
            );
        }


        /* Share */

        const copyShare =
            byId("copy-share-url");

        if (copyShare) {
            copyShare.addEventListener(
                "click",
                async function () {
                    const input =
                        byId("share-url");

                    if (!input) {
                        return;
                    }

                    const success =
                        await copyText(
                            input.value
                        );

                    if (success) {
                        showToast(
                            "Share link copied.",
                            "success"
                        );
                    } else {
                        showToast(
                            "Unable to copy the link.",
                            "error"
                        );
                    }
                }
            );
        }

        const nativeShareButton =
            byId("native-share-button");

        if (nativeShareButton) {
            nativeShareButton.addEventListener(
                "click",
                function () {
                    nativeShare(
                        state.lastShareData
                    );
                }
            );
        }


        /* Footer report */

        const footerReport =
            byId("footer-report-button");

        if (footerReport) {
            footerReport.addEventListener(
                "click",
                function () {
                    openModal(
                        "report-modal"
                    );
                }
            );
        }
    }


    /* =======================================================
       KEYBOARD CONTROLS
       ======================================================= */

    function handleKeyboard(event) {
        if (event.key === "Escape") {
            if (state.search.open) {
                closeSearch();
                return;
            }

            if (state.mobileNavigationOpen) {
                closeMobileNavigation();
                return;
            }

            if (state.accountPanelOpen) {
                closeAccountPanel();
                return;
            }

            const openModalElement =
                $(".modal-overlay.is-open");

            if (openModalElement) {
                if (
                    openModalElement.id ===
                    "auth-modal"
                ) {
                    closeAuthModal();
                } else {
                    closeModal(
                        openModalElement
                    );
                }
            }
        }
    }


    /* =======================================================
       HASH / HISTORY
       ======================================================= */

    function bindHistory() {
        window.addEventListener(
            "hashchange",
            handleHashChange
        );

        window.addEventListener(
            "popstate",
            handleHashChange
        );
    }


    /* =======================================================
       INITIAL PAGE STATE
       ======================================================= */

    function initializeRoute() {
        const route =
            getHashRoute();

        /*
         * This updates sections without creating an extra
         * history entry during initial page load.
         */
        navigate(route, {
            updateHash: false,
            preserveScroll: true
        });
    }


    /* =======================================================
       APP INITIALIZATION
       ======================================================= */

    async function initialize() {
        if (state.initialized) {
            return APP;
        }

        state.initialized = true;

        loadReducedMotionPreference();

        setLoaderProgress(5);
        setLoaderStatus(
            "Initializing station..."
        );

        bindGlobalControls();
        bindHistory();

        document.addEventListener(
            "keydown",
            handleKeyboard
        );

        setLoaderProgress(15);

        initFeaturedCarousel();

        setLoaderProgress(25);

        initializeRoute();

        setLoaderProgress(35);

        /*
         * Data.js exists before app.js because of the HTML
         * dependency order. It may still be unconfigured.
         */
        await callDataInit();

        setLoaderProgress(55);

        subscribeToData();

        updateHomeCounts();

        updateDataStatusUI(
            getCurrentDataStatus()
        );

        setLoaderProgress(65);

        /*
         * Loading is intentionally graceful. A missing or
         * unconfigured data source must not destroy the UI.
         */
        try {
            await callDataLoad();
        } catch (error) {
            console.error(
                "[HoKStation] Initial data load failed:",
                error
            );

            updateDataStatusUI({
                state: "error",
                label: "Data unavailable",
                error: error
            });
        }

        setLoaderProgress(80);

        updateHomeCounts();

        updateDataStatusUI(
            getCurrentDataStatus()
        );

        setLoaderStatus(
            "Preparing station interface..."
        );

        setLoaderProgress(90);

        /*
         * Tell features.js/account.js that core application
         * infrastructure is ready.
         */
        emit("app-ready", {
            route: state.currentRoute
        });

        setLoaderStatus(
            "Station ready."
        );

        setLoaderProgress(100);

        hideLoader();

        emit("ready", {
            route: state.currentRoute
        });

        return APP;
    }


    APP.init = initialize;


    /* =======================================================
       DEBUG / PUBLIC STATE
       ======================================================= */

    APP.getState = function () {
        return {
            currentRoute:
                state.currentRoute,

            previousRoute:
                state.previousRoute,

            search: {
                query:
                    state.search.query,

                type:
                    state.search.type,

                open:
                    state.search.open
            },

            mobileNavigationOpen:
                state.mobileNavigationOpen,

            accountPanelOpen:
                state.accountPanelOpen,

            reducedMotion:
                state.reducedMotion,

            dataStatus:
                state.lastDataStatus
        };
    };


    /* =======================================================
       DOM READY
       ======================================================= */

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            {
                once: true
            }
        );
    } else {
        initialize();
    }


    /* =======================================================
       FINAL SAFETY
       ======================================================= */

    window.addEventListener(
        "error",
        function (event) {
            /*
             * Do not expose raw internal errors to users.
             * Log for debugging and show a generic message only
             * for serious runtime errors.
             */
            console.error(
                "[HoKStation] Runtime error:",
                event.error || event.message
            );
        }
    );

})();
