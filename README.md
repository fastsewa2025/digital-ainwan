# Digital Ainwan

**Parampara aur Pragati ka Sangam.** A bilingual (Hindi / English) village website with an admin area, built on MongoDB, Express, React and Node.

| Pillar | Public pages | What the admin manages |
|---|---|---|
| **Sanskriti** (preservation) | Festival timeline, oral histories with audio, tradition wiki, photo gallery | Festivals, oral history, wiki, albums |
| **Vikas** (transparency) | Projects (planned / in progress / completed with before-after photos), village map, public notice board | Projects, notices |
| **Sampark** (connection) | Directory of skilled people, youth corner, wall of fame, "contribute to village" | Directory, youth, wall of fame, visitor messages |

## Run it on your computer

You need **Node 22** and **MongoDB** running on `localhost:27017`.

```bash
npm run setup                      # installs the server and the website
ADMIN_EMAIL=you@example.com npm run seed:admin    # first admin; prints a temporary password once
npm run seed:demo                  # optional sample content, every entry labelled [Sample]
npm run dev                        # website on http://localhost:5173 , admin on /admin
```

Remove the sample content later with `npm run seed:demo -- --remove`.
Settings are optional in development. If you want any, copy `.env.example` to `.env` (the server reads it).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | API (port 5000) and website (port 5173) together |
| `npm run check` | lint, server tests and a production build: run before you push |
| `npm test` | server tests (need MongoDB; they use a database whose name contains `test` and delete everything in it) |
| `e2e/run.sh` | browser test of the whole admin area on a throw-away database (needs Python and `playwright`) |
| `npm run secrets` | creates `.env` with strong random secrets for deployment |

## Folders

```
server/src/resources.js   ONE list that describes every content type (fields, labels, rules)
server/src/lib/fields.js  turns that list into database models, validation and admin forms
server/src/routes/        public API, admin API, uploads, users, inbox, login
client/src/pages/         public pages
client/src/admin/         the admin area (loaded only when someone opens /admin)
scripts/                  secrets, backup, restore, database setup
Dockerfile, docker-compose.yml, Caddyfile   production setup
DEPLOYMENT.md             step by step: from an empty server to a live site
```

**Adding a new kind of content** (for example a "grievance" list) is one new entry in `server/src/resources.js`.
The database model, validation, admin list and admin form, approval flow and public API follow from it.
Only the public page that shows it needs to be written by hand.

## Who can do what

- **Visitors** read everything that is published, and can send a suggestion, a diaspora message or a directory entry. Messages land in the admin **Inbox**. Directory entries wait for approval and are not public until the Mukhiya publishes them.
- **Editors** (youth volunteers) write and upload. Their work becomes a **draft**, then **waiting for approval**. If they edit something already live, it goes back to waiting.
- **Super admin** (the Mukhiya) publishes, sends back with a reason, unpublishes, manages users and the Inbox, and edits website settings.

Every change is written to an **activity log** (kept one year).

## Safety built in

- Passwords: at least 10 characters, common ones refused, hashed with bcrypt. Five wrong tries lock the account for 15 minutes. A new account must choose its own password at first sign-in.
- Sign-in cookie is `HttpOnly`, same-site only; every change request needs a header only the website sends (blocks forged requests).
- Uploads are checked by their real file content, not their name. Photos are re-encoded to WebP, which also removes hidden location data.
- Visitors' phone numbers in the directory are hidden until someone taps "show", and that tap is rate-limited. Each entry needs the person's consent.
- Strict content-security rules: no scripts from other sites, no framing of the website.
- The database has a password, a limited user for the website, and is not reachable from the internet.
- No payment gateway. "Contribute" shows the Panchayat's own UPI ID or bank details, and nothing else.

## Tests: what they do and do not prove

- 52 server tests: permissions, approval rules, validation, uploads, injection attempts, headers, password rules.
- 94 browser checks of the admin area, in English and Hindi, on desktop and phone width.
- The public pages were checked in a browser with sample data and with an **empty** database.
- **Not proven here:** the tests ran against MongoDB-compatible FerretDB, not real MongoDB, and the Docker image could not be built in the environment where this was written.
  The CI file (`.github/workflows/ci.yml`) does both on GitHub: real MongoDB, and it builds the image and starts it. Make it green before the first deployment.

## Things you must decide before launch

1. **Who owns the domain, server and database backups?** Put them in the Panchayat's name, with a second person holding the login.
2. **Who edits and who approves?** A portal that stops being updated looks worse than no portal.
3. **What may be published?** Development spending, photos of people and phone numbers of residents need rules and consent. The `/privacy` page ships with general wording: replace it with your Panchayat's real text (it lives in `client/src/lib/strings.js`, search for `privacy.`). Consult someone who knows India's data protection law (DPDP Act) before collecting data from the diaspora or from children.
4. **Village name spelling and map centre** ship as placeholders. Set the real ones in **Website settings**.
5. **Map tiles** come from OpenStreetMap's public servers, which are fine for a small village site. If traffic grows, use a tile provider.
