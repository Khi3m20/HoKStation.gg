const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  throw new Error("Missing SUPABASE_URL");
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
}

const OFFICIAL_HERO_URL =
  "https://world.honorofkings.com/zlkdatasys/ip/hero/en/117.html";

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

function validateHero(hero) {
  if (!hero.id) {
    throw new Error(
      "Official hero data is missing hero ID."
    );
  }

  if (!/^\d+$/.test(hero.id)) {
    throw new Error(
      `Invalid hero ID: "${hero.id}"`
    );
  }

  if (!hero.name) {
    throw new Error(
      "Official hero data is missing hero name."
    );
  }
}

async function main() {
  console.log(
    "HoKStation Official Data Sync Engine"
  );

  console.log(
    "Official Hero DB Write Test"
  );

  console.log("");
  console.log(
    "=== OFFICIAL SOURCE ==="
  );

  console.log(OFFICIAL_HERO_URL);

  // --------------------------------------------------
  // 1. Download official hero page
  // --------------------------------------------------

  const response = await fetch(
    OFFICIAL_HERO_URL,
    {
      headers: {
        "User-Agent":
          "HoKStation-Official-Sync/1.0",
        "Accept":
          "text/html,application/xhtml+xml",
      },
    }
  );

  console.log(
    `Official hero HTTP status: ${response.status}`
  );

  if (!response.ok) {
    throw new Error(
      `Official hero page returned HTTP ${response.status}`
    );
  }

  const html = await response.text();

  console.log(
    `Official hero page downloaded: ${html.length} characters`
  );

  if (html.length < 5000) {
    throw new Error(
      "Official hero page response is unexpectedly small."
    );
  }

  // --------------------------------------------------
  // 2. Parse official hero data
  // --------------------------------------------------

  const hero = parseHeroVariables(html);

  validateHero(hero);

  const slug = createSlug(hero.name);

  console.log("");
  console.log(
    "=== OFFICIAL HERO DATA ==="
  );

  console.log(`Hero ID: ${hero.id}`);
  console.log(`Hero Name: ${hero.name}`);
  console.log(
    `Chinese Name: ${
      hero.chineseName || "Not provided"
    }`
  );
  console.log(`Height: ${hero.height}`);
  console.log(`Generated Slug: ${slug}`);

  // --------------------------------------------------
  // 3. Prepare database record
  // --------------------------------------------------

  const heroRecord = {
    id: hero.id,
    name: hero.name,
    slug: slug,
  };

  console.log("");
  console.log(
    "=== DATABASE WRITE PAYLOAD ==="
  );

  console.log(
    JSON.stringify(heroRecord, null, 2)
  );

  // --------------------------------------------------
  // 4. Upsert hero into public.heroes
  // --------------------------------------------------

  console.log("");
  console.log(
    "Writing hero to public.heroes..."
  );

  const result = await supabase(
    "heroes?on_conflict=id",
    {
      method: "POST",
      headers: {
        Prefer:
          "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(heroRecord),
    }
  );

  if (
    !Array.isArray(result) ||
    result.length === 0
  ) {
    throw new Error(
      "Database write returned no hero rows."
    );
  }

  const savedHero = result[0];

  console.log(
    "Database write request completed."
  );

  console.log("");
  console.log(
    "=== DATABASE RESPONSE ==="
  );

  console.log(
    `Database hero ID: ${savedHero.id}`
  );

  console.log(
    `Database hero name: ${savedHero.name}`
  );

  console.log(
    `Database hero slug: ${savedHero.slug}`
  );

  // --------------------------------------------------
  // 5. Verify returned data
  // --------------------------------------------------

  if (
    String(savedHero.id) !==
    String(hero.id)
  ) {
    throw new Error(
      `Database ID mismatch. Expected ${hero.id}, received ${savedHero.id}.`
    );
  }

  if (
    savedHero.name !== hero.name
  ) {
    throw new Error(
      `Database name mismatch. Expected ${hero.name}, received ${savedHero.name}.`
    );
  }

  if (
    savedHero.slug !== slug
  ) {
    throw new Error(
      `Database slug mismatch. Expected ${slug}, received ${savedHero.slug}.`
    );
  }

  console.log("");
  console.log(
    "Returned database data verified."
  );

  // --------------------------------------------------
  // 6. Read the hero back from Supabase
  // --------------------------------------------------

  console.log("");
  console.log(
    "=== DATABASE READ-BACK TEST ==="
  );

  const verifyResult = await supabase(
    `heroes?id=eq.${encodeURIComponent(hero.id)}&select=id,name,slug`,
    {
      method: "GET",
    }
  );

  if (
    !Array.isArray(verifyResult) ||
    verifyResult.length !== 1
  ) {
    throw new Error(
      `Database read-back expected 1 hero, received ${
        Array.isArray(verifyResult)
          ? verifyResult.length
          : 0
      }.`
    );
  }

  const verifiedHero = verifyResult[0];

  console.log(
    `Verified ID: ${verifiedHero.id}`
  );

  console.log(
    `Verified name: ${verifiedHero.name}`
  );

  console.log(
    `Verified slug: ${verifiedHero.slug}`
  );

  if (
    String(verifiedHero.id) !==
      String(hero.id) ||
    verifiedHero.name !== hero.name ||
    verifiedHero.slug !== slug
  ) {
    throw new Error(
      "Database read-back verification failed."
    );
  }

  console.log("");
  console.log(
    "=== FINAL RESULT ==="
  );

  console.log(
    "Official source: PASS"
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
    "Official Hero DB Write Test: PASS"
  );
}

main().catch((error) => {
  console.error("");
  console.error(
    "Official hero DB write failed:"
  );

  console.error(error.message);

  process.exit(1);
});
