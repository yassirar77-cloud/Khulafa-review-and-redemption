# Khulafa Bistro: QR review & free drink

Customers scan a QR code at the table and land on a page for their branch:

1. **Free drink on us**: they enter a name and phone number and get a voucher to show at the counter.
2. **Review us on Google**: the voucher screen then shows, under the voucher QR, "While you wait, tell us how we did on Google" with a button to the branch's Google review form. It's marked optional; the drink is theirs either way.

The voucher screen shows a 6-digit code and a QR code. At `/staff` the cashier logs in with the branch PIN, taps **Scan QR** to read the customer's QR with the phone's back camera (or types the code), then taps **Redeem**. The owner manages branches, prints QR posters and sees the numbers at `/admin`.

## About Google's review rules

Google's policy doesn't allow offering rewards **in exchange for** reviews. If Google spots it, it can remove your reviews or suspend your Business Profile. Also, nobody can check whether a customer actually posted a review, because Google offers no way to do that.

So this app keeps the two separate. Every customer who scans can claim the drink, and the page says "No review needed". The Google button only appears afterwards, on the voucher, marked as optional, and people who enjoyed their meal tend to use it. Keep the wording on your posters and signs the same: "Free drink, and tell us how we did on Google", not "Review us to get a free drink".

## Pages

| Page | Who | What |
| --- | --- | --- |
| `/r/<branch>` | Customers (QR code) | Free drink claim |
| `/v/<code>` | Customers | Their voucher code and QR to show at the counter, plus an optional Google review button |
| `/staff` | Cashier | Log in with branch PIN, check and redeem codes |
| `/staff?code=<code>` | Cashier (scanned from voucher QR) | Checks that code straight away; staff still tap Redeem |
| `/admin` | Owner | Stats, add or edit branches, print QR posters |

## Rules built in

- One voucher per phone number per branch, then a waiting period (default 30 days, set per branch). If someone claims again while their voucher is still unused, they get the same code back.
- Vouchers expire (default 24 hours) and only work at the branch they were claimed at.
- A code can only be redeemed once, even if two tills try at the same moment.
- Scanning a voucher QR never redeems it by itself: the cashier must be logged in and tap **Redeem**. If they aren't logged in, they see the PIN login first and then return to the same code.
- **Scan QR** on `/staff` uses the camera inside the page. It only fills in the code and checks it; the cashier still taps **Redeem**. If camera permission is blocked, the page says how to allow it, and typing the code always works. The camera needs the site's `https://` address (or `localhost`).
- New codes are 6 digits, typed on a number keypad. Older codes with letters (from before this change) still work.
- 5 wrong staff PINs lock that branch's login for 15 minutes.
- Phone numbers are masked (last 4 digits) on staff and admin screens.

## Setup

You need Node.js 20+ and a Postgres database. [Supabase](https://supabase.com) free tier works well.

```bash
npm install
cp .env.example .env        # then fill in the values
npm run db:migrate          # creates the tables
SEED_STAFF_PIN=4821 npm run db:seed   # creates "Khulafa Bistro" with its Google review link
npm run dev                 # http://localhost:3000
```

### Your Google review link

In the branch settings, paste either:

- your **Place ID** (find it with [Google's Place ID finder](https://developers.google.com/maps/documentation/places/web-service/place-id)), or
- the review link from your Google Business Profile ("Ask for reviews" / "Get more reviews").

### Deploying (Vercel + Supabase)

1. Create a Supabase project. Copy the **Transaction pooler** connection string (the **Connect** button at the top of the project).
2. Run `npm run db:migrate` and `npm run db:seed` once with that `DATABASE_URL`.
3. Import this repo in Vercel and set the environment variables `DATABASE_URL`, `ADMIN_PASSWORD` and `PUBLIC_BASE_URL` (your final domain). `SESSION_SECRET` is optional.
4. Open `/admin`, check the branch, then print the QR poster.

Set `PUBLIC_BASE_URL` before printing posters. The QR codes contain that address, so it shouldn't change afterwards.

All tables live in a separate `review` schema, so the app can share a Supabase database with other apps without touching their tables.

## Adding more branches

`/admin` → **+ Add branch**. Give it a name, its own Google review link and a staff PIN, then print its QR poster. **Reward details** (for example "Sirap Ais or Teh O Ais") is shown to customers on the claim page, voucher and poster, and to the cashier at redeem time, so everyone knows exactly what the free drink is. Each branch gets its own link (`/r/<link-name>`), its own stats, and its own staff PIN. Vouchers only work at the branch they came from.

## Tests

```bash
TEST_DATABASE_URL=postgres://postgres@localhost:5432/khulafa_test npm test
```

These tests need an empty throwaway database; they drop and recreate the `review` schema.

Browser tests of the QR → `/staff?code=` flow and the in-page **Scan QR** camera (using Chromium's fake camera, with Android Chrome and Samsung Internet phone profiles) run against a running app. It claims and redeems a real voucher, so point it at a local or test copy:

```bash
E2E_BASE_URL=http://localhost:3000 E2E_STAFF_PIN=4821 npm run test:e2e
```

Set `CHROMIUM_PATH` if Playwright can't find a browser on its own.
