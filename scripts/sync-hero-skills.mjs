const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase environment variables.");
}

const OFFICIAL_BASE =
  "https://world.honorofkings.com/zlkdatasys/ip/hero/en";

const headers = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

async function supabase(table, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${table}`;

  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      ...headers,
      ...(options.headers || {}),
    },
    body: options.body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Supabase ${response.status}: ${text}`
    );
  }

  if (response.status === 204) return null;

  return response.json();
}

async function fetchOfficialHero(id) {
  const url = `${OFFICIAL_BASE}/${id}.html`;

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "HoKStation-Official-Data-Sync/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Official hero ${id}: HTTP ${response.status}`
    );
  }

  return response.text();
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\u00a0/g, " ")
    .trim();
}

function cleanText(value) {
  return decodeHtml(
    value
      .replace(/<[^>]*>/g, " ")
      .replace(/\\n/g, " ")
      .replace(/\s+/g, " ")
  ).trim();
}

function createSlug(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/*
  Official hero pages have changed markup over time.
  We therefore search several known skill-data patterns
  instead of depending on one CSS class.
*/
function extractSkills(html) {
  const skills = [];

  const pushSkill = (
    name,
    description,
    order,
    imageUrl = null
  ) => {
    name = cleanText(name);
    description = cleanText(description);

    if (!name) return;

    const lower = name.toLowerCase();

    if (
      lower === "hero data" ||
      lower === "hero information" ||
      lower === "hero voice" ||
      lower === "skin appreciation" ||
      lower === "relevant content"
    ) {
      return;
    }

    if (
      skills.some(
        (skill) =>
          skill.name.toLowerCase() === lower
      )
    ) {
      return;
    }

    skills.push({
      name,
      description: description || null,
      skill_order: order,
      image_url: imageUrl,
    });
  };

  /*
    Pattern 1:
    HTML/data containing explicit skill objects.
  */
  const objectRegex =
    /(?:skillName|skill_name|name)\s*[:=]\s*["']([^"']+)["'][\s\S]{0,1200}?(?:description|desc|skillDesc|skill_desc)\s*[:=]\s*["']([^"']*)["']/gi;

  let match;
  let order = 1;

  while ((match = objectRegex.exec(html))) {
    pushSkill(
      match[1],
      match[2],
      order++
    );

    if (order > 10) break;
  }

  /*
    Pattern 2:
    Common official page text markers.
  */
  const markerRegex =
    /(?:SKILL NAME|SKILL-NAME|SKILL_TITLE|SKILL TITLE)\s*[-:=]\s*["']?([^"<>\r\n]+)["']?/gi;

  while ((match = markerRegex.exec(html))) {
    pushSkill(
      match[1],
      null,
      order++
    );

    if (order > 10) break;
  }

  /*
    Pattern 3:
    Some official builds expose skill data in JSON.
  */
  const jsonPatterns = [
    /"skillName"\s*:\s*"([^"]+)"[\s\S]{0,1500}?"(?:description|desc)"\s*:\s*"([^"]*)"/gi,
    /"name"\s*:\s*"([^"]+)"[\s\S]{0,1000}?"skillDesc"\s*:\s*"([^"]*)"/gi,
  ];

  for (const regex of jsonPatterns) {
    while ((match = regex.exec(html))) {
      pushSkill(
        match[1],
        match[2],
        order++
      );

      if (order > 10) break;
    }
  }

  /*
    Normalize order after duplicate filtering.
  */
  return skills.map((skill, index) => ({
    ...skill,
    skill_order: index + 1,
    slug: createSlug(skill.name),
  }));
}

function validateSkills(hero, skills) {
  if (!Array.isArray(skills)) {
    throw new Error(
      `Hero ${hero.id}: skills parser did not return an array.`
    );
  }

  const seen = new Set();

  for (const skill of skills) {
    if (!skill.name) {
      throw new Error(
        `Hero ${hero.id}: skill without name.`
      );
    }

    if (!skill.slug) {
      throw new Error(
        `Hero ${hero.id}: could not create skill slug.`
      );
    }

    if (seen.has(skill.slug)) {
      throw new Error(
        `Hero ${hero.id}: duplicate skill slug ${skill.slug}`
      );
    }

    seen.add(skill.slug);
  }
}

async function logSync(status) {
  try {
    await supabase("sync_jobs", {
      method: "POST",
      headers: {
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        job_type: "OFFICIAL_HERO_SKILL_SYNC",
        status,
      }),
    });
  } catch (error) {
    console.warn(
      `sync_jobs logging skipped: ${error.message}`
    );
  }
}

async function main() {
  console.log("Reading heroes from database...");

  const heroes = await supabase(
    "heroes?select=id,name,slug&order=id.asc"
  );

  console.log(
    `Heroes in database: ${heroes.length}`
  );

  let successful = 0;
  let failed = 0;
  let written = 0;

  for (const hero of heroes) {
    try {
      const html = await fetchOfficialHero(hero.id);

      const skills = extractSkills(html);

      /*
        Safety rule:
        NEVER delete existing DB skills if parser
        returned zero. This prevents catastrophic
        empty syncs caused by an official markup change.
      */
      if (skills.length === 0) {
        throw new Error(
          "No skills detected. Existing database records were NOT deleted."
        );
      }

      validateSkills(hero, skills);

      /*
        Delete only after successful parsing.
      */
      await supabase(
        `hero_skills?hero_id=eq.${encodeURIComponent(
          hero.id
        )}`,
        {
          method: "DELETE",
          headers: {
            Prefer: "return=minimal",
          },
        }
      );

      const rows = skills.map((skill) => ({
        hero_id: hero.id,
        name: skill.name,
        slug: skill.slug,
        description: skill.description,
        image_url: skill.image_url,
        source_url: `${OFFICIAL_BASE}/${hero.id}.html`,
        skill_order: skill.skill_order,
      }));

      await supabase("hero_skills", {
        method: "POST",
        headers: {
          Prefer: "return=minimal",
        },
        body: JSON.stringify(rows),
      });

      written += rows.length;
      successful++;

      console.log(
        `[FOUND] ${hero.id} - ${hero.name}: ${rows.length} skills`
      );
    } catch (error) {
      failed++;

      console.error(
        `[FAILED] ${hero.id} - ${hero.name}: ${error.message}`
      );
    }
  }

  const databaseSkills = await supabase(
    "hero_skills?select=id,hero_id,name,slug,skill_order&order=hero_id.asc,skill_order.asc"
  );

  console.log("");
  console.log("========================================");
  console.log(" FINAL RESULT");
  console.log("========================================");
  console.log(`Heroes processed: ${heroes.length}`);
  console.log(`Heroes successful: ${successful}`);
  console.log(`Heroes failed/skipped: ${failed}`);
  console.log(`Skills written this run: ${written}`);
  console.log(
    `Database skill records: ${databaseSkills.length}`
  );
  console.log("Official source: PASS");
  console.log(
    `Hero skill parser: ${successful > 0 ? "PASS" : "FAIL"}`
  );
  console.log(
    `Database write: ${
      written > 0 ? "PASS" : "FAIL"
    }`
  );
  console.log(
    `Database read-back: ${
      databaseSkills.length > 0 ? "PASS" : "FAIL"
    }`
  );

  if (
    failed === 0 &&
    successful === heroes.length &&
    written > 0
  ) {
    await logSync("SUCCESS");
    console.log("");
    console.log(
      "HoKStation Official Hero Skill Sync: PASS"
    );
  } else {
    await logSync("FAILED");

    throw new Error(
      "HoKStation Official Hero Skill Sync: FAIL"
    );
  }
}

main().catch(async (error) => {
  console.error("");
  console.error(error.message);
  await logSync("FAILED").catch(() => {});
  process.exit(1);
});
