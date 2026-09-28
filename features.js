/* =========================================================
   HOKSTATION.GG
   FILE 7 / 8 — features.js

   DOMAIN FEATURE LAYER
   ---------------------------------------------------------
   Owns:
   - Hero rendering / filtering / sorting
   - Hero detail
   - Equipment rendering / filtering
   - Build rendering
   - Build Lab
   - Build calculation
   - Build sharing state
   - Compare
   - Favorites UI
   - Patch / history / meta / notice rendering
   - Community question rendering
   - Search-result rendering

   Does NOT own:
   - Authentication
   - Supabase sessions
   - Passwords
   - Account authorization
   - Global route switching
   - Generic modal infrastructure

   SOURCE OF TRUTH:
   index.html

   DEPENDENCIES:
   config.js
   data.js
   app.js
   ========================================================= */

(function () {
    "use strict";

    /* =========================================================
       GLOBAL GUARDS
       ========================================================= */

    if (window.HOKSTATION_FEATURES) {
        return;
    }

    const DATA = window.HOKSTATION_DATA || {};
    const APP = window.HOKSTATION_APP || {};
    const CONFIG = window.HOKSTATION_CONFIG || {};

    /* =========================================================
       STATE
       ========================================================= */

    const state = {
        initialized: false,

        heroRole: "all",
        heroSort: "name",

        equipmentType: "all",

        historyTab: "changes",

        favoriteTab: "heroes",

        communityFilter: "recent",

        selectedHeroId: "",

        selectedBuildId: null,

        buildHeroId: "",
        buildSlots: Array(6).fill(""),

        activeBuildSlot: null,

        compareA: "",
        compareB: "",

        equipmentSearch: "",

        lastSearchQuery: "",
        lastSearchType: "all",

        sharePayload: null,

        unsubscribeData: null
    };

    /* =========================================================
       DOM HELPERS
       ========================================================= */

    function byId(id) {
        return document.getElementById(id);
    }

    function all(selector, root) {
        const scope = root || document;
        return Array.from(scope.querySelectorAll(selector));
    }

    function first(selector, root) {
        const scope = root || document;
        return scope.querySelector(selector);
    }

    function isElement(value) {
        return value instanceof Element;
    }

    function safeString(value, fallback = "") {
        if (
            value === null ||
            value === undefined
        ) {
            return fallback;
        }

        const result = String(value).trim();

        return result || fallback;
    }

    function escapeHTML(value) {
        const text = safeString(value);

        return text.replace(
            /[&<>"']/g,
            function (character) {
                const map = {
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#039;"
                };

                return map[character];
            }
        );
    }

    function array(value) {
        return Array.isArray(value)
            ? value
            : [];
    }

    function itemId(item) {
        if (!item) {
            return "";
        }

        return safeString(
            item.id ??
            item.uuid ??
            item.slug
        );
    }

    function itemName(item, fallback = "Unnamed") {
        if (!item) {
            return fallback;
        }

        return safeString(
            item.name ??
            item.title ??
            item.displayName ??
            item.display_name,
            fallback
        );
    }

    function getRoles(item) {
        if (!item) {
            return [];
        }

        const roles =
            item.roles ??
            item.role ??
            item.primaryRole ??
            item.primary_role ??
            [];

        if (Array.isArray(roles)) {
            return roles
                .map(function (role) {
                    return safeString(role)
                        .toLowerCase();
                })
                .filter(Boolean);
        }

        return safeString(roles)
            .split(",")
            .map(function (role) {
                return role.trim().toLowerCase();
            })
            .filter(Boolean);
    }

    function getStats(item) {
        if (!item) {
            return {};
        }

        if (
            item.stats &&
            typeof item.stats === "object"
        ) {
            return item.stats;
        }

        if (
            item.baseStats &&
            typeof item.baseStats === "object"
        ) {
            return item.baseStats;
        }

        if (
            item.base_stats &&
            typeof item.base_stats === "object"
        ) {
            return item.base_stats;
        }

        return item;
    }

    function getNumber(value, fallback = 0) {
        const number = Number(value);

        return Number.isFinite(number)
            ? number
            : fallback;
    }

    function formatNumber(value) {
        const number = Number(value);

        if (!Number.isFinite(number)) {
            return "—";
        }

        return number.toLocaleString(
            undefined,
            {
                maximumFractionDigits: 2
            }
        );
    }

    function formatDate(value) {
        if (!value) {
            return "—";
        }

        const date = new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "—";
        }

        return date.toLocaleDateString(
            undefined,
            {
                year: "numeric",
                month: "short",
                day: "numeric"
            }
        );
    }

    function showToast(message, type) {
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

    function navigate(route) {
        if (
            APP &&
            typeof APP.navigate === "function"
        ) {
            APP.navigate(route);
        }
    }

    /* =========================================================
       DATA HELPERS
       ========================================================= */

    function getCollection(name) {
        if (
            DATA &&
            typeof DATA.getCollection === "function"
        ) {
            return array(
                DATA.getCollection(name)
            );
        }

        return [];
    }

    function getHero(id) {
        if (
            !id ||
            !DATA ||
            typeof DATA.getHero !== "function"
        ) {
            return null;
        }

        return DATA.getHero(id);
    }

    function getEquipment(id) {
        if (
            !id ||
            !DATA ||
            typeof DATA.getEquipment !== "function"
        ) {
            return null;
        }

        return DATA.getEquipment(id);
    }

    function getBuild(id) {
        if (
            !id ||
            !DATA ||
            typeof DATA.getBuild !== "function"
        ) {
            return null;
        }

        return DATA.getBuild(id);
    }

    function getFilteredHeroes() {
        if (
            DATA &&
            typeof DATA.getFilteredHeroes ===
                "function"
        ) {
            return array(
                DATA.getFilteredHeroes({
                    role: state.heroRole,
                    sort: state.heroSort
                })
            );
        }

        let heroes = getCollection("heroes");

        if (
            state.heroRole &&
            state.heroRole !== "all"
        ) {
            heroes = heroes.filter(
                function (hero) {
                    return getRoles(hero).includes(
                        state.heroRole
                    );
                }
            );
        }

        heroes.sort(
            function (a, b) {
                return itemName(a).localeCompare(
                    itemName(b),
                    undefined,
                    {
                        sensitivity: "base"
                    }
                );
            }
        );

        return heroes;
    }

    function getFilteredEquipment() {
        if (
            DATA &&
            typeof DATA.getFilteredEquipment ===
                "function"
        ) {
            return array(
                DATA.getFilteredEquipment({
                    type: state.equipmentType
                })
            );
        }

        let equipment =
            getCollection("equipment");

        if (
            state.equipmentType &&
            state.equipmentType !== "all"
        ) {
            equipment = equipment.filter(
                function (item) {
                    const type = safeString(
                        item.type ??
                        item.category ??
                        item.equipmentType ??
                        item.equipment_type
                    ).toLowerCase();

                    return type ===
                        state.equipmentType;
                }
            );
        }

        return equipment;
    }

    /* =========================================================
       HEROES
       ========================================================= */

    function renderHeroes() {
        const grid = byId("hero-grid");
        const empty = byId("hero-empty");

        if (!grid) {
            return;
        }

        const heroes =
            getFilteredHeroes();

        grid.innerHTML = "";

        if (!heroes.length) {
            if (empty) {
                empty.classList.remove(
                    "hidden"
                );
            }

            return;
        }

        if (empty) {
            empty.classList.add(
                "hidden"
            );
        }

        heroes.forEach(
            function (hero) {
                const id =
                    itemId(hero);

                const name =
                    itemName(hero);

                const roles =
                    getRoles(hero)
                        .map(
                            function (role) {
                                return role
                                    .replace(
                                        /(^|-)\w/g,
                                        function (letter) {
                                            return letter
                                                .toUpperCase();
                                        }
                                    );
                            }
                        )
                        .join(" • ");

                const stats =
                    getStats(hero);

                const image =
                    safeString(
                        hero.imageUrl ??
                        hero.image_url ??
                        hero.portraitUrl ??
                        hero.portrait_url
                    );

                const article =
                    document.createElement(
                        "article"
                    );

                article.className =
                    "data-card hero-card";

                article.dataset.heroId =
                    id;

                const art =
                    document.createElement(
                        "div"
                    );

                art.className =
                    "card-art-placeholder";

                if (image) {
                    art.style.backgroundImage =
                        `url("${image.replace(
                            /"/g,
                            "%22"
                        )}")`;
                    art.classList.add(
                        "has-image"
                    );
                    art.setAttribute(
                        "role",
                        "img"
                    );
                    art.setAttribute(
                        "aria-label",
                        name
                    );
                } else {
                    art.setAttribute(
                        "aria-hidden",
                        "true"
                    );
                    art.textContent =
                        name
                            .slice(0, 2)
                            .toUpperCase();
                }

                const content =
                    document.createElement(
                        "div"
                    );

                content.className =
                    "card-content";

                content.innerHTML = `
                    <span class="eyebrow">
                        ${escapeHTML(
                            roles || "Hero"
                        )}
                    </span>

                    <h3>
                        ${escapeHTML(name)}
                    </h3>

                    <p>
                        ${escapeHTML(
                            safeString(
                                hero.shortBio ??
                                hero.short_bio ??
                                hero.description ??
                                hero.bio,
                                "Official hero data will appear here when the live dataset is connected."
                            )
                        )}
                    </p>

                    <div class="card-meta">
                        <span>
                            HP ${escapeHTML(
                                formatNumber(
                                    stats.hp
                                )
                            )}
                        </span>

                        <span>
                            ATK ${escapeHTML(
                                formatNumber(
                                    stats.physicalAttack ??
                                    stats.physical_attack
                                )
                            )}
                        </span>
                    </div>

                    <button
                        type="button"
                        class="secondary-button"
                        data-feature-hero="${escapeHTML(
                            id
                        )}"
                    >
                        View Hero
                    </button>
                `;

                article.appendChild(
                    art
                );

                article.appendChild(
                    content
                );

                grid.appendChild(
                    article
                );
            }
        );
    }

    function renderHeroDetail(
        heroId
    ) {
        const root =
            byId(
                "hero-detail-content"
            );

        if (!root) {
            return;
        }

        const hero =
            getHero(heroId);

        if (!hero) {
            root.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">◇</span>
                    <h3>Hero not found</h3>
                    <p>
                        The requested hero is not available
                        in the current dataset.
                    </p>
                </div>
            `;

            return;
        }

        state.selectedHeroId =
            itemId(hero);

        const stats =
            getStats(hero);

        const roles =
            getRoles(hero)
                .map(
                    function (role) {
                        return role
                            .replace(
                                /(^|-)\w/g,
                                function (letter) {
                                    return letter
                                        .toUpperCase();
                                }
                            );
                    }
                )
                .join(" • ");

        const abilities =
            array(
                hero.abilities ??
                hero.skills
            );

        root.innerHTML = `
            <div class="detail-layout">

                <div class="detail-art-placeholder">
                    ${escapeHTML(
                        itemName(hero)
                            .slice(0, 2)
                            .toUpperCase()
                    )}
                </div>

                <div class="detail-copy">

                    <span class="eyebrow">
                        ${escapeHTML(
                            roles || "Hero"
                        )}
                    </span>

                    <h1>
                        ${escapeHTML(
                            itemName(hero)
                        )}
                    </h1>

                    <p>
                        ${escapeHTML(
                            safeString(
                                hero.shortBio ??
                                hero.short_bio ??
                                hero.description ??
                                hero.bio,
                                "Official hero information is not yet available."
                            )
                        )}
                    </p>

                    ${
                        safeString(
                            hero.strategy ??
                            hero.playStyle ??
                            hero.play_style
                        )
                            ? `
                                <div class="panel">
                                    <span class="eyebrow">
                                        Play Style
                                    </span>
                                    <p>
                                        ${escapeHTML(
                                            hero.strategy ??
                                            hero.playStyle ??
                                            hero.play_style
                                        )}
                                    </p>
                                </div>
                            `
                            : ""
                    }

                    <div class="stat-grid">

                        <div class="stat-card">
                            <span>HP</span>
                            <strong>
                                ${escapeHTML(
                                    formatNumber(
                                        stats.hp
                                    )
                                )}
                            </strong>
                        </div>

                        <div class="stat-card">
                            <span>Physical Attack</span>
                            <strong>
                                ${escapeHTML(
                                    formatNumber(
                                        stats.physicalAttack ??
                                        stats.physical_attack
                                    )
                                )}
                            </strong>
                        </div>

                        <div class="stat-card">
                            <span>Armor</span>
                            <strong>
                                ${escapeHTML(
                                    formatNumber(
                                        stats.armor
                                    )
                                )}
                            </strong>
                        </div>

                        <div class="stat-card">
                            <span>Magic Defense</span>
                            <strong>
                                ${escapeHTML(
                                    formatNumber(
                                        stats.magicDefense ??
                                        stats.magic_defense
                                    )
                                )}
                            </strong>
                        </div>

                    </div>

                    ${
                        abilities.length
                            ? `
                                <div class="panel">
                                    <span class="eyebrow">
                                        Abilities
                                    </span>
                                    <ul class="simple-list">
                                        ${abilities
                                            .slice(0, 8)
                                            .map(
                                                function (
                                                    ability
                                                ) {
                                                    const title =
                                                        typeof ability ===
                                                        "object"
                                                            ? (
                                                                ability.name ??
                                                                ability.title
                                                            )
                                                            : ability;

                                                    return `
                                                        <li>
                                                            ${escapeHTML(
                                                                safeString(
                                                                    title,
                                                                    "Ability"
                                                                )
                                                            )}
                                                        </li>
                                                    `;
                                                }
                                            )
                                            .join("")}
                                    </ul>
                                </div>
                            `
                            : ""
                    }

                    <button
                        type="button"
                        class="primary-button"
                        data-open-build-for="${escapeHTML(
                            itemId(hero)
                        )}"
                    >
                        Build with this Hero
                    </button>

                </div>

            </div>
        `;

        navigate("hero-detail");
    }

    function applyHeroFilter(
        role
    ) {
        const valid =
            [
                "all",
                "clash",
                "jungle",
                "mid",
                "farm",
                "support"
            ];

        state.heroRole =
            valid.includes(role)
                ? role
                : "all";

        all(
            "[data-hero-role]"
        ).forEach(
            function (button) {
                button.classList.toggle(
                    "is-active",
                    button.getAttribute(
                        "data-hero-role"
                    ) ===
                        state.heroRole
                );
            }
        );

        renderHeroes();
    }

    function applyHeroSort(
        sort
    ) {
        const valid =
            [
                "name",
                "role",
                "recent"
            ];

        state.heroSort =
            valid.includes(sort)
                ? sort
                : "name";

        renderHeroes();
    }

    /* =========================================================
       EQUIPMENT
       ========================================================= */

    function renderEquipment() {
        const grid =
            byId(
                "equipment-grid"
            );

        if (!grid) {
            return;
        }

        const items =
            getFilteredEquipment();

        const query =
            state.equipmentSearch
                .toLowerCase();

        const filtered =
            query
                ? items.filter(
                    function (item) {
                        return (
                            itemName(item)
                                .toLowerCase()
                                .includes(
                                    query
                                ) ||
                            safeString(
                                item.description
                            )
                                .toLowerCase()
                                .includes(
                                    query
                                )
                        );
                    }
                )
                : items;

        grid.innerHTML = "";

        if (!filtered.length) {
            grid.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">◇</span>
                    <h3>No equipment data</h3>
                    <p>
                        The live equipment dataset has not
                        been connected or no item matches
                        the current filter.
                    </p>
                </div>
            `;

            return;
        }

        filtered.forEach(
            function (item) {
                const card =
                    document.createElement(
                        "article"
                    );

                card.className =
                    "data-card equipment-card";

                const type =
                    safeString(
                        item.type ??
                        item.category ??
                        item.equipmentType ??
                        item.equipment_type,
                        "Equipment"
                    );

                const stats =
                    getStats(item);

                const statEntries =
                    Object.entries(
                        stats
                    )
                        .filter(
                            function (entry) {
                                return (
                                    entry[1] !==
                                        null &&
                                    entry[1] !==
                                        undefined &&
                                    entry[1] !==
                                        ""
                                );
                            }
                        )
                        .slice(0, 5);

                card.innerHTML = `
                    <div
                        class="card-art-placeholder"
                        aria-hidden="true"
                    >
                        ${escapeHTML(
                            itemName(item)
                                .slice(0, 2)
                                .toUpperCase()
                        )}
                    </div>

                    <div class="card-content">

                        <span class="eyebrow">
                            ${escapeHTML(type)}
                        </span>

                        <h3>
                            ${escapeHTML(
                                itemName(item)
                            )}
                        </h3>

                        <p>
                            ${escapeHTML(
                                safeString(
                                    item.description,
                                    "Official equipment information will appear here."
                                )
                            )}
                        </p>

                        ${
                            statEntries.length
                                ? `
                                    <div class="card-meta">
                                        ${statEntries
                                            .map(
                                                function (
                                                    entry
                                                ) {
                                                    return `
                                                        <span>
                                                            ${escapeHTML(
                                                                entry[0]
                                                            )}
                                                            ${escapeHTML(
                                                                String(
                                                                    entry[1]
                                                                )
                                                            )}
                                                        </span>
                                                    `;
                                                }
                                            )
                                            .join("")}
                                    </div>
                                `
                                : ""
                        }

                    </div>
                `;

                grid.appendChild(
                    card
                );
            }
        );
    }

    function applyEquipmentFilter(
        type
    ) {
        const valid =
            [
                "all",
                "attack",
                "magic",
                "defense",
                "movement",
                "roaming"
            ];

        state.equipmentType =
            valid.includes(type)
                ? type
                : "all";

        all(
            "[data-equipment-type]"
        ).forEach(
            function (button) {
                button.classList.toggle(
                    "is-active",
                    button.getAttribute(
                        "data-equipment-type"
                    ) ===
                        state.equipmentType
                );
            }
        );

        renderEquipment();
    }

    /* =========================================================
       BUILDS
       ========================================================= */

    function renderBuilds() {
        const grid =
            byId(
                "build-grid"
            );

        if (!grid) {
            return;
        }

        const builds =
            getCollection(
                "builds"
            );

        grid.innerHTML = "";

        if (!builds.length) {
            grid.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">◇</span>
                    <h3>No public builds</h3>
                    <p>
                        Builds will appear here when live
                        build data is available.
                    </p>
                </div>
            `;

            return;
        }

        builds.forEach(
            function (build) {
                const hero =
                    getHero(
                        build.heroId ??
                        build.hero_id
                    );

                const card =
                    document.createElement(
                        "article"
                    );

                card.className =
                    "data-card build-card";

                card.innerHTML = `
                    <div class="card-content">

                        <span class="eyebrow">
                            ${escapeHTML(
                                itemName(
                                    hero,
                                    "Hero"
                                )
                            )}
                        </span>

                        <h3>
                            ${escapeHTML(
                                itemName(
                                    build,
                                    "Build"
                                )
                            )}
                        </h3>

                        <p>
                            ${escapeHTML(
                                safeString(
                                    build.description,
                                    "No description provided."
                                )
                            )}
                        </p>

                        <div class="card-meta">
                            <span>
                                ${
                                    build.isRecommended ||
                                    build.is_recommended
                                        ? "Recommended"
                                        : "Community"
                                }
                            </span>

                            <span>
                                ${
                                    build.updatedAt ||
                                    build.updated_at
                                        ? escapeHTML(
                                            formatDate(
                                                build.updatedAt ??
                                                build.updated_at
                                            )
                                        )
                                        : "—"
                                }
                            </span>
                        </div>

                        <button
                            type="button"
                            class="secondary-button"
                            data-load-build="${escapeHTML(
                                itemId(build)
                            )}"
                        >
                            Open Build
                        </button>

                    </div>
                `;

                grid.appendChild(
                    card
                );
            }
        );
    }

    /* =========================================================
       BUILD LAB — HERO SELECTOR
       ========================================================= */

    function renderBuildHeroSelector() {
        const root =
            byId(
                "build-hero-selector"
            );

        if (!root) {
            return;
        }

        const heroes =
            getCollection(
                "heroes"
            );

        root.innerHTML = "";

        if (!heroes.length) {
            root.innerHTML = `
                <div class="empty-state compact">
                    <h3>No heroes available</h3>
                    <p>
                        Connect the live dataset to select a hero.
                    </p>
                </div>
            `;

            return;
        }

        heroes.forEach(
            function (hero) {
                const id =
                    itemId(hero);

                const button =
                    document.createElement(
                        "button"
                    );

                button.type =
                    "button";

                button.className =
                    "selector-card";

                button.dataset.heroSelect =
                    id;

                button.setAttribute(
                    "aria-pressed",
                    id ===
                        state.buildHeroId
                        ? "true"
                        : "false"
                );

                button.innerHTML = `
                    <span
                        class="selector-card-mark"
                        aria-hidden="true"
                    >
                        ${escapeHTML(
                            itemName(hero)
                                .slice(0, 2)
                                .toUpperCase()
                        )}
                    </span>

                    <span class="selector-card-content">
                        <strong>
                            ${escapeHTML(
                                itemName(hero)
                            )}
                        </strong>

                        <small>
                            ${escapeHTML(
                                getRoles(hero)
                                    .join(" • ") ||
                                "Hero"
                            )}
                        </small>
                    </span>
                `;

                root.appendChild(
                    button
                );
            }
        );
    }

    function selectBuildHero(
        heroId
    ) {
        const hero =
            getHero(heroId);

        if (!hero) {
            showToast(
                "That hero is not available in the current dataset.",
                "error"
            );

            return;
        }

        state.buildHeroId =
            itemId(hero);

        all(
            "[data-hero-select]"
        ).forEach(
            function (button) {
                const selected =
                    button.getAttribute(
                        "data-hero-select"
                    ) ===
                    state.buildHeroId;

                button.classList.toggle(
                    "is-selected",
                    selected
                );

                button.setAttribute(
                    "aria-pressed",
                    selected
                        ? "true"
                        : "false"
                );
            }
        );

        updateBuildStats();
    }

    /* =========================================================
       BUILD LAB — EQUIPMENT SLOTS
       ========================================================= */

    function renderBuildSlots() {
        const root =
            byId(
                "build-slots"
            );

        if (!root) {
            return;
        }

        const slots =
            all(
                "[data-build-slot]",
                root
            );

        slots.forEach(
            function (slot) {
                const number =
                    Number(
                        slot.getAttribute(
                            "data-build-slot"
                        )
                    );

                if (
                    !Number.isInteger(
                        number
                    ) ||
                    number < 1 ||
                    number > 6
                ) {
                    return;
                }

                const index =
                    number - 1;

                const equipmentId =
                    state.buildSlots[
                        index
                    ];

                const equipment =
                    equipmentId
                        ? getEquipment(
                            equipmentId
                        )
                        : null;

                const content =
                    first(
                        ".slot-content",
                        slot
                    );

                if (content) {
                    if (equipment) {
                        content.innerHTML = `
                            <strong>
                                ${escapeHTML(
                                    itemName(
                                        equipment
                                    )
                                )}
                            </strong>

                            <span>
                                Equipment selected
                            </span>
                        `;
                    } else {
                        content.innerHTML = `
                            <strong>
                                Empty
                            </strong>

                            <span>
                                Select equipment
                            </span>
                        `;
                    }
                }

                slot.dataset.equipmentId =
                    equipmentId || "";

                slot.classList.toggle(
                    "is-filled",
                    Boolean(
                        equipment
                    )
                );

                const selectButton =
                    first(
                        "[data-slot-action]",
                        slot
                    );

                if (selectButton) {
                    selectButton.textContent =
                        equipment
                            ? "Change"
                            : "Select";
                }
            }
        );

        updateBuildStats();
    }

    function openEquipmentSelector(
        slotNumber
    ) {
        const modal =
            byId(
                "equipment-selector-modal"
            );

        const list =
            byId(
                "equipment-selector-list"
            );

        const title =
            byId(
                "equipment-selector-title"
            );

        if (
            !modal ||
            !list
        ) {
            return;
        }

        const number =
            Number(slotNumber);

        if (
            !Number.isInteger(
                number
            ) ||
            number < 1 ||
            number > 6
        ) {
            return;
        }

        state.activeBuildSlot =
            number;

        if (title) {
            title.textContent =
                `Select Equipment — Slot ${number}`;
        }

        const search =
            byId(
                "equipment-selector-search"
            );

        if (search) {
            search.value =
                state.equipmentSearch;

            window.setTimeout(
                function () {
                    search.focus();
                },
                0
            );
        }

        renderEquipmentSelectorList();

        openModal(
            "equipment-selector-modal"
        );
    }

    function renderEquipmentSelectorList() {
        const list =
            byId(
                "equipment-selector-list"
            );

        if (!list) {
            return;
        }

        const query =
            state.equipmentSearch
                .toLowerCase();

        const equipment =
            getCollection(
                "equipment"
            ).filter(
                function (item) {
                    if (!query) {
                        return true;
                    }

                    const haystack =
                        [
                            itemName(item),
                            item.description,
                            item.type,
                            item.category
                        ]
                            .map(
                                function (
                                    value
                                ) {
                                    return safeString(
                                        value
                                    ).toLowerCase();
                                }
                            )
                            .join(" ");

                    return haystack.includes(
                        query
                    );
                }
            );

        list.innerHTML = "";

        if (!equipment.length) {
            list.innerHTML = `
                <div class="empty-state compact">
                    <h3>No equipment found</h3>
                    <p>
                        Try another search.
                    </p>
                </div>
            `;

            return;
        }

        equipment.forEach(
            function (item) {
                const id =
                    itemId(item);

                const button =
                    document.createElement(
                        "button"
                    );

                button.type =
                    "button";

                button.className =
                    "selector-card";

                button.dataset.equipmentSelect =
                    id;

                const current =
                    state.activeBuildSlot
                        ? state.buildSlots[
                            state.activeBuildSlot -
                            1
                        ]
                        : "";

                button.classList.toggle(
                    "is-selected",
                    current === id
                );

                button.innerHTML = `
                    <span
                        class="selector-card-mark"
                        aria-hidden="true"
                    >
                        ${escapeHTML(
                            itemName(item)
                                .slice(0, 2)
                                .toUpperCase()
                        )}
                    </span>

                    <span class="selector-card-content">
                        <strong>
                            ${escapeHTML(
                                itemName(item)
                            )}
                        </strong>

                        <small>
                            ${escapeHTML(
                                safeString(
                                    item.type ??
                                    item.category,
                                    "Equipment"
                                )
                            )}
                        </small>
                    </span>
                `;

                list.appendChild(
                    button
                );
            }
        );
    }

    function selectEquipmentForSlot(
        equipmentId
    ) {
        const equipment =
            getEquipment(
                equipmentId
            );

        const slot =
            state.activeBuildSlot;

        if (
            !equipment ||
            !slot ||
            slot < 1 ||
            slot > 6
        ) {
            return;
        }

        state.buildSlots[
            slot - 1
        ] = itemId(
            equipment
        );

        closeModal(
            "equipment-selector-modal"
        );

        renderBuildSlots();

        showToast(
            `${itemName(
                equipment
            )} selected.`,
            "success"
        );
    }

    function clearBuild() {
        state.buildHeroId =
            "";

        state.buildSlots =
            Array(6).fill("");

        state.selectedBuildId =
            null;

        const name =
            byId("build-name");

        const description =
            byId(
                "build-description"
            );

        if (name) {
            name.value = "";
        }

        if (description) {
            description.value =
                "";
        }

        renderBuildHeroSelector();
        renderBuildSlots();

        navigate(
            "build-lab"
        );
    }

    function updateBuildStats() {
        const ids =
            state.buildSlots.filter(
                Boolean
            );

        let result =
            null;

        if (
            state.buildHeroId &&
            DATA &&
            typeof DATA.calculateBuildStatsFromIds ===
                "function"
        ) {
            result =
                DATA.calculateBuildStatsFromIds(
                    state.buildHeroId,
                    ids
                );
        }

        const stats =
            result &&
            result.stats
                ? result.stats
                : {};

        const map =
            {
                hp:
                    "build-stat-hp",

                physicalAttack:
                    "build-stat-physical-attack",

                magicAttack:
                    "build-stat-magic-attack",

                armor:
                    "build-stat-armor",

                magicDefense:
                    "build-stat-magic-defense",

                movementSpeed:
                    "build-stat-movement-speed"
            };

        Object.entries(
            map
        ).forEach(
            function (entry) {
                const key =
                    entry[0];

                const id =
                    entry[1];

                const element =
                    byId(id);

                if (!element) {
                    return;
                }

                element.textContent =
                    Object.prototype.hasOwnProperty.call(
                        stats,
                        key
                    )
                        ? formatNumber(
                            stats[key]
                        )
                        : "—";
            }
        );

        const previewMap =
            {
                physicalAttack:
                    "preview-physical-attack",

                hp:
                    "preview-hp",

                armor:
                    "preview-armor",

                magicDefense:
                    "preview-magic-defense"
            };

        Object.entries(
            previewMap
        ).forEach(
            function (entry) {
                const key =
                    entry[0];

                const id =
                    entry[1];

                const element =
                    byId(id);

                if (!element) {
                    return;
                }

                element.textContent =
                    Object.prototype.hasOwnProperty.call(
                        stats,
                        key
                    )
                        ? formatNumber(
                            stats[key]
                        )
                        : "—";
            }
        );
    }

    /* =========================================================
       BUILD LOAD / SAVE PAYLOAD
       ========================================================= */

    function getCurrentBuildPayload() {
        const buildName =
            byId(
                "build-name"
            );

        const buildDescription =
            byId(
                "build-description"
            );

        return {
            heroId:
                state.buildHeroId ||
                null,

            equipmentIds:
                state.buildSlots.slice(),

            name:
                safeString(
                    buildName
                        ? buildName.value
                        : "",
                    "Untitled Build"
                ),

            description:
                safeString(
                    buildDescription
                        ? buildDescription.value
                        : ""
                )
        };
    }

    function loadBuildIntoLab(
        buildId
    ) {
        const build =
            getBuild(buildId);

        if (!build) {
            showToast(
                "Build not found.",
                "error"
            );

            return;
        }

        const heroId =
            build.heroId ??
            build.hero_id;

        const slots =
            build.equipmentIds ??
            build.equipment_ids ??
            build.slots ??
            build.equipment ??
            [];

        state.selectedBuildId =
            itemId(build);

        state.buildHeroId =
            safeString(
                heroId
            );

        state.buildSlots =
            Array(6)
                .fill("")
                .map(
                    function (_, index) {
                        return safeString(
                            slots[index]
                        );
                    }
                );

        const name =
            byId("build-name");

        const description =
            byId(
                "build-description"
            );

        if (name) {
            name.value =
                safeString(
                    build.name ??
                    build.title
                );
        }

        if (description) {
            description.value =
                safeString(
                    build.description
                );
        }

        renderBuildHeroSelector();
        renderBuildSlots();

        navigate(
            "build-lab"
        );
    }

    function validateCurrentBuild() {
        const payload =
            getCurrentBuildPayload();

        if (
            !payload.heroId
        ) {
            return {
                ok: false,
                message:
                    "Select a hero before saving the build."
            };
        }

        if (
            DATA &&
            typeof DATA.validateBuild ===
                "function"
        ) {
            const result =
                DATA.validateBuild(
                    payload
                );

            if (
                result &&
                result.ok === false
            ) {
                return {
                    ok: false,
                    message:
                        safeString(
                            result.message,
                            "The build is not valid."
                        )
                };
            }
        }

        return {
            ok: true,
            payload
        };
    }

    function saveBuildRequest() {
        const validation =
            validateCurrentBuild();

        if (!validation.ok) {
            showToast(
                validation.message,
                "error"
            );

            return;
        }

        /*
         * Account.js owns authenticated persistence.
         * This event lets account.js save the validated payload.
         */
        window.dispatchEvent(
            new CustomEvent(
                "hokstation:save-build-request",
                {
                    detail: {
                        build:
                            validation.payload,
                        existingBuildId:
                            state.selectedBuildId
                    }
                }
            )
        );

        showToast(
            "Build ready to save.",
            "info"
        );
    }

    /* =========================================================
       BUILD SHARING
       ========================================================= */

    function createShareURL(
        payload
    ) {
        let encoded =
            "";

        if (
            DATA &&
            typeof DATA.encodeBuild ===
                "function"
        ) {
            try {
                encoded =
                    DATA.encodeBuild(
                        payload
                    );
            } catch {
                encoded =
                    "";
            }
        }

        if (!encoded) {
            try {
                encoded =
                    btoa(
                        unescape(
                            encodeURIComponent(
                                JSON.stringify(
                                    payload
                                )
                            )
                        )
                    );
            } catch {
                encoded =
                    "";
            }
        }

        const base =
            window.location.href
                .split("#")[0];

        return (
            base +
            "#build-lab?build=" +
            encodeURIComponent(
                encoded
            )
        );
    }

    function openShareBuild() {
        const validation =
            validateCurrentBuild();

        if (!validation.ok) {
            showToast(
                validation.message,
                "error"
            );

            return;
        }

        const payload =
            validation.payload;

        const url =
            createShareURL(
                payload
            );

        state.sharePayload = {
            title:
                payload.name ||
                "HoKStation Build",

            text:
                payload.description ||
                "HoKStation build",

            url
        };

        const input =
            byId("share-url");

        if (input) {
            input.value =
                url;
        }

        openModal(
            "share-modal"
        );

        window.dispatchEvent(
            new CustomEvent(
                "hokstation:build-share",
                {
                    detail:
                        state.sharePayload
                }
            )
        );
    }

    function restoreBuildFromHash() {
        const hash =
            window.location.hash;

        if (
            !hash.startsWith(
                "#build-lab"
            )
        ) {
            return false;
        }

        const questionIndex =
            hash.indexOf("?");

        if (
            questionIndex ===
            -1
        ) {
            return false;
        }

        const query =
            new URLSearchParams(
                hash.slice(
                    questionIndex + 1
                )
            );

        const encoded =
            query.get(
                "build"
            );

        if (!encoded) {
            return false;
        }

        let payload =
            null;

        try {
            const decoded =
                decodeURIComponent(
                    encoded
                );

            if (
                DATA &&
                typeof DATA.decodeBuild ===
                    "function"
            ) {
                payload =
                    DATA.decodeBuild(
                        decoded
                    );
            }

            if (!payload) {
                payload =
                    JSON.parse(
                        decodeURIComponent(
                            escape(
                                atob(
                                    decoded
                                )
                            )
                        )
                    );
            }
        } catch {
            return false;
        }

        if (
            !payload ||
            typeof payload !==
                "object"
        ) {
            return false;
        }

        state.selectedBuildId =
            null;

        state.buildHeroId =
            safeString(
                payload.heroId ??
                payload.hero_id
            );

        const slots =
            payload.equipmentIds ??
            payload.equipment_ids ??
            payload.slots ??
            [];

        state.buildSlots =
            Array(6)
                .fill("")
                .map(
                    function (_, index) {
                        return safeString(
                            slots[index]
                        );
                    }
                );

        const name =
            byId(
                "build-name"
            );

        const description =
            byId(
                "build-description"
            );

        if (name) {
            name.value =
                safeString(
                    payload.name
                );
        }

        if (description) {
            description.value =
                safeString(
                    payload.description
                );
        }

        renderBuildHeroSelector();
        renderBuildSlots();

        return true;
    }

    /* =========================================================
       COMPARE
       ========================================================= */

    function getCompareCandidates() {
        return [
            ...getCollection(
                "heroes"
            ).map(
                function (item) {
                    return {
                        id:
                            "hero:" +
                            itemId(item),

                        rawId:
                            itemId(item),

                        type:
                            "hero",

                        name:
                            itemName(item)
                    };
                }
            ),

            ...getCollection(
                "equipment"
            ).map(
                function (item) {
                    return {
                        id:
                            "equipment:" +
                            itemId(item),

                        rawId:
                            itemId(item),

                        type:
                            "equipment",

                        name:
                            itemName(item)
                    };
                }
            ),

            ...getCollection(
                "builds"
            ).map(
                function (item) {
                    return {
                        id:
                            "build:" +
                            itemId(item),

                        rawId:
                            itemId(item),

                        type:
                            "build",

                        name:
                            itemName(item)
                    };
                }
            )
        ];
    }

    function populateCompareSelect(
        select
    ) {
        if (!select) {
            return;
        }

        const current =
            select.value;

        const candidates =
            getCompareCandidates();

        select.innerHTML =
            `<option value="">Select item</option>` +
            candidates
                .map(
                    function (candidate) {
                        return `
                            <option
                                value="${escapeHTML(
                                    candidate.id
                                )}"
                            >
                                ${escapeHTML(
                                    candidate.name
                                )}
                                — ${escapeHTML(
                                    candidate.type
                                )}
                            </option>
                        `;
                    }
                )
                .join("");

        if (
            candidates.some(
                function (candidate) {
                    return (
                        candidate.id ===
                        current
                    );
                }
            )
        ) {
            select.value =
                current;
        }
    }

    function renderCompare() {
        const root =
            byId(
                "compare-results"
            );

        if (!root) {
            return;
        }

        const firstId =
            state.compareA;

        const secondId =
            state.compareB;

        if (
            !firstId ||
            !secondId
        ) {
            root.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">⇄</span>
                    <h3>Choose two items</h3>
                    <p>
                        Select two supported items to compare.
                    </p>
                </div>
            `;

            return;
        }

        const a =
            resolveCompareItem(
                firstId
            );

        const b =
            resolveCompareItem(
                secondId
            );

        if (!a || !b) {
            root.innerHTML = `
                <div class="empty-state">
                    <h3>Comparison unavailable</h3>
                    <p>
                        One or both selected items are no longer
                        available in the current dataset.
                    </p>
                </div>
            `;

            return;
        }

        root.innerHTML = `
            <div class="compare-grid">

                <article class="panel compare-card">
                    <span class="eyebrow">
                        ${escapeHTML(
                            a.type
                        )}
                    </span>

                    <h2>
                        ${escapeHTML(
                            itemName(a.item)
                        )}
                    </h2>

                    ${renderCompareStats(
                        a.item
                    )}
                </article>

                <div class="compare-vs">
                    VS
                </div>

                <article class="panel compare-card">
                    <span class="eyebrow">
                        ${escapeHTML(
                            b.type
                        )}
                    </span>

                    <h2>
                        ${escapeHTML(
                            itemName(b.item)
                        )}
                    </h2>

                    ${renderCompareStats(
                        b.item
                    )}
                </article>

            </div>
        `;
    }

    function resolveCompareItem(
        value
    ) {
        const parts =
            safeString(
                value
            ).split(":");

        if (
            parts.length !==
            2
        ) {
            return null;
        }

        const type =
            parts[0];

        const id =
            parts.slice(
                1
            ).join(":");

        let item =
            null;

        if (
            type === "hero"
        ) {
            item =
                getHero(id);
        } else if (
            type === "equipment"
        ) {
            item =
                getEquipment(id);
        } else if (
            type === "build"
        ) {
            item =
                getBuild(id);
        }

        if (!item) {
            return null;
        }

        return {
            type,
            item
        };
    }

    function renderCompareStats(
        item
    ) {
        const stats =
            getStats(item);

        const keys =
            [
                [
                    "HP",
                    "hp"
                ],
                [
                    "Physical Attack",
                    "physicalAttack"
                ],
                [
                    "Magic Attack",
                    "magicAttack"
                ],
                [
                    "Armor",
                    "armor"
                ],
                [
                    "Magic Defense",
                    "magicDefense"
                ],
                [
                    "Movement Speed",
                    "movementSpeed"
                ]
            ];

        return `
            <div class="build-stat-list">
                ${keys
                    .map(
                        function (entry) {
                            const label =
                                entry[0];

                            const key =
                                entry[1];

                            const snake =
                                key.replace(
                                    /[A-Z]/g,
                                    function (letter) {
                                        return (
                                            "_" +
                                            letter.toLowerCase()
                                        );
                                    }
                                );

                            const value =
                                stats[key] ??
                                stats[snake];

                            return `
                                <div class="build-stat-row">
                                    <span>
                                        ${escapeHTML(
                                            label
                                        )}
                                    </span>

                                    <strong>
                                        ${escapeHTML(
                                            formatNumber(
                                                value
                                            )
                                        )}
                                    </strong>
                                </div>
                            `;
                        }
                    )
                    .join("")}
            </div>
        `;
    }

    /* =========================================================
       HISTORY / PATCHES
       ========================================================= */

    function renderPatches() {
        const root =
            byId(
                "patch-list"
            );

        if (!root) {
            return;
        }

        const patches =
            DATA &&
            typeof DATA.getPatches ===
                "function"
                ? array(
                    DATA.getPatches()
                )
                : getCollection(
                    "patches"
                );

        root.innerHTML = "";

        if (!patches.length) {
            root.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">◇</span>
                    <h3>No patch history</h3>
                    <p>
                        Official patch data will appear here when
                        the verified dataset is connected.
                    </p>
                </div>
            `;

            return;
        }

        patches.forEach(
            function (patch) {
                const article =
                    document.createElement(
                        "article"
                    );

                article.className =
                    "patch-card panel";

                article.innerHTML = `
                    <span class="eyebrow">
                        ${escapeHTML(
                            safeString(
                                patch.version ??
                                patch.patchVersion ??
                                patch.patch_version,
                                "Update"
                            )
                        )}
                    </span>

                    <h3>
                        ${escapeHTML(
                            itemName(
                                patch,
                                "Patch Update"
                            )
                        )}
                    </h3>

                    <p>
                        ${escapeHTML(
                            safeString(
                                patch.summary ??
                                patch.description,
                                "No summary available."
                            )
                        )}
                    </p>

                    <div class="card-meta">
                        <span>
                            ${escapeHTML(
                                formatDate(
                                    patch.releaseDate ??
                                    patch.release_date ??
                                    patch.updatedAt ??
                                    patch.updated_at
                                )
                            )}
                        </span>

                        ${
                            patch.official
                                ? `
                                    <span>
                                        Official
                                    </span>
                                `
                                : ""
                        }
                    </div>
                `;

                root.appendChild(
                    article
                );
            }
        );
    }

    function renderHistory() {
        const root =
            byId(
                "data-history-list"
            );

        if (!root) {
            return;
        }

        let rows = [];

        if (
            DATA &&
            typeof DATA.getHistory ===
                "function"
        ) {
            rows =
                array(
                    DATA.getHistory(
                        state.historyTab
                    )
                );
        } else {
            const collectionMap =
                {
                    changes:
                        "changeLogs",

                    patches:
                        "patches",

                    snapshots:
                        "rawSnapshots"
                };

            rows =
                getCollection(
                    collectionMap[
                        state.historyTab
                    ] || "changeLogs"
                );
        }

        root.innerHTML = "";

        if (!rows.length) {
            root.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">◇</span>
                    <h3>No history records</h3>
                    <p>
                        There are no records in this history category
                        yet.
                    </p>
                </div>
            `;

            return;
        }

        rows.forEach(
            function (row) {
                const article =
                    document.createElement(
                        "article"
                    );

                article.className =
                    "history-item panel";

                article.innerHTML = `
                    <div>
                        <span class="eyebrow">
                            ${escapeHTML(
                                safeString(
                                    row.type ??
                                    row.category ??
                                    state.historyTab,
                                    state.historyTab
                                )
                            )}
                        </span>

                        <h3>
                            ${escapeHTML(
                                itemName(
                                    row,
                                    "Data Change"
                                )
                            )}
                        </h3>

                        <p>
                            ${escapeHTML(
                                safeString(
                                    row.description ??
                                    row.summary ??
                                    row.message,
                                    "No description available."
                                )
                            )}
                        </p>
                    </div>

                    <time>
                        ${escapeHTML(
                            formatDate(
                                row.createdAt ??
                                row.created_at ??
                                row.updatedAt ??
                                row.updated_at ??
                                row.date
                            )
                        )}
                    </time>
                `;

                root.appendChild(
                    article
                );
            }
        );
    }

    /* =========================================================
       META
       ========================================================= */

    function renderMeta() {
        const root =
            byId(
                "meta-grid"
            );

        if (!root) {
            return;
        }

        const rows =
            DATA &&
            typeof DATA.getMeta ===
                "function"
                ? array(
                    DATA.getMeta()
                )
                : getCollection(
                    "meta"
                );

        root.innerHTML = "";

        if (!rows.length) {
            root.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">◇</span>
                    <h3>No meta data</h3>
                    <p>
                        Community meta tracking will appear once
                        verified records are available.
                    </p>
                </div>
            `;

            return;
        }

        rows.forEach(
            function (row) {
                const card =
                    document.createElement(
                        "article"
                    );

                card.className =
                    "panel meta-card";

                card.innerHTML = `
                    <span class="eyebrow">
                        ${escapeHTML(
                            safeString(
                                row.role ??
                                row.lane ??
                                row.category,
                                "Meta"
                            )
                        )}
                    </span>

                    <h3>
                        ${escapeHTML(
                            itemName(
                                row,
                                "Meta Record"
                            )
                        )}
                    </h3>

                    <p>
                        ${escapeHTML(
                            safeString(
                                row.description ??
                                row.summary,
                                "No additional description."
                            )
                        )}
                    </p>

                    ${
                        row.verified
                            ? `
                                <span class="role-badge">
                                    Verified
                                </span>
                            `
                            : ""
                    }
                `;

                root.appendChild(
                    card
                );
            }
        );
    }

    /* =========================================================
       NOTICES
       ========================================================= */

    function renderNotices() {
        const root =
            byId(
                "notice-list"
            );

        if (!root) {
            return;
        }

        const notices =
            DATA &&
            typeof DATA.getNotices ===
                "function"
                ? array(
                    DATA.getNotices()
                )
                : getCollection(
                    "notices"
                );

        root.innerHTML = "";

        if (!notices.length) {
            root.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">◇</span>
                    <h3>No active notices</h3>
                    <p>
                        Station notices will appear here when
                        published.
                    </p>
                </div>
            `;

            return;
        }

        notices.forEach(
            function (notice) {
                const article =
                    document.createElement(
                        "article"
                    );

                article.className =
                    "panel notice-card";

                article.innerHTML = `
                    <span class="eyebrow">
                        ${escapeHTML(
                            safeString(
                                notice.category,
                                "Notice"
                            )
                        )}
                    </span>

                    <h3>
                        ${escapeHTML(
                            itemName(
                                notice,
                                "Station Notice"
                            )
                        )}
                    </h3>

                    <p>
                        ${escapeHTML(
                            safeString(
                                notice.body ??
                                notice.description ??
                                notice.summary,
                                "No notice content."
                            )
                        )}
                    </p>

                    <time>
                        ${escapeHTML(
                            formatDate(
                                notice.publishedAt ??
                                notice.published_at ??
                                notice.updatedAt ??
                                notice.updated_at
                            )
                        )}
                    </time>
                `;

                root.appendChild(
                    article
                );
            }
        );
    }

    /* =========================================================
       FAVORITES
       ---------------------------------------------------------
       Account.js owns persistence.
       features.js only renders data supplied by account.js.
       ========================================================= */

    function renderFavorites(
        payload
    ) {
        const root =
            byId(
                "favorites-content"
            );

        if (!root) {
            return;
        }

        const data =
            payload || {};

        const ids =
            state.favoriteTab ===
                "builds"
                ? array(
                    data.buildIds
                )
                : array(
                    data.heroIds
                );

        root.innerHTML = "";

        if (!ids.length) {
            root.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">☆</span>
                    <h3>No favorites yet</h3>
                    <p>
                        ${
                            state.favoriteTab ===
                            "builds"
                                ? "Save builds to see them here."
                                : "Follow heroes to see them here."
                        }
                    </p>
                </div>
            `;

            return;
        }

        ids.forEach(
            function (id) {
                const item =
                    state.favoriteTab ===
                        "builds"
                        ? getBuild(id)
                        : getHero(id);

                if (!item) {
                    return;
                }

                const card =
                    document.createElement(
                        "article"
                    );

                card.className =
                    "data-card";

                card.innerHTML = `
                    <div class="card-content">
                        <span class="eyebrow">
                            ${escapeHTML(
                                state.favoriteTab
                            )}
                        </span>

                        <h3>
                            ${escapeHTML(
                                itemName(item)
                            )}
                        </h3>

                        <button
                            type="button"
                            class="secondary-button"
                            data-favorite-open="${escapeHTML(
                                itemId(item)
                            )}"
                            data-favorite-type="${escapeHTML(
                                state.favoriteTab
                            )}"
                        >
                            Open
                        </button>
                    </div>
                `;

                root.appendChild(
                    card
                );
            }
        );
    }

    /* =========================================================
       COMMUNITY
       ---------------------------------------------------------
       The actual persistence / posting is account.js.
       ========================================================= */

    function renderCommunity(
        questions
    ) {
        const root =
            byId(
                "question-list"
            );

        if (!root) {
            return;
        }

        const rows =
            array(
                questions
            );

        root.innerHTML = "";

        if (!rows.length) {
            root.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">?</span>
                    <h3>No questions yet</h3>
                    <p>
                        Be the first to start a useful discussion.
                    </p>
                </div>
            `;

            return;
        }

        rows.forEach(
            function (question) {
                const article =
                    document.createElement(
                        "article"
                    );

                article.className =
                    "question-card panel";

                article.dataset.questionId =
                    itemId(question);

                article.innerHTML = `
                    <span class="eyebrow">
                        ${escapeHTML(
                            safeString(
                                question.category,
                                "General"
                            )
                        )}
                    </span>

                    <h3>
                        ${escapeHTML(
                            itemName(
                                question,
                                "Question"
                            )
                        )}
                    </h3>

                    <p>
                        ${escapeHTML(
                            safeString(
                                question.body ??
                                question.content,
                                "No question body."
                            )
                        )}
                    </p>

                    <div class="card-meta">
                        <span>
                            ${escapeHTML(
                                safeString(
                                    question.authorName ??
                                    question.author_name ??
                                    "Community member"
                                )
                            )}
                        </span>

                        <span>
                            ${escapeHTML(
                                formatDate(
                                    question.createdAt ??
                                    question.created_at
                                )
                            )}
                        </span>
                    </div>

                    <button
                        type="button"
                        class="secondary-button"
                        data-open-question="${escapeHTML(
                            itemId(question)
                        )}"
                    >
                        Open Discussion
                    </button>
                `;

                root.appendChild(
                    article
                );
            }
        );
    }

    /* =========================================================
       SEARCH RESULT PAGE
       ========================================================= */

    function renderSearchResults(
        query,
        type,
        results
    ) {
        const summary =
            byId(
                "search-results-summary"
            );

        const root =
            byId(
                "search-results-page-content"
            );

        if (!root) {
            return;
        }

        const rows =
            array(
                results
            );

        if (summary) {
            summary.textContent =
                query
                    ? `${rows.length} result${
                        rows.length === 1
                            ? ""
                            : "s"
                    } for “${query}”`
                    : "Search the station database.";
        }

        root.innerHTML = "";

        if (!query) {
            root.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">⌕</span>
                    <h3>Enter a search</h3>
                    <p>
                        Search heroes, equipment, builds or updates.
                    </p>
                </div>
            `;

            return;
        }

        if (!rows.length) {
            root.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">⌕</span>
                    <h3>No results</h3>
                    <p>
                        No matching records were found in the
                        current dataset.
                    </p>
                </div>
            `;

            return;
        }

        rows.forEach(
            function (result) {
                const card =
                    document.createElement(
                        "article"
                    );

                card.className =
                    "panel search-result-card";

                const route =
                    safeString(
                        result.route
                    );

                card.innerHTML = `
                    <span class="eyebrow">
                        ${escapeHTML(
                            safeString(
                                result.type,
                                type || "Result"
                            )
                        )}
                    </span>

                    <h3>
                        ${escapeHTML(
                            itemName(
                                result,
                                "Search Result"
                            )
                        )}
                    </h3>

                    <p>
                        ${escapeHTML(
                            safeString(
                                result.subtitle ??
                                result.description,
                                "No description available."
                            )
                        )}
                    </p>

                    ${
                        route
                            ? `
                                <button
                                    type="button"
                                    class="secondary-button"
                                    data-search-route="${escapeHTML(
                                        route
                                    )}"
                                    data-search-id="${escapeHTML(
                                        itemId(result)
                                    )}"
                                >
                                    Open
                                </button>
                            `
                            : ""
                    }
                `;

                root.appendChild(
                    card
                );
            }
        );
    }

    /* =========================================================
       DATA EVENT REFRESH
       ========================================================= */

    function renderAllDataViews() {
        renderHeroes();
        renderEquipment();
        renderBuilds();
        renderPatches();
        renderHistory();
        renderMeta();
        renderNotices();
        renderBuildHeroSelector();
        renderBuildSlots();
        populateCompareSelect(
            byId(
                "compare-item-a"
            )
        );
        populateCompareSelect(
            byId(
                "compare-item-b"
            )
        );
        renderCompare();
    }

    /* =========================================================
       APP EVENTS
       ========================================================= */

    function handleAppEvent(
        event
    ) {
        const detail =
            event &&
            event.detail
                ? event.detail
                : {};

        switch (
            event.type
        ) {
            case "hokstation:app-ready":
                renderAllDataViews();
                restoreBuildFromHash();
                break;

            case "hokstation:data-ready":
                renderAllDataViews();
                break;

            case "hokstation:route":
                if (
                    detail &&
                    detail.route ===
                        "heroes"
                ) {
                    renderHeroes();
                }

                if (
                    detail &&
                    detail.route ===
                        "equipment"
                ) {
                    renderEquipment();
                }

                if (
                    detail &&
                    detail.route ===
                        "builds"
                ) {
                    renderBuilds();
                }

                if (
                    detail &&
                    detail.route ===
                        "build-lab"
                ) {
                    renderBuildHeroSelector();
                    renderBuildSlots();
                    restoreBuildFromHash();
                }

                if (
                    detail &&
                    detail.route ===
                        "patches"
                ) {
                    renderPatches();
                }

                if (
                    detail &&
                    detail.route ===
                        "data-history"
                ) {
                    renderHistory();
                }

                if (
                    detail &&
                    detail.route ===
                        "meta"
                ) {
                    renderMeta();
                }

                if (
                    detail &&
                    detail.route ===
                        "notices"
                ) {
                    renderNotices();
                }

                if (
                    detail &&
                    detail.route ===
                        "compare"
                ) {
                    populateCompareSelect(
                        byId(
                            "compare-item-a"
                        )
                    );

                    populateCompareSelect(
                        byId(
                            "compare-item-b"
                        )
                    );

                    renderCompare();
                }

                break;

            case "hokstation:search":
                state.lastSearchQuery =
                    safeString(
                        detail.query
                    );

                state.lastSearchType =
                    safeString(
                        detail.type,
                        "all"
                    );

                if (
                    detail.results
                ) {
                    renderSearchResults(
                        state.lastSearchQuery,
                        state.lastSearchType,
                        detail.results
                    );
                }

                break;

            default:
                break;
        }
    }

    /* =========================================================
       DOM EVENTS
       ========================================================= */

    function bindHeroControls() {
        all(
            "[data-hero-role]"
        ).forEach(
            function (button) {
                button.addEventListener(
                    "click",
                    function () {
                        applyHeroFilter(
                            button.getAttribute(
                                "data-hero-role"
                            )
                        );
                    }
                );
            }
        );

        const sort =
            byId(
                "hero-sort"
            );

        if (sort) {
            sort.addEventListener(
                "change",
                function () {
                    applyHeroSort(
                        sort.value
                    );
                }
            );
        }
    }

    function bindEquipmentControls() {
        all(
            "[data-equipment-type]"
        ).forEach(
            function (button) {
                button.addEventListener(
                    "click",
                    function () {
                        applyEquipmentFilter(
                            button.getAttribute(
                                "data-equipment-type"
                            )
                        );
                    }
                );
            }
        );

        const search =
            byId(
                "equipment-selector-search"
            );

        if (search) {
            search.addEventListener(
                "input",
                function () {
                    state.equipmentSearch =
                        search.value;

                    renderEquipmentSelectorList();
                }
            );
        }
    }

    function bindBuildControls() {
        const create =
            byId(
                "create-build-button"
            );

        if (create) {
            create.addEventListener(
                "click",
                clearBuild
            );
        }

        const openLab =
            byId(
                "open-build-lab"
            );

        if (openLab) {
            openLab.addEventListener(
                "click",
                function () {
                    navigate(
                        "build-lab"
                    );
                }
            );
        }

        const clear =
            byId(
                "clear-build-button"
            );

        if (clear) {
            clear.addEventListener(
                "click",
                clearBuild
            );
        }

        const save =
            byId(
                "save-build-button"
            );

        if (save) {
            save.addEventListener(
                "click",
                saveBuildRequest
            );
        }

        const share =
            byId(
                "share-build-button"
            );

        if (share) {
            share.addEventListener(
                "click",
                openShareBuild
            );
        }

        const heroSelector =
            byId(
                "build-hero-selector"
            );

        if (heroSelector) {
            heroSelector.addEventListener(
                "click",
                function (event) {
                    const button =
                        event.target.closest(
                            "[data-hero-select]"
                        );

                    if (!button) {
                        return;
                    }

                    selectBuildHero(
                        button.getAttribute(
                            "data-hero-select"
                        )
                    );
                }
            );
        }

        const slots =
            byId(
                "build-slots"
            );

        if (slots) {
            slots.addEventListener(
                "click",
                function (event) {
                    const button =
                        event.target.closest(
                            "[data-slot-action]"
                        );

                    if (!button) {
                        return;
                    }

                    openEquipmentSelector(
                        button.getAttribute(
                            "data-slot-action"
                        )
                    );
                }
            );
        }

        const equipmentList =
            byId(
                "equipment-selector-list"
            );

        if (equipmentList) {
            equipmentList.addEventListener(
                "click",
                function (event) {
                    const button =
                        event.target.closest(
                            "[data-equipment-select]"
                        );

                    if (!button) {
                        return;
                    }

                    selectEquipmentForSlot(
                        button.getAttribute(
                            "data-equipment-select"
                        )
                    );
                }
            );
        }
    }

    function bindCompareControls() {
        const selectA =
            byId(
                "compare-item-a"
            );

        const selectB =
            byId(
                "compare-item-b"
            );

        if (selectA) {
            selectA.addEventListener(
                "change",
                function () {
                    state.compareA =
                        selectA.value;

                    renderCompare();
                }
            );
        }

        if (selectB) {
            selectB.addEventListener(
                "change",
                function () {
                    state.compareB =
                        selectB.value;

                    renderCompare();
                }
            );
        }
    }

    function bindHistoryControls() {
        all(
            "[data-history-tab]"
        ).forEach(
            function (button) {
                button.addEventListener(
                    "click",
                    function () {
                        state.historyTab =
                            safeString(
                                button.getAttribute(
                                    "data-history-tab"
                                ),
                                "changes"
                            );

                        all(
                            "[data-history-tab]"
                        ).forEach(
                            function (
                                item
                            ) {
                                item.classList.toggle(
                                    "is-active",
                                    item ===
                                        button
                                );
                            }
                        );

                        renderHistory();
                    }
                );
            }
        );
    }

    function bindFavoriteControls() {
        all(
            "[data-favorite-tab]"
        ).forEach(
            function (button) {
                button.addEventListener(
                    "click",
                    function () {
                        state.favoriteTab =
                            safeString(
                                button.getAttribute(
                                    "data-favorite-tab"
                                ),
                                "heroes"
                            );

                        all(
                            "[data-favorite-tab]"
                        ).forEach(
                            function (
                                item
                            ) {
                                item.classList.toggle(
                                    "is-active",
                                    item ===
                                        button
                                );
                            }
                        );

                        window.dispatchEvent(
                            new CustomEvent(
                                "hokstation:favorites-request",
                                {
                                    detail: {
                                        type:
                                            state.favoriteTab
                                    }
                                }
                            )
                        );
                    }
                );
            }
        );
    }

    function bindCommunityControls() {
        all(
            "[data-community-filter]"
        ).forEach(
            function (button) {
                button.addEventListener(
                    "click",
                    function () {
                        state.communityFilter =
                            safeString(
                                button.getAttribute(
                                    "data-community-filter"
                                ),
                                "recent"
                            );

                        all(
                            "[data-community-filter]"
                        ).forEach(
                            function (
                                item
                            ) {
                                item.classList.toggle(
                                    "is-active",
                                    item ===
                                        button
                                );
                            }
                        );

                        window.dispatchEvent(
                            new CustomEvent(
                                "hokstation:community-request",
                                {
                                    detail: {
                                        filter:
                                            state.communityFilter
                                    }
                                }
                            )
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
                    openModal(
                        "question-modal"
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
                    openModal(
                        "report-modal"
                    );
                }
            );
        }
    }

    /* =========================================================
       GLOBAL FEATURE CLICK DELEGATION
       ========================================================= */

    function bindFeatureDelegation() {
        document.addEventListener(
            "click",
            function (event) {
                const hero =
                    event.target.closest(
                        "[data-feature-hero]"
                    );

                if (hero) {
                    event.preventDefault();

                    renderHeroDetail(
                        hero.getAttribute(
                            "data-feature-hero"
                        )
                    );

                    return;
                }

                const build =
                    event.target.closest(
                        "[data-load-build]"
                    );

                if (build) {
                    event.preventDefault();

                    loadBuildIntoLab(
                        build.getAttribute(
                            "data-load-build"
                        )
                    );

                    return;
                }

                const openBuild =
                    event.target.closest(
                        "[data-open-build-for]"
                    );

                if (openBuild) {
                    event.preventDefault();

                    clearBuild();

                    selectBuildHero(
                        openBuild.getAttribute(
                            "data-open-build-for"
                        )
                    );

                    navigate(
                        "build-lab"
                    );

                    return;
                }

                const searchRoute =
                    event.target.closest(
                        "[data-search-route]"
                    );

                if (searchRoute) {
                    event.preventDefault();

                    const route =
                        searchRoute.getAttribute(
                            "data-search-route"
                        );

                    if (route) {
                        navigate(
                            route
                        );
                    }

                    return;
                }

                const favoriteOpen =
                    event.target.closest(
                        "[data-favorite-open]"
                    );

                if (favoriteOpen) {
                    event.preventDefault();

                    const type =
                        favoriteOpen.getAttribute(
                            "data-favorite-type"
                        );

                    const id =
                        favoriteOpen.getAttribute(
                            "data-favorite-open"
                        );

                    if (
                        type ===
                        "heroes"
                    ) {
                        renderHeroDetail(
                            id
                        );
                    } else if (
                        type ===
                        "builds"
                    ) {
                        loadBuildIntoLab(
                            id
                        );
                    }
                }

                const question =
                    event.target.closest(
                        "[data-open-question]"
                    );

                if (question) {
                    event.preventDefault();

                    window.dispatchEvent(
                        new CustomEvent(
                            "hokstation:question-request",
                            {
                                detail: {
                                    id:
                                        question.getAttribute(
                                            "data-open-question"
                                        )
                                }
                            }
                        )
                    );

                    navigate(
                        "question-detail"
                    );
                }
            }
        );
    }

    /* =========================================================
       PUBLIC API
       ========================================================= */

    const API = {
        version: "1.0.0",

        getState:
            function () {
                return {
                    heroRole:
                        state.heroRole,

                    heroSort:
                        state.heroSort,

                    equipmentType:
                        state.equipmentType,

                    historyTab:
                        state.historyTab,

                    favoriteTab:
                        state.favoriteTab,

                    communityFilter:
                        state.communityFilter,

                    selectedHeroId:
                        state.selectedHeroId,

                    selectedBuildId:
                        state.selectedBuildId,

                    buildHeroId:
                        state.buildHeroId,

                    buildSlots:
                        state.buildSlots.slice(),

                    compareA:
                        state.compareA,

                    compareB:
                        state.compareB
                };
            },

        renderHeroes,
        renderHeroDetail,
        renderEquipment,
        renderBuilds,

        renderBuildHeroSelector,
        renderBuildSlots,
        updateBuildStats,

        renderPatches,
        renderHistory,
        renderMeta,
        renderNotices,

        renderFavorites,
        renderCommunity,
        renderSearchResults,

        getCurrentBuild:
            getCurrentBuildPayload,

        validateCurrentBuild,

        openShareBuild,

        loadBuildIntoLab,

        clearBuild,

        renderCompare,

        setFavoriteData:
            function (payload) {
                renderFavorites(
                    payload
                );
            },

        setCommunityQuestions:
            function (questions) {
                renderCommunity(
                    questions
                );
            },

        setCompare:
            function (
                first,
                second
            ) {
                state.compareA =
                    safeString(first);

                state.compareB =
                    safeString(second);

                const selectA =
                    byId(
                        "compare-item-a"
                    );

                const selectB =
                    byId(
                        "compare-item-b"
                    );

                if (selectA) {
                    selectA.value =
                        state.compareA;
                }

                if (selectB) {
                    selectB.value =
                        state.compareB;
                }

                renderCompare();
            },

        init:
            function () {
                renderAllDataViews();

                return API;
            }
    };

    /* =========================================================
       EVENT LISTENERS
       ========================================================= */

    window.addEventListener(
        "hokstation:app-ready",
        handleAppEvent
    );

    window.addEventListener(
        "hokstation:data-ready",
        handleAppEvent
    );

    window.addEventListener(
        "hokstation:route",
        handleAppEvent
    );

    window.addEventListener(
        "hokstation:search",
        handleAppEvent
    );

    /* =========================================================
       INITIALIZATION
       ========================================================= */

    function initialize() {
        if (
            state.initialized
        ) {
            return;
        }

        state.initialized =
            true;

        bindHeroControls();
        bindEquipmentControls();
        bindBuildControls();
        bindCompareControls();
        bindHistoryControls();
        bindFavoriteControls();
        bindCommunityControls();
        bindFeatureDelegation();

        renderAllDataViews();

        /*
         * app.js is already loaded before this file and may have
         * initialized before features.js reached DOMContentLoaded.
         * Render once immediately and again when app-ready/data-ready
         * events arrive.
         */
        restoreBuildFromHash();
    }

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

    /* =========================================================
       EXPOSE GLOBAL
       ========================================================= */

    window.HOKSTATION_FEATURES =
        Object.freeze(
            API
        );

})();
