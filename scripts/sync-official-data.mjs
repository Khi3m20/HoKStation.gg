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

  return text ? JSON.parse(text) : null;
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
    id: match[1],
    name: match[2],
    chineseName: match[3],
    height: match[4],
  };
}

async function main() {
  console.log(
    "HoKStation Official Data Sync Engine"
  );

  console.log(
    "Official Hero DB Write Test"
  );

  console.log(OFFICIAL_HERO_URL);

  // 1. Download official hero page
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

  // 2. Parse official data
  const hero = parseHeroVariables(html);

  console.log("");
  console.log("=== OFFICIAL HERO DATA ===");
  console.log(`Hero ID: ${hero.id}`);
  console.log(`Hero Name: ${hero.name}`);
  console.log(
    `Chinese Name: ${
      hero.chineseName || "Not provided"
    }`
  );
  console.log(`Height: ${hero.height}`);

  // 3. Prepare DB record
  const heroRecord = {
    id: hero.id,
    name: hero.name,
  };

  console.log("");
  console.log("=== DATABASE WRITE ===");
  console.log(
    JSON.stringify(heroRecord, null, 2)
  );

  // 4. Upsert into heroes
  const result = await supabase(
    "heroes?on_conflict=id",
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(heroRecord),
    }
  );

  console.log("");
  console.log(
    `Database rows returned: ${
      Array.isArray(result)
        ? result.length
        : 0
    }`
  );

  if (!Array.isArray(result) || result.length === 0) {
    throw new Error(
      "Database write returned no rows."
    );
  }

  console.log(
    `Database hero ID: ${result[0].id}`
  );

  console.log(
    `Database hero name: ${result[0].name}`
  );

  console.log("");
  console.log(
    "Official Hero DB Write Test: PASS"
  );
}

main().catch((error) => {
  console.error(
    "Official hero DB write failed:"
  );

  console.error(error.message);

  process.exit(1);
});
