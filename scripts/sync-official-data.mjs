const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  throw new Error("Missing SUPABASE_URL");
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
}

const OFFICIAL_HERO_LIST_URL =
  "https://world.honorofkings.com/ipworld/en/m/champion.html";

const OFFICIAL_HERO_BASE =
  "https://world.honorofkings.com";

const headers = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

async function supabase(path, options = {}) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${path}`,
    {
      ...options,
      headers: {
        ...headers,
        ...(options.headers || {}),
      },
    }
  );

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `Supabase ${response.status}: ${text}`
    );
  }

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Supabase returned invalid JSON: ${text}`
    );
  }
}

async function fetchOfficial(url) {
  const response = await fetch(
    url,
    {
      headers: {
        "User-Agent":
          "HoKStation-Official-Sync/1.0",
        "Accept":
          "text/html,application/xhtml+xml",
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Official source HTTP ${response.status}: ${url}`
    );
  }

  const html = await response.text();

  if (html.length < 5000) {
    throw new Error(
      `Official source response unexpectedly small: ${url}`
    );
  }

  return html;
}

function createSlug(name) {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug) {
    throw new Error(
      `Could not create slug from hero name: "${name}"`
    );
  }

  return slug;
}

function parseHeroVariables(html) {
  const match = html.match(
    /var\s+heroId\s*=\s*"([^"]*)"\s*,\s*heroName\s*=\s*"([^"]*)"\s*,\s*heroCh\s*=\s*"([^"]*)"\s*,\s*heroHeight\s*=\s*"([^"]*)"/i
  );

  if (!match) {
    throw new Error(
      "Could not find official hero variables."
    );
  }

  const hero = {
    id: match[1].trim(),
    name: match[2].trim(),
    chineseName: match[3].trim(),
    height: match[4].trim(),
  };

  if (!/^\d+$/.test(hero.id)) {
    throw new Error(
      `Invalid official hero ID: "${hero.id}"`
    );
  }

  if (!hero.name) {
    throw new Error(
      `Official hero ${hero.id} has no name.`
    );
  }

  return hero;
}

function findOfficialHeroUrls(html) {
  const urls = new Map();

  /*
   * Official detail-page format:
   *
   * /zlkdatasys/ip/hero/en/117.html
   *
   * We accept:
   * - absolute URLs
   * - root-relative URLs
   * - URLs with additional query/hash
   */

  const regex =
    /(?:https?:\/\/world\.honorofkings\.com)?\/zlkdatasys\/ip\/hero\/en\/(\d+)\.html(?:[?#][^"'<> ]*)?/gi;

  for (const match of html.matchAll(regex)) {
    const id = match[1];

    if (!urls.has(id)) {
      urls.set(
        id,
        `${OFFICIAL_HERO_BASE}/zlkdatasys/ip/hero/en/${id}.html`
      );
    }
  }

  return [...urls.values()];
}

function validateHeroRecord(hero) {
  if (!hero.id) {
    throw new Error(
      "Hero record is missing ID."
    );
  }

  if (!/^\d+$/.test(String(hero.id))) {
    throw new Error(
      `Invalid hero ID: "${hero.id}"`
    );
  }

  if (!hero.name) {
    throw new Error(
      `Hero ${hero.id} is missing name.`
    );
  }

  if (!hero.slug) {
    throw new Error(
      `Hero ${hero.id} is missing slug.`
    );
  }
}

async function mapWithConcurrency(
  items,
  limit,
  worker
) {
  const results = new Array(
    items.length
  );

  let nextIndex = 0;

  async function runner() {
    while (true) {
      const index = nextIndex++;

      if (index >= items.length) {
        return;
      }

      results[index] =
        await worker(
          items[index],
          index
        );
    }
  }

  const workerCount = Math.min(
    limit,
    items.length
  );

  await Promise.all(
    Array.from(
      { length: workerCount },
      () => runner()
    )
  );

  return results;
}

async function main() {
  console.log(
    "HoKStation Official Data Sync Engine"
  );

  console.log(
    "Full Official Hero Sync"
  );

  // ==================================================
  // 1. Download official hero list
  // ==================================================

  console.log("");
  console.log(
    "=== OFFICIAL HERO LIST ==="
  );

  console.log(
    OFFICIAL_HERO_LIST_URL
  );

  const listHtml =
    await fetchOfficial(
      OFFICIAL_HERO_LIST_URL
    );

  console.log(
    `Official hero list downloaded: ${listHtml.length} characters`
  );

  const heroUrls =
    findOfficialHeroUrls(listHtml);

  console.log(
    `Official hero URLs detected: ${heroUrls.length}`
  );

  if (heroUrls.length === 0) {
    throw new Error(
      "No official hero detail URLs detected. Database write skipped."
    );
  }

  // ==================================================
  // 2. Download every official hero page
  // ==================================================

  console.log("");
  console.log(
    "=== PARSING OFFICIAL HEROES ==="
  );

  const parsedHeroes =
    await mapWithConcurrency(
      heroUrls,
      6,
      async (url, index) => {
        const html =
          await fetchOfficial(url);

        const hero =
          parseHeroVariables(html);

        const record = {
          id: hero.id,
          name: hero.name,
          slug: createSlug(hero.name),
        };

        validateHeroRecord(record);

        console.log(
          `[${index + 1}/${heroUrls.length}] ${record.id} | ${record.name} | ${record.slug}`
        );

        return record;
      }
    );

  // ==================================================
  // 3. Remove duplicate IDs
  // ==================================================

  const heroesById =
    new Map();

  for (const hero of parsedHeroes) {
    const id = String(hero.id);

    if (heroesById.has(id)) {
      const previous =
        heroesById.get(id);

      if (
        previous.name !== hero.name ||
        previous.slug !== hero.slug
      ) {
        throw new Error(
          `Conflicting data for hero ID ${id}.`
        );
      }

      continue;
    }

    heroesById.set(
      id,
      hero
    );
  }

  const heroes =
    [...heroesById.values()];

  if (heroes.length === 0) {
    throw new Error(
      "No valid official heroes were parsed. Database write skipped."
    );
  }

  // ==================================================
  // 4. Check duplicate slugs
  // ==================================================

  const slugs =
    new Map();

  for (const hero of heroes) {
    if (slugs.has(hero.slug)) {
      const previous =
        slugs.get(hero.slug);

      throw new Error(
        `Duplicate slug "${hero.slug}" found for heroes ${previous.id} (${previous.name}) and ${hero.id} (${hero.name}).`
      );
    }

    slugs.set(
      hero.slug,
      hero
    );
  }

  console.log("");
  console.log(
    "=== PARSER RESULT ==="
  );

  console.log(
    `Hero URLs: ${heroUrls.length}`
  );

  console.log(
    `Heroes parsed: ${parsedHeroes.length}`
  );

  console.log(
    `Unique heroes: ${heroes.length}`
  );

  // ==================================================
  // 5. Show a small sample before DB write
  // ==================================================

  console.log("");
  console.log(
    "=== HERO SAMPLE ==="
  );

  heroes
    .slice(0, 10)
    .forEach((hero, index) => {
      console.log(
        `${index + 1}. ${hero.id} | ${hero.name} | ${hero.slug}`
      );
    });

  if (heroes.length > 10) {
    console.log(
      `... ${heroes.length - 10} more heroes`
    );
  }

  // ==================================================
  // 6. Write all heroes to Supabase
  // ==================================================

  console.log("");
  console.log(
    "=== DATABASE WRITE ==="
  );

  console.log(
    `Upserting ${heroes.length} heroes into public.heroes...`
  );

  const result =
    await supabase(
      "heroes?on_conflict=id",
      {
        method: "POST",
        headers: {
          Prefer:
            "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify(
          heroes
        ),
      }
    );

  if (!Array.isArray(result)) {
    throw new Error(
      "Database write did not return an array."
    );
  }

  if (
    result.length !== heroes.length
  ) {
    throw new Error(
      `Database returned ${result.length} rows, expected ${heroes.length}.`
    );
  }

  console.log(
    `Database rows returned: ${result.length}`
  );

  // ==================================================
  // 7. Verify returned records
  // ==================================================

  const expectedById =
    new Map(
      heroes.map((hero) => [
        String(hero.id),
        hero,
      ])
    );

  for (const savedHero of result) {
    const expected =
      expectedById.get(
        String(savedHero.id)
      );

    if (!expected) {
      throw new Error(
        `Unexpected hero returned by database: ${savedHero.id}`
      );
    }

    if (
      savedHero.name !==
      expected.name
    ) {
      throw new Error(
        `Name mismatch for hero ${savedHero.id}: expected "${expected.name}", received "${savedHero.name}".`
      );
    }

    if (
      savedHero.slug !==
      expected.slug
    ) {
      throw new Error(
        `Slug mismatch for hero ${savedHero.id}: expected "${expected.slug}", received "${savedHero.slug}".`
      );
    }
  }

  console.log(
    "Returned database records verified."
  );

  // ==================================================
  // 8. Read-back verification
  // ==================================================

  console.log("");
  console.log(
    "=== DATABASE READ-BACK TEST ==="
  );

  const verifyResult =
    await supabase(
      "heroes?select=id,name,slug",
      {
        method: "GET",
      }
    );

  if (
    !Array.isArray(
      verifyResult
    )
  ) {
    throw new Error(
      "Database read-back did not return an array."
    );
  }

  const databaseById =
    new Map(
      verifyResult.map(
        (hero) => [
          String(hero.id),
          hero,
        ]
      )
    );

  let verifiedCount = 0;

  for (const expected of heroes) {
    const actual =
      databaseById.get(
        String(expected.id)
      );

    if (!actual) {
      throw new Error(
        `Hero ${expected.id} (${expected.name}) was not found during read-back.`
      );
    }

    if (
      actual.name !==
      expected.name
    ) {
      throw new Error(
        `Read-back name mismatch for hero ${expected.id}.`
      );
    }

    if (
      actual.slug !==
      expected.slug
    ) {
      throw new Error(
        `Read-back slug mismatch for hero ${expected.id}.`
      );
    }

    verifiedCount++;
  }

  console.log(
    `Heroes verified from database: ${verifiedCount}`
  );

  // ==================================================
  // 9. Final result
  // ==================================================

  console.log("");
  console.log(
    "=== FINAL RESULT ==="
  );

  console.log(
    "Official hero list: PASS"
  );

  console.log(
    "Official hero parsing: PASS"
  );

  console.log(
    `Heroes parsed: ${heroes.length}`
  );

  console.log(
    "Database bulk upsert: PASS"
  );

  console.log(
    "Database read-back: PASS"
  );

  console.log("");
  console.log(
    "FULL OFFICIAL HERO SYNC: PASS"
  );
}

main().catch((error) => {
  console.error("");
  console.error(
    "Full official hero sync failed:"
  );

  console.error(
    error.message
  );

  process.exit(1);
});
