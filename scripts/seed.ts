import "./env";
import { randomInt } from "crypto";
import { hashPin } from "../src/lib/auth";
import { toGoogleReviewUrl } from "../src/lib/branches";
import { db } from "../src/lib/db";

// Creates the first branch. Usage:
//   SEED_STAFF_PIN=4821 SEED_GOOGLE_PLACE_ID=ChIJxxxx npm run db:seed
async function main() {
  const sql = db();
  const pin = process.env.SEED_STAFF_PIN || String(randomInt(100000, 1000000));
  const google = toGoogleReviewUrl(process.env.SEED_GOOGLE_PLACE_ID ?? "") ?? "";

  const rows = await sql`
    INSERT INTO branches (slug, name, google_review_url, reward_text, staff_pin_hash)
    VALUES ('khulafa-bistro', 'Khulafa Bistro', ${google}, 'Free drink', ${hashPin(pin)})
    ON CONFLICT (slug) DO NOTHING
    RETURNING id`;

  if (rows.length) {
    console.log("Created branch 'Khulafa Bistro' (customer link: /r/khulafa-bistro)");
    console.log(`Staff PIN: ${pin}`);
    if (!google) console.log("No Google review link yet: add it in /admin → Edit.");
  } else {
    console.log("Branch 'khulafa-bistro' already exists; nothing changed.");
  }
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
