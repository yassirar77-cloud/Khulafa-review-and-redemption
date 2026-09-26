# Khulafa Bistro: QR review & free drink

Customers scan a QR code at the table and land on a page for their branch. The page does two things:

1. **Review us on Google**: a button that opens the branch's Google review form.
2. **Free drink on us**: they enter a name and phone number and get a voucher code to show at the counter.

Staff check and redeem codes at `/staff` with a branch PIN. The owner manages branches, prints QR posters and sees the numbers at `/admin`.

## About Google's review rules

Google's policy doesn't allow offering rewards **in exchange for** reviews. If Google spots it, it can remove your reviews or suspend your Business Profile. Also, nobody can check whether a customer actually posted a review, because Google offers no way to do that.

So this app keeps the two separate. Every customer who scans can claim the drink, and the page says "No review needed". The Google button sits next to it, and people who enjoyed their meal tend to use it. Keep the wording on your posters and signs the same: "Free drink, and tell us how we did on Google", not "Review us to get a free drink".

## Pages

| Page | Who | What |
| --- | --- | --- |
| `/r/<branch>` | Customers (QR code) | Google review button + free drink claim |
| `/v/<code>` | Customers | Their voucher, to show at the counter |
| `/staff` | Cashier | Log in with branch PIN, check and redeem codes |
| `/admin` | Owner | Stats, add or edit branches, print QR posters |

## Rules built in

- One voucher per phone number per branch, then a waiting period (default 30 days, set per branch). If someone claims again while their voucher is still unused, they get the same code back.
- Vouchers expire (default 24 hours) and only work at the branch they were claimed at.
- A code can only be redeemed once, even if two tills try at the same moment.
- 5 wrong staff PINs lock that branch's login for 15 minutes.
- Phone numbers are masked (last 4 digits) on staff and admin screens.

## Setup

You need Node.js 20+ and a Postgres database. [Supabase](https://supabase.com) free tier works well.

```bash
npm install
cp .env.example .env        # then fill in the values
npm run db:migrate          # creates the tables
SEED_STAFF_PIN=4821 SEED_GOOGLE_PLACE_ID=<your Place ID> npm run db:seed   # creates "Khulafa Bistro"
npm run dev                 # http://localhost:3000
```

### Your Google review link

In the branch settings, paste either:

- your **Place ID** (find it with [Google's Place ID finder](https://developers.google.com/maps/documentation/places/web-service/place-id)), or
- the review link from your Google Business Profile ("Ask for reviews" / "Get more reviews").

### Deploying (Vercel + Supabase)

1. Create a Supabase project. Copy the **Transaction pooler** connection string (Project Settings → Database).
2. Run `npm run db:migrate` and `npm run db:seed` once with that `DATABASE_URL`.
3. Import this repo in Vercel and set the environment variables `DATABASE_URL`, `ADMIN_PASSWORD`, `SESSION_SECRET` and `PUBLIC_BASE_URL` (your final domain).
4. Open `/admin`, check the branch, then print the QR poster.

Set `PUBLIC_BASE_URL` before printing posters. The QR codes contain that address, so it shouldn't change afterwards.

## Adding more branches

`/admin` → **+ Add branch**. Give it a name, its own Google review link and a staff PIN, then print its QR poster. Each branch gets its own link (`/r/<link-name>`), its own stats, and its own staff PIN. Vouchers only work at the branch they came from.

## Tests

```bash
TEST_DATABASE_URL=postgres://postgres@localhost:5432/khulafa_test npm test
```

The voucher tests need an empty throwaway database; they drop and recreate the tables.
