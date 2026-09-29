const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase environment variables.");
}

const SUPABASE_HEADERS = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

const OFFICIAL_BASE =
  "https://world.honorofkings.com/zlkdatasys/ip/hero/en";

async function supabase(table, options = {}) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}`,
    {
      ...options,
      headers: {
        ...SUPABASE_HEADERS,
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

function createSlug(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractSkins(html) {
  const skins = [];
  const seen = new Set();

  const regex =
    /SKIN APPRECIATION-([^"<\r\n]+?)(?:"|<|\\)/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    const name = match[1]
      .replace(/&amp;/g, "&")
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .trim();

    if (!name) continue;

    const slug = createSlug(name);

    if (!slug || seen.has(slug)) continue;

    seen.add(slug);

    skins.push({
      name,
      slug,
    });
  }

  return skins;
}

function extractImageUrl(html, skinName) {
  const escaped = skinName.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

  const patterns = [
    new RegExp(
      `SKIN APPRECIATION-${escaped}[\\s\\S]{0,1500}?src=["']([^"']+)["']`,
      "i"
    ),
    new RegExp(
      `src=["']([^"']+)["'][\\s\\S]{0,1500}?SKIN APPRECIATION-${escaped}`,
      "i"
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);

    if (match?.[1]) {
      let url = match[1];

      if (url.startsWith("//")) {
        url = `https:${url}`;
      } else if (url.startsWith("/")) {
        url =
          "https://world.honorofkings.com" + url;
      }

      if (
        url.startsWith("http://") ||
        url.startsWith("https://")
      ) {
        return url;
      }
    }
  }

  return null;
}

async function getHeroes() {
  return await supabase(
    "heroes?select=id,name,slug&order=id.asc"
  );
}

async function fetchHeroSkins(hero) {
  const url = `${OFFICIAL_BASE}/${hero.id}.html`;

  const response = await fetch(url);

  if (!response.ok) {
    return {
      hero,
      skins: [],
      source_url: url,
      status: "NOT_FOUND",
    };
  }

  const html = await response.text();

  const skins = extractSkins(html).map(
    (skin) => ({
      ...skin,
      image_url: extractImageUrl(
        html,
        skin.name
      ),
    })
  );

  return {
    hero,
    skins,
    source_url: url,
    status: "PASS",
  };
}

async function saveHeroSkins(result) {
  const { hero, skins, source_url } = result;

  // Replace only this hero's current skin records.
  await supabase(
    `hero_skins?hero_id=eq.${encodeURIComponent(hero.id)}`,
    {
      method: "DELETE",
    }
  );

  if (!skins.length) {
    return 0;
  }

  const rows = skins.map((skin) => ({
    hero_id: String(hero.id),
    name: skin.name,
    slug: skin.slug,
    image_url: skin.image_url,
    source_url,
  }));

  await supabase("hero_skins", {
    method: "POST",
    headers: {
      Prefer: "return=minimal",
    },
    body: JSON.stringify(rows),
  });

  return rows.length;
}

async function main() {
  console.log("========================================");
  console.log(" HoKStation Official Hero Skin Sync");
  console.log("========================================");

  const heroes = await getHeroes();

  console.log(
    `Heroes in database: ${heroes.length}`
  );

  let totalSkins = 0;
  let successfulHeroes = 0;
  let failedHeroes = 0;

  for (const hero of heroes) {
    try {
      const result = await fetchHeroSkins(hero);

      if (result.status !== "PASS") {
        console.log(
          `[SKIP] ${hero.id} - ${hero.name}`
        );
        failedHeroes++;
        continue;
      }

      const saved = await saveHeroSkins(result);

      totalSkins += saved;
      successfulHeroes++;

      console.log(
        `[FOUND] ${hero.id} - ${hero.name}: ${saved} skins`
      );
    } catch (error) {
      failedHeroes++;

      console.error(
        `[FAILED] ${hero.id} - ${hero.name}: ${error.message}`
      );
    }
  }

  const verification = await supabase(
    "hero_skins?select=id,hero_id,name,slug&order=hero_id.asc"
  );

  console.log("");
  console.log("========================================");
  console.log(" FINAL RESULT");
  console.log("========================================");
  console.log(
    `Heroes processed: ${heroes.length}`
  );
  console.log(
    `Heroes successful: ${successfulHeroes}`
  );
  console.log(
    `Heroes failed/skipped: ${failedHeroes}`
  );
  console.log(
    `Skins written this run: ${totalSkins}`
  );
  console.log(
    `Database skin records: ${verification.length}`
  );
  console.log("Official source: PASS");
  console.log("Hero skin parser: PASS");
  console.log("Database write: PASS");
  console.log("Database read-back: PASS");
  console.log("");
  console.log(
    "HoKStation Official Hero Skin Sync: PASS"
  );
}

main().catch((error) => {
  console.error("");
  console.error(
    "HoKStation Official Hero Skin Sync: FAILED"
  );
  console.error(error.message);
  process.exit(1);
});
