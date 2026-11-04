# Digital Ainwan

**परंपरा और प्रगति का संगम.** The website of Ainwan village (Jehanabad, Bihar): Hindi first, English at `/en`, works on old phones and slow networks, and the Panchayat updates it without code. Built on MongoDB, Express, React and Node.

## What is in it

| Part | What people see | Who updates it |
|---|---|---|
| **Home** | Real photo, village numbers, notice board, development work with before/after photos and money spent, elders' voices (audio), culture, Google map, wall of pride, "living away? stay connected" | Settings + content in the admin area |
| **Sanskriti** | Festivals, elders' stories with audio, tradition wiki, photo gallery | Admins write, super admin publishes; villagers can send stories and photos |
| **Vikas** | Projects (planned / in progress / done), map, notice board | Admins write, super admin publishes |
| **Sampark** | Directory (numbers only for verified members), youth corner, wall of pride, contribute + **public accounts of the village fund** | Same, plus villagers can add themselves to the directory |

## Three kinds of account

Everybody signs in at **/login** with a **mobile number or e-mail**.

| | Villager (ग्रामीण) | Admin (एडमिन) | Super admin (मुख्य एडमिन / मुखिया) |
|---|---|---|---|
| How they get an account | Registers on the site, then **an admin verifies** them | Added by the super admin | Created on the server (`seed:admin`) or by another super admin |
| Read everything public | ✓ | ✓ | ✓ |
| See directory phone numbers | ✓ once verified (max 25 a day, every look-up logged) | ✓ | ✓ |
| Send a story (record in the browser), photos, a directory listing, a suggestion or complaint | ✓ once verified; all of it waits for approval | ✓ | ✓ |
| See their own receipts, delete their own account | ✓ | | |
| Write and edit content, upload files | | ✓ (goes to "waiting for approval") | ✓ |
| Verify, switch off, reset passwords of **villagers** | | ✓ | ✓ |
| Publish, send back, unpublish | | | ✓ |
| Add admins, change roles, website settings, inbox, activity log, approve money records | | | ✓ |
| Session length | 30 days on their own phone | 8 hours | 8 hours |
| Minimum password | 8 characters | 10 characters | 10 characters |

Every rule is checked **on the server**, not only hidden in the screen: a villager gets "403" on every admin address, an admin cannot touch another admin or a super admin, nobody can change their own role or switch themselves off, and a role change ends that person's old sessions at once. Accounts lock for 15 minutes after 5 wrong passwords. There is no e-mail or SMS: a forgotten password is reset by an admin, who gets a one-time temporary password to pass on.

## Run it on your computer

You need **Node 22** and **MongoDB** on `localhost:27017`.

```bash
npm run setup                      # installs the server and the website
ADMIN_EMAIL=you@example.com npm run seed:admin    # first super admin; prints a temporary password once
npm run seed:demo                  # optional sample content, every entry labelled [Sample]
npm run dev                        # website http://localhost:5173 , admin http://localhost:5173/admin
```

Remove the sample content later with `npm run seed:demo -- --remove`.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | API (port 5000) and website (port 5173) together |
| `npm run check` | lint, server tests and a production build: run before you push |
| `npm test` | 74 server tests (need MongoDB; they use a database whose name contains `test` and delete everything in it) |
| `e2e/run.sh` | browser tests on a throw-away database: the whole admin area (96 checks) and a villager's journey on a phone screen (16 checks) |
| `npm run secrets` | creates `.env` with strong random secrets for deployment |

## Folders

```
server/src/resources.js   ONE list that describes every content type (fields, labels, rules), incl. donations
server/src/lib/fields.js  turns that list into database models, validation and admin forms
server/src/lib/seo.js     per-page title, WhatsApp/Google preview tags, /en versions, the first-paint header
server/src/routes/        public API, admin API, users (3 roles), me (villager self-service), uploads, login
client/src/pages/         public pages (Home.jsx = the new home page), Auth (login/register), Account
client/src/admin/         the admin area (loaded only when someone opens /admin)
client/public/            app icons, manifest, offline page, service worker (sw.js)
e2e/                      browser tests
```

## Speed and phones (from the brief)

- **Lighthouse, mobile, measured here:** home 94, development page 90, directory 92 for performance; 100 for accessibility, best practices and SEO.
- How: only the home page is in the first download, the server sends the header and the home photo with the HTML (so the top of the page shows before JavaScript), the hero photo is preloaded, photos are re-encoded to WebP with a small version for phones, files are cached for a year.
- **One deliberate change to the brief:** Hindi body text uses the phone's own Devanagari font (Noto Sans Devanagari on Android) instead of Mukta. Mukta's Hindi files weigh about 200 KB and cost about 10 Lighthouse points on a slow network. Headings keep Rozha One, English text keeps Mukta. To switch back, add the two import lines noted in `client/src/main.jsx`.
- **Works offline / add to home screen:** pages opened before still open with no internet; Android offers "Add to Home screen".

## Things you must decide before launch

1. **Hosting.** Render's free plan is not fit for this site: it sleeps (30–50 s first load) **and deletes uploaded photos and recordings** on every restart. Use a small server with the Docker setup (see `DEPLOYMENT.md`), or a paid plan with a persistent disk.
2. **Who owns the domain, the server and the backups?** In the Panchayat's name, with a second person holding the login.
3. **Who verifies villagers and how?** Approving an account gives that person the directory's phone numbers. Agree on a rule (for example: a phone call, or someone who knows them).
4. **Who approves money records?** Admins enter donations and spending; only the super admin approves, and only then a receipt number is created. Keep the bank statement next to it.
5. **Consent.** Photos and voices of people need their (or their family's) agreement; no personal details of children. Replace the generic `/privacy` text with your Panchayat's wording (`client/src/lib/strings.js`, search `privacy.`). India's data protection law (DPDP Act) applies to the phone numbers you collect: ask someone who knows it.
6. **Real content.** 15–20 real photos, the village numbers, the contact details, 2–3 recorded stories. Placeholders do not convince anyone.
