/* =========================================================
   HOKSTATION.GG
   FILE 5 / 8 — data.js

   PURPOSE
   ---------------------------------------------------------
   HoKStation data layer.

   Responsibilities:
   - Hero data
   - Equipment data
   - Build data
   - Patch history
   - Change logs
   - Raw update snapshots
   - Meta tracking
   - Notices
   - Search
   - Filtering / sorting
   - Data normalization
   - Data freshness
   - Build-stat calculation
   - Supabase data loading
   - Shared data API for app.js / features.js

   SOURCE OF TRUTH
   ---------------------------------------------------------
   index.html

   IMPORTANT:
   - No fake/test game data is included.
   - Official game data should come from verified sources.
   - Supabase frontend must use only the public anon key.
   - NEVER place a Supabase service-role key in this file.
   - This file does not own authentication.
   - Account/community ownership belongs to account.js.
   - UI rendering belongs primarily to app.js / features.js.
   ========================================================= */

(function () {
    "use strict";

    /* =========================================================
       GLOBAL GUARD
       ========================================================= */

    if (window.HOKSTATION_DATA) {
        return;
    }


    /* =========================================================
       CONSTANTS
       ========================================================= */

    const VERSION = "1.0.0";

    const COLLECTIONS = Object.freeze([
        "heroes",
        "equipment",
        "builds",
        "patches",
        "changeLogs",
        "rawSnapshots",
        "meta",
        "notices"
    ]);

    const SEARCH_TYPES = Object.freeze([
        "all",
        "heroes",
        "equipment",
        "builds",
        "patches"
    ]);

    const HERO_ROLES = Object.freeze([
        "all",
        "clash",
        "jungle",
        "mid",
        "farm",
        "support"
    ]);

    const EQUIPMENT_TYPES = Object.freeze([
        "all",
        "attack",
        "magic",
        "defense",
        "movement",
        "roaming"
    ]);

    const HERO_SORTS = Object.freeze([
        "name",
        "role",
        "recent"
    ]);

    const HISTORY_TYPES = Object.freeze([
        "changes",
        "patches",
        "snapshots"
    ]);

    const META_ROLES = Object.freeze([
        "clash",
        "jungle",
        "mid",
        "farm",
        "support"
    ]);

    const BUILD_MAX_SLOTS = 6;

    const BUILD_STATS = Object.freeze([
        "hp",
        "physicalAttack",
        "magicAttack",
        "armor",
        "magicDefense",
        "movementSpeed"
    ]);

    const BUILD_LIMITS = Object.freeze({
        name: 80,
        description: 500
    });


    /* =========================================================
       DEFAULT TABLE NAMES
       ---------------------------------------------------------
       These match the planned Supabase schema from config.js.
       If config.js provides different names, those names win.
       ========================================================= */

    const DEFAULT_TABLES = Object.freeze({
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
        rawSnapshots: "raw_update_snapshots",
        notices: "notices",
        meta: "meta_tracker",
        advertisements: "advertisements",
        tokenShops: "token_shops",
        adminLogs: "admin_logs",
        platformSettings: "platform_settings"
    });


    /* =========================================================
       DATA STATE
       ---------------------------------------------------------
       Empty by design.
       No fabricated HoK data.
       ========================================================= */

    const state = {
        heroes: [],
        equipment: [],
        builds: [],
        patches: [],
        changeLogs: [],
        rawSnapshots: [],
        meta: [],
        notices: [],

        initialized: false,
        loading: false,

        status: "not-configured",

        lastUpdated: null,
        lastVerified: null,

        source: null,
        sourceLabel: null,

        error: null,

        currentHeroRole: "all",
        currentHeroSort: "name",
        currentEquipmentType: "all",

        currentHistoryTab: "changes",

        currentSearchType: "all",
        currentSearchQuery: "",

        revision: 0
    };


    /* =========================================================
       SUBSCRIBERS
       ========================================================= */

    const subscribers = new Set();


    /* =========================================================
       UTILITY HELPERS
       ========================================================= */

    function isObject(value) {
        return (
            value !== null &&
            typeof value === "object" &&
            !Array.isArray(value)
        );
    }


    function isArray(value) {
        return Array.isArray(value);
    }


    function cleanString(value, fallback = "") {
        if (value === null || value === undefined) {
            return fallback;
        }

        return String(value).trim();
    }


    function nullableString(value) {
        const result = cleanString(value);
        return result || null;
    }


    function toNumber(value, fallback = 0) {
        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return fallback;
        }

        const number = Number(value);

        return Number.isFinite(number)
            ? number
            : fallback;
    }


    function toNullableNumber(value) {
        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return null;
        }

        const number = Number(value);

        return Number.isFinite(number)
            ? number
            : null;
    }


    function toBoolean(value, fallback = false) {
        if (typeof value === "boolean") {
            return value;
        }

        if (typeof value === "number") {
            return value !== 0;
        }

        if (typeof value === "string") {
            const normalized = value.trim().toLowerCase();

            if (
                normalized === "true" ||
                normalized === "1" ||
                normalized === "yes"
            ) {
                return true;
            }

            if (
                normalized === "false" ||
                normalized === "0" ||
                normalized === "no"
            ) {
                return false;
            }
        }

        return fallback;
    }


    function normalizeArray(value) {
        if (Array.isArray(value)) {
            return value;
        }

        if (typeof value === "string") {
            try {
                const parsed = JSON.parse(value);

                return Array.isArray(parsed)
                    ? parsed
                    : [];
            } catch {
                return value
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean);
            }
        }

        return [];
    }


    function normalizeDate(value) {
        if (!value) {
            return null;
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return null;
        }

        return date.toISOString();
    }


    function getField(object, keys, fallback = undefined) {
        if (!isObject(object)) {
            return fallback;
        }

        for (const key of keys) {
            if (
                Object.prototype.hasOwnProperty.call(
                    object,
                    key
                ) &&
                object[key] !== undefined &&
                object[key] !== null
            ) {
                return object[key];
            }
        }

        return fallback;
    }


    function getId(object) {
        return cleanString(
            getField(object, [
                "id",
                "uuid",
                "hero_id",
                "equipment_id",
                "build_id",
                "patch_id",
                "notice_id",
                "slug"
            ])
        );
    }


    function getSlug(object) {
        return cleanString(
            getField(object, [
                "slug",
                "hero_slug",
                "equipment_slug",
                "build_slug",
                "patch_slug"
            ])
        );
    }


    function createSearchText(values) {
        return values
            .filter(
                (value) =>
                    value !== null &&
                    value !== undefined
            )
            .map((value) => String(value))
            .join(" ")
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim();
    }


    function clone(value) {
        if (value === null || value === undefined) {
            return value;
        }

        try {
            return structuredClone(value);
        } catch {
            return JSON.parse(JSON.stringify(value));
        }
    }


    function sortByText(a, b) {
        return String(a || "").localeCompare(
            String(b || ""),
            undefined,
            {
                sensitivity: "base"
            }
        );
    }


    function sortByDateDescending(a, b) {
        const first = Date.parse(a || "") || 0;
        const second = Date.parse(b || "") || 0;

        return second - first;
    }


    function uniqueById(items) {
        const map = new Map();

        for (const item of items) {
            const id = getId(item);

            if (!id) {
                continue;
            }

            map.set(id, item);
        }

        return Array.from(map.values());
    }


    function emit(eventName = "change", payload = {}) {
        state.revision += 1;

        const event = {
            name: eventName,
            payload,
            revision: state.revision,
            timestamp: new Date().toISOString()
        };

        subscribers.forEach((listener) => {
            try {
                listener(event, getState());
            } catch (error) {
                console.error(
                    "[HoKStation Data] Subscriber error:",
                    error
                );
            }
        });

        window.dispatchEvent(
            new CustomEvent(
                "hokstation:data",
                {
                    detail: event
                }
            )
        );
    }


    /* =========================================================
       CONFIG HELPERS
       ========================================================= */

    function getConfig() {
        return window.HOKSTATION_CONFIG || {};
    }


    function getConfigSection(section, fallback = {}) {
        const config = getConfig();

        if (
            isObject(config) &&
            isObject(config[section])
        ) {
            return config[section];
        }

        return fallback;
    }


    function getTableName(collection) {
        const config = getConfig();

        const configuredTables =
            getConfigSection(
                "database",
                {}
            ).tables ||
            getConfigSection(
                "tables",
                {}
            );

        const configKeyMap = {
            heroes: "heroes",
            equipment: "equipment",
            builds: "builds",
            patches: "patches",
            changeLogs: "changeLogs",
            rawSnapshots: "rawSnapshots",
            meta: "meta",
            notices: "notices"
        };

        const key = configKeyMap[collection];

        if (
            key &&
            configuredTables &&
            configuredTables[key]
        ) {
            return configuredTables[key];
        }

        return DEFAULT_TABLES[
            key || collection
        ] || collection;
    }


    /* =========================================================
       SUPABASE CLIENT
       ========================================================= */

    let supabaseClientPromise = null;


    function getExistingSupabaseClient() {
        const config = getConfig();

        const candidates = [
            config.supabaseClient,
            config.client,
            config.runtime &&
                config.runtime.supabaseClient
        ];

        for (const candidate of candidates) {
            if (
                candidate &&
                typeof candidate.from === "function"
            ) {
                return candidate;
            }
        }

        if (
            window.supabase &&
            typeof window.supabase.from === "function"
        ) {
            return window.supabase;
        }

        return null;
    }


    function getSupabaseCredentials() {
        const config = getConfig();

        const supabaseConfig =
            getConfigSection(
                "supabase",
                {}
            );

        const url =
            cleanString(
                supabaseConfig.url ||
                config.supabaseUrl ||
                ""
            );

        const anonKey =
            cleanString(
                supabaseConfig.anonKey ||
                supabaseConfig.key ||
                config.supabaseAnonKey ||
                config.anonKey ||
                ""
            );

        return {
            url,
            anonKey
        };
    }


    async function loadSupabaseLibrary() {
        if (
            window.supabase &&
            typeof window.supabase.createClient ===
                "function"
        ) {
            return window.supabase;
        }

        const config = getConfig();

        const supabaseConfig =
            getConfigSection(
                "supabase",
                {}
            );

        const cdn =
            cleanString(
                supabaseConfig.clientCdn ||
                config.supabaseClientCdn ||
                "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"
            );

        if (!cdn) {
            return null;
        }

        return new Promise((resolve, reject) => {
            const existingScript =
                document.querySelector(
                    `script[data-hokstation-supabase="true"]`
                );

            if (existingScript) {
                existingScript.addEventListener(
                    "load",
                    () => {
                        resolve(
                            window.supabase || null
                        );
                    },
                    {
                        once: true
                    }
                );

                existingScript.addEventListener(
                    "error",
                    () => {
                        reject(
                            new Error(
                                "Supabase library failed to load."
                            )
                        );
                    },
                    {
                        once: true
                    }
                );

                return;
            }

            const script =
                document.createElement("script");

            script.src = cdn;
            script.async = true;
            script.dataset.hokstationSupabase =
                "true";

            script.onload = () => {
                if (
                    window.supabase &&
                    typeof window.supabase.createClient ===
                        "function"
                ) {
                    resolve(window.supabase);
                } else {
                    reject(
                        new Error(
                            "Supabase library loaded without createClient."
                        )
                    );
                }
            };

            script.onerror = () => {
                reject(
                    new Error(
                        "Unable to load Supabase client."
                    )
                );
            };

            document.head.appendChild(script);
        });
    }


    async function getSupabaseClient() {
        const existing =
            getExistingSupabaseClient();

        if (existing) {
            return existing;
        }

        if (supabaseClientPromise) {
            return supabaseClientPromise;
        }

        supabaseClientPromise =
            (async () => {
                const credentials =
                    getSupabaseCredentials();

                if (
                    !credentials.url ||
                    !credentials.anonKey
                ) {
                    return null;
                }

                const library =
                    await loadSupabaseLibrary();

                if (
                    !library ||
                    typeof library.createClient !==
                        "function"
                ) {
                    return null;
                }

                return library.createClient(
                    credentials.url,
                    credentials.anonKey
                );
            })().catch((error) => {
                supabaseClientPromise = null;

                console.error(
                    "[HoKStation Data] Supabase client error:",
                    error
                );

                return null;
            });

        return supabaseClientPromise;
    }


    /* =========================================================
       NORMALIZE HERO
       ---------------------------------------------------------
       Supports common Supabase snake_case + camelCase names.
       ========================================================= */

    function normalizeHero(row) {
        const source = isObject(row)
            ? row
            : {};

        const baseStats =
            isObject(
                getField(source, [
                    "base_stats",
                    "baseStats",
                    "stats"
                ], {})
            )
                ? getField(source, [
                    "base_stats",
                    "baseStats",
                    "stats"
                ], {})
                : {};

        const physicalAttack = toNumber(
            getField(
                source,
                [
                    "physical_attack",
                    "physicalAttack"
                ],
                getField(
                    baseStats,
                    [
                        "physical_attack",
                        "physicalAttack"
                    ],
                    0
                )
            )
        );

        const magicAttack = toNumber(
            getField(
                source,
                [
                    "magic_attack",
                    "magicAttack"
                ],
                getField(
                    baseStats,
                    [
                        "magic_attack",
                        "magicAttack"
                    ],
                    0
                )
            )
        );

        const hp = toNumber(
            getField(
                source,
                [
                    "hp",
                    "health",
                    "health_points"
                ],
                getField(
                    baseStats,
                    [
                        "hp",
                        "health",
                        "health_points"
                    ],
                    0
                )
            )
        );

        const armor = toNumber(
            getField(
                source,
                [
                    "armor",
                    "physical_defense"
                ],
                getField(
                    baseStats,
                    [
                        "armor",
                        "physical_defense"
                    ],
                    0
                )
            )
        );

        const magicDefense = toNumber(
            getField(
                source,
                [
                    "magic_defense",
                    "magicDefense",
                    "magic_resistance"
                ],
                getField(
                    baseStats,
                    [
                        "magic_defense",
                        "magicDefense",
                        "magic_resistance"
                    ],
                    0
                )
            )
        );

        const movementSpeed = toNumber(
            getField(
                source,
                [
                    "movement_speed",
                    "movementSpeed",
                    "move_speed"
                ],
                getField(
                    baseStats,
                    [
                        "movement_speed",
                        "movementSpeed",
                        "move_speed"
                    ],
                    0
                )
            )
        );

        const roles = normalizeArray(
            getField(source, [
                "roles",
                "role"
            ], [])
        ).map((role) =>
            cleanString(role).toLowerCase()
        );

        const abilities = normalizeArray(
            getField(source, [
                "abilities",
                "skills"
            ], [])
        );

        const strategy = cleanString(
            getField(source, [
                "strategy",
                "play_style",
                "playStyle"
            ])
        );

        const description = cleanString(
            getField(source, [
                "description",
                "bio",
                "short_bio"
            ])
        );

        const normalized = {
            id: getId(source),
            slug: getSlug(source),

            name: cleanString(
                getField(source, [
                    "name",
                    "hero_name",
                    "display_name"
                ])
            ),

            localizedNames:
                getField(source, [
                    "localized_names",
                    "localizedNames",
                    "translations"
                ], {}),

            roles,

            primaryRole:
                cleanString(
                    getField(source, [
                        "primary_role",
                        "primaryRole"
                    ], roles[0] || "")
                ).toLowerCase(),

            description,

            shortBio:
                cleanString(
                    getField(source, [
                        "short_bio",
                        "shortBio"
                    ], description)
                ),

            strategy,

            abilities,

            difficulty:
                cleanString(
                    getField(source, [
                        "difficulty"
                    ])
                ),

            imageUrl:
                nullableString(
                    getField(source, [
                        "image_url",
                        "imageUrl",
                        "portrait_url",
                        "portraitUrl"
                    ])
                ),

            splashUrl:
                nullableString(
                    getField(source, [
                        "splash_url",
                        "splashUrl",
                        "art_url",
                        "artUrl"
                    ])
                ),

            iconUrl:
                nullableString(
                    getField(source, [
                        "icon_url",
                        "iconUrl"
                    ])
                ),

            stats: {
                hp,
                physicalAttack,
                magicAttack,
                armor,
                magicDefense,
                movementSpeed
            },

            updatedAt:
                normalizeDate(
                    getField(source, [
                        "updated_at",
                        "updatedAt",
                        "last_updated",
                        "lastUpdated"
                    ])
                ),

            createdAt:
                normalizeDate(
                    getField(source, [
                        "created_at",
                        "createdAt"
                    ])
                ),

            verified:
                toBoolean(
                    getField(source, [
                        "verified",
                        "is_verified",
                        "isVerified"
                    ]),
                    false
                ),

            source:
                cleanString(
                    getField(source, [
                        "source",
                        "source_name"
                    ])
                ),

            sourceUrl:
                nullableString(
                    getField(source, [
                        "source_url",
                        "sourceUrl"
                    ])
                )
        };

        normalized.searchText =
            createSearchText([
                normalized.name,
                normalized.slug,
                normalized.description,
                normalized.strategy,
                normalized.primaryRole,
                normalized.roles.join(" ")
            ]);

        return normalized;
    }


    /* =========================================================
       NORMALIZE EQUIPMENT
       ========================================================= */

    function normalizeEquipment(row) {
        const source = isObject(row)
            ? row
            : {};

        const stats =
            isObject(
                getField(source, [
                    "stats",
                    "attributes"
                ], {})
            )
                ? getField(source, [
                    "stats",
                    "attributes"
                ], {})
                : {};

        const normalized = {
            id: getId(source),
            slug: getSlug(source),

            name: cleanString(
                getField(source, [
                    "name",
                    "equipment_name",
                    "display_name"
                ])
            ),

            localizedNames:
                getField(source, [
                    "localized_names",
                    "localizedNames",
                    "translations"
                ], {}),

            type:
                cleanString(
                    getField(source, [
                        "type",
                        "equipment_type",
                        "category"
                    ])
                ).toLowerCase(),

            subType:
                cleanString(
                    getField(source, [
                        "sub_type",
                        "subType"
                    ])
                ).toLowerCase(),

            description:
                cleanString(
                    getField(source, [
                        "description",
                        "effect_description",
                        "effectDescription"
                    ])
                ),

            cost: toNullableNumber(
                getField(source, [
                    "cost",
                    "price",
                    "gold"
                ])
            ),

            sellPrice: toNullableNumber(
                getField(source, [
                    "sell_price",
                    "sellPrice"
                ])
            ),

            stats: {
                hp: toNumber(
                    getField(
                        source,
                        ["hp", "health"],
                        getField(
                            stats,
                            ["hp", "health"],
                            0
                        )
                    )
                ),

                physicalAttack: toNumber(
                    getField(
                        source,
                        [
                            "physical_attack",
                            "physicalAttack"
                        ],
                        getField(
                            stats,
                            [
                                "physical_attack",
                                "physicalAttack"
                            ],
                            0
                        )
                    )
                ),

                magicAttack: toNumber(
                    getField(
                        source,
                        [
                            "magic_attack",
                            "magicAttack"
                        ],
                        getField(
                            stats,
                            [
                                "magic_attack",
                                "magicAttack"
                            ],
                            0
                        )
                    )
                ),

                armor: toNumber(
                    getField(
                        source,
                        [
                            "armor",
                            "physical_defense"
                        ],
                        getField(
                            stats,
                            [
                                "armor",
                                "physical_defense"
                            ],
                            0
                        )
                    )
                ),

                magicDefense: toNumber(
                    getField(
                        source,
                        [
                            "magic_defense",
                            "magicDefense"
                        ],
                        getField(
                            stats,
                            [
                                "magic_defense",
                                "magicDefense"
                            ],
                            0
                        )
                    )
                ),

                movementSpeed: toNumber(
                    getField(
                        source,
                        [
                            "movement_speed",
                            "movementSpeed",
                            "move_speed"
                        ],
                        getField(
                            stats,
                            [
                                "movement_speed",
                                "movementSpeed",
                                "move_speed"
                            ],
                            0
                        )
                    )
                )
            },

            passive:
                cleanString(
                    getField(source, [
                        "passive",
                        "passive_effect",
                        "passiveEffect"
                    ])
                ),

            active:
                cleanString(
                    getField(source, [
                        "active",
                        "active_effect",
                        "activeEffect"
                    ])
                ),

            imageUrl:
                nullableString(
                    getField(source, [
                        "image_url",
                        "imageUrl",
                        "icon_url",
                        "iconUrl"
                    ])
                ),

            updatedAt:
                normalizeDate(
                    getField(source, [
                        "updated_at",
                        "updatedAt",
                        "last_updated",
                        "lastUpdated"
                    ])
                ),

            createdAt:
                normalizeDate(
                    getField(source, [
                        "created_at",
                        "createdAt"
                    ])
                ),

            verified:
                toBoolean(
                    getField(source, [
                        "verified",
                        "is_verified",
                        "isVerified"
                    ]),
                    false
                ),

            source:
                cleanString(
                    getField(source, [
                        "source",
                        "source_name"
                    ])
                ),

            sourceUrl:
                nullableString(
                    getField(source, [
                        "source_url",
                        "sourceUrl"
                    ])
                )
        };

        normalized.searchText =
            createSearchText([
                normalized.name,
                normalized.slug,
                normalized.type,
                normalized.subType,
                normalized.description,
                normalized.passive,
                normalized.active
            ]);

        return normalized;
    }


    /* =========================================================
       NORMALIZE BUILD
       ========================================================= */

    function normalizeBuild(row) {
        const source = isObject(row)
            ? row
            : {};

        const equipmentIds =
            normalizeArray(
                getField(source, [
                    "equipment_ids",
                    "equipmentIds",
                    "items",
                    "item_ids",
                    "itemIds"
                ], [])
            )
                .map((item) => {
                    if (isObject(item)) {
                        return getId(item);
                    }

                    return cleanString(item);
                })
                .filter(Boolean)
                .slice(0, BUILD_MAX_SLOTS);

        const stats =
            isObject(
                getField(source, [
                    "stats",
                    "calculated_stats",
                    "calculatedStats"
                ], {})
            )
                ? getField(source, [
                    "stats",
                    "calculated_stats",
                    "calculatedStats"
                ], {})
                : {};

        const normalized = {
            id: getId(source),
            slug: getSlug(source),

            name:
                cleanString(
                    getField(source, [
                        "name",
                        "build_name",
                        "title"
                    ]),
                    "Untitled Build"
                ).slice(
                    0,
                    BUILD_LIMITS.name
                ),

            description:
                cleanString(
                    getField(source, [
                        "description",
                        "build_description"
                    ])
                ).slice(
                    0,
                    BUILD_LIMITS.description
                ),

            heroId:
                cleanString(
                    getField(source, [
                        "hero_id",
                        "heroId"
                    ])
                ),

            heroSlug:
                cleanString(
                    getField(source, [
                        "hero_slug",
                        "heroSlug"
                    ])
                ),

            equipmentIds,

            stats: {
                hp: toNumber(
                    getField(
                        stats,
                        ["hp"],
                        getField(
                            source,
                            ["hp"],
                            0
                        )
                    )
                ),

                physicalAttack: toNumber(
                    getField(
                        stats,
                        [
                            "physical_attack",
                            "physicalAttack"
                        ],
                        getField(
                            source,
                            [
                                "physical_attack",
                                "physicalAttack"
                            ],
                            0
                        )
                    )
                ),

                magicAttack: toNumber(
                    getField(
                        stats,
                        [
                            "magic_attack",
                            "magicAttack"
                        ],
                        getField(
                            source,
                            [
                                "magic_attack",
                                "magicAttack"
                            ],
                            0
                        )
                    )
                ),

                armor: toNumber(
                    getField(
                        stats,
                        ["armor"],
                        getField(
                            source,
                            ["armor"],
                            0
                        )
                    )
                ),

                magicDefense: toNumber(
                    getField(
                        stats,
                        [
                            "magic_defense",
                            "magicDefense"
                        ],
                        getField(
                            source,
                            [
                                "magic_defense",
                                "magicDefense"
                            ],
                            0
                        )
                    )
                ),

                movementSpeed: toNumber(
                    getField(
                        stats,
                        [
                            "movement_speed",
                            "movementSpeed"
                        ],
                        getField(
                            source,
                            [
                                "movement_speed",
                                "movementSpeed"
                            ],
                            0
                        )
                    )
                )
            },

            authorId:
                cleanString(
                    getField(source, [
                        "author_id",
                        "authorId",
                        "user_id",
                        "userId"
                    ])
                ),

            authorName:
                cleanString(
                    getField(source, [
                        "author_name",
                        "authorName",
                        "display_name",
                        "displayName"
                    ])
                ),

            isRecommended:
                toBoolean(
                    getField(source, [
                        "is_recommended",
                        "isRecommended",
                        "recommended"
                    ]),
                    false
                ),

            isPublished:
                toBoolean(
                    getField(source, [
                        "is_published",
                        "isPublished",
                        "published"
                    ]),
                    true
                ),

            updatedAt:
                normalizeDate(
                    getField(source, [
                        "updated_at",
                        "updatedAt",
                        "last_updated",
                        "lastUpdated"
                    ])
                ),

            createdAt:
                normalizeDate(
                    getField(source, [
                        "created_at",
                        "createdAt"
                    ])
                ),

            verified:
                toBoolean(
                    getField(source, [
                        "verified",
                        "is_verified",
                        "isVerified"
                    ]),
                    false
                ),

            source:
                cleanString(
                    getField(source, [
                        "source",
                        "source_name"
                    ])
                )
        };

        normalized.searchText =
            createSearchText([
                normalized.name,
                normalized.description,
                normalized.heroId,
                normalized.heroSlug,
                normalized.authorName,
                normalized.equipmentIds.join(" ")
            ]);

        return normalized;
    }


    /* =========================================================
       NORMALIZE PATCH
       ========================================================= */

    function normalizePatch(row) {
        const source = isObject(row)
            ? row
            : {};

        const changes =
            normalizeArray(
                getField(source, [
                    "changes",
                    "change_list",
                    "changeList"
                ], [])
            );

        const normalized = {
            id: getId(source),
            slug: getSlug(source),

            version:
                cleanString(
                    getField(source, [
                        "version",
                        "patch_version",
                        "patchVersion"
                    ])
                ),

            title:
                cleanString(
                    getField(source, [
                        "title",
                        "name"
                    ])
                ),

            summary:
                cleanString(
                    getField(source, [
                        "summary",
                        "description"
                    ])
                ),

            content:
                cleanString(
                    getField(source, [
                        "content",
                        "body"
                    ])
                ),

            releaseDate:
                normalizeDate(
                    getField(source, [
                        "release_date",
                        "releaseDate",
                        "published_at",
                        "publishedAt"
                    ])
                ),

            official:
                toBoolean(
                    getField(source, [
                        "official",
                        "is_official",
                        "isOfficial"
                    ]),
                    false
                ),

            source:
                cleanString(
                    getField(source, [
                        "source",
                        "source_name"
                    ])
                ),

            sourceUrl:
                nullableString(
                    getField(source, [
                        "source_url",
                        "sourceUrl"
                    ])
                ),

            changes,

            updatedAt:
                normalizeDate(
                    getField(source, [
                        "updated_at",
                        "updatedAt"
                    ])
                )
        };

        normalized.searchText =
            createSearchText([
                normalized.version,
                normalized.title,
                normalized.summary,
                normalized.content,
                normalized.source
            ]);

        return normalized;
    }


    /* =========================================================
       NORMALIZE CHANGE LOG
       ========================================================= */

    function normalizeChangeLog(row) {
        const source = isObject(row)
            ? row
            : {};

        const normalized = {
            id: getId(source),

            entityType:
                cleanString(
                    getField(source, [
                        "entity_type",
                        "entityType",
                        "type"
                    ])
                ),

            entityId:
                cleanString(
                    getField(source, [
                        "entity_id",
                        "entityId"
                    ])
                ),

            action:
                cleanString(
                    getField(source, [
                        "action",
                        "change_type",
                        "changeType"
                    ])
                ),

            summary:
                cleanString(
                    getField(source, [
                        "summary",
                        "description",
                        "message"
                    ])
                ),

            before:
                getField(source, [
                    "before",
                    "old_data",
                    "oldData"
                ], null),

            after:
                getField(source, [
                    "after",
                    "new_data",
                    "newData"
                ], null),

            changedBy:
                cleanString(
                    getField(source, [
                        "changed_by",
                        "changedBy",
                        "user_id",
                        "userId"
                    ])
                ),

            verified:
                toBoolean(
                    getField(source, [
                        "verified",
                        "is_verified",
                        "isVerified"
                    ]),
                    false
                ),

            createdAt:
                normalizeDate(
                    getField(source, [
                        "created_at",
                        "createdAt",
                        "changed_at",
                        "changedAt"
                    ])
                )
        };

        normalized.searchText =
            createSearchText([
                normalized.entityType,
                normalized.entityId,
                normalized.action,
                normalized.summary
            ]);

        return normalized;
    }


    /* =========================================================
       NORMALIZE RAW SNAPSHOT
       ========================================================= */

    function normalizeSnapshot(row) {
        const source = isObject(row)
            ? row
            : {};

        return {
            id: getId(source),

            snapshotVersion:
                cleanString(
                    getField(source, [
                        "snapshot_version",
                        "snapshotVersion",
                        "version"
                    ])
                ),

            source:
                cleanString(
                    getField(source, [
                        "source",
                        "source_name"
                    ])
                ),

            sourceUrl:
                nullableString(
                    getField(source, [
                        "source_url",
                        "sourceUrl"
                    ])
                ),

            capturedAt:
                normalizeDate(
                    getField(source, [
                        "captured_at",
                        "capturedAt",
                        "created_at",
                        "createdAt"
                    ])
                ),

            data:
                getField(source, [
                    "data",
                    "payload",
                    "snapshot"
                ], null),

            checksum:
                cleanString(
                    getField(source, [
                        "checksum",
                        "hash"
                    ])
                ),

            verified:
                toBoolean(
                    getField(source, [
                        "verified",
                        "is_verified",
                        "isVerified"
                    ]),
                    false
                )
        };
    }


    /* =========================================================
       NORMALIZE META
       ========================================================= */

    function normalizeMeta(row) {
        const source = isObject(row)
            ? row
            : {};

        const roles =
            normalizeArray(
                getField(source, [
                    "roles",
                    "role"
                ], [])
            ).map((role) =>
                cleanString(role).toLowerCase()
            );

        return {
            id: getId(source),

            heroId:
                cleanString(
                    getField(source, [
                        "hero_id",
                        "heroId"
                    ])
                ),

            heroSlug:
                cleanString(
                    getField(source, [
                        "hero_slug",
                        "heroSlug"
                    ])
                ),

            heroName:
                cleanString(
                    getField(source, [
                        "hero_name",
                        "heroName",
                        "name"
                    ])
                ),

            roles,

            patchId:
                cleanString(
                    getField(source, [
                        "patch_id",
                        "patchId"
                    ])
                ),

            season:
                cleanString(
                    getField(source, [
                        "season",
                        "season_name",
                        "seasonName"
                    ])
                ),

            region:
                cleanString(
                    getField(source, [
                        "region"
                    ])
                ),

            source:
                cleanString(
                    getField(source, [
                        "source",
                        "source_name"
                    ])
                ),

            rating:
                toNullableNumber(
                    getField(source, [
                        "rating",
                        "score"
                    ])
                ),

            pickRate:
                toNullableNumber(
                    getField(source, [
                        "pick_rate",
                        "pickRate"
                    ])
                ),

            banRate:
                toNullableNumber(
                    getField(source, [
                        "ban_rate",
                        "banRate"
                    ])
                ),

            winRate:
                toNullableNumber(
                    getField(source, [
                        "win_rate",
                        "winRate"
                    ])
                ),

            sampleSize:
                toNullableNumber(
                    getField(source, [
                        "sample_size",
                        "sampleSize"
                    ])
                ),

            methodology:
                cleanString(
                    getField(source, [
                        "methodology",
                        "method"
                    ])
                ),

            updatedAt:
                normalizeDate(
                    getField(source, [
                        "updated_at",
                        "updatedAt"
                    ])
                ),

            verified:
                toBoolean(
                    getField(source, [
                        "verified",
                        "is_verified",
                        "isVerified"
                    ]),
                    false
                )
        };
    }


    /* =========================================================
       NORMALIZE NOTICE
       ========================================================= */

    function normalizeNotice(row) {
        const source = isObject(row)
            ? row
            : {};

        return {
            id: getId(source),

            title:
                cleanString(
                    getField(source, [
                        "title",
                        "name"
                    ])
                ),

            body:
                cleanString(
                    getField(source, [
                        "body",
                        "content",
                        "description"
                    ])
                ),

            type:
                cleanString(
                    getField(source, [
                        "type",
                        "notice_type",
                        "noticeType"
                    ])
                ),

            priority:
                cleanString(
                    getField(source, [
                        "priority"
                    ]),
                    "normal"
                ),

            heroId:
                cleanString(
                    getField(source, [
                        "hero_id",
                        "heroId"
                    ])
                ),

            publishedAt:
                normalizeDate(
                    getField(source, [
                        "published_at",
                        "publishedAt",
                        "created_at",
                        "createdAt"
                    ])
                ),

            expiresAt:
                normalizeDate(
                    getField(source, [
                        "expires_at",
                        "expiresAt"
                    ])
                ),

            active:
                toBoolean(
                    getField(source, [
                        "active",
                        "is_active",
                        "isActive"
                    ]),
                    true
                ),

            source:
                cleanString(
                    getField(source, [
                        "source",
                        "source_name"
                    ])
                ),

            sourceUrl:
                nullableString(
                    getField(source, [
                        "source_url",
                        "sourceUrl"
                    ])
                )
        };
    }


    /* =========================================================
       NORMALIZER MAP
       ========================================================= */

    const NORMALIZERS = Object.freeze({
        heroes: normalizeHero,
        equipment: normalizeEquipment,
        builds: normalizeBuild,
        patches: normalizePatch,
        changeLogs: normalizeChangeLog,
        rawSnapshots: normalizeSnapshot,
        meta: normalizeMeta,
        notices: normalizeNotice
    });


    /* =========================================================
       COLLECTION ACCESS
       ========================================================= */

    function getCollection(collection) {
        if (!COLLECTIONS.includes(collection)) {
            return [];
        }

        return state[collection] || [];
    }


    function setCollection(
        collection,
        rows,
        options = {}
    ) {
        if (!COLLECTIONS.includes(collection)) {
            throw new Error(
                `Unknown HoKStation collection: ${collection}`
            );
        }

        const normalizer =
            NORMALIZERS[collection];

        const sourceRows =
            Array.isArray(rows)
                ? rows
                : [];

        const normalizedRows =
            sourceRows
                .map((row) =>
                    normalizer
                        ? normalizer(row)
                        : clone(row)
                )
                .filter((row) => {
                    if (
                        collection === "rawSnapshots"
                    ) {
                        return true;
                    }

                    return Boolean(
                        getId(row)
                    );
                });

        state[collection] =
            uniqueById(normalizedRows);

        if (options.emit !== false) {
            emit(
                "collection:set",
                {
                    collection,
                    count:
                        state[collection].length
                }
            );
        }

        return getCollection(collection);
    }


    function appendCollection(
        collection,
        rows
    ) {
        const current =
            getCollection(collection);

        return setCollection(
            collection,
            current.concat(
                Array.isArray(rows)
                    ? rows
                    : []
            )
        );
    }


    function clearCollection(
        collection
    ) {
        if (!COLLECTIONS.includes(collection)) {
            return false;
        }

        state[collection] = [];

        emit(
            "collection:clear",
            {
                collection
            }
        );

        return true;
    }


    /* =========================================================
       FIND BY ID / SLUG
       ========================================================= */

    function findByIdOrSlug(
        collection,
        idOrSlug
    ) {
        const value =
            cleanString(idOrSlug)
                .toLowerCase();

        if (!value) {
            return null;
        }

        return (
            getCollection(collection)
                .find((item) => {
                    return (
                        cleanString(
                            item.id
                        ).toLowerCase() ===
                            value ||
                        cleanString(
                            item.slug
                        ).toLowerCase() ===
                            value
                    );
                }) || null
        );
    }


    function getHero(idOrSlug) {
        return findByIdOrSlug(
            "heroes",
            idOrSlug
        );
    }


    function getEquipment(idOrSlug) {
        return findByIdOrSlug(
            "equipment",
            idOrSlug
        );
    }


    function getBuild(idOrSlug) {
        return findByIdOrSlug(
            "builds",
            idOrSlug
        );
    }


    function getPatch(idOrSlug) {
        return findByIdOrSlug(
            "patches",
            idOrSlug
        );
    }


    /* =========================================================
       COUNTS
       ---------------------------------------------------------
       Directly supports:
       #home-hero-count
       #home-equipment-count
       #home-build-count
       ========================================================= */

    function getHeroCount() {
        return state.heroes.length;
    }


    function getEquipmentCount() {
        return state.equipment.length;
    }


    function getBuildCount() {
        return state.builds.length;
    }


    function getCounts() {
        return {
            heroes: getHeroCount(),
            equipment: getEquipmentCount(),
            builds: getBuildCount(),
            patches: state.patches.length,
            changeLogs: state.changeLogs.length,
            rawSnapshots: state.rawSnapshots.length,
            meta: state.meta.length,
            notices: state.notices.length
        };
    }


    /* =========================================================
       HERO FILTERING
       ---------------------------------------------------------
       Matches HTML:
       data-hero-role=
       all / clash / jungle / mid / farm / support
       ========================================================= */

    function filterHeroes(
        role = state.currentHeroRole
    ) {
        const normalizedRole =
            cleanString(role, "all")
                .toLowerCase();

        state.currentHeroRole =
            HERO_ROLES.includes(
                normalizedRole
            )
                ? normalizedRole
                : "all";

        if (
            state.currentHeroRole ===
            "all"
        ) {
            return [
                ...state.heroes
            ];
        }

        return state.heroes.filter(
            (hero) => {
                const roles =
                    Array.isArray(
                        hero.roles
                    )
                        ? hero.roles
                        : [];

                return (
                    roles.includes(
                        state.currentHeroRole
                    ) ||
                    hero.primaryRole ===
                        state.currentHeroRole
                );
            }
        );
    }


    /* =========================================================
       HERO SORTING
       ---------------------------------------------------------
       Matches HTML:
       #hero-sort
       name / role / recent
       ========================================================= */

    function sortHeroes(
        heroes,
        sortKey = state.currentHeroSort
    ) {
        const items = Array.isArray(
            heroes
        )
            ? [...heroes]
            : [];

        const normalizedSort =
            cleanString(
                sortKey,
                "name"
            ).toLowerCase();

        state.currentHeroSort =
            HERO_SORTS.includes(
                normalizedSort
            )
                ? normalizedSort
                : "name";

        if (
            state.currentHeroSort ===
            "role"
        ) {
            return items.sort(
                (a, b) => {
                    const roleCompare =
                        sortByText(
                            a.primaryRole,
                            b.primaryRole
                        );

                    if (
                        roleCompare !== 0
                    ) {
                        return roleCompare;
                    }

                    return sortByText(
                        a.name,
                        b.name
                    );
                }
            );
        }

        if (
            state.currentHeroSort ===
            "recent"
        ) {
            return items.sort(
                (a, b) =>
                    sortByDateDescending(
                        a.updatedAt,
                        b.updatedAt
                    )
            );
        }

        return items.sort(
            (a, b) =>
                sortByText(
                    a.name,
                    b.name
                )
        );
    }


    function getFilteredHeroes(
        role = state.currentHeroRole,
        sortKey = state.currentHeroSort
    ) {
        return sortHeroes(
            filterHeroes(role),
            sortKey
        );
    }


    /* =========================================================
       EQUIPMENT FILTERING
       ---------------------------------------------------------
       Matches HTML:
       data-equipment-type=
       all / attack / magic / defense /
       movement / roaming
       ========================================================= */

    function filterEquipment(
        type = state.currentEquipmentType
    ) {
        const normalizedType =
            cleanString(type, "all")
                .toLowerCase();

        state.currentEquipmentType =
            EQUIPMENT_TYPES.includes(
                normalizedType
            )
                ? normalizedType
                : "all";

        if (
            state.currentEquipmentType ===
            "all"
        ) {
            return [
                ...state.equipment
            ];
        }

        return state.equipment.filter(
            (item) =>
                item.type ===
                    state.currentEquipmentType ||
                item.subType ===
                    state.currentEquipmentType
        );
    }


    function getFilteredEquipment(
        type = state.currentEquipmentType
    ) {
        return filterEquipment(type)
            .sort(
                (a, b) =>
                    sortByText(
                        a.name,
                        b.name
                    )
            );
    }


    /* =========================================================
       SEARCH
       ---------------------------------------------------------
       Matches HTML search filters:
       all
       heroes
       equipment
       builds
       patches
       ========================================================= */

    function normalizeSearchType(
        type
    ) {
        const value =
            cleanString(
                type,
                "all"
            ).toLowerCase();

        return SEARCH_TYPES.includes(
            value
        )
            ? value
            : "all";
    }


    function searchCollection(
        collection,
        query
    ) {
        const normalizedQuery =
            cleanString(
                query
            ).toLowerCase();

        if (!normalizedQuery) {
            return [
                ...getCollection(collection)
            ];
        }

        return getCollection(
            collection
        ).filter((item) => {
            const searchText =
                cleanString(
                    item.searchText
                ).toLowerCase();

            return searchText.includes(
                normalizedQuery
            );
        });
    }


    function search(
        query,
        type = "all"
    ) {
        const normalizedQuery =
            cleanString(query);

        const normalizedType =
            normalizeSearchType(type);

        state.currentSearchQuery =
            normalizedQuery;

        state.currentSearchType =
            normalizedType;

        const collections =
            normalizedType === "all"
                ? [
                    "heroes",
                    "equipment",
                    "builds",
                    "patches"
                ]
                : [
                    normalizedType
                ];

        const results = [];

        for (
            const collection
            of collections
        ) {
            const matches =
                searchCollection(
                    collection,
                    normalizedQuery
                );

            for (const item of matches) {
                results.push({
                    type: collection,
                    item
                });
            }
        }

        return results;
    }


    /* =========================================================
       BUILD CALCULATOR
       ---------------------------------------------------------
       HTML supports exactly:
       HP
       Physical Attack
       Magic Attack
       Armor
       Magic Defense
       Movement Speed

       This calculator intentionally handles
       additive flat stats only.

       It does NOT pretend to calculate:
       - passive effects
       - penetration
       - attack-speed formulas
       - percentage modifiers
       - unique item passives
       - level scaling
       - buffs/debuffs
       - game-specific caps

       Those require verified game formulas.
       ========================================================= */

    function createEmptyStats() {
        return {
            hp: 0,
            physicalAttack: 0,
            magicAttack: 0,
            armor: 0,
            magicDefense: 0,
            movementSpeed: 0
        };
    }


    function addStats(
        target,
        source
    ) {
        if (!source) {
            return target;
        }

        for (
            const stat
            of BUILD_STATS
        ) {
            target[stat] += toNumber(
                source[stat],
                0
            );
        }

        return target;
    }


    function calculateBuildStats(
        heroOrId,
        equipmentItems = []
    ) {
        let hero =
            isObject(heroOrId)
                ? heroOrId
                : getHero(heroOrId);

        if (!hero) {
            hero = null;
        }

        const result =
            createEmptyStats();

        const warnings = [];

        if (hero) {
            addStats(
                result,
                hero.stats
            );
        } else if (
            heroOrId
        ) {
            warnings.push(
                "Hero data was not found."
            );
        }

        const items =
            Array.isArray(
                equipmentItems
            )
                ? equipmentItems
                : [];

        const usedSlots =
            items.slice(
                0,
                BUILD_MAX_SLOTS
            );

        usedSlots.forEach(
            (itemOrId, index) => {
                const item =
                    isObject(itemOrId)
                        ? itemOrId
                        : getEquipment(
                            itemOrId
                        );

                if (!item) {
                    warnings.push(
                        `Equipment slot ${
                            index + 1
                        } could not be resolved.`
                    );

                    return;
                }

                addStats(
                    result,
                    item.stats
                );
            }
        );

        return {
            stats: result,

            heroId:
                hero
                    ? hero.id
                    : "",

            equipmentIds:
                usedSlots
                    .map((itemOrId) => {
                        if (
                            isObject(
                                itemOrId
                            )
                        ) {
                            return getId(
                                itemOrId
                            );
                        }

                        return cleanString(
                            itemOrId
                        );
                    })
                    .filter(Boolean),

            slotsUsed:
                usedSlots.length,

            warnings,

            calculationMode:
                "flat-additive"
        };
    }


    function calculateBuildStatsFromIds(
        heroId,
        equipmentIds = []
    ) {
        return calculateBuildStats(
            heroId,
            Array.isArray(
                equipmentIds
            )
                ? equipmentIds
                : []
        );
    }


    /* =========================================================
       BUILD VALIDATION
       ========================================================= */

    function validateBuild(
        buildInput
    ) {
        const build =
            isObject(buildInput)
                ? buildInput
                : {};

        const errors = [];
        const warnings = [];

        const name =
            cleanString(
                build.name
            );

        const description =
            cleanString(
                build.description
            );

        const heroId =
            cleanString(
                build.heroId ||
                build.hero_id
            );

        const equipmentIds =
            normalizeArray(
                build.equipmentIds ||
                build.equipment_ids ||
                []
            )
                .map((id) =>
                    cleanString(id)
                )
                .filter(Boolean);

        if (!name) {
            errors.push(
                "Build name is required."
            );
        }

        if (
            name.length >
            BUILD_LIMITS.name
        ) {
            errors.push(
                `Build name cannot exceed ${BUILD_LIMITS.name} characters.`
            );
        }

        if (
            description.length >
            BUILD_LIMITS.description
        ) {
            errors.push(
                `Description cannot exceed ${BUILD_LIMITS.description} characters.`
            );
        }

        if (!heroId) {
            errors.push(
                "A hero must be selected."
            );
        } else if (
            !getHero(heroId)
        ) {
            warnings.push(
                "The selected hero is not currently available in the live dataset."
            );
        }

        if (
            equipmentIds.length >
            BUILD_MAX_SLOTS
        ) {
            errors.push(
                `A build can contain a maximum of ${BUILD_MAX_SLOTS} equipment slots.`
            );
        }

        equipmentIds.forEach(
            (equipmentId, index) => {
                if (
                    !getEquipment(
                        equipmentId
                    )
                ) {
                    warnings.push(
                        `Equipment slot ${index + 1} references unavailable data.`
                    );
                }
            }
        );

        return {
            valid:
                errors.length === 0,

            errors,
            warnings,

            normalized: {
                name:
                    name.slice(
                        0,
                        BUILD_LIMITS.name
                    ),

                description:
                    description.slice(
                        0,
                        BUILD_LIMITS.description
                    ),

                heroId,

                equipmentIds:
                    equipmentIds.slice(
                        0,
                        BUILD_MAX_SLOTS
                    )
            }
        };
    }


    /* =========================================================
       BUILD SERIALIZATION
       ---------------------------------------------------------
       Used later by features.js for shareable builds.
       ========================================================= */

    function serializeBuild(
        buildInput
    ) {
        const validation =
            validateBuild(
                buildInput
            );

        const payload =
            validation.normalized;

        return {
            ...payload,

            version:
                VERSION,

            stats:
                calculateBuildStatsFromIds(
                    payload.heroId,
                    payload.equipmentIds
                ).stats
        };
    }


    function encodeBuild(
        buildInput
    ) {
        const payload =
            serializeBuild(
                buildInput
            );

        try {
            return btoa(
                encodeURIComponent(
                    JSON.stringify(
                        payload
                    )
                )
            );
        } catch (error) {
            console.error(
                "[HoKStation Data] Build encoding failed:",
                error
            );

            return "";
        }
    }


    function decodeBuild(
        encoded
    ) {
        if (!encoded) {
            return null;
        }

        try {
            const decoded =
                decodeURIComponent(
                    atob(
                        String(encoded)
                    )
                );

            const parsed =
                JSON.parse(decoded);

            return validateBuild(
                parsed
            ).normalized;
        } catch (error) {
            console.error(
                "[HoKStation Data] Build decoding failed:",
                error
            );

            return null;
        }
    }


    /* =========================================================
       BUILD SLOT HELPERS
       ---------------------------------------------------------
       Matches:
       [data-build-slot="1"...]
       through
       [data-build-slot="6"...]
       ========================================================= */

    function normalizeBuildSlots(
        equipmentIds
    ) {
        const ids =
            Array.isArray(
                equipmentIds
            )
                ? equipmentIds
                    .slice(
                        0,
                        BUILD_MAX_SLOTS
                    )
                    .map((id) =>
                        cleanString(id)
                    )
                : [];

        while (
            ids.length <
            BUILD_MAX_SLOTS
        ) {
            ids.push("");
        }

        return ids;
    }


    /* =========================================================
       PATCH / HISTORY
       ---------------------------------------------------------
       Matches HTML:
       data-history-tab=
       changes / patches / snapshots
       ========================================================= */

    function getHistory(
        type = state.currentHistoryTab
    ) {
        const normalizedType =
            cleanString(
                type,
                "changes"
            ).toLowerCase();

        state.currentHistoryTab =
            HISTORY_TYPES.includes(
                normalizedType
            )
                ? normalizedType
                : "changes";

        if (
            state.currentHistoryTab ===
            "patches"
        ) {
            return [
                ...state.patches
            ].sort(
                (a, b) =>
                    sortByDateDescending(
                        a.releaseDate ||
                            a.updatedAt,
                        b.releaseDate ||
                            b.updatedAt
                    )
            );
        }

        if (
            state.currentHistoryTab ===
            "snapshots"
        ) {
            return [
                ...state.rawSnapshots
            ].sort(
                (a, b) =>
                    sortByDateDescending(
                        a.capturedAt,
                        b.capturedAt
                    )
            );
        }

        return [
            ...state.changeLogs
        ].sort(
            (a, b) =>
                sortByDateDescending(
                    a.createdAt,
                    b.createdAt
                )
        );
    }


    function getPatches() {
        return [
            ...state.patches
        ].sort(
            (a, b) =>
                sortByDateDescending(
                    a.releaseDate ||
                        a.updatedAt,
                    b.releaseDate ||
                        b.updatedAt
                )
        );
    }


    function getChangeLogs() {
        return [
            ...state.changeLogs
        ].sort(
            (a, b) =>
                sortByDateDescending(
                    a.createdAt,
                    b.createdAt
                )
        );
    }


    function getRawSnapshots() {
        return [
            ...state.rawSnapshots
        ].sort(
            (a, b) =>
                sortByDateDescending(
                    a.capturedAt,
                    b.capturedAt
                )
        );
    }


    /* =========================================================
       META
       ========================================================= */

    function getMeta(
        options = {}
    ) {
        let items = [
            ...state.meta
        ];

        if (
            options.role &&
            META_ROLES.includes(
                cleanString(
                    options.role
                ).toLowerCase()
            )
        ) {
            const role =
                cleanString(
                    options.role
                ).toLowerCase();

            items =
                items.filter(
                    (item) =>
                        item.roles.includes(
                            role
                        )
                );
        }

        if (options.region) {
            const region =
                cleanString(
                    options.region
                ).toLowerCase();

            items =
                items.filter(
                    (item) =>
                        cleanString(
                            item.region
                        ).toLowerCase() ===
                        region
                );
        }

        return items.sort(
            (a, b) =>
                sortByDateDescending(
                    a.updatedAt,
                    b.updatedAt
                )
        );
    }


    /* =========================================================
       NOTICES
       ========================================================= */

    function getNotices(
        options = {}
    ) {
        let items =
            state.notices.filter(
                (notice) =>
                    notice.active !== false
            );

        const now =
            Date.now();

        items =
            items.filter(
                (notice) => {
                    if (
                        !notice.expiresAt
                    ) {
                        return true;
                    }

                    const expires =
                        Date.parse(
                            notice.expiresAt
                        );

                    return (
                        !Number.isFinite(
                            expires
                        ) ||
                        expires > now
                    );
                }
            );

        if (options.type) {
            items =
                items.filter(
                    (notice) =>
                        notice.type ===
                        options.type
                );
        }

        return items.sort(
            (a, b) => {
                const priorityRank = {
                    high: 3,
                    important: 3,
                    normal: 2,
                    low: 1
                };

                const first =
                    priorityRank[
                        a.priority
                    ] || 0;

                const second =
                    priorityRank[
                        b.priority
                    ] || 0;

                if (
                    first !== second
                ) {
                    return (
                        second - first
                    );
                }

                return sortByDateDescending(
                    a.publishedAt,
                    b.publishedAt
                );
            }
        );
    }


    /* =========================================================
       DATA FRESHNESS
       ---------------------------------------------------------
       Supports:
       #data-status-indicator
       #data-status-text
       #data-last-updated
       #patch-data-status
       #patch-data-status-text
       #patch-data-date
       ========================================================= */

    function calculateFreshnessStatus() {
        if (
            state.status ===
            "error"
        ) {
            return {
                state: "error",
                label: "Data connection issue",
                message:
                    "Live data could not be loaded.",
                lastUpdated:
                    state.lastUpdated,
                source:
                    state.source
            };
        }

        if (
            state.status ===
            "loading"
        ) {
            return {
                state: "loading",
                label: "Checking data...",
                message:
                    "Station data is being synchronized.",
                lastUpdated:
                    state.lastUpdated,
                source:
                    state.source
            };
        }

        if (
            state.status ===
            "not-configured"
        ) {
            return {
                state: "offline",
                label: "Database not configured",
                message:
                    "Live database connection has not been configured yet.",
                lastUpdated:
                    state.lastUpdated,
                source:
                    state.source
            };
        }

        if (
            !state.lastUpdated
        ) {
            return {
                state: "unknown",
                label: "No synchronization recorded",
                message:
                    "No live dataset synchronization has been recorded.",
                lastUpdated: null,
                source:
                    state.source
            };
        }

        const timestamp =
            Date.parse(
                state.lastUpdated
            );

        if (
            !Number.isFinite(
                timestamp
            )
        ) {
            return {
                state: "unknown",
                label: "Data status unknown",
                message:
                    "The dataset timestamp could not be verified.",
                lastUpdated:
                    state.lastUpdated,
                source:
                    state.source
            };
        }

        const ageMs =
            Date.now() -
            timestamp;

        const ageHours =
            ageMs /
            (1000 * 60 * 60);

        if (
            ageHours <= 24
        ) {
            return {
                state: "fresh",
                label: "Data current",
                message:
                    "The dataset was synchronized recently.",
                lastUpdated:
                    state.lastUpdated,
                source:
                    state.source
            };
        }

        if (
            ageHours <= 72
        ) {
            return {
                state: "recent",
                label: "Recently updated",
                message:
                    "The dataset was updated within the last few days.",
                lastUpdated:
                    state.lastUpdated,
                source:
                    state.source
            };
        }

        return {
            state: "stale",
            label: "Data may be outdated",
            message:
                "The dataset has not been synchronized recently.",
            lastUpdated:
                state.lastUpdated,
            source:
                state.source
        };
    }


    function getDataFreshness() {
        return calculateFreshnessStatus();
    }


    function setDataStatus(
        status,
        details = {}
    ) {
        state.status =
            cleanString(
                status,
                "unknown"
            );

        state.lastUpdated =
            normalizeDate(
                details.lastUpdated ||
                details.last_updated ||
                state.lastUpdated
            );

        state.lastVerified =
            normalizeDate(
                details.lastVerified ||
                details.last_verified ||
                state.lastVerified
            );

        state.source =
            cleanString(
                details.source ||
                state.source
            ) || null;

        state.sourceLabel =
            cleanString(
                details.sourceLabel ||
                details.source_label ||
                state.sourceLabel
            ) || null;

        state.error =
            details.error ||
            null;

        emit(
            "status:change",
            getDataFreshness()
        );

        return getDataFreshness();
    }


    /* =========================================================
       DETECT DATA METADATA
       --------------------------------------------------------- */

    function inferLatestDate(
        collection
    ) {
        const items =
            getCollection(
                collection
            );

        let latest = null;

        for (const item of items) {
            const candidate =
                item.updatedAt ||
                item.releaseDate ||
                item.capturedAt ||
                item.publishedAt ||
                item.createdAt;

            if (!candidate) {
                continue;
            }

            if (
                !latest ||
                Date.parse(
                    candidate
                ) >
                    Date.parse(
                        latest
                    )
            ) {
                latest = candidate;
            }
        }

        return latest;
    }


    function inferLatestDataDate() {
        const dates = [];

        COLLECTIONS.forEach(
            (collection) => {
                const latest =
                    inferLatestDate(
                        collection
                    );

                if (latest) {
                    dates.push(latest);
                }
            }
        );

        if (!dates.length) {
            return null;
        }

        return dates.sort(
            sortByDateDescending
        )[0];
    }


    /* =========================================================
       LOAD ONE COLLECTION FROM SUPABASE
       ========================================================= */

    async function loadCollection(
        collection,
        options = {}
    ) {
        if (
            !COLLECTIONS.includes(
                collection
            )
        ) {
            throw new Error(
                `Unknown collection: ${collection}`
            );
        }

        const client =
            await getSupabaseClient();

        if (!client) {
            return {
                ok: false,
                configured: false,
                collection,
                rows: [],
                error: null
            };
        }

        const table =
            options.table ||
            getTableName(
                collection
            );

        let query =
            client
                .from(table)
                .select(
                    options.select ||
                    "*"
                );

        if (
            options.orderBy
        ) {
            query =
                query.order(
                    options.orderBy,
                    {
                        ascending:
                            options.ascending !==
                            false,
                        nullsFirst: false
                    }
                );
        }

        if (
            Number.isInteger(
                options.limit
            ) &&
            options.limit > 0
        ) {
            query =
                query.limit(
                    options.limit
                );
        }

        if (
            typeof options.filter ===
            "function"
        ) {
            query =
                options.filter(
                    query
                );
        }

        const {
            data,
            error
        } = await query;

        if (error) {
            throw error;
        }

        const rows =
            Array.isArray(data)
                ? data
                : [];

        setCollection(
            collection,
            rows,
            {
                emit: false
            }
        );

        return {
            ok: true,
            configured: true,
            collection,
            table,
            rows:
                getCollection(
                    collection
                ),
            error: null
        };
    }


    /* =========================================================
       LOAD ALL DATA
       ========================================================= */

    async function loadAll(
        options = {}
    ) {
        if (state.loading) {
            return {
                ok: false,
                loading: true,
                counts: getCounts()
            };
        }

        state.loading = true;
        state.error = null;
        state.status = "loading";

        emit(
            "load:start",
            {}
        );

        try {
            const client =
                await getSupabaseClient();

            if (!client) {
                state.loading = false;
                state.initialized = true;
                state.status =
                    "not-configured";

                emit(
                    "load:complete",
                    {
                        configured: false,
                        counts:
                            getCounts()
                    }
                );

                return {
                    ok: true,
                    configured: false,
                    counts:
                        getCounts(),
                    freshness:
                        getDataFreshness()
                };
            }

            const requested =
                Array.isArray(
                    options.collections
                ) &&
                options.collections.length
                    ? options.collections.filter(
                        (name) =>
                            COLLECTIONS.includes(
                                name
                            )
                    )
                    : [
                        "heroes",
                        "equipment",
                        "builds",
                        "patches",
                        "changeLogs",
                        "rawSnapshots",
                        "meta",
                        "notices"
                    ];

            const results = {};

            for (
                const collection
                of requested
            ) {
                try {
                    results[
                        collection
                    ] =
                        await loadCollection(
                            collection,
                            options[
                                collection
                            ] || {}
                        );
                } catch (error) {
                    results[
                        collection
                    ] = {
                        ok: false,
                        configured: true,
                        collection,
                        rows: [],
                        error
                    };

                    console.error(
                        `[HoKStation Data] Failed loading ${collection}:`,
                        error
                    );
                }
            }

            state.loading = false;
            state.initialized = true;

            const anySuccess =
                Object.values(
                    results
                ).some(
                    (result) =>
                        result.ok
                );

            const anyError =
                Object.values(
                    results
                ).some(
                    (result) =>
                        !result.ok &&
                        result.error
                );

            if (anySuccess) {
                state.status =
                    anyError
                        ? "partial"
                        : "ready";
            } else {
                state.status =
                    "error";
            }

            const latest =
                inferLatestDataDate();

            if (latest) {
                state.lastUpdated =
                    latest;
            }

            const freshness =
                getDataFreshness();

            emit(
                "load:complete",
                {
                    configured: true,
                    results,
                    counts:
                        getCounts(),
                    freshness
                }
            );

            return {
                ok: anySuccess,
                configured: true,
                results,
                counts:
                    getCounts(),
                freshness
            };
        } catch (error) {
            state.loading = false;
            state.initialized = true;
            state.status = "error";
            state.error = error;

            emit(
                "load:error",
                {
                    error
                }
            );

            return {
                ok: false,
                configured: true,
                error,
                counts:
                    getCounts(),
                freshness:
                    getDataFreshness()
            };
        }
    }


    /* =========================================================
       REFRESH
       ========================================================= */

    async function refresh(
        options = {}
    ) {
        return loadAll(
            options
        );
    }


    /* =========================================================
       INITIALIZATION
       ---------------------------------------------------------
       Does NOT automatically download remote data.
       app.js can call:
       HOKSTATION_DATA.init()
       or
       HOKSTATION_DATA.loadAll()
       ========================================================= */

    async function init(
        options = {}
    ) {
        if (
            state.initialized &&
            !options.force
        ) {
            return {
                ok: true,
                alreadyInitialized: true,
                counts:
                    getCounts(),
                freshness:
                    getDataFreshness()
            };
        }

        state.initialized = true;

        emit(
            "init",
            {
                counts:
                    getCounts()
            }
        );

        if (
            options.load !== false
        ) {
            return loadAll(
                options
            );
        }

        return {
            ok: true,
            initialized: true,
            counts:
                getCounts(),
            freshness:
                getDataFreshness()
        };
    }


    /* =========================================================
       STATE ACCESS
       ========================================================= */

    function getState() {
        return {
            initialized:
                state.initialized,

            loading:
                state.loading,

            status:
                state.status,

            lastUpdated:
                state.lastUpdated,

            lastVerified:
                state.lastVerified,

            source:
                state.source,

            sourceLabel:
                state.sourceLabel,

            error:
                state.error,

            currentHeroRole:
                state.currentHeroRole,

            currentHeroSort:
                state.currentHeroSort,

            currentEquipmentType:
                state.currentEquipmentType,

            currentHistoryTab:
                state.currentHistoryTab,

            currentSearchType:
                state.currentSearchType,

            currentSearchQuery:
                state.currentSearchQuery,

            revision:
                state.revision,

            counts:
                getCounts()
        };
    }


    /* =========================================================
       SUBSCRIPTION
       ========================================================= */

    function subscribe(
        listener
    ) {
        if (
            typeof listener !==
            "function"
        ) {
            return () => {};
        }

        subscribers.add(
            listener
        );

        return function unsubscribe() {
            subscribers.delete(
                listener
            );
        };
    }


    /* =========================================================
       IMPORT / EXPORT
       ---------------------------------------------------------
       Useful for admin tools and future verified data imports.
       No automatic mutation of protected history.
       ========================================================= */

    function exportCollection(
        collection
    ) {
        if (
            !COLLECTIONS.includes(
                collection
            )
        ) {
            return [];
        }

        return clone(
            getCollection(
                collection
            )
        );
    }


    function exportAll() {
        const output = {};

        COLLECTIONS.forEach(
            (collection) => {
                output[collection] =
                    exportCollection(
                        collection
                    );
            }
        );

        return {
            version: VERSION,
            exportedAt:
                new Date().toISOString(),
            data: output
        };
    }


    function importCollection(
        collection,
        rows,
        options = {}
    ) {
        if (
            !COLLECTIONS.includes(
                collection
            )
        ) {
            throw new Error(
                `Unknown collection: ${collection}`
            );
        }

        return setCollection(
            collection,
            rows,
            options
        );
    }


    /* =========================================================
       DATA POLICY HELPERS
       ---------------------------------------------------------
       Raw snapshots:
       keep latest 2.

       Protected collections are NEVER automatically
       deleted by this client-side data layer:
       - live data
       - patch history
       - change logs
       - user accounts
       - community questions
       - community answers
       ========================================================= */

    const PROTECTED_DATA = Object.freeze([
        "heroes",
        "equipment",
        "builds",
        "patches",
        "changeLogs"
    ]);

    function getDataPolicy() {
        const config =
            getConfig();

        const policy =
            getConfigSection(
                "dataPolicy",
                {}
            );

        return {
            rawSnapshotRetention:
                toNumber(
                    policy.rawSnapshotRetention,
                    2
                ),

            cleanupRawSnapshotsAutomatically:
                toBoolean(
                    policy.cleanupRawSnapshotsAutomatically,
                    false
                ),

            protectedCollections:
                [
                    ...PROTECTED_DATA
                ],

            userDataProtected:
                true,

            communityDataProtected:
                true,

            sourcePriority:
                Array.isArray(
                    policy.sourcePriority
                )
                    ? [
                        ...policy.sourcePriority
                    ]
                    : [
                        "official-tencent",
                        "official-honor-of-kings"
                    ],

            independentProject:
                config.site
                    ? toBoolean(
                        config.site
                            .independentProject,
                        true
                    )
                    : true
        };
    }


    function getLatestRawSnapshots(
        limit = 2
    ) {
        const safeLimit =
            Math.max(
                0,
                toNumber(
                    limit,
                    2
                )
            );

        return getRawSnapshots()
            .slice(
                0,
                safeLimit
            );
    }


    /* =========================================================
       DATA QUALITY
       ========================================================= */

    function getQualityReport() {
        const report = {};

        report.heroes = {
            count:
                state.heroes.length,
            verified:
                state.heroes.filter(
                    (item) =>
                        item.verified
                ).length,
            missingIds:
                state.heroes.filter(
                    (item) =>
                        !item.id
                ).length,
            missingNames:
                state.heroes.filter(
                    (item) =>
                        !item.name
                ).length
        };

        report.equipment = {
            count:
                state.equipment.length,
            verified:
                state.equipment.filter(
                    (item) =>
                        item.verified
                ).length,
            missingIds:
                state.equipment.filter(
                    (item) =>
                        !item.id
                ).length,
            missingNames:
                state.equipment.filter(
                    (item) =>
                        !item.name
                ).length
        };

        report.builds = {
            count:
                state.builds.length,
            published:
                state.builds.filter(
                    (item) =>
                        item.isPublished
                ).length,
            recommended:
                state.builds.filter(
                    (item) =>
                        item.isRecommended
                ).length
        };

        report.patches = {
            count:
                state.patches.length,
            official:
                state.patches.filter(
                    (item) =>
                        item.official
                ).length
        };

        report.meta = {
            count:
                state.meta.length,
            verified:
                state.meta.filter(
                    (item) =>
                        item.verified
                ).length
        };

        report.notices = {
            count:
                state.notices.length,
            active:
                getNotices().length
        };

        return report;
    }


    /* =========================================================
       LOCAL UI CACHE
       ---------------------------------------------------------
       Only non-sensitive UI state.
       NEVER store passwords, access tokens,
       refresh tokens or authentication secrets here.
       ========================================================= */

    const UI_CACHE_KEY =
        "hokstation_data_ui_v1";


    function saveUiState() {
        try {
            const payload = {
                currentHeroRole:
                    state.currentHeroRole,

                currentHeroSort:
                    state.currentHeroSort,

                currentEquipmentType:
                    state.currentEquipmentType,

                currentHistoryTab:
                    state.currentHistoryTab
            };

            localStorage.setItem(
                UI_CACHE_KEY,
                JSON.stringify(
                    payload
                )
            );

            return true;
        } catch {
            return false;
        }
    }


    function loadUiState() {
        try {
            const raw =
                localStorage.getItem(
                    UI_CACHE_KEY
                );

            if (!raw) {
                return false;
            }

            const parsed =
                JSON.parse(raw);

            if (
                HERO_ROLES.includes(
                    parsed.currentHeroRole
                )
            ) {
                state.currentHeroRole =
                    parsed.currentHeroRole;
            }

            if (
                HERO_SORTS.includes(
                    parsed.currentHeroSort
                )
            ) {
                state.currentHeroSort =
                    parsed.currentHeroSort;
            }

            if (
                EQUIPMENT_TYPES.includes(
                    parsed.currentEquipmentType
                )
            ) {
                state.currentEquipmentType =
                    parsed.currentEquipmentType;
            }

            if (
                HISTORY_TYPES.includes(
                    parsed.currentHistoryTab
                )
            ) {
                state.currentHistoryTab =
                    parsed.currentHistoryTab;
            }

            return true;
        } catch {
            return false;
        }
    }


    /* =========================================================
       RESET
       ---------------------------------------------------------
       Clears only in-memory live data.
       It does NOT delete anything from Supabase.
       ========================================================= */

    function resetMemory() {
        COLLECTIONS.forEach(
            (collection) => {
                state[collection] =
                    [];
            }
        );

        state.status =
            "not-configured";

        state.lastUpdated =
            null;

        state.lastVerified =
            null;

        state.source =
            null;

        state.sourceLabel =
            null;

        state.error =
            null;

        state.initialized =
            false;

        state.loading =
            false;

        emit(
            "reset",
            {}
        );
    }


    /* =========================================================
       PUBLIC API
       ========================================================= */

    const api = {

        version: VERSION,

        constants: {
            COLLECTIONS,
            SEARCH_TYPES,
            HERO_ROLES,
            EQUIPMENT_TYPES,
            HERO_SORTS,
            HISTORY_TYPES,
            META_ROLES,
            BUILD_MAX_SLOTS,
            BUILD_STATS,
            BUILD_LIMITS
        },

        /* State */
        getState,
        subscribe,

        /* Initialization */
        init,
        loadAll,
        refresh,
        loadCollection,

        /* Collections */
        getCollection,
        setCollection,
        appendCollection,
        clearCollection,

        /* Hero */
        getHero,
        getHeroCount,
        filterHeroes,
        sortHeroes,
        getFilteredHeroes,

        /* Equipment */
        getEquipment,
        getEquipmentCount,
        filterEquipment,
        getFilteredEquipment,

        /* Builds */
        getBuild,
        getBuildCount,
        validateBuild,
        calculateBuildStats,
        calculateBuildStatsFromIds,
        normalizeBuildSlots,
        serializeBuild,
        encodeBuild,
        decodeBuild,

        /* Patches / history */
        getPatch,
        getPatches,
        getChangeLogs,
        getRawSnapshots,
        getHistory,

        /* Meta / notices */
        getMeta,
        getNotices,

        /* Search */
        search,
        searchCollection,

        /* Counts */
        getCounts,

        /* Freshness */
        getDataFreshness,
        setDataStatus,

        /* Quality */
        getQualityReport,

        /* Policy */
        getDataPolicy,
        getLatestRawSnapshots,

        /* Import / export */
        exportCollection,
        exportAll,
        importCollection,

        /* UI preferences only */
        saveUiState,
        loadUiState,

        /* Memory reset */
        resetMemory,

        /* Supabase */
        getSupabaseClient,

        /* Constants */
        tables: {
            ...DEFAULT_TABLES
        }
    };


    /* =========================================================
       EXPOSE GLOBAL
       ========================================================= */

    window.HOKSTATION_DATA =
        Object.freeze(api);


    /* =========================================================
       LOAD NON-SENSITIVE UI STATE
       ========================================================= */

    loadUiState();


    /* =========================================================
       INITIAL EVENT
       ========================================================= */

    emit(
        "ready",
        {
            version: VERSION,
            counts:
                getCounts()
        }
    );


    /* =========================================================
       OPTIONAL GLOBAL DATA EVENTS
       ========================================================= */

    window.addEventListener(
        "beforeunload",
        () => {
            saveUiState();
        }
    );


    /* =========================================================
       DEBUG INFORMATION
       ---------------------------------------------------------
       Does not expose secrets.
       ========================================================= */

    if (
        window.HOKSTATION_DEBUG === true
    ) {
        console.info(
            "[HoKStation Data] data.js loaded.",
            {
                version: VERSION,
                collections:
                    COLLECTIONS,
                counts:
                    getCounts()
            }
        );
    }

})();
