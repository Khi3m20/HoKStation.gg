const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  throw new Error("Missing SUPABASE_URL");
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
}

const OFFICIAL_HERO_LIST =
  "https://world.honorofkings.com/ipworld/en/m/champion.html";

async function testOfficialSource() {
  console.log("HoKStation Official Data Sync Engine");
  console.log("Testing official HoK hero source...");
  console.log(OFFICIAL_HERO_LIST);

  const response = await fetch(
    OFFICIAL_HERO_LIST,
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
    `Official source HTTP status: ${response.status}`
  );

  if (!response.ok) {
    throw new Error(
      `Official source returned HTTP ${response.status}`
    );
  }

  const html = await response.text();

  console.log(
    `Official source downloaded: ${html.length} characters`
  );

  if (html.length < 10000) {
    throw new Error(
      "Official hero page response is unexpectedly small."
    );
  }

  const heroLinks = [
    ...html.matchAll(
      /href\s*=\s*["']([^"']*\/zlkdatasys\/ip\/hero\/[^"']+)["']/gi
    ),
  ];

  console.log(
    `Hero links detected: ${heroLinks.length}`
  );

  if (heroLinks.length === 0) {
    throw new Error(
      "No official hero links detected."
    );
  }

  console.log(
    "Official Hero Source Test: PASS"
  );
}

testOfficialSource().catch(error => {
  console.error(
    "Official source test failed:"
  );

  console.error(error.message);

  process.exit(1);
});
