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

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function cleanText(value) {
  return decodeHtml(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function findSkinNames(html) {
  const results = [];

  const regex =
    /SKIN APPRECIATION-[^<"'=\n]{1,150}/gi;

  for (const match of html.matchAll(regex)) {
    const value = match[0]
      .replace(/^SKIN APPRECIATION-/i, "")
      .trim();

    if (value && !results.includes(value)) {
      results.push(value);
    }
  }

  return results;
}

function findHeroAssetPaths(html) {
  const regex =
    /\/zlkdatasys\/ip\/hero\/en\/[^"'<> ]+\.(?:jpg|jpeg|png|webp)/gi;

  return [
    ...new Set(
      [...html.matchAll(regex)].map(
        (match) => match[0]
      )
    ),
  ];
}

async function main() {
  console.log(
    "HoKStation Official Data Sync Engine"
  );

  console.log(
    "Parsing official HoK hero data..."
  );

  console.log(OFFICIAL_HERO_URL);

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

  const hero = parseHeroVariables(html);
  const skins = findSkinNames(html);
  const assets = findHeroAssetPaths(html);

  console.log("");
  console.log("=== OFFICIAL HERO PARSED DATA ===");

  console.log(`Hero ID: ${hero.id}`);
  console.log(`Hero Name: ${hero.name}`);
  console.log(
    `Chinese Name: ${hero.chineseName || "Not provided"}`
  );
  console.log(`Height: ${hero.height}`);

  console.log("");
  console.log(
    `Skin names detected: ${skins.length}`
  );

  skins.forEach((skin, index) => {
    console.log(
      `Skin ${index + 1}: ${skin}`
    );
  });

  console.log("");
  console.log(
    `Official hero asset paths detected: ${assets.length}`
  );

  assets.forEach((asset, index) => {
    console.log(
      `Asset ${index + 1}: ${asset}`
    );
  });

  console.log("");
  console.log(
    "Database write: SKIPPED"
  );

  console.log(
    "Official Hero Parser Test: PASS"
  );
}

main().catch((error) => {
  console.error(
    "Official hero parser failed:"
  );

  console.error(error.message);

  process.exit(1);
});
