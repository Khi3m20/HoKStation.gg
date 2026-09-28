/* =========================================================
   HOKSTATION.GG
   FILE 4 / 8 — config.js

   PURPOSE
   ---------------------------------------------------------
   Central configuration for HoKStation.gg.

   DEPENDENCY ORDER:
   1. config.js
   2. data.js
   3. app.js
   4. features.js
   5. account.js

   IMPORTANT:
   - HoKStation.gg is an independent project.
   - NOT an official Honor of Kings / Tencent website.
   - No WestJet branding or assets are used.
   - Never place a Supabase service-role key here.
   - Only the public Supabase URL + anon/publishable key
     belong in this client-side configuration.

   HTML SOURCE OF TRUTH:
   This file has been crosschecked against index.html.
   ========================================================= */


/* =========================================================
   SMALL INTERNAL HELPERS
   ========================================================= */

(function () {
    "use strict";

    function freezeArray(value) {
        return Object.freeze(Array.isArray(value) ? value : []);
    }

    function freezeObject(value) {
        return Object.freeze(value || {});
    }


    /* =======================================================
       MAIN CONFIGURATION
       ======================================================= */

    const CONFIG = {

        /* =====================================================
           SITE
           ===================================================== */

        site: freezeObject({

            name: "HoKStation.gg",

            shortName: "HoKStation",

            domain: "HoKStation.gg",

            title: "HoKStation.gg — Honor of Kings",

            description:
                "HoKStation.gg — A premium Honor of Kings community, hero, build and data platform.",

            environment: "production",

            version: "1.0.0",

            independentProject: true,

            officialAffiliation: false,

            officialTencentSite: false

        }),


        /* =====================================================
           BRAND
           -----------------------------------------------------
           Palette inspiration only.
           No external brand assets.
           ===================================================== */

        brand: freezeObject({

            symbol: "HS",

            name: "HoKStation",

            domain: ".gg",

            displayName: "HoKStation.gg",

            palette: freezeObject({

                darkNavy: "#071018",

                deepNavy: "#0A141E",

                navy: "#0E1C28",

                white: "#FFFFFF",

                red: "#E3263F",

                orange: "#FF8A24",

                gold: "#D8A94A",

                cyan: "#52D6E8",

                green: "#54D38A"

            })

        }),


        /* =====================================================
           SUPABASE
           ===================================================== */

        supabase: freezeObject({

            /*
             * PUT YOUR REAL PROJECT VALUES HERE LATER.
             *
             * Example:
             *
             * url: "https://your-project.supabase.co",
             * anonKey: "your-public-anon-or-publishable-key"
             *
             * NEVER put the service_role key here.
             */

            url: "https://skhwtswrrufhqijruybs.supabase.co",

            anonKey: "sb_publishable_WpqT3I-p4d_kfQj-JoHaKg_WS3xL-O7",

            clientVersion: "2",

            clientCdn:
                "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"

        }),


        /* =====================================================
           DATABASE TABLE MAP
           -----------------------------------------------------
           These names are the planned Supabase tables.
           They are NOT credentials.
           ===================================================== */

        database: freezeObject({

            profiles: "profiles",

            heroes: "heroes",

            equipment: "equipment",

            builds: "builds",

            favorites: "favorites",

            activity: "activity",

            questions: "questions",

            questionAnswers: "question_answers",

            reports: "reports",

            patches: "patches",

            changeLogs: "change_logs",

            rawSnapshots: "raw_snapshots",

            notices: "notices",

            meta: "meta",

            ads: "ads",

            tokenShops: "token_shops",

            adminLogs: "admin_logs",

            platformSettings: "platform_settings"

        }),


        /* =====================================================
           ROUTES
           -----------------------------------------------------
           Must match data-page values in index.html.
           ===================================================== */

        routes: freezeObject({

            home: "home",

            heroes: "heroes",

            heroDetail: "hero-detail",

            equipment: "equipment",

            builds: "builds",

            buildLab: "build-lab",

            compare: "compare",

            patches: "patches",

            dataHistory: "data-history",

            meta: "meta",

            favorites: "favorites",

            community: "community",

            questionDetail: "question-detail",

            profile: "profile",

            savedBuilds: "saved-builds",

            activity: "activity",

            settings: "settings",

            admin: "admin",

            notices: "notices",

            searchResults: "search-results"

        }),


        /* =====================================================
           MAIN NAVIGATION
           -----------------------------------------------------
           Must match the visible navigation in index.html.
           ===================================================== */

        navigation: freezeArray([

            "home",

            "heroes",

            "builds",

            "equipment",

            "compare",

            "patches",

            "community"

        ]),


        /* =====================================================
           LANGUAGES
           -----------------------------------------------------
           Matches the language selector in index.html.
           Korean intentionally excluded.
           ===================================================== */

        languages: freezeObject({

            en: "English",

            vi: "Tiếng Việt",

            zh: "中文",

            fr: "Français",

            ms: "Bahasa Melayu",

            id: "Bahasa Indonesia",

            fil: "Filipino",

            ja: "日本語",

            es: "Español"

        }),


        localization: freezeObject({

            defaultLanguage: "en",

            fallbackLanguage: "en",

            supportedLanguages: freezeArray([

                "en",

                "vi",

                "zh",

                "fr",

                "ms",

                "id",

                "fil",

                "ja",

                "es"

            ])

        }),


        /* =====================================================
           FEATURE FLAGS
           ===================================================== */

        features: freezeObject({

            heroes: true,

            heroDetails: true,

            equipment: true,

            builds: true,

            buildCalculator: true,

            compare: true,

            patches: true,

            dataHistory: true,

            metaTracker: true,

            notices: true,

            globalSearch: true,

            accounts: true,

            emailVerification: true,

            passwordRecovery: true,

            savedBuilds: true,

            favorites: true,

            activity: true,

            profile: true,

            settings: true,

            community: true,

            questions: true,

            reports: true,

            shareableBuilds: true,

            nativeShare: true,

            adminDashboard: true,

            adminDataSync: true,

            adminContent: true,

            adminUsers: true,

            adminAds: true,

            adminTokenShops: true,

            adminLogs: true,

            adminSettings: true,

            advertisements: true,

            officialTokenShops: true

        }),


        /* =====================================================
           DATA POLICY
           ===================================================== */

        dataPolicy: freezeObject({

            sourcePriority: freezeArray([

                "official-tencent",

                "official-honor-of-kings"

            ]),

            communityDataIsOfficialGameData: false,

            rawSnapshotRetention: 2,

            cleanupRawSnapshotsAutomatically: true,

            protectedDataSets: freezeArray([

                "live-data",

                "patch-history",

                "change-logs",

                "user-accounts",

                "community-questions",

                "community-answers"

            ]),

            neverAutoDelete: freezeArray([

                "live-data",

                "patch-history",

                "change-logs",

                "user-accounts",

                "community-questions",

                "community-answers"

            ])

        }),


        /* =====================================================
           OFFICIAL SOURCE CONFIGURATION
           -----------------------------------------------------
           URLs intentionally blank until verified.
           DO NOT invent source URLs.
           ===================================================== */

        officialSources: freezeObject({

            tencent: "",

            honorOfKings: "",

            patchNotes: "",

            officialNews: "",

            officialShopOne: "",

            officialShopTwo: ""

        }),


        /* =====================================================
           SEARCH
           -----------------------------------------------------
           Matches:
           all / heroes / equipment / builds / patches
           ===================================================== */

        search: freezeObject({

            defaultType: "all",

            supportedTypes: freezeArray([

                "all",

                "heroes",

                "equipment",

                "builds",

                "patches"

            ]),

            minimumQueryLength: 1,

            maximumQueryLength: 100,

            resultsPerCategory: 20,

            debounceMilliseconds: 180

        }),


        /* =====================================================
           HERO FILTERS
           -----------------------------------------------------
           Matches data-hero-role values in index.html.
           ===================================================== */

        heroFilters: freezeArray([

            "all",

            "clash",

            "jungle",

            "mid",

            "farm",

            "support"

        ]),


        heroSorting: freezeArray([

            "name",

            "role",

            "recent"

        ]),


        /* =====================================================
           EQUIPMENT FILTERS
           -----------------------------------------------------
           Matches data-equipment-type values.
           ===================================================== */

        equipmentFilters: freezeArray([

            "all",

            "attack",

            "magic",

            "defense",

            "movement",

            "roaming"

        ]),


        /* =====================================================
           BUILD CONFIGURATION
           -----------------------------------------------------
           index.html contains exactly 6 build slots.
           ===================================================== */

        builds: freezeObject({

            equipmentSlots: 6,

            maximumNameLength: 80,

            maximumDescriptionLength: 500,

            supportedStats: freezeArray([

                "hp",

                "physicalAttack",

                "magicAttack",

                "armor",

                "magicDefense",

                "movementSpeed"

            ]),

            shareable: true,

            saveRequiresAccount: true

        }),


        /* =====================================================
           COMMUNITY
           -----------------------------------------------------
           Matches question/report limits in index.html.
           ===================================================== */

        community: freezeObject({

            filters: freezeArray([

                "recent",

                "popular",

                "unanswered"

            ]),

            questionTitleMaximum: 120,

            questionBodyMaximum: 5000,

            reportDetailsMaximum: 3000,

            requiresAccountToPost: true,

            requiresAccountToReport: true

        }),


        /* =====================================================
           DATA HISTORY
           -----------------------------------------------------
           Matches the 3 history tabs in index.html.
           ===================================================== */

        history: freezeObject({

            tabs: freezeArray([

                "changes",

                "patches",

                "snapshots"

            ]),

            defaultTab: "changes",

            rawSnapshotsKept: 2

        }),


        /* =====================================================
           FAVORITES
           -----------------------------------------------------
           Matches the two favorite tabs.
           ===================================================== */

        favorites: freezeObject({

            tabs: freezeArray([

                "heroes",

                "builds"

            ]),

            defaultTab: "heroes"

        }),


        /* =====================================================
           ADMIN PANELS
           -----------------------------------------------------
           Matches all data-admin-panel values in index.html.
           ===================================================== */

        adminPanels: freezeArray([

            "sync",

            "content",

            "users",

            "ads",

            "token-shops",

            "logs",

            "settings"

        ]),


        /* =====================================================
           ROLES
           ===================================================== */

        roles: freezeArray([

            "user",

            "moderator",

            "admin"

        ]),


        /* =====================================================
           UI
           ===================================================== */

        ui: freezeObject({

            defaultReducedMotion: false,

            toastDurationMilliseconds: 4200,

            modalAnimationDurationMilliseconds: 240,

            panelAnimationDurationMilliseconds: 280,

            loadingMinimumDurationMilliseconds: 350,

            loadingMaximumDurationMilliseconds: 12000,

            searchDebounceMilliseconds: 180,

            scrollBehavior: "smooth"

        }),


        /* =====================================================
           FEATURED CAROUSEL
           -----------------------------------------------------
           index.html contains exactly 3 cards:
           0 = Hero Spotlight
           1 = Build Lab
           2 = Updates
           ===================================================== */

        carousel: freezeObject({

            totalSlides: 3,

            defaultIndex: 0,

            autoRotate: true,

            intervalMilliseconds: 7000,

            pauseOnInteraction: true,

            pauseOnHover: true

        }),


        /* =====================================================
           LOADER
           -----------------------------------------------------
           Matches:
           #app-loader
           #loader-status
           #loader-progress-bar
           ===================================================== */

        loader: freezeObject({

            initialStatus: "Loading station...",

            readyStatus: "Station ready.",

            errorStatus: "Station loaded with limited features.",

            minimumProgress: 0,

            maximumProgress: 100,

            minimumDisplayMilliseconds: 350,

            maximumWaitMilliseconds: 12000

        }),


        /* =====================================================
           SECURITY
           ----------------------------------------------------- */

        security: freezeObject({

            minimumPasswordLength: 8,

            maximumDisplayNameLength: 40,

            maximumBioLength: 300,

            clientSideAdminChecksAreAuthorization: false,

            requireServerSideAdminAuthorization: true,

            allowServiceRoleKeyInBrowser: false

        }),


        /* =====================================================
           STORAGE
           -----------------------------------------------------
           Only UI preferences/cache should be managed manually.
           Supabase Auth handles its own authentication session.
           ===================================================== */

        storage: freezeObject({

            languageKey: "hokstation-language",

            reducedMotionKey: "hokstation-reduced-motion",

            cachePrefix: "hokstation-cache",

            buildDraftKey: "hokstation-build-draft",

            searchPreferencesKey: "hokstation-search-preferences"

        }),


        /* =====================================================
           NETWORK / REQUEST TIMING
           ===================================================== */

        timeouts: freezeObject({

            requestMilliseconds: 15000,

            authMilliseconds: 15000,

            searchDebounceMilliseconds: 180,

            toastMilliseconds: 4200

        }),


        /* =====================================================
           DEBUG
           ===================================================== */

        debug: freezeObject({

            enabled: false,

            logConfigWarnings: true,

            logDataRequests: false,

            logNavigation: false

        })

    };


    /* =========================================================
       FREEZE TOP-LEVEL CONFIG
       ========================================================= */

    window.HOKSTATION_CONFIG = Object.freeze(CONFIG);


    /* =========================================================
       SUPABASE CLIENT LOADER
       ---------------------------------------------------------
       Supabase JS is loaded only when needed.

       HTML DOES NOT need another CDN script.

       The public anon/publishable key is safe to expose in
       a browser when Row Level Security is correctly configured.

       NEVER use a service_role key here.
       ========================================================= */

    window.HoKStationSupabase = (function () {

        let clientPromise = null;

        let clientInstance = null;


        /* =====================================================
           CHECK CONFIGURATION
           ===================================================== */

        function isConfigured() {

            const supabaseConfig =
                window.HOKSTATION_CONFIG.supabase;

            return Boolean(

                supabaseConfig &&

                typeof supabaseConfig.url === "string" &&

                supabaseConfig.url.trim() !== "" &&

                typeof supabaseConfig.anonKey === "string" &&

                supabaseConfig.anonKey.trim() !== ""

            );

        }


        /* =====================================================
           VALIDATE CONFIGURATION
           ===================================================== */

        function validateConfig() {

            const supabaseConfig =
                window.HOKSTATION_CONFIG.supabase;

            if (!supabaseConfig) {

                throw new Error(
                    "HoKStation Supabase configuration is missing."
                );

            }


            if (
                typeof supabaseConfig.url !== "string" ||
                !supabaseConfig.url.trim()
            ) {

                throw new Error(
                    "Supabase URL is not configured."
                );

            }


            if (
                typeof supabaseConfig.anonKey !== "string" ||
                !supabaseConfig.anonKey.trim()
            ) {

                throw new Error(
                    "Supabase anon/publishable key is not configured."
                );

            }


            if (
                supabaseConfig.anonKey.includes("service_role")
            ) {

                throw new Error(
                    "A Supabase service-role key must never be used in the browser."
                );

            }

        }


        /* =====================================================
           LOAD SUPABASE JS
           ===================================================== */

        function loadScript() {

            return new Promise(function (resolve, reject) {

                if (
                    window.supabase &&
                    typeof window.supabase.createClient === "function"
                ) {

                    resolve();

                    return;

                }


                const existingScript =
                    document.querySelector(
                        'script[data-hokstation-supabase="true"]'
                    );


                if (existingScript) {

                    existingScript.addEventListener(
                        "load",
                        function () {
                            resolve();
                        },
                        { once: true }
                    );


                    existingScript.addEventListener(
                        "error",
                        function () {

                            reject(
                                new Error(
                                    "Failed to load Supabase JS."
                                )
                            );

                        },
                        { once: true }
                    );

                    return;

                }


                const script =
                    document.createElement("script");


                script.src =
                    window.HOKSTATION_CONFIG.supabase.clientCdn;


                script.async = true;


                script.dataset.hokstationSupabase =
                    "true";


                script.onload = function () {

                    if (
                        window.supabase &&
                        typeof window.supabase.createClient ===
                            "function"
                    ) {

                        resolve();

                    } else {

                        reject(
                            new Error(
                                "Supabase JS loaded but createClient is unavailable."
                            )
                        );

                    }

                };


                script.onerror = function () {

                    reject(
                        new Error(
                            "Unable to load Supabase JS."
                        )
                    );

                };


                document.head.appendChild(script);

            });

        }


        /* =====================================================
           GET CLIENT
           ===================================================== */

        async function getClient() {

            if (clientInstance) {

                return clientInstance;

            }


            if (clientPromise) {

                return clientPromise;

            }


            clientPromise = (async function () {

                validateConfig();

                await loadScript();


                if (
                    !window.supabase ||
                    typeof window.supabase.createClient !==
                        "function"
                ) {

                    throw new Error(
                        "Supabase client library is unavailable."
                    );

                }


                const supabaseConfig =
                    window.HOKSTATION_CONFIG.supabase;


                clientInstance =
                    window.supabase.createClient(

                        supabaseConfig.url.trim(),

                        supabaseConfig.anonKey.trim(),

                        {

                            auth: {

                                persistSession: true,

                                autoRefreshToken: true,

                                detectSessionInUrl: true

                            }

                        }

                    );


                return clientInstance;

            })();


            try {

                return await clientPromise;

            } catch (error) {

                clientPromise = null;

                clientInstance = null;

                throw error;

            }

        }


        /* =====================================================
           RESET CLIENT
           -----------------------------------------------------
           Mainly useful for development/testing.
           ===================================================== */

        function resetClient() {

            clientPromise = null;

            clientInstance = null;

        }


        return Object.freeze({

            isConfigured,

            getClient,

            resetClient

        });

    })();


    /* =========================================================
       OPTIONAL GLOBAL HELPERS
       ---------------------------------------------------------
       These do NOT touch the DOM.
       They simply expose safe config checks for other scripts.
       ========================================================= */

    window.HoKStationConfig = Object.freeze({

        get: function () {

            return window.HOKSTATION_CONFIG;

        },


        isSupabaseConfigured: function () {

            return window.HoKStationSupabase.isConfigured();

        },


        getRoute: function (routeName) {

            const routes =
                window.HOKSTATION_CONFIG.routes;

            return routes[routeName] || null;

        },


        isFeatureEnabled: function (featureName) {

            const features =
                window.HOKSTATION_CONFIG.features;

            return features[featureName] === true;

        },


        getLanguageName: function (languageCode) {

            const languages =
                window.HOKSTATION_CONFIG.languages;

            return languages[languageCode] || null;

        }

    });


})();
