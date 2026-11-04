# Putting Digital Ainwan on the internet

This guide takes you from an empty server to a live website with HTTPS, backups and a first admin account.
Time needed: about 45 minutes the first time.

The whole site runs in three Docker containers on **one** small server:

| Part | What it does |
|---|---|
| `caddy` | Front door. Gets and renews the HTTPS certificate by itself. |
| `app` | The website and its API (Node). |
| `mongo` | The database. Has a password and cannot be reached from outside. |

## Before anything: where to host (read this if the site is on Render's free plan)

The developer brief noticed that the site "sleeps" on Render's free plan and suggested static hosting
(Cloudflare Pages / Netlify / Vercel). Two corrections:

- **Render free is worse than slow.** Its disk is temporary: every restart or redeploy **deletes all uploaded
  photos, recordings and PDFs**. Nothing the Panchayat uploads there is safe.
- **Static hosting alone cannot run this site.** Sign-in for three kinds of users, the admin area, uploads,
  the database and the per-page WhatsApp previews all need a server that is always on. A static host would
  also lose the WhatsApp preview for each notice (that needs the server to fill in the page's tags).

What works:

| Option | Monthly cost (roughly; check current prices) | Notes |
|---|---|---|
| **A small Linux server (VPS) with the Docker setup below** | a few hundred rupees | Recommended. Always on, files kept, HTTPS automatic, backups scripted. Put Cloudflare's free plan in front if you want a CDN. |
| Render paid instance + persistent disk + MongoDB Atlas | about USD 7+ | Works, but you must attach a disk at `/data/uploads` and set the same environment variables as `.env`. |
| Render free / any host without a persistent disk | 0 | **Not for real use.** Fine for a demo only. |

## 0. What you need before you start

- **A server.** Any Linux server (Ubuntu 22.04 or 24.04 is easiest) with **2 GB RAM**, 20 GB disk, and a public IP.
  Ports **80 and 443** must be open. 1 GB RAM can work for a trial but it is tight.
- **A domain name** (for example `ainwan.in`). Create an **A record** that points the domain to the server's IP.
  Wait until it works: `ping your-domain` must show your server's IP.
- **The domain and the server account must be in the Panchayat's name** (or at least a second trusted person must hold the login).
  If they are only in your personal name, the village loses the website the day you stop paying or answering.
- **Someone to own the content.** The website is only as good as its updates. Decide who the editors are
  (youth volunteers) and who approves (the Mukhiya or a person they name).

## 1. Install Docker on the server

Follow the official guide for your system: <https://docs.docker.com/engine/install/ubuntu/>
Then check: `docker compose version` must print a version (v2 or newer).

## 2. Put the code on the server

```bash
git clone <your-repository-url> ainwan
cd ainwan
```

(No Git? Copy the project folder with `scp -r` or upload the zip and unzip it. Do not copy `node_modules`.)

## 3. Create the settings file

```bash
node scripts/gen-secrets.mjs
```

No Node on the server? Use Docker instead:

```bash
docker run --rm -v "$PWD":/w -w /w node:22-alpine node scripts/gen-secrets.mjs
```

This creates `.env` with three strong random secrets. Now open it (`nano .env`) and set **two** lines:

```
SITE_ADDRESS=ainwan.in
PUBLIC_URL=https://ainwan.in
```

- `SITE_ADDRESS` has **no** `https://`. `PUBLIC_URL` **has** it.
- **Make a copy of `.env` and keep it somewhere safe** (a password manager, not GitHub). Without it, a backup cannot be put back.

## 4. Start everything

```bash
docker compose up -d --build
```

The first build takes a few minutes. Then check:

```bash
docker compose ps              # all three should say "running" or "healthy"
docker compose logs -f app     # press Ctrl+C to leave
```

Open `https://your-domain`. The first visit can take a few seconds while the certificate is issued.

## 5. Create the first admin (the Mukhiya's account)

```bash
docker compose exec -e ADMIN_EMAIL=mukhiya@example.com -e ADMIN_NAME="Name of Mukhiya" app node src/scripts/seed-admin.js
```

It prints a **temporary password, once**. Sign in at `https://your-domain/admin`.
You will be asked to choose a new password straight away (at least 10 characters).

Then, in the admin area:

1. **Website settings** (everything the home page shows):
   - one big **real photo** for the top of the home page (landscape, the fields at dawn, the Chhath ghat or the temple);
   - place line ("जहानाबाद, बिहार"), the line under the name;
   - **village numbers**: population, families, distance from Jehanabad, PIN code, Panchayat name (a card is hidden until filled);
   - **contact**: office address, office WhatsApp number, e-mail, the WhatsApp **group** link, the name of the team running the site (shown in the footer);
   - **map**: in Google My Maps make a map with the temple, school, Panchayat building and pond, then *Share → Embed on my site*, and paste that code. The site loads it only when someone taps "Open the map" (saves data);
   - **Google Search Console**: add the site there, choose "HTML tag", paste only the `content="…"` code. Then submit `https://your-domain/sitemap.xml`;
   - UPI ID / bank details for "Contribute" (money never passes through the website);
   - the village centre on the map of development work.
   The map centre that ships with the code is Jehanabad town, a **placeholder**: move the pin to Ainwan itself.
2. **Users → Staff:** add the **admins** (youth volunteers, committee). They write and upload; only the super admin publishes.
   Add a second super admin you trust, so the site does not depend on one person.
3. **Villager accounts:** villagers register at `/register` with their mobile number. They wait as "pending" until an
   admin **verifies** them (the admin area shows how many are waiting). Verify only people you can confirm are from
   the village: a verified account can see the directory's phone numbers. A villager who forgot the password asks an
   admin, who uses *Reset password* and passes on the one-time temporary password.
4. Add real content. **Nothing is pre-filled on the live site.** An empty section shows a short "nothing here yet" line until you add something.

Do **not** run the demo-data command on the live site. It exists only for development.

## 6. Backups (do this on day one)

```bash
./scripts/backup.sh
```

This writes one file, `backups/ainwan-DATE.tar.gz`, with the database **and** every uploaded photo, audio file and PDF.
It keeps the newest 14.

**Automatic daily backup** at 2:10 every night: run `crontab -e` and add

```
10 2 * * * cd /home/YOURUSER/ainwan && ./scripts/backup.sh >> backups/backup.log 2>&1
```

**A backup that stays on the same server is not a backup.** If the server's disk dies, both are gone.
Copy the backups somewhere else at least weekly. For example, from another computer you control (it copies only the new files):

```bash
rsync -av YOURUSER@your-server:ainwan/backups/ ./ainwan-backups/
```

or use `rclone` to push the `backups/` folder to Google Drive or any cloud storage.

**Test a restore once, now,** on a spare machine, not during an emergency:

```bash
./scripts/restore.sh backups/ainwan-2026-11-02-0210.tar.gz
```

It asks you to type `YES` because it **replaces** everything on that machine.

## 7. Updating the website

```bash
cd ainwan
git pull
docker compose up -d --build
```

Visitors see a few seconds of downtime. Run `./scripts/backup.sh` before big updates.
If an update breaks something: `git checkout <previous-version>` then `docker compose up -d --build`.

## 8. Everyday operations

| I want to | Command |
|---|---|
| See what is happening | `docker compose logs -f app` |
| Restart the website | `docker compose restart app` |
| Stop everything | `docker compose down` (data is kept) |
| Someone forgot their password | `docker compose exec app node src/scripts/reset-password.js their@email` (or use **Users, Reset password** in the admin area) |
| See disk use | `df -h` and `docker system df` |

**Warning:** `docker compose down -v` **deletes the database and all uploads.** Never add `-v` unless you mean it.

## 9. Keep it safe

- **Firewall:** allow only SSH, 80 and 443. On Ubuntu: `sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443/tcp && sudo ufw allow 443/udp && sudo ufw enable`
- **SSH:** use keys, turn off password login.
- **Server updates:** `sudo apt install unattended-upgrades` so security fixes install by themselves.
- **Package updates:** the repository includes Dependabot. Merge its pull requests regularly (monthly is fine), then redeploy.
- **Uptime alarm:** add a free monitor (for example UptimeRobot) on `https://your-domain/api/health`. It should answer `{"ok":true,"db":"up"}`.
- **The database is not on the internet.** It lives on a private Docker network. Do **not** add a `ports:` entry to the `mongo` service.
- **Never share `.env`.**

## 10. Changing a secret

- **`JWT_SECRET`** (safe any time): edit `.env`, then `docker compose up -d`. Everybody is signed out once. Nothing else happens.
- **Database passwords:** these were stored inside the database **the first time it started**. Editing `.env` later does **not** change them
  and the app will fail with "Authentication failed". To change them properly:
  1. Open the database shell (keep the single quotes exactly):
     `docker compose exec mongo sh -c 'mongosh -u root -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin'`
  2. Inside it, for the website's user: `db.getSiblingDB("ainwan").changeUserPassword("ainwan", "THE-NEW-PASSWORD")`
     (for the root user: `db.getSiblingDB("admin").changeUserPassword("root", "THE-NEW-PASSWORD")`)
  3. Type `exit`. Put the same new password in `.env` (`APP_DB_PASSWORD` or `MONGO_ROOT_PASSWORD`), then run `docker compose up -d`.
  Use only letters and digits in a password you choose yourself.

## 11. Trial run on a bare IP address (no domain yet)

Only for a short look. Browsers will not keep a sign-in cookie over plain http unless you allow it:

```
SITE_ADDRESS=:80
PUBLIC_URL=http://YOUR.SERVER.IP
COOKIE_SECURE=false
```

Remove these and use a real domain before real use. Passwords sent over http can be read by anyone on the path.

## 12. Moving to a new server

1. Install Docker and copy the project folder and your `.env` to the new server.
2. `docker compose up -d --build`
3. `./scripts/restore.sh backups/the-newest-file.tar.gz`
4. Point the domain's A record to the new IP.

## Troubleshooting

| What you see | Usual reason and fix |
|---|---|
| Browser says "connection refused" or times out | Firewall closes 80/443, or the domain's A record points elsewhere. |
| "Not secure" or certificate error | The domain does not point at this server yet, or port 80 is blocked. Caddy retries by itself. Read `docker compose logs caddy`. |
| `docker compose up` stops with a message that ends in "in .env" | `.env` is missing or that line is empty. Fill it, or run `node scripts/gen-secrets.mjs` if `.env` does not exist yet. |
| `app` keeps restarting, log says "Invalid configuration" | The log names the exact line to fix. Most often `PUBLIC_URL` does not start with `https://`. |
| `app` log says "Authentication failed" | Database password in `.env` differs from the one stored in the database. See "Changing a secret". |
| Can sign in on https but not on http | Expected. See "Trial run". |
| Photo upload says "too large" | Photos up to 15 MB, audio up to 30 MB, PDF up to 12 MB. Compress the file. |
| The site shows old text after an update | Hard refresh in the browser (Ctrl+Shift+R). |

## What this setup does not do

- **No automatic failover.** One server means short outages are possible. For a village portal this is a fair trade; the backups are your safety net.
- **No email or SMS.** Messages, complaints and new registrations wait in the admin area; nothing is e-mailed or texted.
  Password resets are done by an admin. (An SMS one-time-code login would need a paid SMS provider.)
- **No online payments.** "Contribute to village" shows the Panchayat's UPI ID or bank details only. Money never passes through this website.
