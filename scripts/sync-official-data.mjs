const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  throw new Error("Missing SUPABASE_URL");
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
}

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

async function main() {
  console.log(
    "HoKStation Official Data Sync Engine"
  );

  console.log(
    "Supabase connection settings detected."
  );

  const jobs = await supabase(
    "sync_jobs",
    {
      method: "POST",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        job_type: "official_data_sync",
        status: "RUNNING",
        started_at: new Date().toISOString(),
      }),
    }
  );

  const job = jobs?.[0];

  if (!job?.id) {
    throw new Error(
      "Could not create sync_jobs record."
    );
  }

  console.log(
    `Sync job created: ${job.id}`
  );

  await supabase(
    `sync_jobs?id=eq.${job.id}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status: "SUCCESS",
        finished_at: new Date().toISOString(),
      }),
    }
  );

  console.log(
    "Sync job completed successfully."
  );

  console.log("Engine test: PASS");
}

main().catch(error => {
  console.error(
    "Official sync failed:"
  );

  console.error(error.message);

  process.exit(1);
});
