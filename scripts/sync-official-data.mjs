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

function printMatches(label, html, regex, limit = 20) {
  const matches = [...html.matchAll(regex)]
    .map((match) => cleanText(match[1] || match[0]))
    .filter(Boolean)
    .slice(0, limit);

  console.log("");
  console.log(`${label}: ${matches.length}`);

  matches.forEach((value, index) => {
    console.log(`${index + 1}: ${value.slice(0, 500)}`);
  });
}

async function main() {
  console.log(
    "HoKStation Official Data Sync Engine"
  );

  console.log(
    "Inspecting official HoK hero page structure..."
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

  console.log("");
  console.log("=== HTML STRUCTURE INSPECTION ===");

  printMatches(
    "Script blocks",
    html,
    /<script[^>]*>([\s\S]*?)<\/script>/gi,
    10
  );

  printMatches(
    "Data-like attributes",
    html,
    /(?:data-[a-z0-9_-]+)\s*=\s*["']([^"']+)["']/gi,
    30
  );

  printMatches(
    "Hero-related strings",
    html,
    /([^"'<>]{0,120}(?:hero|skill|skin|champion)[^"'<>]{0,180})/gi,
    30
  );

  printMatches(
    "JSON-like objects",
    html,
    /(\{[^{}]{0,500}(?:hero|skill|skin|champion)[^{}]{0,500}\})/gi,
    20
  );

  console.log("");
  console.log(
    "Database write: SKIPPED"
  );

  console.log(
    "Official Source Structure Inspection: PASS"
  );
}

main().catch((error) => {
  console.error(
    "Official source inspection failed:"
  );

  console.error(error.message);

  process.exit(1);
});
