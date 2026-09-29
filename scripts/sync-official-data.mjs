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
  "https://world.honorofkings.com/zlkdatasys/ip/hero/en/";

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
      `Official source returned HTTP ${response.status}: ${url}`
    );
  }

  const html = await response.text();

  if (html.length < 5000) {
    throw new Error(
      `Official page is unexpectedly small: ${url}`
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

  return {
    id: match[1].trim(),
    name: match[2].trim(),
    chineseName: match[3].trim(),
    height: match[4].trim(),
  };
}

/*
 * The official champion index does not reliably expose
 * direct hero .html URLs in its static HTML.
 *
 * Therefore we collect numeric hero IDs from the official
 * page and verify every candidate by opening the official
 * hero detail page.
 */
function findHeroIds(html) {
  const ids = new Set();

  const patterns = [
    /heroId\s*[:=]\s*["']?(\d{1,6})["']?/gi,
    /hero_id\s*[:=]\s*["']?(\d{1,6})["']?/gi,
    /hero-id\s*[:=]\s*["']?(\d{1,6})["']?/gi,
    /hero\/(\d{1,6})/gi,
    /heroId=(\d{1,6})/gi,
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const id = match[1];

      if (id) {
        ids.add(id);
      }
    }
  }

  return [...ids];
}

function validateHero(hero) {
  if (!hero.id) {
    throw new Error(
      "Official hero is missing ID."
    );
  }

  if (!/^\d+$/.test(hero.id)) {
    throw new Error(
      `Invalid hero ID: ${hero.id}`
    );
  }

  if (!hero.name) {
    throw new Error(
      `Official hero ${hero.id} is missing name.`
    );
  }
}

async function tryHero(id) {
  const url =
    `${OFFICIAL_HERO_BASE}${id}.html`;

  try {
    const html =
      await fetchOfficial(url);

    const hero =
      parseHeroVariables(html);

    validateHero(hero);

    if (
      String(hero.id) !==
      String(id)
    ) {
      return null;
    }

    return {
      id: hero.id,
      name: hero.name,
      slug: createSlug(hero.name),
    };
  } catch {
    return null;
  }
}

async function mapWithConcurrency(
  items,
  limit,
  worker
) {
  const results = new Array(items.length);

  let nextIndex = 0;

  async function runner() {
    while (true) {
      const index = nextIndex++;

      if (index >= items.length) {
        return;
      }

      results[index] =
        await worker(items[index], index);
    }
  }

  const workers = Array.from(
    {
      length: Math.min(
        limit,
        items.length
      ),
    },
    () => runner()
  );

  await Promise.all(workers);

  return results;
}

async function upsertInBatches(
  records,
  batchSize = 50
) {
  for (
    let i = 0;
    i < records.length;
    i += batchSize
  ) {
    const batch =
      records.slice(
        i,
        i + batchSize
      );

    console.log(
      `Writing heroes ${i + 1}-${Math.min(
        i + batchSize,
        records.length
      )} of ${records.length}...`
    );

    const result =
      await supabase(
        "heroes?on_conflict=id",
        {
          method: "POST",
          headers: {
            Prefer:
              "resolution=merge-duplicates,return=minimal",
          },
          body:
            JSON.stringify(batch),
        }
      );

    void result;
  }
}

async function verifyHeroes(records) {
  const saved =
    await supabase(
      "heroes?select=id,name,slug",
      {
        method: "GET",
      }
    );

  if (!Array.isArray(saved)) {
    throw new Error(
      "Could not read heroes from database."
    );
  }

  const byId =
    new Map(
      saved.map((hero) => [
        String(hero.id),
        hero,
      ])
    );

  const missing = [];
  const mismatched = [];

  for (const hero of records) {
    const databaseHero =
      byId.get(
        String(hero.id)
      );

    if (!databaseHero) {
      missing.push(hero.id);
      continue;
    }

    if (
      databaseHero.name !==
        hero.name ||
      databaseHero.slug !==
        hero.slug
    ) {
      mismatched.push(
        `${hero.id}:${hero.name}`
      );
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Database verification missing ${missing.length} heroes: ${missing.slice(0, 10).join(", ")}`
    );
  }

  if (mismatched.length > 0) {
    throw new Error(
      `Database verification found mismatches: ${mismatched.slice(0, 10).join(", ")}`
    );
  }

  return saved.length;
}

async function main() {
  console.log(
    "HoKStation Official Data Sync Engine"
  );

  console.log(
    "FULL OFFICIAL HERO SYNC"
  );

  console.log("");

  /*
   * 1. Download official champion index.
   */

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

  /*
   * 2. Discover candidate IDs.
   */

  const candidateIds =
    findHeroIds(listHtml);

  console.log(
    `Hero ID candidates detected: ${candidateIds.length}`
  );

  if (
    candidateIds.length === 0
  ) {
    throw new Error(
      "No hero IDs detected from official champion list. Database write skipped."
    );
  }

  /*
   * 3. Verify candidates against
   *    real official hero pages.
   */

  console.log("");

  console.log(
    "=== VERIFYING OFFICIAL HERO PAGES ==="
  );

  const parsed =
    await mapWithConcurrency(
      candidateIds,
      6,
      async (id, index) => {
        const hero =
          await tryHero(id);

        if (hero) {
          console.log(
            `[${index + 1}/${candidateIds.length}] PASS ${hero.id} ${hero.name}`
          );
        }

        return hero;
      }
    );

  const heroes =
    parsed.filter(Boolean);

  console.log("");

  console.log(
    `Official hero pages verified: ${heroes.length}`
  );

  if (heroes.length === 0) {
    throw new Error(
      "No valid official hero detail pages were verified. Database write skipped."
    );
  }

  /*
   * 4. Deduplicate by ID.
   */

  const uniqueById =
    new Map();

  for (const hero of heroes) {
    uniqueById.set(
      String(hero.id),
      hero
    );
  }

  const uniqueHeroes =
    [...uniqueById.values()];

  /*
   * 5. Detect duplicate slugs.
   */

  const slugOwners =
    new Map();

  for (const hero of uniqueHeroes) {
    const existing =
      slugOwners.get(
        hero.slug
      );

    if (
      existing &&
      existing.id !== hero.id
    ) {
      throw new Error(
        `Duplicate hero slug "${hero.slug}" for IDs ${existing.id} and ${hero.id}. Database write skipped.`
      );
    }

    slugOwners.set(
      hero.slug,
      hero
    );
  }

  console.log(
    `Unique official heroes: ${uniqueHeroes.length}`
  );

  /*
   * 6. Show sample.
   */

  console.log("");

  console.log(
    "=== HERO SAMPLE ==="
  );

  for (
    const hero of uniqueHeroes.slice(
      0,
      10
    )
  ) {
    console.log(
      `${hero.id} | ${hero.name} | ${hero.slug}`
    );
  }

  /*
   * 7. Write to Supabase.
   */

  console.log("");

  console.log(
    "=== DATABASE WRITE ==="
  );

  await upsertInBatches(
    uniqueHeroes,
    50
  );

  console.log(
    "All official heroes written successfully."
  );

  /*
   * 8. Read back and verify.
   */

  console.log("");

  console.log(
    "=== DATABASE READ-BACK ==="
  );

  const databaseCount =
    await verifyHeroes(
      uniqueHeroes
    );

  console.log(
    `Database heroes available: ${databaseCount}`
  );

  /*
   * 9. Final result.
   */

  console.log("");

  console.log(
    "=== FINAL RESULT ==="
  );

  console.log(
    "Official hero list: PASS"
  );

  console.log(
    "Official hero discovery: PASS"
  );

  console.log(
    "Official hero page verification: PASS"
  );

  console.log(
    "Hero parsing: PASS"
  );

  console.log(
    "Database write: PASS"
  );

  console.log(
    "Database read-back: PASS"
  );

  console.log("");

  console.log(
    `FULL OFFICIAL HERO SYNC: PASS — ${uniqueHeroes.length} heroes`
  );
}

main().catch(
  (error) => {
    console.error("");

    console.error(
      "Full official hero sync failed:"
    );

    console.error(
      error.message
    );

    process.exit(1);
  }
);
