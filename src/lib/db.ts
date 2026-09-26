import postgres from "postgres";

const globalForDb = globalThis as unknown as { __sql?: postgres.Sql };

/** Shared Postgres client, created on first use so builds work without DATABASE_URL. */
export function db(): postgres.Sql {
  if (!globalForDb.__sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    // prepare: false keeps it compatible with Supabase's transaction pooler.
    globalForDb.__sql = postgres(url, { prepare: false, max: 5, onnotice: () => {} });
  }
  return globalForDb.__sql;
}
