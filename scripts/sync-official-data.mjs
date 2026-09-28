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

async function main() {
  console.log("HoKStation Official Data Sync Engine");
  console.log("Testing official HoK hero page...");
  console.log(OFFICIAL_HERO_URL);

  const response = await fetch(OFFICIAL_HERO_URL, {
    headers: {
      "User-Agent": "HoKStation-Official-Sync/1.0",
      "Accept": "text/html,application/xhtml+xml",
    },
  });

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

  const hasHonorOfKings =
    /Honor of Kings|honor of kings/i.test(html);

  const hasHeroData =
    /hero|skill|skin|champion/i.test(html);

  console.log(
    `Honor of Kings content detected: ${hasHonorOfKings}`
  );

  console.log(
    `Hero-related content detected: ${hasHeroData}`
  );

  if (!hasHonorOfKings || !hasHeroData) {
    throw new Error(
      "Official hero page did not contain expected HoK content."
    );
  }

  console.log(
    "Official Hero Page Source Test: PASS"
  );
}

main().catch((error) => {
  console.error("Official source test failed:");
  console.error(error.message);
  process.exit(1);
});
