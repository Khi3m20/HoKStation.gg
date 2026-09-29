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

function cleanText(value) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function findTitle(html) {
  const match = html.match(
    /<title[^>]*>([\s\S]*?)<\/title>/i
  );

  return match
    ? cleanText(match[1])
    : null;
}

function findHeroImages(html) {
  const matches = [
    ...html.matchAll(
      /https?:\/\/[^"'<> ]+\.(?:png|jpg|jpeg|webp)/gi
    ),
  ];

  return [
    ...new Set(
      matches.map((match) => match[0])
    ),
  ].slice(0, 10);
}

async function main() {
  console.log(
    "HoKStation Official Data Sync Engine"
  );

  console.log(
    "Reading official HoK hero data..."
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

  const heroDataDetected =
    /hero|skill|skin|champion/i.test(html);

  if (!heroDataDetected) {
    throw new Error(
      "Official hero page did not contain expected hero content."
    );
  }

  const title = findTitle(html);
  const images = findHeroImages(html);

  console.log("");
  console.log("Official Hero Data Preview");
  console.log("--------------------------");

  console.log(
    `Page title: ${title || "Not detected"}`
  );

  console.log(
    `Hero image URLs detected: ${images.length}`
  );

  images.forEach(
    (image, index) => {
      console.log(
        `Image ${index + 1}: ${image}`
      );
    }
  );

  console.log("");
  console.log(
    "Database write: SKIPPED"
  );

  console.log(
    "Official Hero Read Test: PASS"
  );
}

main().catch((error) => {
  console.error(
    "Official hero read failed:"
  );

  console.error(error.message);

  process.exit(1);
});
