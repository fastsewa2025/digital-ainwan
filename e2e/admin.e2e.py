"""End-to-end check of the admin area in a real browser (Chromium via Playwright).
Two browsers run side by side: the Mukhiya (super admin) and an admin volunteer (formerly 'editor').
Run it with  e2e/run.sh  (it starts a server on a throw-away database, runs this, and cleans up).
By hand: python3 -u e2e/admin.e2e.py  with the server on E2E_BASE and a freshly created admin account.
"""
import json
import os
import re
import struct
import sys
import tempfile
import traceback
import wave
import zlib
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get("E2E_BASE", "http://localhost:5055")
SP = Path(os.environ.get("E2E_OUT", Path(tempfile.gettempdir()) / "ainwan-e2e"))  # screenshots and test files go here
SHOTS = SP / "shots"
SHOTS.mkdir(parents=True, exist_ok=True)
FILES = SP / "e2e-files"
FILES.mkdir(exist_ok=True)

BOSS_EMAIL, BOSS_TEMP, BOSS_PASS = "mukhiya@ainwan.test", "Temp-Start-2026", "Gaon-Panchayat-2026!"
ED_EMAIL, ED_NAME, ED_PASS = "sunita@ainwan.test", "Sunita Devi", "Yuva-Editor-2026!"
HDR = {"X-Requested-By": "ainwan-web"}

results, console_errors, server_errors = [], [], []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name + (f"   [{detail}]" if detail and not ok else ""))


def step(name):
    def deco(fn):
        try:
            fn()
        except Exception as e:  # keep going: one broken step must not hide the others
            check(name, False, f"{type(e).__name__}: {str(e).splitlines()[0][:230]}")
            traceback.print_exc(limit=2, file=sys.stdout)
        return fn

    return deco


def make_png(path, w=640, h=480, seed=1):
    rows = []
    for y in range(h):
        row = bytearray([0])
        for x in range(w):
            row += bytes(((x * 255 // w + seed * 60) % 256, (y * 255 // h) % 256, (90 + seed * 50) % 256))
        rows.append(bytes(row))
    raw = b"".join(rows)

    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 6)) + chunk(b"IEND", b"")
    Path(path).write_bytes(png)


def make_wav(path):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(8000)
        w.writeframes(b"\x00\x10" * 8000)


def make_pdf(path):
    Path(path).write_bytes(
        b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
        b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R/Size 4>>\n%%EOF\n"
    )


PNG1, PNG2, WAV, PDF, FAKE = FILES / "a.png", FILES / "b.png", FILES / "voice.wav", FILES / "order.pdf", FILES / "fake.png"
make_png(PNG1, seed=1)
make_png(PNG2, seed=2)
make_wav(WAV)
make_pdf(PDF)
FAKE.write_text("this is not an image at all")

state = {}

with sync_playwright() as pw:
    browser = pw.chromium.launch()

    def new_context(width=1280, height=900, lang="en", storage=None):
        ctx = browser.new_context(viewport={"width": width, "height": height}, locale="en-IN", storage_state=storage)
        ctx.add_init_script(f"try{{localStorage.setItem('ainwan-lang','{lang}')}}catch(e){{}}")
        pg = ctx.new_page()
        pg.set_default_timeout(12000)

        def on_console(m):
            if m.type == "error":
                loc = (m.location or {}).get("url", "")
                if "openstreetmap" in loc or "Failed to load resource" in m.text:
                    return
                console_errors.append(f"{m.text[:200]} @ {loc}")

        pg.on("console", on_console)
        pg.on("pageerror", lambda e: console_errors.append("PAGEERROR " + str(e)[:200]))
        pg.on("response", lambda r: server_errors.append(f"{r.status} {r.request.method} {r.url}") if r.status >= 500 else None)
        return ctx, pg

    ctx, page = new_context()  # the Mukhiya
    ed_ctx, ed = new_context()  # the editor volunteer (second browser, own cookies)

    def goto(pg, path):
        pg.goto(BASE + path)
        pg.wait_for_load_state("networkidle")

    def shot(pg, name):
        pg.screenshot(path=str(SHOTS / f"{name}.png"), full_page=True)

    def login(pg, email, password):
        goto(pg, "/admin")  # -> the shared sign-in page (/en/login?next=/admin)
        pg.get_by_label("Mobile number or email").fill(email)
        pg.get_by_label("Password", exact=True).fill(password)
        pg.get_by_role("button", name="Sign in", exact=True).click()

    def forced_password(pg, old, new):
        pg.get_by_label("Current password").fill(old)
        pg.get_by_label("New password", exact=True).fill(new)
        pg.get_by_label("Type the new password again").fill(new)
        pg.get_by_role("button", name="Change password").click()
        pg.get_by_role("heading", name=re.compile("Hello,")).wait_for()

    def i18n(pg, group_pattern, hi=None, en=None):
        grp = pg.get_by_role("group", name=re.compile(group_pattern))
        if hi is not None:
            grp.get_by_label("हिन्दी").fill(hi)
        if en is not None:
            grp.get_by_label("English").fill(en)

    def api_get(pg, path):
        r = pg.request.get(BASE + "/api" + path)
        return r.status, (r.json() if r.ok else None)

    # ------------------------------------------------------------------ sign in
    @step("sign-in page")
    def _():
        goto(page, "/admin")
        page.get_by_role("heading", name="Sign in").wait_for()
        check("signed-out /admin goes to the shared sign-in page", "/login?next=/admin" in page.url, page.url)
        check("sign-in page shows", page.get_by_label("Mobile number or email").is_visible())
        check("admin pages are noindex", page.locator('meta[name="robots"][content*="noindex"]').count() == 1)
        shot(page, "01-login")

    @step("wrong password")
    def _():
        page.get_by_label("Mobile number or email").fill(BOSS_EMAIL)
        page.get_by_label("Password", exact=True).fill("definitely-wrong-1")
        page.get_by_role("button", name="Sign in", exact=True).click()
        page.get_by_text("Wrong mobile number / email or password").wait_for()
        check("wrong password is refused with a clear message", True)

    @step("first sign-in forces a new password")
    def _():
        login(page, BOSS_EMAIL, BOSS_TEMP)
        page.get_by_text("You must set your own password").wait_for()
        check("forced password page shows", True)
        shot(page, "02-forced-password")
        page.get_by_label("Current password").fill(BOSS_TEMP)
        page.get_by_label("New password", exact=True).fill(BOSS_PASS)
        page.get_by_label("Type the new password again").fill("something else")
        page.get_by_role("button", name="Change password").click()
        page.get_by_text("do not match").wait_for()
        check("mismatching passwords are caught", True)
        page.get_by_label("New password", exact=True).fill("short")
        page.get_by_label("Type the new password again").fill("short")
        page.get_by_role("button", name="Change password").click()
        page.locator(".field__error").first.wait_for()
        check("weak password is refused", True, page.locator(".field__error").first.inner_text())
        page.get_by_label("New password", exact=True).fill("Gaon-Mukhiya-2026!")
        page.get_by_label("Type the new password again").fill("Gaon-Mukhiya-2026!")
        page.get_by_role("button", name="Change password").click()
        expect(page.locator(".field__error").first).to_contain_text(re.compile("e-mail", re.I))
        check("a password containing the e-mail name is refused", True)
        forced_password(page, BOSS_TEMP, BOSS_PASS)
        check("lands on the dashboard after choosing a password", True)

    @step("dashboard")
    def _():
        page.get_by_text("Nothing is waiting for approval").wait_for()
        rows = page.locator(".adm-table tbody tr").count()
        check("dashboard lists every content type", rows == 11, f"rows={rows}")
        check("super admin sees the manage links", page.get_by_role("link", name="Users", exact=True).count() == 1 and page.get_by_role("link", name="Inbox", exact=True).count() == 1)
        shot(page, "03-dashboard")

    # ---------------------------------------------------------- create + publish
    @step("validation on empty festival")
    def _():
        goto(page, "/admin/content/festivals/new")
        page.get_by_role("button", name="Publish", exact=True).click()
        page.get_by_text("Please fix the fields marked in red").first.wait_for()
        check("empty form shows red messages", page.locator(".field__error").count() >= 1)
        shot(page, "04-form-errors")

    @step("create + publish a festival")
    def _():
        goto(page, "/admin/content/festivals/new")
        i18n(page, r"^Title", hi="दीपावली मेला (परीक्षण)", en="Diwali Mela (test)")
        page.get_by_label("Date").fill("2026-10-20")
        i18n(page, r"^Place", hi="पंचायत भवन", en="Panchayat Bhawan")
        i18n(page, r"^Short summary", hi="परीक्षण सारांश", en="Test summary of the fair")
        page.get_by_role("button", name="Publish", exact=True).click()
        page.wait_for_url(re.compile(r"/admin/content/festivals/[a-f0-9]{24}$"))
        state["festival"] = page.url.rsplit("/", 1)[1]
        page.get_by_text("Saved.").wait_for()
        check("festival saved and shows 'Published'", page.locator(".badge--published").count() == 1)
        status, data = api_get(page, "/public/content/festivals?limit=50")
        check("festival is visible on the public API", status == 200 and any("Diwali Mela (test)" in json.dumps(i, ensure_ascii=False) for i in data["items"]))
        shot(page, "05-festival-published")

    @step("uploads: photos, bad file")
    def _():
        goto(page, f"/admin/content/festivals/{state['festival']}")
        gal = page.locator("input[type=file][multiple]")
        gal.set_input_files([str(PNG1), str(PNG2)])
        expect(page.locator(".gal-edit__item")).to_have_count(2, timeout=25000)
        check("two photos uploaded", True)
        ok = page.evaluate("[...document.querySelectorAll('.gal-edit__item img')].every(i => i.complete && i.naturalWidth > 0)")
        check("uploaded thumbnails actually load", ok)
        src = page.locator(".gal-edit__item img").first.get_attribute("src")
        check("thumbnails are WebP", src.endswith(".webp"), src)
        gal.set_input_files(str(FAKE))
        page.locator(".field__error").first.wait_for(timeout=10000)
        check("a text file renamed .png is refused", page.locator(".field__error").first.is_visible(), page.locator(".field__error").first.inner_text())
        page.locator(".gal-edit__cap summary").first.click()
        page.locator(".gal-edit__cap input[lang=en]").first.fill("Lamps at the fair")
        page.get_by_role("button", name="Move later").first.click()
        shot(page, "06-gallery-editor")
        page.get_by_role("button", name="Save changes").click()
        page.get_by_text("Saved.").wait_for()
        page.reload()
        page.wait_for_load_state("networkidle")
        check("photos survive a reload", page.locator(".gal-edit__item").count() == 2)
        status, data = api_get(page, f"/public/content/festivals/{state['festival']}")
        check("public page has 2 photos", status == 200 and len(data.get("photos", [])) == 2)

    @step("audio + pdf + image upload and map pick")
    def _():
        goto(page, "/admin/content/oral-history/new")
        page.locator('input[type=file][accept*="audio"]').set_input_files(str(WAV))
        page.locator("audio.player").wait_for(timeout=15000)
        src = page.locator("audio.player").get_attribute("src")
        check("audio file uploaded; player shown", src.startswith("/uploads/") or src.startswith("http"), src)
        page.locator('input[type=file][accept*="image/jpeg"]').first.set_input_files(str(PNG1))
        page.locator(".media__thumb").wait_for(timeout=15000)
        check("single image upload shows a preview", True)
        goto(page, "/admin/content/projects/new")
        page.locator('input[type=file][accept*="pdf"]').set_input_files(str(PDF))
        page.get_by_role("link", name="Open PDF").wait_for(timeout=15000)
        check("PDF upload shows a link", True)
        page.locator(".picker").scroll_into_view_if_needed()
        page.wait_for_selector(".leaflet-container")
        page.locator(".picker").click(position={"x": 200, "y": 150})
        lat = page.get_by_label("Latitude").input_value()
        lng = page.get_by_label("Longitude").input_value()
        check("clicking the map fills latitude and longitude", re.fullmatch(r"\d+\.\d{6}", lat or "") and re.fullmatch(r"\d+\.\d{6}", lng or ""), f"{lat},{lng}")
        check("a pin is drawn on the map", page.locator(".leaflet-marker-icon").count() == 1)
        shot(page, "07-project-form-map")

    # ------------------------------------------------------------------- users
    @step("users: add admin, duplicate, deactivate, reset")
    def _():
        goto(page, "/admin/users")
        page.get_by_role("button", name="Staff (admins)").click()
        page.get_by_label("Name", exact=True).fill(ED_NAME)
        page.get_by_label("Email", exact=True).fill(ED_EMAIL)
        page.get_by_label("Role", exact=True).select_option(label="Admin")
        page.get_by_role("button", name="Create account").click()
        page.locator(".temp").wait_for()
        state["ed_temp"] = page.locator(".temp").inner_text().strip()
        check("temporary password is shown once", len(state["ed_temp"]) >= 10)
        shot(page, "08-users-temp-password")
        page.get_by_role("button", name="Close").click()
        check("temporary password is gone after closing", page.locator(".temp").count() == 0)
        page.reload()
        page.wait_for_load_state("networkidle")
        check("temporary password is not shown after reload", page.locator(".temp").count() == 0)
        page.get_by_role("button", name="Staff (admins)").click()
        page.get_by_label("Name", exact=True).fill("Someone Else")
        page.get_by_label("Email", exact=True).fill(ED_EMAIL)
        page.get_by_role("button", name="Create account").click()
        page.locator(".alert--error, .field__error").first.wait_for()
        check("duplicate e-mail is refused", True)
        page.locator("li.urow", has_text=ED_NAME).get_by_role("button", name="Deactivate").click()
        page.locator("li.urow", has_text=ED_NAME).get_by_text("Inactive").wait_for()
        page.locator("li.urow", has_text=ED_NAME).get_by_role("button", name="Activate").click()
        page.locator("li.urow", has_text=ED_NAME).get_by_role("button", name="Deactivate").wait_for()
        check("deactivate / activate works", True)
        page.locator("li.urow", has_text=ED_NAME).get_by_role("button", name="Reset password").click()
        page.get_by_text("Reset the password for").wait_for()
        page.get_by_role("button", name="Yes, reset it").click()
        page.locator(".temp").wait_for()
        new_temp = page.locator(".temp").inner_text().strip()
        check("reset gives a different temporary password", new_temp != state["ed_temp"])
        state["ed_temp"] = new_temp
        # (other rows also mention "Ramesh Singh" as the one who checked them, so match the name line only)
        own = page.locator("li.urow", has=page.locator(".urow__name", has_text="Ramesh Singh"))
        check("own row has no dangerous buttons", own.count() == 1 and own.get_by_role("button").count() == 0, f"rows={own.count()}")

    # -------------------------------------------------------------------- editor
    @step("editor: forced password, restricted menu, create project, submit")
    def _():
        login(ed, ED_EMAIL, state["ed_temp"])
        ed.get_by_text("You must set your own password").wait_for()
        forced_password(ed, state["ed_temp"], ED_PASS)
        check("admin has no Users / Inbox / Settings links", ed.get_by_role("link", name="Users", exact=True).count() == 0 and ed.get_by_role("link", name="Inbox", exact=True).count() == 0 and ed.get_by_role("link", name="Site settings").count() == 0)
        check("admin has the villager accounts link", ed.get_by_role("link", name="Villager accounts").count() == 1)
        goto(ed, "/admin/users")
        ed.get_by_role("heading", name="Villager accounts").wait_for()
        check("admin's user page shows villagers only (no staff tab)", ed.get_by_role("button", name="Staff (admins)").count() == 0)
        goto(ed, "/admin/content/projects/new")
        check("admin sees no Publish button", ed.get_by_role("button", name="Publish", exact=True).count() == 0)
        gap = ed.evaluate("""() => {
          const l = [...document.querySelectorAll('label.field__label')].find(x => x.textContent.startsWith('Status'));
          const i = document.getElementById(l.htmlFor);
          return i.getBoundingClientRect().top - l.getBoundingClientRect().bottom;
        }""")
        check("labels sit above their inputs (not beside them)", gap >= 0, f"gap={gap}")
        pos = ed.evaluate("getComputedStyle(document.querySelector('.adm-form > .adm-actions')).position")
        check("save buttons are pinned on a big screen", pos == "sticky", pos)
        i18n(ed, r"^Project title", hi="तालाब की सफाई", en="Pond cleaning")
        ed.get_by_label("Status").select_option(label="In progress")
        ed.get_by_label("Progress %").first.fill("40")
        ed.get_by_role("button", name="Send for approval").click()
        ed.wait_for_url(re.compile(r"/admin/content/projects/[a-f0-9]{24}$"))
        state["project"] = ed.url.rsplit("/", 1)[1]
        ed.get_by_text("Saved.").wait_for()
        check("project is 'Waiting for approval'", ed.locator(".badge--pending").count() == 1)
        status, data = api_get(ed, "/public/content/projects?limit=50")
        check("pending project is NOT public", not any("Pond cleaning" in json.dumps(i) for i in data["items"]))
        r = ed.request.post(BASE + f"/api/admin/resources/projects/{state['project']}/status", data={"status": "published"}, headers=HDR)
        check("admin cannot publish through the API either", r.status == 403, str(r.status))
        r = ed.request.get(BASE + "/api/admin/messages")
        check("admin cannot read the inbox through the API", r.status == 403, str(r.status))
        r = ed.request.get(BASE + "/api/admin/users?kind=staff")
        check("admin cannot list staff accounts through the API", r.status == 403, str(r.status))
        shot(ed, "09-editor-pending")

    @step("super admin sees the queue and rejects with a reason")
    def _():
        goto(page, "/admin")
        page.get_by_role("link", name=re.compile("Pond cleaning|तालाब")).first.wait_for()
        check("pending project is in the approval queue", True)
        shot(page, "10-queue")
        page.get_by_role("link", name=re.compile("Pond cleaning|तालाब")).first.click()
        page.get_by_role("button", name="Send back", exact=True).click()
        expect(page.locator("#reject-reason")).to_be_focused()
        box = page.locator("#reject-reason").bounding_box()
        vh = page.viewport_size["height"]
        page.wait_for_timeout(600)  # smooth scrolling
        box = page.locator("#reject-reason").bounding_box()
        check("reason box is focused and on screen after 'Send back'", box and 0 <= box["y"] and box["y"] + box["height"] <= vh + 2, str(box))
        send = page.get_by_role("button", name="Send back with this reason")
        check("send-back button is disabled until a reason is typed", send.is_disabled())
        page.locator("#reject-reason").fill("Please add the mohalla name.")
        shot(page, "11-reject-panel")
        send.click()
        page.wait_for_url(re.compile(r"/admin/content/projects$"))
        page.locator(".badge--rejected").first.wait_for()
        check("project shows 'Sent back' in the list", True)

    @step("editor sees the reason, fixes, resubmits")
    def _():
        goto(ed, f"/admin/content/projects/{state['project']}")
        ed.get_by_text("Please add the mohalla name.").wait_for()
        check("editor sees why it was sent back", True)
        i18n(ed, r"^Mohalla", hi="पूर्वी टोला", en="East Tola")
        ed.get_by_role("button", name="Send for approval").click()
        ed.get_by_text("Saved.").wait_for()
        ed.locator(".badge--pending").wait_for()
        check("resubmitted: back to 'Waiting for approval'", True)

    @step("super admin approves")
    def _():
        goto(page, f"/admin/content/projects/{state['project']}")
        page.get_by_role("button", name="Approve and publish").click()
        page.locator(".badge--published").wait_for()
        check("approved: shows 'Published'", True)
        status, data = api_get(page, "/public/content/projects?limit=50")
        check("approved project is public", any("Pond cleaning" in json.dumps(i) for i in data["items"]))
        shot(page, "12-project-published")
        goto(page, "/admin/content/projects")
        shot(page, "13-project-list")

    @step("editor edits a published item: it goes back to waiting")
    def _():
        goto(ed, f"/admin/content/projects/{state['project']}")
        ed.get_by_text("This is live on the website").wait_for()
        check("editor is warned before editing live content", True)
        i18n(ed, r"^Mohalla", en="East Tola (edited)")
        ed.get_by_role("button", name="Send changes for approval").click()
        ed.get_by_text("Saved.").wait_for()
        ed.locator(".badge--pending").wait_for()
        status, data = api_get(ed, "/public/content/projects?limit=50")
        check("edited item is hidden until approved again", not any("Pond cleaning" in json.dumps(i) for i in data["items"]))
        goto(page, f"/admin/content/projects/{state['project']}")
        page.get_by_role("button", name="Approve and publish").click()
        page.locator(".badge--published").wait_for()
        status, data = api_get(page, "/public/content/projects?limit=50")
        check("approved again: public once more", any("Pond cleaning" in json.dumps(i) for i in data["items"]))

    @step("list: search, status tabs")
    def _():
        goto(page, "/admin/content/festivals")
        check("festival is listed", page.get_by_text("Diwali Mela (test)").count() >= 1 or page.get_by_text("दीपावली मेला (परीक्षण)").count() >= 1)
        page.get_by_role("button", name=re.compile("^Draft")).click()
        # The list refreshes after the click; wait for it (a plain count right after the click can still see the old rows).
        try:
            expect(page.get_by_text("Diwali Mela (test)")).to_have_count(0)
            hidden = True
        except AssertionError:
            hidden = False
        check("draft tab hides the published festival", hidden)
        page.get_by_role("button", name=re.compile("^All")).click()
        page.get_by_label("Search").fill("zzzz-nothing")
        page.get_by_text("Nothing here yet").wait_for()
        check("search with no hits shows the empty message", True)

    # -------------------------------------------------------------------- inbox
    @step("inbox: receive, read, archive, delete")
    def _():
        r1 = page.request.post(BASE + "/api/public/submit/suggestion", data={"message": "Please fix the hand pump near the school road."}, headers=HDR)
        r2 = page.request.post(BASE + "/api/public/submit/diaspora", data={"name": "Anil Kumar", "place": "Pune", "helpType": "funds", "message": "I want to help with the library.", "phone": "9876543210"}, headers=HDR)
        check("public suggestion + diaspora messages accepted", r1.status == 201 and r2.status == 201, f"{r1.status},{r2.status}")
        goto(page, "/admin")
        page.get_by_role("link", name=re.compile(r"\d+ new messages")).wait_for()
        check("dashboard announces new messages", True)
        goto(page, "/admin/inbox")
        check("two new messages shown", page.locator(".msg--new").count() >= 2, str(page.locator(".msg--new").count()))
        shot(page, "14-inbox")
        before = page.locator(".msg").count()
        page.locator(".msg").last.get_by_role("button", name="Mark as read").click()
        expect(page.locator(".msg--read")).to_have_count(1)
        check("mark as read works", True)
        page.locator(".msg--read").first.get_by_role("button", name="Archive").click()
        expect(page.locator(".msg--archived")).to_have_count(1)
        check("archive works", True)
        page.locator(".msg--archived").first.get_by_role("button", name="Delete permanently").click()
        page.get_by_role("button", name="Yes, delete").click()
        expect(page.locator(".msg")).to_have_count(before - 1)
        check("delete asks first, then removes", True)
        check("WhatsApp link built for the diaspora number", page.locator('a[href="https://wa.me/919876543210"]').count() == 1)

    # ----------------------------------------------------------------- settings
    @step("settings: save and read back")
    def _():
        goto(page, "/admin/settings")
        page.get_by_text("Double-check UPI and bank details").wait_for()
        i18n(page, r"^Tagline", en="A blend of Tradition and Progress (edited)")
        page.get_by_role("button", name="Save settings").click()
        page.get_by_text("Settings saved.").wait_for()
        status, s = api_get(page, "/public/settings")
        check("saved settings reach the public site", s["tagline"]["en"].endswith("(edited)"), json.dumps(s["tagline"]))
        shot(page, "15-settings")
        i18n(page, r"^Tagline", en="A blend of Tradition and Progress")
        page.get_by_role("button", name="Save settings").click()
        page.get_by_text("Settings saved.").wait_for()
        page.get_by_label("Facebook page").fill("javascript:alert(1)")
        page.get_by_role("button", name="Save settings").click()
        page.locator(".field__error").first.wait_for()
        check("javascript: link is refused in settings", True)
        page.get_by_label("Facebook page").fill("")
        page.get_by_role("button", name="Save settings").click()
        page.get_by_text("Settings saved.").wait_for()

    @step("audit log")
    def _():
        goto(page, "/admin/audit")
        page.locator(".logrow").first.wait_for()
        n = page.locator(".logrow").count()
        check("activity log has entries", n >= 8, str(n))
        txt = page.locator(".adm-log").inner_text()
        check("log names the people who acted", "Ramesh Singh" in txt and ED_NAME in txt)
        check("log does not contain passwords", "Gaon-Panchayat" not in txt and "Yuva-Editor" not in txt and "Temp-Start" not in txt)
        shot(page, "16-audit")

    @step("delete a festival draft permanently")
    def _():
        goto(page, "/admin/content/festivals/new")
        i18n(page, r"^Title", en="Throwaway draft")
        page.get_by_label("Date").fill("2026-01-02")
        page.get_by_role("button", name="Save as draft").click()
        page.get_by_text("Saved.").wait_for()
        page.get_by_role("button", name="Delete permanently").click()
        page.get_by_text("Delete this for good?").wait_for()
        page.get_by_role("button", name="Yes, delete").click()
        page.wait_for_url(re.compile(r"/admin/content/festivals$"))
        check("draft deleted after confirmation", page.get_by_text("Throwaway draft").count() == 0)

    # ------------------------------------------------------------------- mobile
    @step("mobile layout")
    def _():
        mctx, m = new_context(390, 844, "en", ctx.storage_state())
        pages = {
            "m-dashboard": "/admin",
            "m-list": "/admin/content/festivals",
            "m-form": f"/admin/content/festivals/{state['festival']}",
            "m-project-form": f"/admin/content/projects/{state['project']}",
            "m-users": "/admin/users",
            "m-inbox": "/admin/inbox",
            "m-settings": "/admin/settings",
            "m-audit": "/admin/audit",
        }
        for name, path in pages.items():
            m.goto(BASE + path)
            m.wait_for_load_state("networkidle")
            m.wait_for_timeout(300)
            overflow = m.evaluate("document.documentElement.scrollWidth - window.innerWidth")
            check(f"mobile {name}: no sideways scroll", overflow <= 0, f"+{overflow}px")
            inner = m.evaluate("[...document.querySelectorAll('.adm-tablewrap')].filter(w => w.scrollWidth > w.clientWidth + 1).length")
            check(f"mobile {name}: no table needs sideways scrolling", inner == 0, str(inner))
            m.screenshot(path=str(SHOTS / f"{name}.png"), full_page=True)
        m.goto(BASE + "/admin")
        m.wait_for_load_state("networkidle")
        m.goto(BASE + f"/admin/content/projects/{state['project']}")
        m.wait_for_load_state("networkidle")
        pos = m.evaluate("getComputedStyle(document.querySelector('.adm-form > .adm-actions')).position")
        check("mobile: save buttons are NOT pinned over the form", pos == "static", pos)
        m.goto(BASE + "/admin")
        m.wait_for_load_state("networkidle")
        check("mobile: menu is closed at first", not m.locator("#adm-nav").is_visible())
        m.get_by_role("button", name="Menu").click()
        check("mobile: menu opens", m.locator("#adm-nav").is_visible())
        m.screenshot(path=str(SHOTS / "m-menu-open.png"))
        m.locator("#adm-nav").get_by_role("link", name="Users", exact=True).click()
        m.wait_for_url(re.compile("/admin/users"))
        check("mobile: menu closes after choosing a page", not m.locator("#adm-nav").is_visible())
        mctx.close()

    @step("Hindi screens")
    def _():
        hctx, h = new_context(1280, 900, "hi", ctx.storage_state())
        h.goto(BASE + "/admin")
        h.wait_for_load_state("networkidle")
        h.get_by_role("heading", name=re.compile("नमस्ते")).wait_for()
        check("dashboard greets in Hindi", True)
        h.screenshot(path=str(SHOTS / "h-dashboard.png"), full_page=True)
        h.goto(BASE + f"/admin/content/projects/{state['project']}")
        h.wait_for_load_state("networkidle")
        h.get_by_text("प्रकाशित").first.wait_for()
        h.screenshot(path=str(SHOTS / "h-project-form.png"), full_page=True)
        txt = h.locator("body").inner_text()
        leaks = re.findall(r"\b(?:nav|form|status|dash|list|common|users|inbox|media|audit)\.[a-zA-Z.]+", txt)
        check("no raw translation keys on screen", not leaks, str(leaks[:5]))

        # Red messages come from the server in English; the Hindi screen must show them in Hindi.
        h.goto(BASE + "/admin/content/festivals/new")
        h.wait_for_load_state("networkidle")
        h.get_by_role("button", name="प्रकाशित करें", exact=True).click()
        h.get_by_text("लाल निशान वाली जगहें ठीक करें").first.wait_for()
        h.locator(".field__error").first.wait_for()
        errs = [e.inner_text() for e in h.locator(".field__error").all()]
        check("field errors are shown in Hindi", errs and all(re.search(r"[\u0900-\u097F]", e) for e in errs), str(errs[:4]))
        check("no English server text in the Hindi error boxes", not any(re.search(r"Required|Enter at least|Enter a valid", e) for e in errs), str(errs[:4]))
        h.screenshot(path=str(SHOTS / "h-form-errors.png"), full_page=True)
        hctx.close()

    @step("sign out really ends the session")
    def _():
        page.get_by_role("button", name="Sign out").click()
        page.get_by_role("heading", name="Sign in").wait_for()
        r = page.request.get(BASE + "/api/admin/dashboard")
        check("after sign-out the admin API answers 401", r.status == 401, str(r.status))
        r = ed.request.get(BASE + "/api/admin/dashboard")
        check("editor session is still valid (independent)", r.status == 200, str(r.status))

    browser.close()

passed = sum(1 for _, ok, _ in results if ok)
print(f"\n{passed}/{len(results)} checks passed")
print("console errors:", len(console_errors))
for e in console_errors[:15]:
    print("  ", e)
print("server 5xx responses:", len(server_errors))
for e in server_errors[:10]:
    print("  ", e)
if passed != len(results) or console_errors or server_errors:
    sys.exit(1)
