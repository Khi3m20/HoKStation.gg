/* =========================================================
   HOKSTATION.GG
   FILE 8 / 8 — account.js

   PURPOSE
   ---------------------------------------------------------
   Account, authentication, profile, favorites, saved builds,
   activity, community questions/reports and admin dashboard.

   DEPENDENCY ORDER
   ---------------------------------------------------------
   1. config.js
   2. data.js
   3. app.js
   4. features.js
   5. account.js

   HTML SOURCE OF TRUTH
   ---------------------------------------------------------
   This file is crosschecked against index.html.

   IMPORTANT
   ---------------------------------------------------------
   - HoKStation.gg is an independent community/data platform.
   - NOT an official Honor of Kings / Tencent website.
   - Never use a Supabase service-role key in browser code.
   - Client-side admin checks are NOT authorization.
   - Real permissions MUST be enforced by Supabase RLS/server-side.
   - No fake users.
   - No fake community content.
   - No fabricated admin data.
   ========================================================= */

(function () {
    "use strict";

    if (window.HOKSTATION_ACCOUNT) {
        return;
    }

    const CONFIG =
        window.HOKSTATION_CONFIG || {};

    const DATA =
        window.HOKSTATION_DATA || null;

    const APP =
        window.HOKSTATION_APP || {};

    const SUPABASE_LOADER =
        window.HoKStationSupabase || null;


    /* =========================================================
       INTERNAL STATE
       ========================================================= */

    const state = {
        initialized: false,

        client: null,

        session: null,
        user: null,
        profile: null,

        authLoading: false,

        currentFavoriteTab: "heroes",
        currentCommunityFilter: "recent",

        selectedQuestionId: null,

        currentAdminPanel: null,

        unsubscribers: [],

        communityLoaded: false,
        favoritesLoaded: false,
        savedBuildsLoaded: false,
        activityLoaded: false,

        profileLoaded: false
    };


    /* =========================================================
       DOM HELPERS
       ========================================================= */

    function byId(id) {
        return document.getElementById(id);
    }

    function all(selector, root) {
        return Array.from(
            (root || document).querySelectorAll(selector)
        );
    }


    /* =========================================================
       SAFE HELPERS
       ========================================================= */

    function cleanString(value, fallback) {
        if (
            value === null ||
            value === undefined
        ) {
            return fallback || "";
        }

        const result = String(value).trim();

        return result ||
            (fallback || "");
    }


    function safeNumber(value, fallback) {
        const number = Number(value);

        return Number.isFinite(number)
            ? number
            : (fallback || 0);
    }


    function escapeHTML(value) {
        if (
            APP &&
            typeof APP.escapeHTML === "function"
        ) {
            return APP.escapeHTML(value);
        }

        return String(
            value === null ||
            value === undefined
                ? ""
                : value
        )
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    function showToast(
        message,
        type
    ) {
        if (
            APP &&
            typeof APP.toast === "function"
        ) {
            APP.toast(
                message,
                type || "info"
            );
        }
    }


    function navigate(route) {
        if (
            APP &&
            typeof APP.navigate === "function"
        ) {
            APP.navigate(route);
        }
    }


    function openModal(id) {
        if (
            APP &&
            typeof APP.openModal === "function"
        ) {
            return APP.openModal(id);
        }

        const modal = byId(id);

        if (!modal) {
            return false;
        }

        modal.classList.add("is-open");
        modal.setAttribute(
            "aria-hidden",
            "false"
        );

        return true;
    }


    function closeModal(id) {
        if (
            APP &&
            typeof APP.closeModal === "function"
        ) {
            return APP.closeModal(id);
        }

        const modal = byId(id);

        if (!modal) {
            return false;
        }

        modal.classList.remove("is-open");
        modal.setAttribute(
            "aria-hidden",
            "true"
        );

        return true;
    }


    function openAuth(tab) {
        if (
            APP &&
            typeof APP.setAuthTab === "function"
        ) {
            APP.setAuthTab(
                tab || "login"
            );
        }

        if (
            APP &&
            typeof APP.openAuthModal === "function"
        ) {
            APP.openAuthModal(
                tab || "login"
            );

            return;
        }

        openModal("auth-modal");
    }


    function setText(
        id,
        value,
        fallback
    ) {
        const element = byId(id);

        if (!element) {
            return;
        }

        element.textContent =
            cleanString(
                value,
                fallback || ""
            );
    }


    function getConfigTable(name) {
        const database =
            CONFIG.database || {};

        if (
            database[name] &&
            typeof database[name] === "string"
        ) {
            return database[name];
        }

        if (
            DATA &&
            DATA.tables &&
            DATA.tables[name]
        ) {
            return DATA.tables[name];
        }

        return name;
    }


    /* =========================================================
       SUPABASE
       ========================================================= */

    async function getClient() {
        if (state.client) {
            return state.client;
        }

        try {
            if (
                SUPABASE_LOADER &&
                typeof SUPABASE_LOADER.getClient ===
                    "function"
            ) {
                state.client =
                    await SUPABASE_LOADER.getClient();

                return state.client;
            }

            if (
                DATA &&
                typeof DATA.getSupabaseClient ===
                    "function"
            ) {
                state.client =
                    await DATA.getSupabaseClient();

                return state.client;
            }
        } catch (error) {
            console.error(
                "[HoKStation Account] Supabase client error:",
                error
            );
        }

        return null;
    }


    function isConfigured() {
        if (
            SUPABASE_LOADER &&
            typeof SUPABASE_LOADER.isConfigured ===
                "function"
        ) {
            return SUPABASE_LOADER.isConfigured();
        }

        const supabase =
            CONFIG.supabase || {};

        return Boolean(
            cleanString(supabase.url) &&
            cleanString(supabase.anonKey)
        );
    }


    /* =========================================================
       AUTH STATE
       ========================================================= */

    async function refreshAuthState() {
        const client =
            await getClient();

        if (!client || !client.auth) {
            state.session = null;
            state.user = null;
            state.profile = null;

            updateAccountUI();

            return null;
        }

        try {
            const result =
                await client.auth.getSession();

            state.session =
                result &&
                result.data
                    ? result.data.session || null
                    : null;

            state.user =
                state.session
                    ? state.session.user || null
                    : null;

            if (state.user) {
                await loadProfile();
            } else {
                state.profile = null;
            }

            updateAccountUI();

            return state.session;
        } catch (error) {
            console.error(
                "[HoKStation Account] Session error:",
                error
            );

            state.session = null;
            state.user = null;
            state.profile = null;

            updateAccountUI();

            return null;
        }
    }


    async function handleAuthStateChange(
        event,
        session
    ) {
        state.session =
            session || null;

        state.user =
            session &&
            session.user
                ? session.user
                : null;

        state.profile = null;

        if (state.user) {
            await loadProfile();
        }

        updateAccountUI();

        document.dispatchEvent(
            new CustomEvent(
                "hokstation:account-state",
                {
                    detail: {
                        event: event || "",
                        session:
                            state.session,
                        user:
                            state.user,
                        profile:
                            state.profile
                    }
                }
            )
        );

        if (
            event === "SIGNED_IN"
        ) {
            showToast(
                "Welcome to HoKStation.",
                "success"
            );
        }

        if (
            event === "SIGNED_OUT"
        ) {
            clearPrivateUI();

            showToast(
                "You have been signed out.",
                "success"
            );
        }
    }


    /* =========================================================
       PROFILE
       ========================================================= */

    async function loadProfile() {
        if (!state.user) {
            state.profile = null;
            state.profileLoaded = false;

            return null;
        }

        const client =
            await getClient();

        if (!client) {
            state.profile = null;
            state.profileLoaded = false;

            return null;
        }

        const table =
            getConfigTable("profiles");

        try {
            const result =
                await client
                    .from(table)
                    .select("*")
                    .eq(
                        "id",
                        state.user.id
                    )
                    .maybeSingle();

            if (result.error) {
                /*
                 * A missing profile row is not treated
                 * as a fake profile.
                 */
                if (
                    result.error.code ===
                    "PGRST116"
                ) {
                    state.profile = null;
                    state.profileLoaded = true;

                    return null;
                }

                throw result.error;
            }

            state.profile =
                result.data || null;

            state.profileLoaded = true;

            return state.profile;
        } catch (error) {
            console.error(
                "[HoKStation Account] Profile load failed:",
                error
            );

            state.profile = null;
            state.profileLoaded = false;

            return null;
        }
    }


    function getDisplayName() {
        if (state.profile) {
            const profileName =
                cleanString(
                    state.profile.display_name ||
                    state.profile.displayName ||
                    state.profile.username
                );

            if (profileName) {
                return profileName;
            }
        }

        if (state.user) {
            const metadata =
                state.user.user_metadata || {};

            const metadataName =
                cleanString(
                    metadata.display_name ||
                    metadata.displayName ||
                    metadata.username ||
                    metadata.name
                );

            if (metadataName) {
                return metadataName;
            }

            if (state.user.email) {
                return state.user.email
                    .split("@")[0]
                    .slice(0, 40);
            }
        }

        return "User";
    }


    function getRole() {
        if (!state.profile) {
            return "user";
        }

        const role =
            cleanString(
                state.profile.role ||
                state.profile.user_role ||
                state.profile.account_role,
                "user"
            ).toLowerCase();

        return role || "user";
    }


    function isAuthenticated() {
        return Boolean(
            state.user &&
            state.session
        );
    }


    function isAdmin() {
        return (
            isAuthenticated() &&
            getRole() === "admin"
        );
    }


    function isModeratorOrAdmin() {
        const role =
            getRole();

        return (
            isAuthenticated() &&
            (
                role === "moderator" ||
                role === "admin"
            )
        );
    }


    /* =========================================================
       ACCOUNT UI
       ========================================================= */

    function updateAccountUI() {
        const guest =
            byId("account-guest-view");

        const userView =
            byId("account-user-view");

        const avatar =
            byId("account-avatar");

        const headerAvatar =
            byId("header-account-avatar");

        const displayName =
            getDisplayName();

        const email =
            state.user &&
            state.user.email
                ? state.user.email
                : "Not signed in";

        const avatarText =
            displayName
                .charAt(0)
                .toUpperCase() || "?";

        if (guest) {
            guest.classList.toggle(
                "hidden",
                isAuthenticated()
            );
        }

        if (userView) {
            userView.classList.toggle(
                "hidden",
                !isAuthenticated()
            );
        }

        if (avatar) {
            avatar.textContent =
                isAuthenticated()
                    ? avatarText
                    : "?";
        }

        if (headerAvatar) {
            headerAvatar.textContent =
                isAuthenticated()
                    ? avatarText
                    : "?";
        }

        setText(
            "account-display-name",
            displayName,
            "User"
        );

        setText(
            "account-email",
            email,
            "Not signed in"
        );

        updateProfilePage();

        updateAdminAccessUI();
    }


    function updateProfilePage() {
        if (!isAuthenticated()) {
            setText(
                "profile-name",
                "Sign in required",
                "Sign in required"
            );

            setText(
                "profile-email",
                "—",
                "—"
            );

            setText(
                "profile-role",
                "Guest",
                "Guest"
            );

            const nameInput =
                byId(
                    "profile-display-name"
                );

            const bioInput =
                byId(
                    "profile-bio"
                );

            if (nameInput) {
                nameInput.value = "";
            }

            if (bioInput) {
                bioInput.value = "";
            }

            return;
        }

        setText(
            "profile-name",
            getDisplayName(),
            "User"
        );

        setText(
            "profile-email",
            state.user.email,
            "—"
        );

        setText(
            "profile-role",
            getRole(),
            "user"
        );

        const nameInput =
            byId(
                "profile-display-name"
            );

        const bioInput =
            byId(
                "profile-bio"
            );

        if (nameInput) {
            nameInput.value =
                cleanString(
                    state.profile &&
                    (
                        state.profile.display_name ||
                        state.profile.displayName
                    ),
                    getDisplayName()
                );
        }

        if (bioInput) {
            bioInput.value =
                cleanString(
                    state.profile &&
                    state.profile.bio
                );
        }
    }


    function updateAdminAccessUI() {
        const status =
            byId(
                "admin-access-status"
            );

        if (!status) {
            return;
        }

        if (!isAuthenticated()) {
            status.textContent =
                "Sign In Required";

            status.classList.remove(
                "is-admin"
            );

            return;
        }

        if (isAdmin()) {
            status.textContent =
                "Administrator";

            status.classList.add(
                "is-admin"
            );

            return;
        }

        status.textContent =
            "Restricted";

        status.classList.remove(
            "is-admin"
        );
    }


    function clearPrivateUI() {
        const saved =
            byId("saved-builds-grid");

        const activity =
            byId("activity-list");

        const favorites =
            byId("favorites-content");

        if (saved) {
            renderEmpty(
                saved,
                "Sign in to view saved builds."
            );
        }

        if (activity) {
            renderEmpty(
                activity,
                "Sign in to view your activity."
            );
        }

        if (favorites) {
            renderEmpty(
                favorites,
                "Sign in to view your favorites."
            );
        }

        updateProfilePage();
        updateAdminAccessUI();
    }


    /* =========================================================
       AUTH FORMS
       ========================================================= */

    async function login(
        email,
        password
    ) {
        if (state.authLoading) {
            return false;
        }

        const client =
            await getClient();

        if (!client || !client.auth) {
            showToast(
                "Account services are not configured yet.",
                "error"
            );

            return false;
        }

        state.authLoading = true;

        try {
            const result =
                await client.auth.signInWithPassword({
                    email:
                        cleanString(email),
                    password:
                        String(password || "")
                });

            if (result.error) {
                throw result.error;
            }

            if (APP.closeAuthModal) {
                APP.closeAuthModal();
            } else {
                closeModal("auth-modal");
            }

            await refreshAuthState();

            return true;
        } catch (error) {
            console.error(
                "[HoKStation Account] Login failed:",
                error
            );

            showToast(
                cleanString(
                    error &&
                    error.message,
                    "Unable to log in."
                ),
                "error"
            );

            return false;
        } finally {
            state.authLoading = false;
        }
    }


    async function register(
        displayName,
        email,
        password
    ) {
        if (state.authLoading) {
            return false;
        }

        const name =
            cleanString(displayName);

        const address =
            cleanString(email);

        const pass =
            String(password || "");

        const minimumPassword =
            CONFIG.security &&
            Number(
                CONFIG.security.minimumPasswordLength
            ) || 8;

        if (
            name.length < 2 ||
            name.length > 40
        ) {
            showToast(
                "Display name must be 2–40 characters.",
                "error"
            );

            return false;
        }

        if (
            pass.length < minimumPassword
        ) {
            showToast(
                "Password does not meet the minimum length.",
                "error"
            );

            return false;
        }

        const client =
            await getClient();

        if (!client || !client.auth) {
            showToast(
                "Account services are not configured yet.",
                "error"
            );

            return false;
        }

        state.authLoading = true;

        try {
            const result =
                await client.auth.signUp({
                    email: address,
                    password: pass,
                    options: {
                        data: {
                            display_name: name
                        }
                    }
                });

            if (result.error) {
                throw result.error;
            }

            /*
             * Profile creation is intentionally attempted only
             * when a session exists. If email verification is
             * enabled, the session may be absent. A database
             * trigger can create the profile instead.
             */
            if (
                result.data &&
                result.data.session &&
                result.data.user
            ) {
                state.session =
                    result.data.session;

                state.user =
                    result.data.user;

                await ensureProfile(
                    name
                );

                updateAccountUI();
            }

            if (
                result.data &&
                result.data.session
            ) {
                if (APP.closeAuthModal) {
                    APP.closeAuthModal();
                } else {
                    closeModal("auth-modal");
                }

                showToast(
                    "Account created successfully.",
                    "success"
                );
            } else {
                showToast(
                    "Account created. Check your email if verification is required.",
                    "success"
                );

                openAuth("login");
            }

            return true;
        } catch (error) {
            console.error(
                "[HoKStation Account] Registration failed:",
                error
            );

            showToast(
                cleanString(
                    error &&
                    error.message,
                    "Unable to create the account."
                ),
                "error"
            );

            return false;
        } finally {
            state.authLoading = false;
        }
    }


    async function recoverPassword(
        email
    ) {
        const client =
            await getClient();

        if (!client || !client.auth) {
            showToast(
                "Account services are not configured yet.",
                "error"
            );

            return false;
        }

        const address =
            cleanString(email);

        if (!address) {
            showToast(
                "Enter your email address.",
                "error"
            );

            return false;
        }

        try {
            const redirectUrl =
                window.location.origin +
                window.location.pathname;

            const result =
                await client.auth
                    .resetPasswordForEmail(
                        address,
                        {
                            redirectTo:
                                redirectUrl
                        }
                    );

            if (result.error) {
                throw result.error;
            }

            showToast(
                "Recovery email sent if the account exists.",
                "success"
            );

            return true;
        } catch (error) {
            console.error(
                "[HoKStation Account] Recovery failed:",
                error
            );

            showToast(
                "Unable to send the recovery email.",
                "error"
            );

            return false;
        }
    }


    async function logout() {
        const client =
            await getClient();

        if (!client || !client.auth) {
            return false;
        }

        try {
            const result =
                await client.auth.signOut();

            if (result.error) {
                throw result.error;
            }

            state.session = null;
            state.user = null;
            state.profile = null;

            clearPrivateUI();
            updateAccountUI();

            return true;
        } catch (error) {
            console.error(
                "[HoKStation Account] Logout failed:",
                error
            );

            showToast(
                "Unable to log out.",
                "error"
            );

            return false;
        }
    }


    /* =========================================================
       PROFILE CREATION / UPDATE
       ========================================================= */

    async function ensureProfile(
        displayName
    ) {
        if (!state.user) {
            return null;
        }

        const client =
            await getClient();

        if (!client) {
            return null;
        }

        const table =
            getConfigTable("profiles");

        const payload = {
            id: state.user.id,
            display_name:
                cleanString(
                    displayName,
                    getDisplayName()
                ),
            bio: ""
        };

        try {
            const result =
                await client
                    .from(table)
                    .upsert(
                        payload,
                        {
                            onConflict: "id"
                        }
                    )
                    .select("*")
                    .maybeSingle();

            if (result.error) {
                /*
                 * Do not treat RLS failure as a local
                 * authorization success.
                 */
                console.warn(
                    "[HoKStation Account] Profile creation was not accepted:",
                    result.error
                );

                return null;
            }

            state.profile =
                result.data || null;

            return state.profile;
        } catch (error) {
            console.warn(
                "[HoKStation Account] Profile creation failed:",
                error
            );

            return null;
        }
    }


    async function updateProfile(
        displayName,
        bio
    ) {
        if (!isAuthenticated()) {
            openAuth("login");

            return false;
        }

        const client =
            await getClient();

        if (!client) {
            showToast(
                "Account services are not configured yet.",
                "error"
            );

            return false;
        }

        const name =
            cleanString(displayName);

        const biography =
            cleanString(bio);

        if (
            name.length < 2 ||
            name.length > 40
        ) {
            showToast(
                "Display name must be 2–40 characters.",
                "error"
            );

            return false;
        }

        if (biography.length > 300) {
            showToast(
                "Bio cannot exceed 300 characters.",
                "error"
            );

            return false;
        }

        const table =
            getConfigTable("profiles");

        try {
            const result =
                await client
                    .from(table)
                    .upsert(
                        {
                            id:
                                state.user.id,
                            display_name:
                                name,
                            bio:
                                biography
                        },
                        {
                            onConflict: "id"
                        }
                    )
                    .select("*")
                    .maybeSingle();

            if (result.error) {
                throw result.error;
            }

            state.profile =
                result.data || {
                    id:
                        state.user.id,
                    display_name:
                        name,
                    bio:
                        biography
                };

            updateAccountUI();

            showToast(
                "Profile updated.",
                "success"
            );

            return true;
        } catch (error) {
            console.error(
                "[HoKStation Account] Profile update failed:",
                error
            );

            showToast(
                "Unable to update your profile.",
                "error"
            );

            return false;
        }
    }


    /* =========================================================
       FAVORITES
       ========================================================= */

    async function getFavorites(
        itemType
    ) {
        if (!isAuthenticated()) {
            return [];
        }

        const client =
            await getClient();

        if (!client) {
            return [];
        }

        const table =
            getConfigTable("favorites");

        try {
            let query =
                client
                    .from(table)
                    .select("*")
                    .eq(
                        "user_id",
                        state.user.id
                    );

            if (itemType) {
                query =
                    query.eq(
                        "item_type",
                        itemType
                    );
            }

            const result =
                await query;

            if (result.error) {
                throw result.error;
            }

            return Array.isArray(
                result.data
            )
                ? result.data
                : [];
        } catch (error) {
            console.warn(
                "[HoKStation Account] Favorites load failed:",
                error
            );

            return [];
        }
    }


    async function isFavorite(
        itemType,
        itemId
    ) {
        if (
            !isAuthenticated() ||
            !cleanString(itemId)
        ) {
            return false;
        }

        const client =
            await getClient();

        if (!client) {
            return false;
        }

        const table =
            getConfigTable("favorites");

        try {
            const result =
                await client
                    .from(table)
                    .select("id")
                    .eq(
                        "user_id",
                        state.user.id
                    )
                    .eq(
                        "item_type",
                        itemType
                    )
                    .eq(
                        "item_id",
                        itemId
                    )
                    .maybeSingle();

            if (result.error) {
                return false;
            }

            return Boolean(
                result.data
            );
        } catch (error) {
            return false;
        }
    }


    async function toggleFavorite(
        itemType,
        itemId
    ) {
        if (!isAuthenticated()) {
            openAuth("login");

            return false;
        }

        const normalizedType =
            cleanString(itemType)
                .toLowerCase();

        const normalizedId =
            cleanString(itemId);

        if (
            !normalizedType ||
            !normalizedId
        ) {
            return false;
        }

        const client =
            await getClient();

        if (!client) {
            return false;
        }

        const table =
            getConfigTable("favorites");

        try {
            const existing =
                await client
                    .from(table)
                    .select("id")
                    .eq(
                        "user_id",
                        state.user.id
                    )
                    .eq(
                        "item_type",
                        normalizedType
                    )
                    .eq(
                        "item_id",
                        normalizedId
                    )
                    .maybeSingle();

            if (
                existing.error &&
                existing.error.code !==
                    "PGRST116"
            ) {
                throw existing.error;
            }

            if (existing.data) {
                const deleted =
                    await client
                        .from(table)
                        .delete()
                        .eq(
                            "id",
                            existing.data.id
                        );

                if (deleted.error) {
                    throw deleted.error;
                }

                showToast(
                    "Removed from favorites.",
                    "success"
                );
            } else {
                const inserted =
                    await client
                        .from(table)
                        .insert({
                            user_id:
                                state.user.id,
                            item_type:
                                normalizedType,
                            item_id:
                                normalizedId
                        });

                if (inserted.error) {
                    throw inserted.error;
                }

                showToast(
                    "Added to favorites.",
                    "success"
                );
            }

            await renderFavorites();

            document.dispatchEvent(
                new CustomEvent(
                    "hokstation:favorites-changed"
                )
            );

            return true;
        } catch (error) {
            console.error(
                "[HoKStation Account] Favorite update failed:",
                error
            );

            showToast(
                "Unable to update favorites.",
                "error"
            );

            return false;
        }
    }


    async function renderFavorites() {
        const container =
            byId(
                "favorites-content"
            );

        if (!container) {
            return;
        }

        if (!isAuthenticated()) {
            renderEmpty(
                container,
                "Sign in to save heroes and builds."
            );

            return;
        }

        const favorites =
            await getFavorites(
                state.currentFavoriteTab ===
                    "heroes"
                    ? "hero"
                    : "build"
            );

        if (!favorites.length) {
            renderEmpty(
                container,
                state.currentFavoriteTab ===
                    "heroes"
                    ? "No favorite heroes yet."
                    : "No favorite builds yet."
            );

            return;
        }

        container.innerHTML = "";

        favorites.forEach(
            function (favorite) {
                const card =
                    document.createElement(
                        "article"
                    );

                card.className =
                    "panel favorite-card";

                const itemId =
                    cleanString(
                        favorite.item_id ||
                        favorite.itemId
                    );

                const type =
                    cleanString(
                        favorite.item_type ||
                        favorite.itemType
                    );

                let item = null;

                if (
                    type === "hero" &&
                    DATA
                ) {
                    item =
                        DATA.getHero(
                            itemId
                        );
                }

                if (
                    type === "build" &&
                    DATA
                ) {
                    item =
                        DATA.getBuild(
                            itemId
                        );
                }

                const title =
                    item &&
                    item.name
                        ? item.name
                        : itemId ||
                          "Saved item";

                const heading =
                    document.createElement(
                        "h3"
                    );

                heading.textContent =
                    title;

                const meta =
                    document.createElement(
                        "span"
                    );

                meta.className =
                    "eyebrow";

                meta.textContent =
                    type === "hero"
                        ? "Hero"
                        : "Build";

                const button =
                    document.createElement(
                        "button"
                    );

                button.type = "button";
                button.className =
                    "secondary-button";

                button.textContent =
                    "Open";

                button.addEventListener(
                    "click",
                    function () {
                        if (
                            type === "hero"
                        ) {
                            document.dispatchEvent(
                                new CustomEvent(
                                    "hokstation:feature-select-hero",
                                    {
                                        detail: {
                                            id: itemId
                                        }
                                    }
                                )
                            );

                            navigate(
                                "hero-detail"
                            );
                        } else {
                            document.dispatchEvent(
                                new CustomEvent(
                                    "hokstation:feature-select-build",
                                    {
                                        detail: {
                                            id: itemId
                                        }
                                    }
                                )
                            );

                            navigate(
                                "build-lab"
                            );
                        }
                    }
                );

                card.appendChild(meta);
                card.appendChild(heading);
                card.appendChild(button);

                container.appendChild(card);
            }
        );
    }


    /* =========================================================
       SAVED BUILDS
       ========================================================= */

    async function saveBuild(
        build
    ) {
        if (!isAuthenticated()) {
            openAuth("login");

            return false;
        }

        if (!build || typeof build !== "object") {
            showToast(
                "No build was supplied.",
                "error"
            );

            return false;
        }

        const normalized =
            DATA &&
            typeof DATA.validateBuild ===
                "function"
                ? DATA.validateBuild(build)
                : {
                    valid: Boolean(
                        build.name &&
                        build.heroId
                    ),
                    normalized: build
                };

        if (!normalized.valid) {
            showToast(
                normalized.errors &&
                normalized.errors[0]
                    ? normalized.errors[0]
                    : "Please complete the build first.",
                "error"
            );

            return false;
        }

        const cleanBuild =
            normalized.normalized ||
            build;

        const client =
            await getClient();

        if (!client) {
            return false;
        }

        const table =
            getConfigTable("builds");

        const payload = {
            user_id:
                state.user.id,

            name:
                cleanString(
                    cleanBuild.name
                ).slice(0, 80),

            description:
                cleanString(
                    cleanBuild.description
                ).slice(0, 500),

            hero_id:
                cleanString(
                    cleanBuild.heroId ||
                    cleanBuild.hero_id
                ),

            equipment_ids:
                Array.isArray(
                    cleanBuild.equipmentIds ||
                    cleanBuild.equipment_ids
                )
                    ? (
                        cleanBuild.equipmentIds ||
                        cleanBuild.equipment_ids
                    ).slice(0, 6)
                    : []
        };

        try {
            const result =
                await client
                    .from(table)
                    .insert(payload)
                    .select("*")
                    .maybeSingle();

            if (result.error) {
                throw result.error;
            }

            showToast(
                "Build saved.",
                "success"
            );

            state.savedBuildsLoaded =
                false;

            await renderSavedBuilds();

            return result.data || true;
        } catch (error) {
            console.error(
                "[HoKStation Account] Save build failed:",
                error
            );

            showToast(
                "Unable to save this build.",
                "error"
            );

            return false;
        }
    }


    async function renderSavedBuilds() {
        const container =
            byId(
                "saved-builds-grid"
            );

        if (!container) {
            return;
        }

        if (!isAuthenticated()) {
            renderEmpty(
                container,
                "Sign in to view saved builds."
            );

            return;
        }

        const client =
            await getClient();

        if (!client) {
            renderEmpty(
                container,
                "Account services are not configured yet."
            );

            return;
        }

        const table =
            getConfigTable("builds");

        try {
            const result =
                await client
                    .from(table)
                    .select("*")
                    .eq(
                        "user_id",
                        state.user.id
                    )
                    .order(
                        "created_at",
                        {
                            ascending: false
                        }
                    );

            if (result.error) {
                throw result.error;
            }

            const builds =
                Array.isArray(
                    result.data
                )
                    ? result.data
                    : [];

            if (!builds.length) {
                renderEmpty(
                    container,
                    "You have no saved builds yet."
                );

                return;
            }

            container.innerHTML = "";

            builds.forEach(
                function (build) {
                    const card =
                        document.createElement(
                            "article"
                        );

                    card.className =
                        "panel build-card";

                    const title =
                        document.createElement(
                            "h3"
                        );

                    title.textContent =
                        cleanString(
                            build.name ||
                            build.build_name ||
                            build.title,
                            "Untitled Build"
                        );

                    const description =
                        document.createElement(
                            "p"
                        );

                    description.textContent =
                        cleanString(
                            build.description ||
                            build.build_description
                        );

                    const heroId =
                        cleanString(
                            build.hero_id ||
                            build.heroId
                        );

                    const hero =
                        DATA &&
                        heroId
                            ? DATA.getHero(
                                heroId
                            )
                            : null;

                    const meta =
                        document.createElement(
                            "span"
                        );

                    meta.className =
                        "eyebrow";

                    meta.textContent =
                        hero
                            ? "Hero: " +
                              hero.name
                            : "Saved Build";

                    const actions =
                        document.createElement(
                            "div"
                        );

                    actions.className =
                        "build-actions";

                    const open =
                        document.createElement(
                            "button"
                        );

                    open.type = "button";
                    open.className =
                        "secondary-button";

                    open.textContent =
                        "Open";

                    open.addEventListener(
                        "click",
                        function () {
                            document.dispatchEvent(
                                new CustomEvent(
                                    "hokstation:feature-load-build",
                                    {
                                        detail: {
                                            build:
                                                build
                                        }
                                    }
                                )
                            );

                            navigate(
                                "build-lab"
                            );
                        }
                    );

                    const remove =
                        document.createElement(
                            "button"
                        );

                    remove.type = "button";
                    remove.className =
                        "danger-button";

                    remove.textContent =
                        "Delete";

                    remove.addEventListener(
                        "click",
                        async function () {
                            const confirmed =
                                await confirmAction(
                                    "Delete saved build?",
                                    "This will remove the saved build from your account."
                                );

                            if (!confirmed) {
                                return;
                            }

                            await deleteBuild(
                                build.id
                            );
                        }
                    );

                    actions.appendChild(open);
                    actions.appendChild(remove);

                    card.appendChild(meta);
                    card.appendChild(title);

                    if (
                        description.textContent
                    ) {
                        card.appendChild(
                            description
                        );
                    }

                    card.appendChild(actions);

                    container.appendChild(card);
                }
            );

            state.savedBuildsLoaded =
                true;
        } catch (error) {
            console.error(
                "[HoKStation Account] Saved builds load failed:",
                error
            );

            renderEmpty(
                container,
                "Unable to load your saved builds."
            );
        }
    }


    async function deleteBuild(
        buildId
    ) {
        if (!isAuthenticated()) {
            return false;
        }

        const client =
            await getClient();

        if (!client) {
            return false;
        }

        const table =
            getConfigTable("builds");

        try {
            const result =
                await client
                    .from(table)
                    .delete()
                    .eq(
                        "id",
                        buildId
                    )
                    .eq(
                        "user_id",
                        state.user.id
                    );

            if (result.error) {
                throw result.error;
            }

            showToast(
                "Saved build deleted.",
                "success"
            );

            state.savedBuildsLoaded =
                false;

            await renderSavedBuilds();

            return true;
        } catch (error) {
            console.error(
                "[HoKStation Account] Delete build failed:",
                error
            );

            showToast(
                "Unable to delete the saved build.",
                "error"
            );

            return false;
        }
    }


    /* =========================================================
       ACTIVITY
       ========================================================= */

    async function renderActivity() {
        const container =
            byId(
                "activity-list"
            );

        if (!container) {
            return;
        }

        if (!isAuthenticated()) {
            renderEmpty(
                container,
                "Sign in to view your activity."
            );

            return;
        }

        const client =
            await getClient();

        if (!client) {
            renderEmpty(
                container,
                "Account services are not configured yet."
            );

            return;
        }

        const table =
            getConfigTable("activity");

        try {
            const result =
                await client
                    .from(table)
                    .select("*")
                    .eq(
                        "user_id",
                        state.user.id
                    )
                    .order(
                        "created_at",
                        {
                            ascending: false
                        }
                    )
                    .limit(50);

            if (result.error) {
                throw result.error;
            }

            const rows =
                Array.isArray(
                    result.data
                )
                    ? result.data
                    : [];

            if (!rows.length) {
                renderEmpty(
                    container,
                    "No activity recorded yet."
                );

                return;
            }

            container.innerHTML = "";

            rows.forEach(
                function (row) {
                    const item =
                        document.createElement(
                            "article"
                        );

                    item.className =
                        "panel activity-item";

                    const title =
                        document.createElement(
                            "strong"
                        );

                    title.textContent =
                        cleanString(
                            row.title ||
                            row.action ||
                            row.type,
                            "Activity"
                        );

                    const description =
                        document.createElement(
                            "span"
                        );

                    description.textContent =
                        cleanString(
                            row.description ||
                            row.details ||
                            ""
                        );

                    const date =
                        document.createElement(
                            "time"
                        );

                    const dateValue =
                        row.created_at ||
                        row.createdAt ||
                        row.timestamp;

                    if (dateValue) {
                        const parsed =
                            new Date(
                                dateValue
                            );

                        if (
                            !Number.isNaN(
                                parsed.getTime()
                            )
                        ) {
                            date.dateTime =
                                parsed.toISOString();

                            date.textContent =
                                parsed.toLocaleString();
                        }
                    }

                    item.appendChild(title);

                    if (
                        description.textContent
                    ) {
                        item.appendChild(
                            description
                        );
                    }

                    if (
                        date.textContent
                    ) {
                        item.appendChild(date);
                    }

                    container.appendChild(item);
                }
            );

            state.activityLoaded =
                true;
        } catch (error) {
            console.error(
                "[HoKStation Account] Activity load failed:",
                error
            );

            renderEmpty(
                container,
                "Unable to load your activity."
            );
        }
    }


    /* =========================================================
       COMMUNITY QUESTIONS
       ========================================================= */

    async function renderQuestions(
        filter
    ) {
        const container =
            byId(
                "question-list"
            );

        if (!container) {
            return;
        }

        state.currentCommunityFilter =
            filter ||
            state.currentCommunityFilter ||
            "recent";

        const client =
            await getClient();

        if (!client) {
            renderEmpty(
                container,
                "Community data is not configured yet."
            );

            return;
        }

        const table =
            getConfigTable("questions");

        try {
            let query =
                client
                    .from(table)
                    .select("*");

            if (
                state.currentCommunityFilter ===
                "unanswered"
            ) {
                query =
                    query.eq(
                        "answer_count",
                        0
                    );
            }

            if (
                state.currentCommunityFilter ===
                "popular"
            ) {
                query =
                    query.order(
                        "score",
                        {
                            ascending: false
                        }
                    );
            } else {
                query =
                    query.order(
                        "created_at",
                        {
                            ascending: false
                        }
                    );
            }

            query =
                query.limit(50);

            const result =
                await query;

            if (result.error) {
                throw result.error;
            }

            const questions =
                Array.isArray(
                    result.data
                )
                    ? result.data
                    : [];

            if (!questions.length) {
                renderEmpty(
                    container,
                    "No community questions are available."
                );

                return;
            }

            container.innerHTML = "";

            questions.forEach(
                function (question) {
                    const card =
                        document.createElement(
                            "article"
                        );

                    card.className =
                        "panel question-card";

                    const title =
                        document.createElement(
                            "h3"
                        );

                    title.textContent =
                        cleanString(
                            question.title,
                            "Untitled Question"
                        );

                    const body =
                        document.createElement(
                            "p"
                        );

                    body.textContent =
                        cleanString(
                            question.body ||
                            question.content ||
                            ""
                        ).slice(
                            0,
                            260
                        );

                    const category =
                        document.createElement(
                            "span"
                        );

                    category.className =
                        "eyebrow";

                    category.textContent =
                        cleanString(
                            question.category,
                            "General"
                        );

                    const meta =
                        document.createElement(
                            "div"
                        );

                    meta.className =
                        "question-meta";

                    const answers =
                        safeNumber(
                            question.answer_count ||
                            question.answerCount,
                            0
                        );

                    const score =
                        safeNumber(
                            question.score ||
                            question.votes,
                            0
                        );

                    meta.textContent =
                        score +
                        " score · " +
                        answers +
                        " answers";

                    const button =
                        document.createElement(
                            "button"
                        );

                    button.type = "button";
                    button.className =
                        "secondary-button";

                    button.textContent =
                        "Open Question";

                    const questionId =
                        cleanString(
                            question.id
                        );

                    button.addEventListener(
                        "click",
                        function () {
                            state.selectedQuestionId =
                                questionId;

                            navigate(
                                "question-detail"
                            );

                            renderQuestionDetail(
                                question
                            );
                        }
                    );

                    card.appendChild(category);
                    card.appendChild(title);

                    if (
                        body.textContent
                    ) {
                        card.appendChild(body);
                    }

                    card.appendChild(meta);
                    card.appendChild(button);

                    container.appendChild(card);
                }
            );

            state.communityLoaded =
                true;
        } catch (error) {
            console.error(
                "[HoKStation Account] Community load failed:",
                error
            );

            renderEmpty(
                container,
                "Unable to load community questions."
            );
        }
    }


    async function createQuestion(
        title,
        body,
        category
    ) {
        if (!isAuthenticated()) {
            openAuth("login");

            return false;
        }

        const cleanTitle =
            cleanString(title);

        const cleanBody =
            cleanString(body);

        const cleanCategory =
            cleanString(
                category,
                "general"
            );

        if (
            cleanTitle.length < 1 ||
            cleanTitle.length > 120
        ) {
            showToast(
                "Question title must be 1–120 characters.",
                "error"
            );

            return false;
        }

        if (
            cleanBody.length < 1 ||
            cleanBody.length > 5000
        ) {
            showToast(
                "Question must be 1–5000 characters.",
                "error"
            );

            return false;
        }

        const client =
            await getClient();

        if (!client) {
            return false;
        }

        const table =
            getConfigTable(
                "questions"
            );

        try {
            const result =
                await client
                    .from(table)
                    .insert({
                        user_id:
                            state.user.id,
                        title:
                            cleanTitle,
                        body:
                            cleanBody,
                        category:
                            cleanCategory
                    })
                    .select("*")
                    .maybeSingle();

            if (result.error) {
                throw result.error;
            }

            closeModal(
                "question-modal"
            );

            const form =
                byId("question-form");

            if (form) {
                form.reset();
            }

            showToast(
                "Question posted.",
                "success"
            );

            await renderQuestions(
                state.currentCommunityFilter
            );

            if (
                result.data &&
                result.data.id
            ) {
                state.selectedQuestionId =
                    result.data.id;

                navigate(
                    "question-detail"
                );

                await renderQuestionDetail(
                    result.data
                );
            }

            return true;
        } catch (error) {
            console.error(
                "[HoKStation Account] Question creation failed:",
                error
            );

            showToast(
                "Unable to post the question.",
                "error"
            );

            return false;
        }
    }


    async function renderQuestionDetail(
        question
    ) {
        const container =
            byId(
                "question-detail-content"
            );

        if (!container) {
            return;
        }

        let row =
            question || null;

        if (
            !row &&
            state.selectedQuestionId
        ) {
            const client =
                await getClient();

            if (client) {
                const table =
                    getConfigTable(
                        "questions"
                    );

                try {
                    const result =
                        await client
                            .from(table)
                            .select("*")
                            .eq(
                                "id",
                                state.selectedQuestionId
                            )
                            .maybeSingle();

                    if (
                        !result.error
                    ) {
                        row =
                            result.data;
                    }
                } catch (error) {
                    row = null;
                }
            }
        }

        if (!row) {
            renderEmpty(
                container,
                "Question not found."
            );

            return;
        }

        container.innerHTML = "";

        const panel =
            document.createElement(
                "article"
            );

        panel.className =
            "panel question-detail-card";

        const category =
            document.createElement(
                "span"
            );

        category.className =
            "eyebrow";

        category.textContent =
            cleanString(
                row.category,
                "General"
            );

        const title =
            document.createElement(
                "h1"
            );

        title.textContent =
            cleanString(
                row.title,
                "Untitled Question"
            );

        const body =
            document.createElement(
                "p"
            );

        body.textContent =
            cleanString(
                row.body ||
                row.content,
                ""
            );

        const meta =
            document.createElement(
                "div"
            );

        meta.className =
            "question-meta";

        meta.textContent =
            "Question";

        panel.appendChild(category);
        panel.appendChild(title);
        panel.appendChild(body);
        panel.appendChild(meta);

        const answers =
            await loadQuestionAnswers(
                row.id
            );

        if (answers.length) {
            const heading =
                document.createElement(
                    "h2"
                );

            heading.textContent =
                "Answers";

            panel.appendChild(
                heading
            );

            answers.forEach(
                function (answer) {
                    const answerCard =
                        document.createElement(
                            "div"
                        );

                    answerCard.className =
                        "panel question-answer";

                    const answerBody =
                        document.createElement(
                            "p"
                        );

                    answerBody.textContent =
                        cleanString(
                            answer.body ||
                            answer.content
                        );

                    answerCard.appendChild(
                        answerBody
                    );

                    panel.appendChild(
                        answerCard
                    );
                }
            );
        }

        container.appendChild(
            panel
        );
    }


    async function loadQuestionAnswers(
        questionId
    ) {
        const client =
            await getClient();

        if (!client || !questionId) {
            return [];
        }

        const table =
            getConfigTable(
                "questionAnswers"
            );

        try {
            const result =
                await client
                    .from(table)
                    .select("*")
                    .eq(
                        "question_id",
                        questionId
                    )
                    .order(
                        "created_at",
                        {
                            ascending: true
                        }
                    );

            if (result.error) {
                throw result.error;
            }

            return Array.isArray(
                result.data
            )
                ? result.data
                : [];
        } catch (error) {
            console.warn(
                "[HoKStation Account] Answers load failed:",
                error
            );

            return [];
        }
    }


    /* =========================================================
       REPORTS
       ========================================================= */

    async function createReport(
        type,
        details
    ) {
        if (!isAuthenticated()) {
            openAuth("login");

            return false;
        }

        const cleanType =
            cleanString(
                type,
                "other"
            );

        const cleanDetails =
            cleanString(details);

        if (
            cleanDetails.length < 1 ||
            cleanDetails.length > 3000
        ) {
            showToast(
                "Report details must be 1–3000 characters.",
                "error"
            );

            return false;
        }

        const client =
            await getClient();

        if (!client) {
            return false;
        }

        const table =
            getConfigTable(
                "reports"
            );

        try {
            const result =
                await client
                    .from(table)
                    .insert({
                        user_id:
                            state.user.id,
                        type:
                            cleanType,
                        details:
                            cleanDetails
                    });

            if (result.error) {
                throw result.error;
            }

            closeModal(
                "report-modal"
            );

            const form =
                byId("report-form");

            if (form) {
                form.reset();
            }

            showToast(
                "Report submitted.",
                "success"
            );

            return true;
        } catch (error) {
            console.error(
                "[HoKStation Account] Report failed:",
                error
            );

            showToast(
                "Unable to submit the report.",
                "error"
            );

            return false;
        }
    }


    /* =========================================================
       ADMIN DASHBOARD
       ========================================================= */

    function adminGuard() {
        if (!isAuthenticated()) {
            openAuth("login");

            return false;
        }

        if (!isAdmin()) {
            showToast(
                "Administrator access is required.",
                "error"
            );

            navigate(
                "home"
            );

            return false;
        }

        return true;
    }


    async function renderAdminPanel(
        panel
    ) {
        const container =
            byId(
                "admin-panel-container"
            );

        if (!container) {
            return;
        }

        if (!adminGuard()) {
            container.innerHTML = "";

            return;
        }

        const allowed =
            Array.isArray(
                CONFIG.adminPanels
            )
                ? CONFIG.adminPanels
                : [
                    "sync",
                    "content",
                    "users",
                    "ads",
                    "token-shops",
                    "logs",
                    "settings"
                ];

        if (
            !allowed.includes(panel)
        ) {
            renderEmpty(
                container,
                "Unknown admin panel."
            );

            return;
        }

        state.currentAdminPanel =
            panel;

        container.innerHTML = "";

        const heading =
            document.createElement(
                "div"
            );

        heading.className =
            "panel-heading";

        const title =
            document.createElement(
                "h2"
            );

        title.textContent =
            getAdminPanelTitle(
                panel
            );

        heading.appendChild(
            title
        );

        container.appendChild(
            heading
        );

        switch (panel) {
            case "sync":
                await renderAdminSync(
                    container
                );
                break;

            case "content":
                await renderAdminContent(
                    container
                );
                break;

            case "users":
                await renderAdminUsers(
                    container
                );
                break;

            case "ads":
                await renderAdminCollection(
                    container,
                    "ads",
                    "Approved advertising records."
                );
                break;

            case "token-shops":
                await renderAdminCollection(
                    container,
                    "tokenShops",
                    "Approved official token-shop records."
                );
                break;

            case "logs":
                await renderAdminCollection(
                    container,
                    "adminLogs",
                    "Administrative logs."
                );
                break;

            case "settings":
                await renderAdminCollection(
                    container,
                    "platformSettings",
                    "Platform settings."
                );
                break;

            default:
                break;
        }
    }


    function getAdminPanelTitle(
        panel
    ) {
        const titles = {
            sync:
                "Data Synchronization",
            content:
                "Content Management",
            users:
                "User Management",
            ads:
                "Advertisements",
            "token-shops":
                "Official Token Shops",
            logs:
                "Administrative Logs",
            settings:
                "Platform Settings"
        };

        return (
            titles[panel] ||
            "Admin Panel"
        );
    }


    async function renderAdminSync(
        container
    ) {
        const status =
            DATA &&
            typeof DATA.getDataFreshness ===
                "function"
                ? DATA.getDataFreshness()
                : null;

        const report =
            DATA &&
            typeof DATA.getQualityReport ===
                "function"
                ? DATA.getQualityReport()
                : null;

        const panel =
            document.createElement(
                "div"
            );

        panel.className =
            "panel";

        const statusText =
            document.createElement(
                "p"
            );

        statusText.textContent =
            "Current data status: " +
            cleanString(
                status &&
                (
                    status.label ||
                    status.state
                ),
                "Unknown"
            );

        const counts =
            DATA &&
            typeof DATA.getCounts ===
                "function"
                ? DATA.getCounts()
                : {};

        const countText =
            document.createElement(
                "p"
            );

        countText.textContent =
            "Heroes: " +
            safeNumber(
                counts.heroes
            ) +
            " · Equipment: " +
            safeNumber(
                counts.equipment
            ) +
            " · Builds: " +
            safeNumber(
                counts.builds
            ) +
            " · Patches: " +
            safeNumber(
                counts.patches
            );

        const quality =
            document.createElement(
                "p"
            );

        quality.textContent =
            report
                ? "Quality report available."
                : "No quality report available.";

        const refresh =
            document.createElement(
                "button"
            );

        refresh.type = "button";
        refresh.className =
            "primary-button";

        refresh.textContent =
            "Refresh Data";

        refresh.addEventListener(
            "click",
            async function () {
                if (!adminGuard()) {
                    return;
                }

                if (
                    !DATA ||
                    typeof DATA.refresh !==
                        "function"
                ) {
                    showToast(
                        "Data refresh is unavailable.",
                        "error"
                    );

                    return;
                }

                refresh.disabled = true;

                try {
                    const result =
                        await DATA.refresh();

                    if (
                        result &&
                        result.ok === false
                    ) {
                        throw (
                            result.error ||
                            new Error(
                                "Data refresh failed."
                            )
                        );
                    }

                    showToast(
                        "Data refresh requested.",
                        "success"
                    );
                } catch (error) {
                    console.error(
                        "[HoKStation Admin] Data refresh failed:",
                        error
                    );

                    showToast(
                        "Data refresh failed.",
                        "error"
                    );
                } finally {
                    refresh.disabled = false;
                }
            }
        );

        panel.appendChild(
            statusText
        );

        panel.appendChild(
            countText
        );

        panel.appendChild(
            quality
        );

        panel.appendChild(
            refresh
        );

        container.appendChild(
            panel
        );
    }


    async function renderAdminContent(
        container
    ) {
        const counts =
            DATA &&
            typeof DATA.getCounts ===
                "function"
                ? DATA.getCounts()
                : {};

        const panel =
            document.createElement(
                "div"
            );

        panel.className =
            "panel";

        const paragraph =
            document.createElement(
                "p"
            );

        paragraph.textContent =
            "Content editing is intentionally connected to the live data layer. No placeholder records are created here.";

        panel.appendChild(
            paragraph
        );

        [
            "heroes",
            "equipment",
            "builds",
            "patches",
            "notices",
            "meta"
        ].forEach(
            function (key) {
                const row =
                    document.createElement(
                        "div"
                    );

                row.className =
                    "admin-stat-row";

                row.textContent =
                    key +
                    ": " +
                    safeNumber(
                        counts[key]
                    );

                panel.appendChild(
                    row
                );
            }
        );

        container.appendChild(
            panel
        );
    }


    async function renderAdminUsers(
        container
    ) {
        const client =
            await getClient();

        if (!client) {
            renderEmpty(
                container,
                "Supabase is not configured."
            );

            return;
        }

        const table =
            getConfigTable(
                "profiles"
            );

        try {
            const result =
                await client
                    .from(table)
                    .select(
                        "id,display_name,bio,role,created_at"
                    )
                    .order(
                        "created_at",
                        {
                            ascending: false
                        }
                    )
                    .limit(100);

            if (result.error) {
                throw result.error;
            }

            const users =
                Array.isArray(
                    result.data
                )
                    ? result.data
                    : [];

            if (!users.length) {
                renderEmpty(
                    container,
                    "No profile records are available."
                );

                return;
            }

            const panel =
                document.createElement(
                    "div"
                );

            panel.className =
                "panel";

            users.forEach(
                function (user) {
                    const row =
                        document.createElement(
                            "div"
                        );

                    row.className =
                        "admin-user-row";

                    const name =
                        document.createElement(
                            "strong"
                        );

                    name.textContent =
                        cleanString(
                            user.display_name,
                            "Unnamed User"
                        );

                    const role =
                        document.createElement(
                            "span"
                        );

                    role.textContent =
                        cleanString(
                            user.role,
                            "user"
                        );

                    row.appendChild(name);
                    row.appendChild(role);

                    panel.appendChild(
                        row
                    );
                }
            );

            container.appendChild(
                panel
            );
        } catch (error) {
            console.error(
                "[HoKStation Admin] User list failed:",
                error
            );

            renderEmpty(
                container,
                "Unable to load user records."
            );
        }
    }


    async function renderAdminCollection(
        container,
        tableKey,
        description
    ) {
        const client =
            await getClient();

        if (!client) {
            renderEmpty(
                container,
                "Supabase is not configured."
            );

            return;
        }

        const table =
            getConfigTable(
                tableKey
            );

        try {
            const result =
                await client
                    .from(table)
                    .select("*")
                    .limit(50);

            if (result.error) {
                throw result.error;
            }

            const rows =
                Array.isArray(
                    result.data
                )
                    ? result.data
                    : [];

            const panel =
                document.createElement(
                    "div"
                );

            panel.className =
                "panel";

            const info =
                document.createElement(
                    "p"
                );

            info.textContent =
                description +
                " Records loaded: " +
                rows.length +
                ".";

            panel.appendChild(
                info
            );

            if (!rows.length) {
                const empty =
                    document.createElement(
                        "p"
                    );

                empty.textContent =
                    "No records are currently available.";

                panel.appendChild(
                    empty
                );
            } else {
                rows.forEach(
                    function (row) {
                        const item =
                            document.createElement(
                                "div"
                            );

                        item.className =
                            "admin-record-row";

                        const text =
                            document.createElement(
                                "span"
                            );

                        /*
                         * Only show a compact safe summary.
                         * Do not dump raw objects into HTML.
                         */
                        text.textContent =
                            cleanString(
                                row.name ||
                                row.title ||
                                row.label ||
                                row.id,
                                "Record"
                            );

                        item.appendChild(
                            text
                        );

                        panel.appendChild(
                            item
                        );
                    }
                );
            }

            container.appendChild(
                panel
            );
        } catch (error) {
            console.error(
                "[HoKStation Admin] Collection load failed:",
                error
            );

            renderEmpty(
                container,
                "Unable to load this admin dataset."
            );
        }
    }


    /* =========================================================
       SETTINGS
       ========================================================= */

    function loadSettings() {
        const language =
            byId(
                "language-setting"
            );

        const reducedMotion =
            byId(
                "reduced-motion-setting"
            );

        if (language) {
            let saved =
                "";

            try {
                saved =
                    localStorage.getItem(
                        "hokstation-language"
                    ) || "";
            } catch (error) {
                saved = "";
            }

            const allowed =
                CONFIG.localization &&
                Array.isArray(
                    CONFIG.localization
                        .supportedLanguages
                )
                    ? CONFIG.localization
                        .supportedLanguages
                    : [
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

            language.value =
                allowed.includes(saved)
                    ? saved
                    : "en";
        }

        if (reducedMotion) {
            let savedMotion =
                null;

            try {
                savedMotion =
                    localStorage.getItem(
                        "hokstation-reduced-motion"
                    );
            } catch (error) {
                savedMotion = null;
            }

            if (
                savedMotion ===
                "true"
            ) {
                reducedMotion.checked =
                    true;
            } else if (
                savedMotion ===
                "false"
            ) {
                reducedMotion.checked =
                    false;
            } else {
                reducedMotion.checked =
                    window.matchMedia &&
                    window.matchMedia(
                        "(prefers-reduced-motion: reduce)"
                    ).matches;
            }
        }
    }


    function saveLanguage(
        language
    ) {
        const allowed =
            CONFIG.localization &&
            Array.isArray(
                CONFIG.localization
                    .supportedLanguages
            )
                ? CONFIG.localization
                    .supportedLanguages
                : [
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

        if (!allowed.includes(language)) {
            return;
        }

        try {
            localStorage.setItem(
                "hokstation-language",
                language
            );
        } catch (error) {
            /* Storage can be unavailable. */
        }

        document.documentElement
            .setAttribute(
                "lang",
                language
            );

        document.dispatchEvent(
            new CustomEvent(
                "hokstation:language-changed",
                {
                    detail: {
                        language:
                            language
                    }
                }
            )
        );

        showToast(
            "Language preference saved.",
            "success"
        );
    }


    function saveReducedMotion(
        enabled
    ) {
        const value =
            Boolean(enabled);

        try {
            localStorage.setItem(
                "hokstation-reduced-motion",
                value
                    ? "true"
                    : "false"
            );
        } catch (error) {
            /* Storage can be unavailable. */
        }

        if (
            APP &&
            typeof APP.setReducedMotion ===
                "function"
        ) {
            APP.setReducedMotion(
                value
            );
        }

        showToast(
            value
                ? "Reduced motion enabled."
                : "Reduced motion disabled.",
            "success"
        );
    }


    async function changePassword() {
        if (!isAuthenticated()) {
            openAuth("login");

            return false;
        }

        const client =
            await getClient();

        if (!client || !client.auth) {
            return false;
        }

        try {
            /*
             * Supabase sends the user through its password
             * update flow. No password is handled by localStorage.
             */
            const result =
                await client.auth
                    .resetPasswordForEmail(
                        state.user.email,
                        {
                            redirectTo:
                                window.location.origin +
                                window.location.pathname
                        }
                    );

            if (result.error) {
                throw result.error;
            }

            showToast(
                "Password reset instructions sent.",
                "success"
            );

            return true;
        } catch (error) {
            console.error(
                "[HoKStation Account] Password recovery failed:",
                error
            );

            showToast(
                "Unable to send password instructions.",
                "error"
            );

            return false;
        }
    }


    async function resendVerification() {
        if (!isAuthenticated()) {
            openAuth("login");

            return false;
        }

        const client =
            await getClient();

        if (!client || !client.auth) {
            return false;
        }

        try {
            const result =
                await client.auth
                    .resend({
                        type: "signup",
                        email:
                            state.user.email
                    });

            if (result.error) {
                throw result.error;
            }

            showToast(
                "Verification email requested.",
                "success"
            );

            return true;
        } catch (error) {
            console.error(
                "[HoKStation Account] Verification resend failed:",
                error
            );

            showToast(
                "Unable to resend verification email.",
                "error"
            );

            return false;
        }
    }


    /* =========================================================
       CONFIRM HELPER
       ========================================================= */

    async function confirmAction(
        title,
        message
    ) {
        if (
            APP &&
            typeof APP.confirm ===
                "function"
        ) {
            return APP.confirm({
                title:
                    title ||
                    "Are you sure?",
                message:
                    message ||
                    "Please confirm this action.",
                confirmText:
                    "Confirm",
                cancelText:
                    "Cancel"
            });
        }

        return window.confirm(
            message ||
            "Please confirm this action."
        );
    }


    /* =========================================================
       EMPTY STATE
       ========================================================= */

    function renderEmpty(
        container,
        message
    ) {
        if (!container) {
            return;
        }

        container.innerHTML = "";

        const empty =
            document.createElement(
                "div"
            );

        empty.className =
            "empty-state";

        const icon =
            document.createElement(
                "span"
            );

        icon.className =
            "empty-icon";

        icon.textContent =
            "◇";

        const heading =
            document.createElement(
                "h3"
            );

        heading.textContent =
            "Nothing here yet";

        const paragraph =
            document.createElement(
                "p"
            );

        paragraph.textContent =
            cleanString(
                message,
                "No records are available."
            );

        empty.appendChild(icon);
        empty.appendChild(heading);
        empty.appendChild(paragraph);

        container.appendChild(
            empty
        );
    }


    /* =========================================================
       ROUTE HANDLING
       ========================================================= */

    async function handleAccountRouteRequest(
        detail
    ) {
        const route =
            detail &&
            cleanString(
                detail.route
            );

        if (!route) {
            return;
        }

        const privateRoutes = [
            "profile",
            "saved-builds",
            "favorites",
            "activity",
            "settings",
            "admin"
        ];

        if (
            privateRoutes.includes(route) &&
            !isAuthenticated()
        ) {
            openAuth("login");

            showToast(
                "Please sign in to access your account.",
                "info"
            );

            return;
        }

        if (
            route === "admin" &&
            !isAdmin()
        ) {
            showToast(
                "Administrator access is required.",
                "error"
            );

            return;
        }

        navigate(route);

        await renderRoute(
            route
        );
    }


    async function renderRoute(
        route
    ) {
        switch (route) {
            case "profile":
                await loadProfile();
                updateProfilePage();
                break;

            case "saved-builds":
                await renderSavedBuilds();
                break;

            case "favorites":
                await renderFavorites();
                break;

            case "activity":
                await renderActivity();
                break;

            case "settings":
                loadSettings();
                break;

            case "community":
                await renderQuestions(
                    state.currentCommunityFilter
                );
                break;

            case "question-detail":
                await renderQuestionDetail();
                break;

            case "admin":
                if (isAdmin()) {
                    if (
                        !state.currentAdminPanel
                    ) {
                        state.currentAdminPanel =
                            "sync";
                    }

                    await renderAdminPanel(
                        state.currentAdminPanel
                    );
                }

                break;

            default:
                break;
        }
    }


    /* =========================================================
       EVENT WIRING
       ========================================================= */

    function bindAuthControls() {
        const loginOpen =
            byId("login-open");

        if (loginOpen) {
            loginOpen.addEventListener(
                "click",
                function () {
                    openAuth("login");
                }
            );
        }


        const registerOpen =
            byId("register-open");

        if (registerOpen) {
            registerOpen.addEventListener(
                "click",
                function () {
                    openAuth("register");
                }
            );
        }


        const forgot =
            byId(
                "forgot-password-open"
            );

        if (forgot) {
            forgot.addEventListener(
                "click",
                function () {
                    openAuth("recovery");
                }
            );
        }


        const recoveryBack =
            byId("recovery-back");

        if (recoveryBack) {
            recoveryBack.addEventListener(
                "click",
                function () {
                    openAuth("login");
                }
            );
        }


        const loginForm =
            byId("login-form");

        if (loginForm) {
            loginForm.addEventListener(
                "submit",
                async function (event) {
                    event.preventDefault();

                    const email =
                        byId(
                            "login-email"
                        );

                    const password =
                        byId(
                            "login-password"
                        );

                    await login(
                        email &&
                            email.value,
                        password &&
                            password.value
                    );
                }
            );
        }


        const registerForm =
            byId(
                "register-form"
            );

        if (registerForm) {
            registerForm.addEventListener(
                "submit",
                async function (event) {
                    event.preventDefault();

                    const name =
                        byId(
                            "register-display-name"
                        );

                    const email =
                        byId(
                            "register-email"
                        );

                    const password =
                        byId(
                            "register-password"
                        );

                    await register(
                        name &&
                            name.value,
                        email &&
                            email.value,
                        password &&
                            password.value
                    );
                }
            );
        }


        const recoveryForm =
            byId(
                "recovery-form"
            );

        if (recoveryForm) {
            recoveryForm.addEventListener(
                "submit",
                async function (event) {
                    event.preventDefault();

                    const email =
                        byId(
                            "recovery-email"
                        );

                    await recoverPassword(
                        email &&
                            email.value
                    );
                }
            );
        }


        const logout =
            byId(
                "logout-button"
            );

        if (logout) {
            logout.addEventListener(
                "click",
                async function () {
                    await logoutUser();
                }
            );
        }


        const mobileAccount =
            byId(
                "mobile-account-trigger"
            );

        if (mobileAccount) {
            mobileAccount.addEventListener(
                "click",
                function () {
                    if (
                        APP &&
                        typeof APP.openAccountPanel ===
                            "function"
                    ) {
                        APP.openAccountPanel();
                    }
                }
            );
        }


        const accountSettings =
            byId(
                "account-settings-open"
            );

        if (accountSettings) {
            accountSettings.addEventListener(
                "click",
                function () {
                    if (
                        isAuthenticated()
                    ) {
                        navigate(
                            "settings"
                        );
                    } else {
                        openAuth(
                            "login"
                        );
                    }
                }
            );
        }
    }


    async function logoutUser() {
        const confirmed =
            await confirmAction(
                "Log out?",
                "You will need to sign in again to access your account."
            );

        if (!confirmed) {
            return;
        }

        await logout();
    }


    function bindProfileControls() {
        const form =
            byId(
                "profile-form"
            );

        if (form) {
            form.addEventListener(
                "submit",
                async function (event) {
                    event.preventDefault();

                    if (
                        !isAuthenticated()
                    ) {
                        openAuth(
                            "login"
                        );

                        return;
                    }

                    const name =
                        byId(
                            "profile-display-name"
                        );

                    const bio =
                        byId(
                            "profile-bio"
                        );

                    await updateProfile(
                        name &&
                            name.value,
                        bio &&
                            bio.value
                    );
                }
            );
        }
    }


    function bindSettingsControls() {
        const language =
            byId(
                "language-setting"
            );

        if (language) {
            language.addEventListener(
                "change",
                function () {
                    saveLanguage(
                        language.value
                    );
                }
            );
        }


        const motion =
            byId(
                "reduced-motion-setting"
            );

        if (motion) {
            motion.addEventListener(
                "change",
                function () {
                    saveReducedMotion(
                        motion.checked
                    );
                }
            );
        }


        const password =
            byId(
                "change-password-button"
            );

        if (password) {
            password.addEventListener(
                "click",
                function () {
                    changePassword();
                }
            );
        }


        const verification =
            byId(
                "send-verification-button"
            );

        if (verification) {
            verification.addEventListener(
                "click",
                function () {
                    resendVerification();
                }
            );
        }
    }


    function bindCommunityControls() {
        all(
            "[data-community-filter]"
        ).forEach(
            function (button) {
                button.addEventListener(
                    "click",
                    async function () {
                        const filter =
                            button.getAttribute(
                                "data-community-filter"
                            );

                        state.currentCommunityFilter =
                            filter || "recent";

                        all(
                            "[data-community-filter]"
                        ).forEach(
                            function (item) {
                                item.classList.toggle(
                                    "is-active",
                                    item ===
                                        button
                                );
                            }
                        );

                        await renderQuestions(
                            state.currentCommunityFilter
                        );
                    }
                );
            }
        );


        const ask =
            byId(
                "ask-question-button"
            );

        if (ask) {
            ask.addEventListener(
                "click",
                function () {
                    if (
                        !isAuthenticated()
                    ) {
                        openAuth(
                            "login"
                        );

                        return;
                    }

                    openModal(
                        "question-modal"
                    );
                }
            );
        }


        const questionForm =
            byId(
                "question-form"
            );

        if (questionForm) {
            questionForm.addEventListener(
                "submit",
                async function (event) {
                    event.preventDefault();

                    const title =
                        byId(
                            "question-title"
                        );

                    const body =
                        byId(
                            "question-body"
                        );

                    const category =
                        byId(
                            "question-category"
                        );

                    await createQuestion(
                        title &&
                            title.value,
                        body &&
                            body.value,
                        category &&
                            category.value
                    );
                }
            );
        }


        const report =
            byId(
                "report-button"
            );

        if (report) {
            report.addEventListener(
                "click",
                function () {
                    if (
                        !isAuthenticated()
                    ) {
                        openAuth(
                            "login"
                        );

                        return;
                    }

                    openModal(
                        "report-modal"
                    );
                }
            );
        }


        const footerReport =
            byId(
                "footer-report-button"
            );

        /*
         * app.js already opens the report modal.
         * This listener only protects the action behind
         * authentication when the user actually submits.
         */
        if (footerReport) {
            footerReport.addEventListener(
                "click",
                function () {
                    if (
                        !isAuthenticated()
                    ) {
                        openAuth(
                            "login"
                        );
                    }
                }
            );
        }


        const reportForm =
            byId(
                "report-form"
            );

        if (reportForm) {
            reportForm.addEventListener(
                "submit",
                async function (event) {
                    event.preventDefault();

                    const type =
                        byId(
                            "report-type"
                        );

                    const details =
                        byId(
                            "report-details"
                        );

                    await createReport(
                        type &&
                            type.value,
                        details &&
                            details.value
                    );
                }
            );
        }
    }


    function bindFavoriteTabs() {
        all(
            "[data-favorite-tab]"
        ).forEach(
            function (button) {
                button.addEventListener(
                    "click",
                    async function () {
                        const tab =
                            button.getAttribute(
                                "data-favorite-tab"
                            );

                        state.currentFavoriteTab =
                            tab === "builds"
                                ? "builds"
                                : "heroes";

                        all(
                            "[data-favorite-tab]"
                        ).forEach(
                            function (item) {
                                item.classList.toggle(
                                    "is-active",
                                    item ===
                                        button
                                );
                            }
                        );

                        await renderFavorites();
                    }
                );
            }
        );
    }


    function bindAdminControls() {
        /*
         * app.js owns the actual click listener for
         * [data-admin-panel] and emits admin-panel-request.
         *
         * account.js listens to that event here.
         */
    }


    function bindAppEvents() {
        document.addEventListener(
            "hokstation:account-route-request",
            function (event) {
                handleAccountRouteRequest(
                    event.detail || {}
                );
            }
        );


        document.addEventListener(
            "hokstation:admin-panel-request",
            function (event) {
                const detail =
                    event.detail || {};

                renderAdminPanel(
                    detail.panel
                );
            }
        );


        document.addEventListener(
            "hokstation:route",
            function (event) {
                const detail =
                    event.detail || {};

                renderRoute(
                    detail.route
                );
            }
        );


        document.addEventListener(
            "hokstation:app-ready",
            function () {
                refreshAuthState();
            }
        );


        document.addEventListener(
            "hokstation:feature-save-build-request",
            function (event) {
                saveBuild(
                    event.detail &&
                    event.detail.build
                );
            }
        );


        /*
         * Also accept the simpler event name in case
         * features.js dispatches it directly.
         */
        document.addEventListener(
            "hokstation:save-build-request",
            function (event) {
                saveBuild(
                    event.detail &&
                    event.detail.build
                );
            }
        );


        document.addEventListener(
            "hokstation:feature-favorite-request",
            function (event) {
                const detail =
                    event.detail || {};

                toggleFavorite(
                    detail.type ||
                    detail.itemType,
                    detail.id ||
                    detail.itemId
                );
            }
        );
    }


    /* =========================================================
       AUTH LISTENER
       ========================================================= */

    async function bindSupabaseAuth() {
        const client =
            await getClient();

        if (
            !client ||
            !client.auth ||
            typeof client.auth.onAuthStateChange !==
                "function"
        ) {
            return;
        }

        try {
            const listener =
                client.auth.onAuthStateChange(
                    function (
                        event,
                        session
                    ) {
                        /*
                         * Do not perform large async DB work
                         * directly inside Supabase's auth callback.
                         */
                        window.setTimeout(
                            function () {
                                handleAuthStateChange(
                                    event,
                                    session
                                );
                            },
                            0
                        );
                    }
                );

            if (
                listener &&
                listener.data &&
                listener.data.subscription
            ) {
                state.unsubscribers.push(
                    function () {
                        listener.data.subscription.unsubscribe();
                    }
                );
            }
        } catch (error) {
            console.warn(
                "[HoKStation Account] Auth listener failed:",
                error
            );
        }
    }


    /* =========================================================
       INITIALIZATION
       ========================================================= */

    async function initialize() {
        if (state.initialized) {
            return API;
        }

        state.initialized = true;

        bindAuthControls();
        bindProfileControls();
        bindSettingsControls();
        bindCommunityControls();
        bindFavoriteTabs();
        bindAdminControls();
        bindAppEvents();

        loadSettings();

        /*
         * Supabase may intentionally be unconfigured during
         * the front-end development phase.
         */
        if (isConfigured()) {
            await bindSupabaseAuth();
            await refreshAuthState();
        } else {
            updateAccountUI();
        }

        return API;
    }


    /* =========================================================
       PUBLIC API
       ========================================================= */

    const API = {

        init:
            initialize,

        isAuthenticated:
            isAuthenticated,

        isAdmin:
            isAdmin,

        isModeratorOrAdmin:
            isModeratorOrAdmin,

        getUser:
            function () {
                return state.user;
            },

        getSession:
            function () {
                return state.session;
            },

        getProfile:
            function () {
                return state.profile;
            },

        getRole:
            getRole,

        getDisplayName:
            getDisplayName,

        refreshAuthState:
            refreshAuthState,

        login:
            login,

        register:
            register,

        recoverPassword:
            recoverPassword,

        logout:
            logout,

        loadProfile:
            loadProfile,

        updateProfile:
            updateProfile,

        saveBuild:
            saveBuild,

        deleteBuild:
            deleteBuild,

        renderSavedBuilds:
            renderSavedBuilds,

        getFavorites:
            getFavorites,

        isFavorite:
            isFavorite,

        toggleFavorite:
            toggleFavorite,

        renderFavorites:
            renderFavorites,

        renderActivity:
            renderActivity,

        renderQuestions:
            renderQuestions,

        createQuestion:
            createQuestion,

        renderQuestionDetail:
            renderQuestionDetail,

        createReport:
            createReport,

        renderAdminPanel:
            renderAdminPanel,

        saveLanguage:
            saveLanguage,

        saveReducedMotion:
            saveReducedMotion
    };


    window.HOKSTATION_ACCOUNT =
        Object.freeze(API);


    /* =========================================================
       START
       ---------------------------------------------------------
       app.js fires app-ready after core initialization.
       We also initialize on DOMContentLoaded as a safe fallback.
       ========================================================= */

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            function () {
                initialize();
            },
            {
                once: true
            }
        );
    } else {
        initialize();
    }

})();
