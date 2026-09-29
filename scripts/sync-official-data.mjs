const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  throw new Error("Missing SUPABASE_URL");
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
}

const OFFICIAL_BASE =
  "https://world.honorofkings.com/zlkdatasys/ip/hero/en";

const MAX_ID = 800;
const CONCURRENCY = 20;

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

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Supabase returned invalid JSON: ${text}`
    );
  }
}

function createSlug(name) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseHero(html, expectedId) {
  const variableMatch = html.match(
    /var\s+heroId\s*=\s*"([^"]*)"\s*,\s*heroName\s*=\s*"([^"]*)"/i
  );

  if (variableMatch) {
    const id = variableMatch[1].trim();
    const name = variableMatch[2].trim();

    if (
      /^\d+$/.test(id) &&
      name &&
      String(id) === String(expectedId)
    ) {
      return {
        id,
        name,
      };
    }
  }

  const titleMatch = html.match(
    /Champion\s+Deatails\s+([A-Z][A-Z\s.'-]{1,80})/i
  );

  if (!titleMatch) {
    return null;
  }

  const name = titleMatch[1]
    .replace(/\s+/g, " ")
    .trim();

  if (!name) {
    return null;
  }

  return {
    id: String(expectedId),
    name,
  };
}

async function fetchHero(id) {
  const url = `${OFFICIAL_BASE}/${id}.html`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "HoKStation-Official-Sync/1.0",
        Accept:
          "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();

    if (html.length < 3000) {
      return null;
    }

    const hero = parseHero(html, id);

    if (!hero) {
      return null;
    }

    const slug = createSlug(hero.name);

    if (!slug) {
      return null;
    }

    return {
      id: hero.id,
      name: hero.name,
      slug,
    };
  } catch {
    return null;
  }
}

async function runPool(ids) {
  const results = [];
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor++;

      if (index >= ids.length) {
        return;
      }

      const id = ids[index];
      const hero = await fetchHero(id);

      if (hero) {
        results.push(hero);

        console.log(
          `[FOUND] ${hero.id} - ${hero.name}`
        );
      }
    }
  }

  const workers = Array.from(
    { length: CONCURRENCY },
    () => worker()
  );

  await Promise.all(workers);

  return results;
}

function validateHeroes(heroes) {
  if (!Array.isArray(heroes)) {
    throw new Error(
      "Hero result is not an array."
    );
  }

  if (heroes.length === 0) {
    throw new Error(
      "Official hero scan returned zero heroes."
    );
  }

  const ids = new Set();
  const slugs = new Set();

  for (const hero of heroes) {
    if (!hero.id) {
      throw new Error(
        "Hero is missing ID."
      );
    }

    if (!/^\d+$/.test(String(hero.id))) {
      throw new Error(
        `Invalid hero ID: ${hero.id}`
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

    if (ids.has(String(hero.id))) {
      throw new Error(
        `Duplicate hero ID: ${hero.id}`
      );
    }

    if (slugs.has(hero.slug)) {
      throw new Error(
        `Duplicate hero slug: ${hero.slug}`
      );
    }

    ids.add(String(hero.id));
    slugs.add(hero.slug);
  }
}

async function writeHeroes(heroes) {
  const batchSize = 50;

  for (
    let i = 0;
    i < heroes.length;
    i += batchSize
  ) {
    const batch = heroes.slice(
      i,
      i + batchSize
    );

    await supabase(
      "heroes?on_conflict=id",
      {
        method: "POST",
        headers: {
          Prefer:
            "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify(batch),
      }
    );

    console.log(
      `Database batch ${Math.min(
        i + batch.length,
        heroes.length
      )}/${heroes.length} written.`
    );
  }
}

async function verifyHeroes(heroes) {
  const result = await supabase(
    "heroes?select=id,name,slug&order=id.asc",
    {
      method: "GET",
    }
  );

  if (!Array.isArray(result)) {
    throw new Error(
      "Database verification returned invalid data."
    );
  }

  const dbIds = new Set(
    result.map((hero) => String(hero.id))
  );

  let verified = 0;

  for (const hero of heroes) {
    if (dbIds.has(String(hero.id))) {
      verified++;
    }
  }

  if (verified !== heroes.length) {
    throw new Error(
      `Database verification failed: ${verified}/${heroes.length} heroes found.`
    );
  }

  return result;
}

async function logSync(status, details) {
  try {
    await supabase(
      "sync_jobs",
      {
        method: "POST",
        headers: {
          Prefer:
            "return=minimal",
        },
        body: JSON.stringify({
          job_type: "OFFICIAL_HERO_SYNC",
          status,
          details,
        }),
      }
    );
  } catch (error) {
    console.warn(
      `sync_jobs logging skipped: ${error.message}`
    );
  }
}

async function main() {
  console.log("");
  console.log(
    "========================================"
  );
  console.log(
    " HoKStation Official Hero Data Sync"
  );
  console.log(
    "========================================"
  );
  console.log("");

  console.log(
    "Official source:"
  );
  console.log(
    `${OFFICIAL_BASE}/{ID}.html`
  );

  console.log("");
  console.log(
    `Scanning official hero IDs 1-${MAX_ID}...`
  );

  const ids = Array.from(
    { length: MAX_ID },
    (_, index) => index + 1
  );

  const heroes = await runPool(ids);

  heroes.sort(
    (a, b) =>
      Number(a.id) - Number(b.id)
  );

  console.log("");
  console.log(
    `Official heroes discovered: ${heroes.length}`
  );

  validateHeroes(heroes);

  console.log("");
  console.log(
    "Writing official heroes to Supabase..."
  );

  await writeHeroes(heroes);

  console.log("");
  console.log(
    "Verifying database..."
  );

  const databaseHeroes =
    await verifyHeroes(heroes);

  console.log("");
  console.log(
    "========================================"
  );
  console.log(
    " FINAL RESULT"
  );
  console.log(
    "========================================"
  );

  console.log(
    `Official heroes found: ${heroes.length}`
  );

  console.log(
    `Database heroes available: ${databaseHeroes.length}`
  );

  console.log(
    "Official source: PASS"
  );

  console.log(
    "Hero ID discovery: PASS"
  );

  console.log(
    "Hero parser: PASS"
  );

  console.log(
    "Database write: PASS"
  );

  console.log(
    "Database read-back: PASS"
  );

  console.log("");
  console.log(
    "HoKStation Official Hero Sync: PASS"
  );

  await logSync(
    "SUCCESS",
    `Official hero sync completed. ${heroes.length} heroes discovered and verified.`
  );
}

main().catch(async (error) => {
  console.error("");
  console.error(
    "========================================"
  );
  console.error(
    " OFFICIAL HERO SYNC FAILED"
  );
  console.error(
    "========================================"
  );

  console.error(
    error.message
  );

  await logSync(
    "FAILED",
    error.message
  ).catch(() => {});

  process.exit(1);
});
