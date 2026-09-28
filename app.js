/* =========================================================
   HOKSTATION.GG
   FILE 6 / 8 — app.js

   CORE APPLICATION CONTROLLER
   ---------------------------------------------------------
   Responsibilities:
   - Application boot
   - Loader
   - Hash routing
   - Navigation state
   - Mobile navigation
   - Global search panel
   - Search result routing
   - Featured carousel
   - Generic modals
   - Toast notifications
   - Global error handling
   - Shared DOM utilities
   - Reduced-motion support
   - URL / share utilities
   - Safe communication with data.js / features.js / account.js

   NOT responsible for:
   - Game data storage
   - Hero rendering
   - Equipment rendering
   - Build rendering/calculation
   - Authentication
   - User profiles
   - Admin authorization
   - Database writes

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

   IMPORTANT:
   - HoKStation.gg is independent.
   - Never place secrets or service-role keys here.
   ========================================================= */

(function () {
    "use strict";

    /* =========================================================
       GLOBAL NAMESPACE
       ========================================================= */

    const APP = window.HOKSTATION_APP = window.HOKSTATION_APP || {};

    APP.version = "1.0.0";
    APP.name = "HoKStation.gg";


    /* =========================================================
       INTERNAL STATE
       ========================================================= */

    const state = {
        currentRoute: "home",
        previousRoute: null,

        search: {
            query: "",
            type: "all",
            isOpen: false
        },

        mobileNavigationOpen: false,

        accountPanelOpen: false,

        featuredIndex: 0,

        modalStack: [],

        reducedMotion: false,

        booted: false,

        ready: false,

        lastError: null
    };


    /* =========================================================
       ROUTE DEFINITIONS
       ========================================================= */

    const ROUTES = new Set([
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

    const DEFAULT_ROUTE = "home";


    /* =========================================================
       DOM CACHE
       ========================================================= */

    const DOM = {};

    function cacheDOM() {
        const ids = [
            "app-loader",
            "loader-status",
            "loader-progress-bar",

            "toast-container",

            "modal-root",

            "global-search-panel",
            "search-close",
            "global-search-input",
            "global-search-filters",
            "global-search-results",

            "mobile-navigation",
            "mobile-menu-close",
            "mobile-menu-trigger",
            "mobile-account-trigger",

            "account-panel",
            "account-close",
            "account-trigger",

            "auth-modal",
            "auth-modal-close",
            "login-open",
            "register-open",
            "forgot-password-open",
            "recovery-back",

            "main-content",
            "site-header",
            "site-footer",

            "home-search-button",
            "heroes-search-button",

            "featured-carousel",
            "featured-prev",
            "featured-next",

            "hero-grid",
            "hero-empty",
            "hero-sort",

            "equipment-grid",

            "build-grid",
            "create-build-button",
            "open-build-lab",

            "save-build-button",
            "share-build-button",
            "clear-build-button",

            "build-hero-selector",
            "build-slots",

            "compare-item-a",
            "compare-item-b",
            "compare-results",

            "patch-list",

            "data-history-list",

            "meta-grid",

            "favorites-content",

            "question-list",
            "ask-question-button",
            "report-button",

            "question-detail-content",

            "saved-builds-grid",
            "activity-list",

            "language-setting",
            "reduced-motion-setting",
            "change-password-button",
            "send-verification-button",

            "admin-access-status",
            "admin-panel-container",

            "notice-list",

            "search-results-page",
            "search-results-summary",
            "search-results-page-content",

            "footer-report-button",

            "equipment-selector-modal",
            "equipment-selector-close",
            "equipment-selector-search",
            "equipment-selector-list",

            "question-modal",
            "question-modal-close",
            "question-form",

            "report-modal",
            "report-modal-close",
            "report-form",

            "share-modal",
            "share-modal-close",
            "share-url",
            "copy-share-url",
            "native-share-button",

            "confirm-modal",
            "confirm-cancel",
            "confirm-accept",
            "confirm-modal-title",
            "confirm-modal-message",

            "global-error",
            "global-error-message",
            "global-error-close",

            "home-hero-count",
            "home-equipment-count",
            "home-build-count",

            "data-status-indicator",
            "data-status-text",
            "data-last-updated",

            "patch-data-status",
            "patch-data-status-text",
            "patch-data-date",

            "footer-status-dot",
            "footer-status-text"
        ];

        ids.forEach(function (id) {
            DOM[id] = document.getElementById(id);
        });

        DOM.routeLinks = Array.from(
            document.querySelectorAll("[data-route]")
        );

        DOM.navLinks = Array.from(
            document.querySelectorAll(".nav-link, .mobile-nav-link")
        );

        DOM.pageSections = Array.from(
            document.querySelectorAll("[data-page]")
        );

        DOM.featuredCards = DOM.featuredCarousel
            ? Array.from(
                DOM.featuredCarousel.querySelectorAll(".featured-card")
            )
            : [];

        DOM.searchTypeButtons = DOM.globalSearchFilters
            ? Array.from(
                DOM.globalSearchFilters.querySelectorAll("[data-search-type]")
            )
            : [];

        DOM.heroRoleButtons = Array.from(
            document.querySelectorAll("[data-hero-role]")
        );

        DOM.equipmentTypeButtons = Array.from(
            document.querySelectorAll("[data-equipment-type]")
        );

        DOM.historyTabButtons = Array.from(
            document.querySelectorAll("[data-history-tab]")
        );

        DOM.favoriteTabButtons = Array.from(
            document.querySelectorAll("[data-favorite-tab]")
        );

        DOM.communityFilterButtons = Array.from(
            document.querySelectorAll("[data-community-filter]")
        );

        DOM.adminPanelButtons = Array.from(
            document.querySelectorAll("[data-admin-panel]")
        );

        DOM.authTabs = Array.from(
            document.querySelectorAll("[data-auth-tab]")
        );

        DOM.authForms = Array.from(
            document.querySelectorAll("[data-auth-form]")
        );
    }


    /* =========================================================
       CONFIG ACCESS
       ========================================================= */

    function getConfig() {
        return window.HOKSTATION_CONFIG || {};
    }

    function getConfigValue(path, fallback) {
        const config = getConfig();

        if (!path) {
            return fallback;
        }

        const parts = String(path).split(".");
        let value = config;

        for (let i = 0; i < parts.length; i += 1) {
            if (
                value === null ||
                value === undefined ||
                typeof value !== "object"
            ) {
                return fallback;
            }

            value = value[parts[i]];
        }

        return value === undefined ? fallback : value;
    }


    /* =========================================================
       DATA API ACCESS
       ========================================================= */

    function getDataAPI() {
        return window.HOKSTATION_DATA || null;
    }

    function getFeaturesAPI() {
        return window.HOKSTATION_FEATURES || null;
    }

    function getAccountAPI() {
        return window.HOKSTATION_ACCOUNT || null;
    }


    /* =========================================================
       SAFE FUNCTION CALL
       ========================================================= */

    function safeCall(fn, fallback) {
        try {
            if (typeof fn !== "function") {
                return fallback;
            }

            return fn();
        } catch (error) {
            console.error("[HoKStation] Safe call failed:", error);
            return fallback;
        }
    }


    /* =========================================================
       STRING UTILITIES
       ========================================================= */

    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function normalizeText(value) {
        return String(value ?? "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
    }

    function truncate(value, length) {
        const text = String(value ?? "");

        if (text.length <= length) {
            return text;
        }

        return text.slice(0, Math.max(0, length - 1)).trim() + "…";
    }

    function slugify(value) {
        return normalizeText(value)
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }


    /* =========================================================
       DATE / NUMBER UTILITIES
       ========================================================= */

    function formatNumber(value) {
        const number = Number(value);

        if (!Number.isFinite(number)) {
            return "—";
        }

        return new Intl.NumberFormat(undefined, {
            maximumFractionDigits: 2
        }).format(number);
    }

    function formatDate(value, options) {
        if (!value) {
            return "—";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "—";
        }

        const defaultOptions = {
            year: "numeric",
            month: "short",
            day: "numeric"
        };

        try {
            return new Intl.DateTimeFormat(
                undefined,
                options || defaultOptions
            ).format(date);
        } catch (error) {
            return date.toLocaleDateString();
        }
    }

    function formatDateTime(value) {
        if (!value) {
            return "—";
        }

        return formatDate(value, {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit"
        });
    }


    /* =========================================================
       LOADER
       ========================================================= */

    function setLoaderProgress(value, message) {
        const progress = Math.max(
            0,
            Math.min(100, Number(value) || 0)
        );

        if (DOM.loaderProgressBar) {
            DOM.loaderProgressBar.style.width = progress + "%";
        }

        const progressElement =
            DOM.loaderProgressBar &&
            DOM.loaderProgressBar.parentElement;

        if (progressElement) {
            progressElement.setAttribute(
                "aria-valuenow",
                String(progress)
            );
        }

        if (DOM.loaderStatus && message) {
            DOM.loaderStatus.textContent = message;
        }
    }

    function hideLoader() {
        if (!DOM.appLoader) {
            return;
        }

        setLoaderProgress(100, "Station ready.");

        window.setTimeout(function () {
            DOM.appLoader.classList.add("is-hidden");
            DOM.appLoader.setAttribute("aria-hidden", "true");

            window.setTimeout(function () {
                DOM.appLoader.classList.add("hidden");
            }, 500);
        }, state.reducedMotion ? 0 : 180);
    }

    function showLoader(message) {
        if (!DOM.appLoader) {
            return;
        }

        DOM.appLoader.classList.remove("hidden");
        DOM.appLoader.classList.remove("is-hidden");
        DOM.appLoader.setAttribute("aria-hidden", "false");

        setLoaderProgress(0, message || "Loading station...");
    }


    /* =========================================================
       TOAST SYSTEM
       ========================================================= */

    function toast(message, type, duration) {
        if (!DOM.toastContainer) {
            return;
        }

        const text = String(message ?? "").trim();

        if (!text) {
            return;
        }

        const allowedTypes = new Set([
            "info",
            "success",
            "warning",
            "error"
        ]);

        const toastType = allowedTypes.has(type)
            ? type
            : "info";

        const item = document.createElement("div");

        item.className = "toast toast-" + toastType;

        item.setAttribute("role", "status");

        item.innerHTML =
            '<div class="toast-content">' +
                '<span class="toast-indicator" aria-hidden="true"></span>' +
                '<span class="toast-message"></span>' +
            '</div>' +
            '<button class="toast-close" type="button" aria-label="Dismiss">' +
                "×" +
            "</button>";

        const messageElement =
            item.querySelector(".toast-message");

        if (messageElement) {
            messageElement.textContent = text;
        }

        const closeButton =
            item.querySelector(".toast-close");

        function removeToast() {
            if (!item.isConnected) {
                return;
            }

            item.classList.add("is-removing");

            window.setTimeout(function () {
                if (item.isConnected) {
                    item.remove();
                }
            }, state.reducedMotion ? 0 : 180);
        }

        if (closeButton) {
            closeButton.addEventListener(
                "click",
                removeToast
            );
        }

        DOM.toastContainer.appendChild(item);

        const timeout =
            Number.isFinite(Number(duration))
                ? Number(duration)
                : 4500;

        if (timeout > 0) {
            window.setTimeout(removeToast, timeout);
        }

        return item;
    }

    APP.toast = toast;
    APP.notify = toast;


    /* =========================================================
       GLOBAL ERROR SYSTEM
       ========================================================= */

    function showGlobalError(message) {
        state.lastError = message;

        if (DOM.globalErrorMessage) {
            DOM.globalErrorMessage.textContent =
                String(message || "Some live features may be unavailable.");
        }

        if (DOM.globalError) {
            DOM.globalError.classList.remove("hidden");
            DOM.globalError.setAttribute("aria-hidden", "false");
        }
    }

    function hideGlobalError() {
        if (!DOM.globalError) {
            return;
        }

        DOM.globalError.classList.add("hidden");
        DOM.globalError.setAttribute("aria-hidden", "true");
    }


    /* =========================================================
       ROUTING HELPERS
       ========================================================= */

    function getRouteFromHash(hash) {
        const raw = String(
            hash !== undefined
                ? hash
                : window.location.hash
        );

        const cleaned = raw
            .replace(/^#/, "")
            .trim();

        if (!cleaned) {
            return DEFAULT_ROUTE;
        }

        const route = cleaned.split("?")[0];

        if (ROUTES.has(route)) {
            return route;
        }

        return DEFAULT_ROUTE;
    }

    function getQueryFromHash(hash) {
        const raw = String(
            hash !== undefined
                ? hash
                : window.location.hash
        );

        const queryIndex = raw.indexOf("?");

        if (queryIndex === -1) {
            return new URLSearchParams();
        }

        return new URLSearchParams(
            raw.slice(queryIndex + 1)
        );
    }

    function getRouteTarget(route) {
        const normalized = getRouteFromHash("#" + route);

        return document.querySelector(
            '[data-page="' +
            CSS.escape(normalized) +
            '"]'
        );
    }


    /* =========================================================
       ROUTE VISIBILITY
       ========================================================= */

    function updatePageVisibility(route) {
        DOM.pageSections.forEach(function (section) {
            const isActive =
                section.getAttribute("data-page") === route;

            section.classList.toggle(
                "is-active",
                isActive
            );

            section.classList.toggle(
                "hidden",
                !isActive
            );

            if (isActive) {
                section.setAttribute(
                    "aria-hidden",
                    "false"
                );
            } else {
                section.setAttribute(
                    "aria-hidden",
                    "true"
                );
            }
        });
    }


    /* =========================================================
       NAVIGATION ACTIVE STATES
       ========================================================= */

    function updateNavigation(route) {
        DOM.navLinks.forEach(function (link) {
            const linkRoute =
                link.getAttribute("data-route");

            const active =
                linkRoute === route;

            link.classList.toggle(
                "is-active",
                active
            );

            if (active) {
                link.setAttribute(
                    "aria-current",
                    "page"
                );
            } else {
                link.removeAttribute(
                    "aria-current"
                );
            }
        });

        DOM.routeLinks.forEach(function (link) {
            const linkRoute =
                link.getAttribute("data-route");

            if (linkRoute === route) {
                link.classList.add("is-current");
            } else {
                link.classList.remove("is-current");
            }
        });
    }


    /* =========================================================
       SCROLL MANAGEMENT
       ========================================================= */

    function scrollToMain(options) {
        const behavior =
            state.reducedMotion
                ? "auto"
                : (options && options.behavior) || "smooth";

        if (DOM.mainContent) {
            DOM.mainContent.scrollTo({
                top: 0,
                behavior
            });
        }

        window.scrollTo({
            top: 0,
            behavior
        });
    }


    /* =========================================================
       ROUTE HANDLER
       ========================================================= */

    function navigate(route, options) {
        const requestedRoute =
            String(route || DEFAULT_ROUTE)
                .replace(/^#/, "")
                .split("?")[0];

        const targetRoute =
            ROUTES.has(requestedRoute)
                ? requestedRoute
                : DEFAULT_ROUTE;

        const opts = options || {};

        if (
            targetRoute !== requestedRoute &&
            !opts.silent
        ) {
            window.location.hash = targetRoute;
            return;
        }

        state.previousRoute = state.currentRoute;
        state.currentRoute = targetRoute;

        updatePageVisibility(targetRoute);
        updateNavigation(targetRoute);

        closeMobileNavigation();
        closeAccountPanel();

        if (!opts.keepSearchOpen) {
            closeSearchPanel();
        }

        if (!opts.skipScroll) {
            scrollToMain({
                behavior: opts.behavior
            });
        }

        dispatchAppEvent(
            "routechange",
            {
                route: targetRoute,
                previousRoute: state.previousRoute
            }
        );

        handleRouteSpecificBehavior(
            targetRoute,
            getQueryFromHash()
        );

        return targetRoute;
    }

    APP.navigate = navigate;


    /* =========================================================
       ROUTE-SPECIFIC BEHAVIOR
       ========================================================= */

    function handleRouteSpecificBehavior(route, params) {
        const features = getFeaturesAPI();

        if (features) {
            if (
                route === "heroes" &&
                typeof features.renderHeroes === "function"
            ) {
                safeCall(function () {
                    features.renderHeroes();
                });
            }

            if (
                route === "equipment" &&
                typeof features.renderEquipment === "function"
            ) {
                safeCall(function () {
                    features.renderEquipment();
                });
            }

            if (
                route === "builds" &&
                typeof features.renderBuilds === "function"
            ) {
                safeCall(function () {
                    features.renderBuilds();
                });
            }

            if (
                route === "build-lab" &&
                typeof features.renderBuildLab === "function"
            ) {
                safeCall(function () {
                    features.renderBuildLab();
                });
            }

            if (
                route === "compare" &&
                typeof features.renderCompare === "function"
            ) {
                safeCall(function () {
                    features.renderCompare();
                });
            }

            if (
                route === "patches" &&
                typeof features.renderPatches === "function"
            ) {
                safeCall(function () {
                    features.renderPatches();
                });
            }

            if (
                route === "data-history" &&
                typeof features.renderHistory === "function"
            ) {
                safeCall(function () {
                    features.renderHistory();
                });
            }

            if (
                route === "meta" &&
                typeof features.renderMeta === "function"
            ) {
                safeCall(function () {
                    features.renderMeta();
                });
            }

            if (
                route === "favorites" &&
                typeof features.renderFavorites === "function"
            ) {
                safeCall(function () {
                    features.renderFavorites();
                });
            }

            if (
                route === "community" &&
                typeof features.renderCommunity === "function"
            ) {
                safeCall(function () {
                    features.renderCommunity();
                });
            }

            if (
                route === "notices" &&
                typeof features.renderNotices === "function"
            ) {
                safeCall(function () {
                    features.renderNotices();
                });
            }
        }

        if (
            route === "search-results"
        ) {
            renderSearchResultsPage(
                params && params.get("q")
                    ? params.get("q")
                    : state.search.query,
                params && params.get("type")
                    ? params.get("type")
                    : state.search.type
            );
        }

        if (
            route === "hero-detail" &&
            features &&
            typeof features.openHeroDetailFromRoute === "function"
        ) {
            safeCall(function () {
                features.openHeroDetailFromRoute(params);
            });
        }

        if (
            route === "question-detail" &&
            features &&
            typeof features.openQuestionFromRoute === "function"
        ) {
            safeCall(function () {
                features.openQuestionFromRoute(params);
            });
        }
    }


    /* =========================================================
       HASH CHANGE
       ========================================================= */

    function handleHashChange() {
        const route = getRouteFromHash();

        navigate(route, {
            silent: true
        });
    }


    /* =========================================================
       ROUTE LINK HANDLING
       ========================================================= */

    function handleRouteLinkClick(event) {
        const link = event.currentTarget;

        if (!link) {
            return;
        }

        const href = link.getAttribute("href");
        const route = link.getAttribute("data-route");

        if (!route) {
            return;
        }

        if (
            event.defaultPrevented ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
        ) {
            return;
        }

        if (
            href &&
            href.startsWith("#")
        ) {
            event.preventDefault();

            if (
                window.location.hash.replace("#", "") === route
            ) {
                navigate(route, {
                    silent: true
                });
            } else {
                window.location.hash = route;
            }
        }
    }


    /* =========================================================
       MOBILE NAVIGATION
       ========================================================= */

    function openMobileNavigation() {
        if (!DOM.mobileNavigation) {
            return;
        }

        state.mobileNavigationOpen = true;

        DOM.mobileNavigation.classList.add("is-open");
        DOM.mobileNavigation.setAttribute(
            "aria-hidden",
            "false"
        );

        if (DOM.mobileMenuTrigger) {
            DOM.mobileMenuTrigger.setAttribute(
                "aria-expanded",
                "true"
            );
        }

        document.body.classList.add(
            "mobile-navigation-open"
        );
    }

    function closeMobileNavigation() {
        if (!DOM.mobileNavigation) {
            return;
        }

        state.mobileNavigationOpen = false;

        DOM.mobileNavigation.classList.remove("is-open");
        DOM.mobileNavigation.setAttribute(
            "aria-hidden",
            "true"
        );

        if (DOM.mobileMenuTrigger) {
            DOM.mobileMenuTrigger.setAttribute(
                "aria-expanded",
                "false"
            );
        }

        document.body.classList.remove(
            "mobile-navigation-open"
        );
    }

    function toggleMobileNavigation() {
        if (state.mobileNavigationOpen) {
            closeMobileNavigation();
        } else {
            openMobileNavigation();
        }
    }


    /* =========================================================
       ACCOUNT PANEL
       ========================================================= */

    function openAccountPanel() {
        if (!DOM.accountPanel) {
            return;
        }

        state.accountPanelOpen = true;

        DOM.accountPanel.classList.add("is-open");
        DOM.accountPanel.setAttribute(
            "aria-hidden",
            "false"
        );

        if (DOM.accountTrigger) {
            DOM.accountTrigger.setAttribute(
                "aria-expanded",
                "true"
            );
        }
    }

    function closeAccountPanel() {
        if (!DOM.accountPanel) {
            return;
        }

        state.accountPanelOpen = false;

        DOM.accountPanel.classList.remove("is-open");
        DOM.accountPanel.setAttribute(
            "aria-hidden",
            "true"
        );

        if (DOM.accountTrigger) {
            DOM.accountTrigger.setAttribute(
                "aria-expanded",
                "false"
            );
        }
    }

    function toggleAccountPanel() {
        if (state.accountPanelOpen) {
            closeAccountPanel();
        } else {
            closeMobileNavigation();
            openAccountPanel();
        }
    }


    /* =========================================================
       SEARCH PANEL
       ========================================================= */

    function openSearchPanel(initialQuery) {
        if (!DOM.globalSearchPanel) {
            return;
        }

        closeMobileNavigation();
        closeAccountPanel();

        state.search.isOpen = true;

        DOM.globalSearchPanel.classList.add(
            "is-open"
        );

        DOM.globalSearchPanel.setAttribute(
            "aria-hidden",
            "false"
        );

        if (initialQuery !== undefined) {
            state.search.query = String(initialQuery);
        }

        if (DOM.globalSearchInput) {
            DOM.globalSearchInput.value =
                state.search.query;

            window.setTimeout(function () {
                DOM.globalSearchInput.focus();

                const length =
                    DOM.globalSearchInput.value.length;

                try {
                    DOM.globalSearchInput.setSelectionRange(
                        length,
                        length
                    );
                } catch (error) {
                    /* Ignore unsupported selection behavior. */
                }
            }, 30);
        }

        renderSearchResults(
            state.search.query,
            state.search.type
        );
    }

    function closeSearchPanel() {
        if (!DOM.globalSearchPanel) {
            return;
        }

        state.search.isOpen = false;

        DOM.globalSearchPanel.classList.remove(
            "is-open"
        );

        DOM.globalSearchPanel.setAttribute(
            "aria-hidden",
            "true"
        );
    }

    function toggleSearchPanel() {
        if (state.search.isOpen) {
            closeSearchPanel();
        } else {
            openSearchPanel();
        }
    }


    /* =========================================================
       SEARCH TYPE
       ========================================================= */

    function setSearchType(type) {
        const allowed = new Set([
            "all",
            "heroes",
            "equipment",
            "builds",
            "patches"
        ]);

        state.search.type =
            allowed.has(type)
                ? type
                : "all";

        DOM.searchTypeButtons.forEach(function (button) {
            const active =
                button.getAttribute("data-search-type") ===
                state.search.type;

            button.classList.toggle(
                "is-active",
                active
            );

            button.setAttribute(
                "aria-pressed",
                active ? "true" : "false"
            );
        });

        renderSearchResults(
            state.search.query,
            state.search.type
        );
    }


    /* =========================================================
       DATA SEARCH
       ========================================================= */

    function performSearch(query, type) {
        const data = getDataAPI();

        if (
            data &&
            typeof data.search === "function"
        ) {
            try {
                const result = data.search(
                    query,
                    type || "all"
                );

                if (Array.isArray(result)) {
                    return result;
                }

                if (
                    result &&
                    Array.isArray(result.results)
                ) {
                    return result.results;
                }
            } catch (error) {
                console.error(
                    "[HoKStation] Data search failed:",
                    error
                );
            }
        }

        return [];
    }


    /* =========================================================
       SEARCH RESULT LABELS
       ========================================================= */

    function getSearchResultTypeLabel(type) {
        const labels = {
            hero: "Hero",
            heroes: "Hero",
            equipment: "Equipment",
            item: "Equipment",
            build: "Build",
            builds: "Build",
            patch: "Update",
            patches: "Update",
            notice: "Notice",
            question: "Community"
        };

        return labels[type] || "Result";
    }

    function getSearchResultTitle(item) {
        return (
            item.name ||
            item.title ||
            item.displayName ||
            item.display_name ||
            "Untitled"
        );
    }

    function getSearchResultDescription(item) {
        return (
            item.shortDescription ||
            item.short_description ||
            item.description ||
            item.summary ||
            item.subtitle ||
            ""
        );
    }

    function getSearchResultType(item) {
        return String(
            item.type ||
            item.kind ||
            item.collection ||
            ""
        ).toLowerCase();
    }


    /* =========================================================
       SEARCH RESULT HTML
       ========================================================= */

    function buildSearchResultHTML(item, index) {
        const title =
            getSearchResultTitle(item);

        const description =
            truncate(
                getSearchResultDescription(item),
                180
            );

        const rawType =
            getSearchResultType(item);

        const typeLabel =
            getSearchResultTypeLabel(rawType);

        const id =
            item.id ||
            item.slug ||
            item.key ||
            "";

        return (
            '<button ' +
                'type="button" ' +
                'class="search-result-item" ' +
                'data-search-result-index="' +
                    escapeHTML(index) +
                '" ' +
                'data-search-result-type="' +
                    escapeHTML(rawType) +
                '" ' +
                'data-search-result-id="' +
                    escapeHTML(id) +
                '">' +

                '<span class="search-result-type">' +
                    escapeHTML(typeLabel) +
                "</span>" +

                '<span class="search-result-main">' +

                    '<strong>' +
                        escapeHTML(title) +
                    "</strong>" +

                    (
                        description
                            ? '<span>' +
                                escapeHTML(description) +
                              "</span>"
                            : ""
                    ) +

                "</span>" +

                '<span class="search-result-arrow" aria-hidden="true">' +
                    "›" +
                "</span>" +

            "</button>"
        );
    }


    /* =========================================================
       SEARCH RESULTS RENDER
       ========================================================= */

    let currentSearchResults = [];

    function renderSearchResults(query, type) {
        if (!DOM.globalSearchResults) {
            return;
        }

        const normalizedQuery =
            String(query || "").trim();

        state.search.query =
            normalizedQuery;

        if (!normalizedQuery) {
            DOM.globalSearchResults.innerHTML =
                '<div class="empty-state compact">' +
                    '<span class="empty-icon">⌕</span>' +
                    '<h3>Start searching</h3>' +
                    '<p>Search across the HoKStation database.</p>' +
                "</div>";

            currentSearchResults = [];
            return;
        }

        const results =
            performSearch(
                normalizedQuery,
                type || state.search.type
            );

        currentSearchResults = results;

        if (!results.length) {
            DOM.globalSearchResults.innerHTML =
                '<div class="empty-state compact">' +
                    '<span class="empty-icon">◇</span>' +
                    '<h3>No results found</h3>' +
                    '<p>Try another search term or category.</p>' +
                "</div>";

            return;
        }

        DOM.globalSearchResults.innerHTML =
            results
                .slice(0, 20)
                .map(buildSearchResultHTML)
                .join("");
    }


    /* =========================================================
       SEARCH RESULT CLICK
       ========================================================= */

    function handleSearchResultClick(event) {
        const target =
            event.target.closest(
                ".search-result-item"
            );

        if (!target) {
            return;
        }

        const index =
            Number(
                target.getAttribute(
                    "data-search-result-index"
                )
            );

        const item =
            currentSearchResults[index];

        if (!item) {
            return;
        }

        openSearchResult(item);
    }


    /* =========================================================
       OPEN SEARCH RESULT
       ========================================================= */

    function openSearchResult(item) {
        const features = getFeaturesAPI();

        const type =
            getSearchResultType(item);

        const id =
            item.id ||
            item.slug ||
            item.key;

        closeSearchPanel();

        if (
            features &&
            typeof features.openSearchResult === "function"
        ) {
            const handled = safeCall(function () {
                return features.openSearchResult(
                    item
                );
            }, false);

            if (handled) {
                return;
            }
        }

        if (
            type === "hero" ||
            type === "heroes"
        ) {
            if (id) {
                window.location.hash =
                    "hero-detail?id=" +
                    encodeURIComponent(id);
            } else {
                window.location.hash = "heroes";
            }

            return;
        }

        if (
            type === "build" ||
            type === "builds"
        ) {
            window.location.hash =
                "builds";

            return;
        }

        if (
            type === "equipment" ||
            type === "item"
        ) {
            window.location.hash =
                "equipment";

            return;
        }

        if (
            type === "patch" ||
            type === "patches"
        ) {
            window.location.hash =
                "patches";

            return;
        }

        window.location.hash =
            "search-results?q=" +
            encodeURIComponent(
                getSearchResultTitle(item)
            ) +
            "&type=" +
            encodeURIComponent(
                type || "all"
            );
    }


    /* =========================================================
       SEARCH RESULTS PAGE
       ========================================================= */

    function renderSearchResultsPage(query, type) {
        if (!DOM.searchResultsPageContent) {
            return;
        }

        const cleanQuery =
            String(query || "").trim();

        const cleanType =
            type || "all";

        if (DOM.searchResultsSummary) {
            DOM.searchResultsSummary.textContent =
                cleanQuery
                    ? 'Results for "' + cleanQuery + '"'
                    : "Search the HoKStation database.";
        }

        if (!cleanQuery) {
            DOM.searchResultsPageContent.innerHTML =
                '<div class="empty-state">' +
                    '<span class="empty-icon">⌕</span>' +
                    '<h3>Start searching</h3>' +
                    '<p>Enter a search term to find heroes, equipment, builds or updates.</p>' +
                "</div>";

            return;
        }

        const results =
            performSearch(
                cleanQuery,
                cleanType
            );

        currentSearchResults = results;

        if (!results.length) {
            DOM.searchResultsPageContent.innerHTML =
                '<div class="empty-state">' +
                    '<span class="empty-icon">◇</span>' +
                    '<h3>No results found</h3>' +
                    '<p>Try another search term or category.</p>' +
                "</div>";

            return;
        }

        DOM.searchResultsPageContent.innerHTML =
            '<div class="search-results-page-list">' +
                results
                    .map(buildSearchResultHTML)
                    .join("") +
            "</div>";
    }


    /* =========================================================
       SEARCH INPUT
       ========================================================= */

    function handleSearchInput() {
        if (!DOM.globalSearchInput) {
            return;
        }

        state.search.query =
            DOM.globalSearchInput.value;

        renderSearchResults(
            state.search.query,
            state.search.type
        );
    }


    /* =========================================================
       FEATURED CAROUSEL
       ========================================================= */

    function updateFeaturedCarousel(index) {
        if (!DOM.featuredCards.length) {
            return;
        }

        const total =
            DOM.featuredCards.length;

        let nextIndex =
            Number(index);

        if (!Number.isFinite(nextIndex)) {
            nextIndex = 0;
        }

        nextIndex =
            ((nextIndex % total) + total) % total;

        state.featuredIndex =
            nextIndex;

        DOM.featuredCards.forEach(function (card, cardIndex) {
            const active =
                cardIndex === nextIndex;

            card.classList.toggle(
                "is-active",
                active
            );

            card.setAttribute(
                "aria-hidden",
                active ? "false" : "true"
            );

            card.setAttribute(
                "tabindex",
                active ? "0" : "-1"
            );
        });

        if (DOM.featuredCarousel) {
            DOM.featuredCarousel.setAttribute(
                "data-active-index",
                String(nextIndex)
            );
        }
    }

    function nextFeatured() {
        updateFeaturedCarousel(
            state.featuredIndex + 1
        );
    }

    function previousFeatured() {
        updateFeaturedCarousel(
            state.featuredIndex - 1
        );
    }


    /* =========================================================
       MODAL HELPERS
       ========================================================= */

    function isModalOpen(element) {
        if (!element) {
            return false;
        }

        return (
            !element.classList.contains("hidden") &&
            element.classList.contains("is-open")
        );
    }

    function openModal(element) {
        if (!element) {
            return;
        }

        closeMobileNavigation();
        closeAccountPanel();

        element.classList.remove("hidden");
        element.classList.add("is-open");
        element.setAttribute(
            "aria-hidden",
            "false"
        );

        if (!state.modalStack.includes(element)) {
            state.modalStack.push(element);
        }

        document.body.classList.add("modal-open");

        dispatchAppEvent(
            "modalopen",
            {
                id: element.id || null
            }
        );
    }

    function closeModal(element) {
        if (!element) {
            return;
        }

        element.classList.remove("is-open");
        element.setAttribute(
            "aria-hidden",
            "true"
        );

        if (!element.classList.contains("global-modal")) {
            element.classList.add("hidden");
        }

        state.modalStack =
            state.modalStack.filter(
                function (modal) {
                    return modal !== element;
                }
            );

        if (!state.modalStack.length) {
            document.body.classList.remove(
                "modal-open"
            );
        }

        dispatchAppEvent(
            "modalclose",
            {
                id: element.id || null
            }
        );
    }

    function closeTopModal() {
        const last =
            state.modalStack[
                state.modalStack.length - 1
            ];

        if (last) {
            closeModal(last);
            return true;
        }

        return false;
    }

    function closeAllModals() {
        const modals =
            Array.from(
                document.querySelectorAll(
                    ".modal-overlay.is-open"
                )
            );

        modals.forEach(function (modal) {
            closeModal(modal);
        });

        state.modalStack = [];

        document.body.classList.remove(
            "modal-open"
        );
    }


    /* =========================================================
       SPECIFIC MODALS
       ========================================================= */

    function openEquipmentSelector(slot) {
        const features = getFeaturesAPI();

        if (
            features &&
            typeof features.openEquipmentSelector === "function"
        ) {
            features.openEquipmentSelector(slot);
            return;
        }

        if (DOM.equipmentSelectorModal) {
            DOM.equipmentSelectorModal.dataset.slot =
                String(slot || "");

            openModal(
                DOM.equipmentSelectorModal
            );
        }
    }

    function closeEquipmentSelector() {
        closeModal(
            DOM.equipmentSelectorModal
        );
    }

    function openQuestionModal() {
        const account = getAccountAPI();

        if (
            account &&
            typeof account.openQuestionModal === "function"
        ) {
            account.openQuestionModal();
            return;
        }

        if (DOM.questionModal) {
            openModal(DOM.questionModal);
        }
    }

    function closeQuestionModal() {
        closeModal(DOM.questionModal);
    }

    function openReportModal() {
        const account = getAccountAPI();

        if (
            account &&
            typeof account.openReportModal === "function"
        ) {
            account.openReportModal();
            return;
        }

        if (DOM.reportModal) {
            openModal(DOM.reportModal);
        }
    }

    function closeReportModal() {
        closeModal(DOM.reportModal);
    }

    function openShareModal(url) {
        if (!DOM.shareModal) {
            return;
        }

        if (DOM.shareUrl) {
            DOM.shareUrl.value =
                url ||
                window.location.href;
        }

        openModal(DOM.shareModal);
    }

    function closeShareModal() {
        closeModal(DOM.shareModal);
    }


    /* =========================================================
       COPY TO CLIPBOARD
       ========================================================= */

    async function copyText(text) {
        const value =
            String(text ?? "");

        if (!value) {
            return false;
        }

        try {
            if (
                navigator.clipboard &&
                typeof navigator.clipboard.writeText === "function"
            ) {
                await navigator.clipboard.writeText(
                    value
                );

                return true;
            }
        } catch (error) {
            console.warn(
                "[HoKStation] Clipboard API failed:",
                error
            );
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

            textarea.style.opacity =
                "0";

            document.body.appendChild(
                textarea
            );

            textarea.select();

            const copied =
                document.execCommand("copy");

            textarea.remove();

            return copied;
        } catch (error) {
            console.error(
                "[HoKStation] Clipboard fallback failed:",
                error
            );

            return false;
        }
    }

    APP.copyText = copyText;


    /* =========================================================
       NATIVE SHARE
       ========================================================= */

    async function nativeShare(data) {
        const shareData =
            data || {
                title: "HoKStation.gg",
                text: "Check this out on HoKStation.gg",
                url: window.location.href
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
                shareData.url ||
                window.location.href
            );

        if (copied) {
            toast(
                "Share link copied to clipboard.",
                "success"
            );

            return true;
        }

        toast(
            "Sharing is not available on this device.",
            "warning"
        );

        return false;
    }

    APP.nativeShare = nativeShare;


    /* =========================================================
       SHARE BUILD EVENT
       ========================================================= */

    function handleShareBuild() {
        const features = getFeaturesAPI();

        if (
            features &&
            typeof features.getCurrentBuildShareURL === "function"
        ) {
            const url =
                safeCall(
                    function () {
                        return features.getCurrentBuildShareURL();
                    },
                    window.location.href
                );

            openShareModal(url);
            return;
        }

        openShareModal(
            window.location.href
        );
    }


    /* =========================================================
       REDUCED MOTION
       ========================================================= */

    function readReducedMotionPreference() {
        const stored =
            safeCall(
                function () {
                    return window.localStorage.getItem(
                        "hokstation_reduced_motion"
                    );
                },
                null
            );

        if (stored === "true") {
            return true;
        }

        if (stored === "false") {
            return false;
        }

        return Boolean(
            window.matchMedia &&
            window.matchMedia(
                "(prefers-reduced-motion: reduce)"
            ).matches
        );
    }

    function setReducedMotion(enabled, persist) {
        state.reducedMotion =
            Boolean(enabled);

        document.documentElement.classList.toggle(
            "reduced-motion",
            state.reducedMotion
        );

        if (
            DOM.reducedMotionSetting &&
            DOM.reducedMotionSetting.checked !==
                state.reducedMotion
        ) {
            DOM.reducedMotionSetting.checked =
                state.reducedMotion;
        }

        if (persist !== false) {
            safeCall(
                function () {
                    window.localStorage.setItem(
                        "hokstation_reduced_motion",
                        state.reducedMotion
                            ? "true"
                            : "false"
                    );
                },
                null
            );
        }

        updateFeaturedCarousel(
            state.featuredIndex
        );

        dispatchAppEvent(
            "motionchange",
            {
                reducedMotion:
                    state.reducedMotion
            }
        );
    }


    /* =========================================================
       LANGUAGE PREFERENCE
       ========================================================= */

    function setLanguage(language, persist) {
        const supported = [
            "en",
            "vi",
            "zh",
            "fr",
            "ms",
            "id",
            "fil",
            "ja",
            "es"
        ];

        const value =
            supported.includes(language)
                ? language
                : "en";

        document.documentElement.lang =
            value;

        if (
            DOM.languageSetting &&
            DOM.languageSetting.value !== value
        ) {
            DOM.languageSetting.value =
                value;
        }

        if (persist !== false) {
            safeCall(
                function () {
                    window.localStorage.setItem(
                        "hokstation_language",
                        value
                    );
                },
                null
            );
        }

        dispatchAppEvent(
            "languagechange",
            {
                language: value
            }
        );
    }

    function loadLanguagePreference() {
        const stored =
            safeCall(
                function () {
                    return window.localStorage.getItem(
                        "hokstation_language"
                    );
                },
                null
            );

        if (stored) {
            setLanguage(
                stored,
                false
            );
            return;
        }

        setLanguage(
            document.documentElement.lang ||
            "en",
            false
        );
    }


    /* =========================================================
       DATA STATUS
       ========================================================= */

    function updateDataStatusUI() {
        const data = getDataAPI();

        if (!data) {
            return;
        }

        let freshness = null;

        if (
            typeof data.getDataFreshness === "function"
        ) {
            freshness =
                safeCall(
                    function () {
                        return data.getDataFreshness();
                    },
                    null
                );
        }

        if (!freshness) {
            return;
        }

        const status =
            freshness.state ||
            freshness.status ||
            "unknown";

        const lastUpdated =
            freshness.lastUpdated ||
            freshness.updatedAt ||
            null;

        const statusLabels = {
            ready: "Live data ready",
            synced: "Data synchronized",
            fresh: "Data current",
            stale: "Data may be outdated",
            loading: "Checking data...",
            "not-configured": "Data source not configured",
            error: "Data connection issue",
            unknown: "Data status unavailable"
        };

        const label =
            statusLabels[status] ||
            String(status);

        if (DOM.dataStatusText) {
            DOM.dataStatusText.textContent =
                label;
        }

        if (DOM.dataLastUpdated) {
            DOM.dataLastUpdated.textContent =
                lastUpdated
                    ? "Last update: " +
                      formatDateTime(lastUpdated)
                    : "Last update: —";
        }

        if (DOM.patchDataStatusText) {
            DOM.patchDataStatusText.textContent =
                label;
        }

        if (DOM.patchDataDate) {
            DOM.patchDataDate.textContent =
                lastUpdated
                    ? formatDateTime(lastUpdated)
                    : "—";
        }

        [
            DOM.dataStatusIndicator,
            DOM.patchDataStatus
        ].forEach(function (element) {
            if (!element) {
                return;
            }

            element.dataset.status =
                status;
        });

        if (DOM.footerStatusText) {
            if (
                status === "error"
            ) {
                DOM.footerStatusText.textContent =
                    "Connection Issue";
            } else if (
                status === "not-configured"
            ) {
                DOM.footerStatusText.textContent =
                    "Station Preview";
            } else {
                DOM.footerStatusText.textContent =
                    "Station Online";
            }
        }

        if (DOM.footerStatusDot) {
            DOM.footerStatusDot.dataset.status =
                status;
        }
    }


    /* =========================================================
       HOME COUNTS
       ========================================================= */

    function updateHomeCounts() {
        const data = getDataAPI();

        if (!data) {
            return;
        }

        const heroCount =
            typeof data.getHeroCount === "function"
                ? safeCall(
                    function () {
                        return data.getHeroCount();
                    },
                    0
                )
                : 0;

        const equipmentCount =
            typeof data.getEquipmentCount === "function"
                ? safeCall(
                    function () {
                        return data.getEquipmentCount();
                    },
                    0
                )
                : 0;

        const buildCount =
            typeof data.getBuildCount === "function"
                ? safeCall(
                    function () {
                        return data.getBuildCount();
                    },
                    0
                )
                : 0;

        if (DOM.homeHeroCount) {
            DOM.homeHeroCount.textContent =
                formatNumber(heroCount);
        }

        if (DOM.homeEquipmentCount) {
            DOM.homeEquipmentCount.textContent =
                formatNumber(equipmentCount);
        }

        if (DOM.homeBuildCount) {
            DOM.homeBuildCount.textContent =
                formatNumber(buildCount);
        }
    }


    /* =========================================================
       APP EVENT SYSTEM
       ========================================================= */

    function dispatchAppEvent(name, detail) {
        try {
            window.dispatchEvent(
                new CustomEvent(
                    "hokstation:" + name,
                    {
                        detail:
                            detail || {}
                    }
                )
            );
        } catch (error) {
            /* Older browser fallback is intentionally ignored. */
        }
    }

    APP.dispatch = dispatchAppEvent;


    /* =========================================================
       KEYBOARD SHORTCUTS
       ========================================================= */

    function handleKeyboard(event) {
        const key =
            String(event.key || "").toLowerCase();

        if (key === "escape") {
            if (state.search.isOpen) {
                closeSearchPanel();
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

            if (closeTopModal()) {
                return;
            }
        }

        const isSearchShortcut =
            (event.ctrlKey || event.metaKey) &&
            key === "k";

        if (isSearchShortcut) {
            event.preventDefault();
            openSearchPanel();
        }

        if (
            key === "/" &&
            !isTypingContext(event.target)
        ) {
            event.preventDefault();
            openSearchPanel();
        }

        if (
            key === "arrowright" &&
            !isTypingContext(event.target) &&
            DOM.featuredCards.length
        ) {
            nextFeatured();
        }

        if (
            key === "arrowleft" &&
            !isTypingContext(event.target) &&
            DOM.featuredCards.length
        ) {
            previousFeatured();
        }
    }

    function isTypingContext(element) {
        if (!element) {
            return false;
        }

        const tag =
            String(
                element.tagName || ""
            ).toLowerCase();

        return (
            tag === "input" ||
            tag === "textarea" ||
            tag === "select" ||
            element.isContentEditable
        );
    }


    /* =========================================================
       FOCUS / ACCESSIBILITY
       ========================================================= */

    function focusFirstModalControl(modal) {
        if (!modal) {
            return;
        }

        const target =
            modal.querySelector(
                "input:not([disabled]), " +
                "textarea:not([disabled]), " +
                "select:not([disabled]), " +
                "button:not([disabled]), " +
                "[tabindex]:not([tabindex='-1'])"
            );

        if (target) {
            window.setTimeout(
                function () {
                    target.focus();
                },
                20
            );
        }
    }


    /* =========================================================
       OUTSIDE CLICK
       ========================================================= */

    function handleDocumentClick(event) {
        if (
            state.accountPanelOpen &&
            DOM.accountPanel &&
            !DOM.accountPanel.contains(event.target) &&
            DOM.accountTrigger &&
            !DOM.accountTrigger.contains(event.target)
        ) {
            closeAccountPanel();
        }

        if (
            state.mobileNavigationOpen &&
            DOM.mobileNavigation &&
            !DOM.mobileNavigation.contains(event.target) &&
            DOM.mobileMenuTrigger &&
            !DOM.mobileMenuTrigger.contains(event.target)
        ) {
            closeMobileNavigation();
        }
    }


    /* =========================================================
       GENERIC DIALOG BACKDROP
       ========================================================= */

    function handleModalBackdropClick(event) {
        const target =
            event.target;

        if (
            target &&
            target.classList &&
            target.classList.contains(
                "modal-overlay"
            )
        ) {
            const account =
                getAccountAPI();

            if (
                account &&
                typeof account.handleModalBackdrop === "function"
            ) {
                const handled =
                    safeCall(
                        function () {
                            return account.handleModalBackdrop(
                                target.id
                            );
                        },
                        false
                    );

                if (handled) {
                    return;
                }
            }

            closeModal(target);
        }
    }


    /* =========================================================
       EQUIPMENT SLOT EVENTS
       ========================================================= */

    function handleSlotAction(event) {
        const button =
            event.target.closest(
                "[data-slot-action]"
            );

        if (!button) {
            return;
        }

        const slot =
            Number(
                button.getAttribute(
                    "data-slot-action"
                )
            );

        if (!Number.isFinite(slot)) {
            return;
        }

        openEquipmentSelector(slot);
    }


    /* =========================================================
       FILTER BUTTON HELPERS
       ========================================================= */

    function setActiveButton(
        buttons,
        attribute,
        value
    ) {
        buttons.forEach(function (button) {
            const active =
                button.getAttribute(attribute) ===
                value;

            button.classList.toggle(
                "is-active",
                active
            );

            button.setAttribute(
                "aria-pressed",
                active ? "true" : "false"
            );
        });
    }


    /* =========================================================
       HERO FILTER BRIDGE
       ========================================================= */

    function handleHeroRoleFilter(event) {
        const button =
            event.currentTarget;

        const role =
            button.getAttribute(
                "data-hero-role"
            );

        setActiveButton(
            DOM.heroRoleButtons,
            "data-hero-role",
            role
        );

        const data =
            getDataAPI();

        if (
            data &&
            typeof data.filterHeroes === "function"
        ) {
            safeCall(
                function () {
                    return data.filterHeroes(role);
                },
                []
            );
        }

        const features =
            getFeaturesAPI();

        if (
            features &&
            typeof features.renderHeroes === "function"
        ) {
            safeCall(
                function () {
                    features.renderHeroes();
                }
            );
        }
    }


    /* =========================================================
       EQUIPMENT FILTER BRIDGE
       ========================================================= */

    function handleEquipmentTypeFilter(event) {
        const button =
            event.currentTarget;

        const type =
            button.getAttribute(
                "data-equipment-type"
            );

        setActiveButton(
            DOM.equipmentTypeButtons,
            "data-equipment-type",
            type
        );

        const data =
            getDataAPI();

        if (
            data &&
            typeof data.filterEquipment === "function"
        ) {
            safeCall(
                function () {
                    return data.filterEquipment(type);
                },
                []
            );
        }

        const features =
            getFeaturesAPI();

        if (
            features &&
            typeof features.renderEquipment === "function"
        ) {
            safeCall(
                function () {
                    features.renderEquipment();
                }
            );
        }
    }


    /* =========================================================
       HERO SORT BRIDGE
       ========================================================= */

    function handleHeroSort() {
        if (!DOM.heroSort) {
            return;
        }

        const value =
            DOM.heroSort.value;

        const data =
            getDataAPI();

        if (
            data &&
            typeof data.sortHeroes === "function"
        ) {
            safeCall(
                function () {
                    return data.sortHeroes(value);
                },
                []
            );
        }

        const features =
            getFeaturesAPI();

        if (
            features &&
            typeof features.renderHeroes === "function"
        ) {
            safeCall(
                function () {
                    features.renderHeroes();
                }
            );
        }
    }


    /* =========================================================
       HISTORY TAB BRIDGE
       ========================================================= */

    function handleHistoryTab(event) {
        const button =
            event.currentTarget;

        const tab =
            button.getAttribute(
                "data-history-tab"
            );

        setActiveButton(
            DOM.historyTabButtons,
            "data-history-tab",
            tab
        );

        const features =
            getFeaturesAPI();

        if (
            features &&
            typeof features.renderHistory === "function"
        ) {
            safeCall(
                function () {
                    features.renderHistory(tab);
                }
            );
        }
    }


    /* =========================================================
       FAVORITE TAB BRIDGE
       ========================================================= */

    function handleFavoriteTab(event) {
        const button =
            event.currentTarget;

        const tab =
            button.getAttribute(
                "data-favorite-tab"
            );

        setActiveButton(
            DOM.favoriteTabButtons,
            "data-favorite-tab",
            tab
        );

        const features =
            getFeaturesAPI();

        if (
            features &&
            typeof features.renderFavorites === "function"
        ) {
            safeCall(
                function () {
                    features.renderFavorites(tab);
                }
            );
        }
    }


    /* =========================================================
       COMMUNITY FILTER BRIDGE
       ========================================================= */

    function handleCommunityFilter(event) {
        const button =
            event.currentTarget;

        const filter =
            button.getAttribute(
                "data-community-filter"
            );

        setActiveButton(
            DOM.communityFilterButtons,
            "data-community-filter",
            filter
        );

        const features =
            getFeaturesAPI();

        if (
            features &&
            typeof features.renderCommunity === "function"
        ) {
            safeCall(
                function () {
                    features.renderCommunity(filter);
                }
            );
        }
    }


    /* =========================================================
       ADMIN PANEL BRIDGE
       ========================================================= */

    function handleAdminPanel(event) {
        const button =
            event.currentTarget;

        const panel =
            button.getAttribute(
                "data-admin-panel"
            );

        const account =
            getAccountAPI();

        if (
            account &&
            typeof account.openAdminPanel === "function"
        ) {
            account.openAdminPanel(panel);
            return;
        }

        const features =
            getFeaturesAPI();

        if (
            features &&
            typeof features.renderAdminPanel === "function"
        ) {
            features.renderAdminPanel(
                panel
            );
            return;
        }

        toast(
            "Admin tools are not available yet.",
            "warning"
        );
    }


    /* =========================================================
       AUTH TAB BRIDGE
       ========================================================= */

    function handleAuthTab(event) {
        const button =
            event.currentTarget;

        const tab =
            button.getAttribute(
                "data-auth-tab"
            );

        DOM.authTabs.forEach(function (item) {
            const active =
                item.getAttribute(
                    "data-auth-tab"
                ) === tab;

            item.classList.toggle(
                "is-active",
                active
            );
        });

        DOM.authForms.forEach(function (form) {
            const active =
                form.getAttribute(
                    "data-auth-form"
                ) === tab;

            form.classList.toggle(
                "hidden",
                !active
            );
        });
    }


    /* =========================================================
       AUTH MODAL
       ========================================================= */

    function openAuthModal(tab) {
        if (!DOM.authModal) {
            return;
        }

        const selectedTab =
            tab || "login";

        const matchingTab =
            DOM.authTabs.find(
                function (button) {
                    return (
                        button.getAttribute(
                            "data-auth-tab"
                        ) === selectedTab
                    );
                }
            );

        if (matchingTab) {
            matchingTab.click();
        }

        openModal(
            DOM.authModal
        );

        focusFirstModalControl(
            DOM.authModal
        );
    }

    function closeAuthModal() {
        closeModal(
            DOM.authModal
        );
    }


    /* =========================================================
       ACCOUNT ROUTE BRIDGE
       ========================================================= */

    function handleAccountRoute(event) {
        const route =
            event.currentTarget.getAttribute(
                "data-account-route"
            );

        if (!route) {
            return;
        }

        closeAccountPanel();

        if (route === "profile") {
            window.location.hash =
                "profile";
            return;
        }

        if (route === "saved-builds") {
            window.location.hash =
                "saved-builds";
            return;
        }

        if (route === "favorites") {
            window.location.hash =
                "favorites";
            return;
        }

        if (route === "activity") {
            window.location.hash =
                "activity";
            return;
        }

        navigate(route);
    }


    /* =========================================================
       BUILD ACTION BRIDGES
       ========================================================= */

    function handleCreateBuild() {
        window.location.hash =
            "build-lab";
    }

    function handleClearBuild() {
        const features =
            getFeaturesAPI();

        if (
            features &&
            typeof features.clearBuild === "function"
        ) {
            features.clearBuild();
            return;
        }

        toast(
            "Build tools are still loading.",
            "warning"
        );
    }

    function handleSaveBuild() {
        const account =
            getAccountAPI();

        if (
            account &&
            typeof account.saveCurrentBuild === "function"
        ) {
            account.saveCurrentBuild();
            return;
        }

        const features =
            getFeaturesAPI();

        if (
            features &&
            typeof features.saveCurrentBuild === "function"
        ) {
            features.saveCurrentBuild();
            return;
        }

        toast(
            "Build saving is not available yet.",
            "warning"
        );
    }


    /* =========================================================
       REPORT BRIDGE
       ========================================================= */

    function handleReportRequest() {
        openReportModal();
    }


    /* =========================================================
       DATA INITIALIZATION
       ========================================================= */

    async function initializeData() {
        const data =
            getDataAPI();

        if (!data) {
            setLoaderProgress(
                45,
                "Preparing station..."
            );

            return;
        }

        setLoaderProgress(
            35,
            "Preparing station data..."
        );

        if (
            typeof data.init === "function"
        ) {
            try {
                await data.init();
            } catch (error) {
                console.error(
                    "[HoKStation] Data initialization failed:",
                    error
                );

                showGlobalError(
                    "The station data layer could not initialize. Some live features may be unavailable."
                );
            }
        }

        setLoaderProgress(
            65,
            "Checking station data..."
        );

        if (
            typeof data.loadAll === "function"
        ) {
            try {
                await data.loadAll({
                    background: true
                });
            } catch (error) {
                console.warn(
                    "[HoKStation] Data loading warning:",
                    error
                );

                /*
                 * Do not crash the entire application.
                 * data.js owns its own status state.
                 */
            }
        }

        updateHomeCounts();
        updateDataStatusUI();

        setLoaderProgress(
            80,
            "Preparing interface..."
        );
    }


    /* =========================================================
       FEATURE INITIALIZATION
       ========================================================= */

    function initializeFeatures() {
        const features =
            getFeaturesAPI();

        if (!features) {
            return;
        }

        if (
            typeof features.init === "function"
        ) {
            safeCall(
                function () {
                    return features.init();
                }
            );
        }

        updateHomeCounts();
        updateDataStatusUI();
    }


    /* =========================================================
       ACCOUNT INITIALIZATION
       ========================================================= */

    async function initializeAccount() {
        const account =
            getAccountAPI();

        if (!account) {
            return;
        }

        setLoaderProgress(
            88,
            "Preparing account..."
        );

        if (
            typeof account.init === "function"
        ) {
            try {
                await account.init();
            } catch (error) {
                console.warn(
                    "[HoKStation] Account initialization warning:",
                    error
                );
            }
        }
    }


    /* =========================================================
       EVENT LISTENERS
       ========================================================= */

    function bindEvents() {

        /* -----------------------------------------------------
           Routing
           ----------------------------------------------------- */

        window.addEventListener(
            "hashchange",
            handleHashChange
        );

        DOM.routeLinks.forEach(function (link) {
            link.addEventListener(
                "click",
                handleRouteLinkClick
            );
        });


        /* -----------------------------------------------------
           Mobile navigation
           ----------------------------------------------------- */

        if (DOM.mobileMenuTrigger) {
            DOM.mobileMenuTrigger.addEventListener(
                "click",
                toggleMobileNavigation
            );
        }

        if (DOM.mobileMenuClose) {
            DOM.mobileMenuClose.addEventListener(
                "click",
                closeMobileNavigation
            );
        }

        if (DOM.mobileAccountTrigger) {
            DOM.mobileAccountTrigger.addEventListener(
                "click",
                function () {
                    closeMobileNavigation();
                    openAccountPanel();
                }
            );
        }


        /* -----------------------------------------------------
           Account panel
           ----------------------------------------------------- */

        if (DOM.accountTrigger) {
            DOM.accountTrigger.addEventListener(
                "click",
                toggleAccountPanel
            );
        }

        if (DOM.accountClose) {
            DOM.accountClose.addEventListener(
                "click",
                closeAccountPanel
            );
        }

        document
            .querySelectorAll("[data-account-route]")
            .forEach(function (button) {
                button.addEventListener(
                    "click",
                    handleAccountRoute
                );
            });


        /* -----------------------------------------------------
           Search
           ----------------------------------------------------- */

        if (DOM.searchTrigger) {
            DOM.searchTrigger.addEventListener(
                "click",
                toggleSearchPanel
            );
        }

        if (DOM.searchClose) {
            DOM.searchClose.addEventListener(
                "click",
                closeSearchPanel
            );
        }

        if (DOM.homeSearchButton) {
            DOM.homeSearchButton.addEventListener(
                "click",
                function () {
                    openSearchPanel();
                }
            );
        }

        if (DOM.heroesSearchButton) {
            DOM.heroesSearchButton.addEventListener(
                "click",
                function () {
                    openSearchPanel();
                    setSearchType("heroes");
                }
            );
        }

        if (DOM.globalSearchInput) {
            DOM.globalSearchInput.addEventListener(
                "input",
                handleSearchInput
            );

            DOM.globalSearchInput.addEventListener(
                "keydown",
                function (event) {
                    if (
                        event.key === "Enter" &&
                        state.search.query.trim()
                    ) {
                        event.preventDefault();

                        window.location.hash =
                            "search-results?q=" +
                            encodeURIComponent(
                                state.search.query.trim()
                            ) +
                            "&type=" +
                            encodeURIComponent(
                                state.search.type
                            );

                        closeSearchPanel();
                    }
                }
            );
        }

        DOM.searchTypeButtons.forEach(function (button) {
            button.addEventListener(
                "click",
                function () {
                    setSearchType(
                        button.getAttribute(
                            "data-search-type"
                        )
                    );
                }
            );
        });

        if (DOM.globalSearchResults) {
            DOM.globalSearchResults.addEventListener(
                "click",
                handleSearchResultClick
            );
        }

        if (DOM.searchResultsPageContent) {
            DOM.searchResultsPageContent.addEventListener(
                "click",
                handleSearchResultClick
            );
        }


        /* -----------------------------------------------------
           Featured carousel
           ----------------------------------------------------- */

        if (DOM.featuredPrev) {
            DOM.featuredPrev.addEventListener(
                "click",
                previousFeatured
            );
        }

        if (DOM.featuredNext) {
            DOM.featuredNext.addEventListener(
                "click",
                nextFeatured
            );
        }


        /* -----------------------------------------------------
           Hero controls
           ----------------------------------------------------- */

        DOM.heroRoleButtons.forEach(function (button) {
            button.addEventListener(
                "click",
                handleHeroRoleFilter
            );
        });

        if (DOM.heroSort) {
            DOM.heroSort.addEventListener(
                "change",
                handleHeroSort
            );
        }


        /* -----------------------------------------------------
           Equipment controls
           ----------------------------------------------------- */

        DOM.equipmentTypeButtons.forEach(function (button) {
            button.addEventListener(
                "click",
                handleEquipmentTypeFilter
            );
        });


        /* -----------------------------------------------------
           History / favorites / community
           ----------------------------------------------------- */

        DOM.historyTabButtons.forEach(function (button) {
            button.addEventListener(
                "click",
                handleHistoryTab
            );
        });

        DOM.favoriteTabButtons.forEach(function (button) {
            button.addEventListener(
                "click",
                handleFavoriteTab
            );
        });

        DOM.communityFilterButtons.forEach(function (button) {
            button.addEventListener(
                "click",
                handleCommunityFilter
            );
        });


        /* -----------------------------------------------------
           Build controls
           ----------------------------------------------------- */

        if (DOM.createBuildButton) {
            DOM.createBuildButton.addEventListener(
                "click",
                handleCreateBuild
            );
        }

        if (DOM.openBuildLab) {
            DOM.openBuildLab.addEventListener(
                "click",
                handleCreateBuild
            );
        }

        if (DOM.clearBuildButton) {
            DOM.clearBuildButton.addEventListener(
                "click",
                handleClearBuild
            );
        }

        if (DOM.saveBuildButton) {
            DOM.saveBuildButton.addEventListener(
                "click",
                handleSaveBuild
            );
        }

        if (DOM.shareBuildButton) {
            DOM.shareBuildButton.addEventListener(
                "click",
                handleShareBuild
            );
        }

        if (DOM.buildSlots) {
            DOM.buildSlots.addEventListener(
                "click",
                handleSlotAction
            );
        }


        /* -----------------------------------------------------
           Equipment selector
           ----------------------------------------------------- */

        if (DOM.equipmentSelectorClose) {
            DOM.equipmentSelectorClose.addEventListener(
                "click",
                closeEquipmentSelector
            );
        }

        if (DOM.equipmentSelectorSearch) {
            DOM.equipmentSelectorSearch.addEventListener(
                "input",
                function () {
                    const features =
                        getFeaturesAPI();

                    if (
                        features &&
                        typeof features.filterEquipmentSelector === "function"
                    ) {
                        features.filterEquipmentSelector(
                            DOM.equipmentSelectorSearch.value
                        );
                    }
                }
            );
        }


        /* -----------------------------------------------------
           Community modals
           ----------------------------------------------------- */

        if (DOM.askQuestionButton) {
            DOM.askQuestionButton.addEventListener(
                "click",
                openQuestionModal
            );
        }

        if (DOM.reportButton) {
            DOM.reportButton.addEventListener(
                "click",
                handleReportRequest
            );
        }

        if (DOM.footerReportButton) {
            DOM.footerReportButton.addEventListener(
                "click",
                handleReportRequest
            );
        }

        if (DOM.questionModalClose) {
            DOM.questionModalClose.addEventListener(
                "click",
                closeQuestionModal
            );
        }

        if (DOM.reportModalClose) {
            DOM.reportModalClose.addEventListener(
                "click",
                closeReportModal
            );


        /* -----------------------------------------------------
           Share modal
           ----------------------------------------------------- */

        if (DOM.shareModalClose) {
            DOM.shareModalClose.addEventListener(
                "click",
                closeShareModal
            );
        }

        if (DOM.copyShareUrl) {
            DOM.copyShareUrl.addEventListener(
                "click",
                async function () {
                    const url =
                        DOM.shareUrl
                            ? DOM.shareUrl.value
                            : window.location.href;

                    const copied =
                        await copyText(url);

                    if (copied) {
                        toast(
                            "Share link copied.",
                            "success"
                        );
                    } else {
                        toast(
                            "Could not copy the share link.",
                            "error"
                        );
                    }
                }
            );
        }

        if (DOM.nativeShareButton) {
            DOM.nativeShareButton.addEventListener(
                "click",
                function () {
                    nativeShare({
                        title:
                            DOM.shareModalTitle
                                ? DOM.shareModalTitle.textContent.trim()
                                : "HoKStation.gg",
                        text:
                            "Check this build on HoKStation.gg",
                        url:
                            DOM.shareUrl
                                ? DOM.shareUrl.value
                                : window.location.href
                    });
                }
            );
        }


        /* -----------------------------------------------------
           Confirm modal
           ----------------------------------------------------- */

        if (DOM.confirmCancel) {
            DOM.confirmCancel.addEventListener(
                "click",
                function () {
                    closeModal(
                        DOM.confirmModal
                    );
                }
            );
        }


        /* -----------------------------------------------------
           Auth
           ----------------------------------------------------- */

        if (DOM.loginOpen) {
            DOM.loginOpen.addEventListener(
                "click",
                function () {
                    openAuthModal("login");
                }
            );
        }

        if (DOM.registerOpen) {
            DOM.registerOpen.addEventListener(
                "click",
                function () {
                    openAuthModal("register");
                }
            );
        }

        if (DOM.authModalClose) {
            DOM.authModalClose.addEventListener(
                "click",
                closeAuthModal
            );
        }

        if (DOM.forgotPasswordOpen) {
            DOM.forgotPasswordOpen.addEventListener(
                "click",
                function () {
                    handleAuthTab({
                        currentTarget: {
                            getAttribute: function (name) {
                                return name === "data-auth-tab"
                                    ? "recovery"
                                    : null;
                            }
                        }
                    });
                }
            );
        }

        if (DOM.recoveryBack) {
            DOM.recoveryBack.addEventListener(
                "click",
                function () {
                    const loginTab =
                        DOM.authTabs.find(
                            function (button) {
                                return (
                                    button.getAttribute(
                                        "data-auth-tab"
                                    ) === "login"
                                );
                            }
                        );

                    if (loginTab) {
                        loginTab.click();
                    }
                }
            );
        }

        DOM.authTabs.forEach(function (button) {
            button.addEventListener(
                "click",
                handleAuthTab
            );
        });


        /* -----------------------------------------------------
           Settings
           ----------------------------------------------------- */

        if (DOM.reducedMotionSetting) {
            DOM.reducedMotionSetting.addEventListener(
                "change",
                function () {
                    setReducedMotion(
                        DOM.reducedMotionSetting.checked
                    );
                }
            );
        }

        if (DOM.languageSetting) {
            DOM.languageSetting.addEventListener(
                "change",
                function () {
                    setLanguage(
                        DOM.languageSetting.value
                    );

                    toast(
                        "Language preference saved.",
                        "success"
                    );
                }
            );
        }


        /* -----------------------------------------------------
           Admin
           ----------------------------------------------------- */

        DOM.adminPanelButtons.forEach(function (button) {
            button.addEventListener(
                "click",
                handleAdminPanel
            );
        });


        /* -----------------------------------------------------
           Global
           ----------------------------------------------------- */

        document.addEventListener(
            "keydown",
            handleKeyboard
        );

        document.addEventListener(
            "click",
            handleDocumentClick
        );

        document.addEventListener(
            "click",
            handleModalBackdropClick
        );

        if (DOM.globalErrorClose) {
            DOM.globalErrorClose.addEventListener(
                "click",
                hideGlobalError
            );
        }


        /* -----------------------------------------------------
           Data / feature event listeners
           ----------------------------------------------------- */

        window.addEventListener(
            "hokstation:datachange",
            function () {
                updateHomeCounts();
                updateDataStatusUI();
            }
        );

        window.addEventListener(
            "hokstation:datastatus",
            function () {
                updateDataStatusUI();
            }
        );

        window.addEventListener(
            "hokstation:accountchange",
            function () {
                updateDataStatusUI();
            }
        );
    }


    /* =========================================================
       FIX: DYNAMIC MODAL TITLE ACCESS
       ========================================================= */

    Object.defineProperty(
        DOM,
        "shareModalTitle",
        {
            configurable: true,
            get: function () {
                return document.getElementById(
                    "share-modal-title"
                );
            }
        }
    );


    /* =========================================================
       APP BOOT
       ========================================================= */

    async function boot() {
        if (state.booted) {
            return;
        }

        state.booted = true;

        cacheDOM();

        state.reducedMotion =
            readReducedMotionPreference();

        setReducedMotion(
            state.reducedMotion,
            false
        );

        loadLanguagePreference();

        showLoader(
            "Loading station..."
        );

        setLoaderProgress(
            10,
            "Starting HoKStation..."
        );

        bindEvents();

        setLoaderProgress(
            20,
            "Connecting station modules..."
        );

        try {
            await initializeData();
        } catch (error) {
            console.error(
                "[HoKStation] Data boot error:",
                error
            );
        }

        try {
            initializeFeatures();
        } catch (error) {
            console.error(
                "[HoKStation] Feature boot error:",
                error
            );
        }

        try {
            await initializeAccount();
        } catch (error) {
            console.error(
                "[HoKStation] Account boot error:",
                error
            );
        }

        setLoaderProgress(
            94,
            "Finalizing station..."
        );

        updateHomeCounts();
        updateDataStatusUI();

        updateFeaturedCarousel(0);

        const initialRoute =
            getRouteFromHash();

        navigate(
            initialRoute,
            {
                silent: true,
                skipScroll: true
            }
        );

        state.ready = true;

        dispatchAppEvent(
            "ready",
            {
                version: APP.version
            }
        );

        setLoaderProgress(
            100,
            "Station ready."
        );

        hideLoader();
    }


    /* =========================================================
       PUBLIC API
       ========================================================= */

    APP.state = state;
    APP.routes = Array.from(ROUTES);

    APP.dom = DOM;

    APP.openSearch = openSearchPanel;
    APP.closeSearch = closeSearchPanel;

    APP.openAccount = openAccountPanel;
    APP.closeAccount = closeAccountPanel;

    APP.openModal = openModal;
    APP.closeModal = closeModal;
    APP.closeAllModals = closeAllModals;

    APP.openAuth = openAuthModal;
    APP.closeAuth = closeAuthModal;

    APP.openQuestionModal =
        openQuestionModal;

    APP.openReportModal =
        openReportModal;

    APP.openShareModal =
        openShareModal;

    APP.updateDataStatus =
        updateDataStatusUI;

    APP.updateHomeCounts =
        updateHomeCounts;

    APP.updateFeatured =
        updateFeaturedCarousel;

    APP.nextFeatured =
        nextFeatured;

    APP.previousFeatured =
        previousFeatured;

    APP.formatNumber =
        formatNumber;

    APP.formatDate =
        formatDate;

    APP.formatDateTime =
        formatDateTime;

    APP.escapeHTML =
        escapeHTML;

    APP.normalizeText =
        normalizeText;

    APP.slugify =
        slugify;

    APP.truncate =
        truncate;

    APP.getRoute =
        function () {
            return state.currentRoute;
        };

    APP.getSearchState =
        function () {
            return {
                query:
                    state.search.query,
                type:
                    state.search.type,
                isOpen:
                    state.search.isOpen
            };
        };

    APP.getConfig =
        getConfig;

    APP.getConfigValue =
        getConfigValue;

    APP.getData =
        getDataAPI;

    APP.getFeatures =
        getFeaturesAPI;

    APP.getAccount =
        getAccountAPI;


    /* =========================================================
       GLOBAL CONVENIENCE HOOKS
       ========================================================= */

    window.HoKStation = window.HoKStation || {};

    window.HoKStation.app =
        APP;

    window.HoKStation.toast =
        toast;

    window.HoKStation.navigate =
        navigate;

    window.HoKStation.openSearch =
        openSearchPanel;

    window.HoKStation.openAccount =
        openAccountPanel;

    window.HoKStation.openModal =
        openModal;

    window.HoKStation.closeModal =
        closeModal;


    /* =========================================================
       START
       ========================================================= */

    if (
        document.readyState === "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            boot,
            {
                once: true
            }
        );
    } else {
        boot();
    }

})();
