"""
Villager journey on a 360px phone: register -> waiting -> verified by the Panchayat -> see a directory
number -> record a story in the browser -> send a complaint -> kept out of /admin -> English pages -> sign out.
Run it with  e2e/run.sh  (after admin.e2e.py, which sets the Mukhiya's password used here).
"""
import os, re, sys, tempfile, time
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("E2E_BASE", "http://localhost:5055")
OUT = str(Path(os.environ.get("E2E_OUT", Path(tempfile.gettempdir()) / "ainwan-e2e")) / "shots") + "/"
os.makedirs(OUT, exist_ok=True)
BOSS = ("mukhiya@ainwan.test", os.environ.get("E2E_BOSS_PASS", "Gaon-Panchayat-2026!"))
H = {"X-Requested-By": "ainwan-web"}
results, console = [], []
def check(name, ok, detail=""):
    results.append((name, bool(ok)))
    print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if detail and not ok else ""))

PHONE = "98" + str(int(time.time()))[-8:]
with sync_playwright() as pw:
    b = pw.chromium.launch(args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"])
    ctx = b.new_context(viewport={"width": 360, "height": 780}, permissions=["microphone"])
    page = ctx.new_page()
    page.set_default_timeout(12000)
    page.on("console", lambda m: console.append(m.text[:200]) if m.type == "error" and "Failed to load resource" not in m.text else None)
    page.on("pageerror", lambda e: console.append("PAGEERROR " + str(e)[:200]))

    # 1. Register from the header's account button
    page.goto(BASE + "/")
    page.get_by_role("link", name="लॉगिन").first.click()
    expect(page).to_have_url(re.compile(r"/login$"))
    page.screenshot(path=OUT + "login-m.png", full_page=True)
    page.get_by_role("link", name="नया खाता बनाएँ").click()
    page.get_by_label("आपका नाम").fill("Sita Devi")
    page.get_by_label("मोबाइल नंबर").fill(PHONE)
    page.get_by_label("टोला / मोहल्ला").fill("Purab tola")
    page.get_by_label("पासवर्ड चुनें").fill("12345678")
    page.get_by_role("button", name="खाता बनाएँ").click()
    expect(page.locator(".field__error").first).to_be_visible()
    errs = page.locator(".field__error").all_inner_texts()
    check("weak password and missing consent are explained in Hindi", any("आम" in e or "अंक" in e for e in errs) and any("टिक" in e for e in errs), str(errs))
    page.get_by_label("पासवर्ड चुनें").fill("aam ka bagicha")
    page.get_by_label("मैंने गोपनीयता नियम पढ़ लिए हैं").check()
    page.screenshot(path=OUT + "register-m.png", full_page=True)
    page.get_by_role("button", name="खाता बनाएँ").click()
    expect(page).to_have_url(re.compile(r"/account$"))
    expect(page.get_by_text("आपका खाता जाँच के लिए भेजा गया है")).to_be_visible()
    check("new account lands on 'my account' with the waiting message", True)
    check("a waiting villager sees no send buttons", page.get_by_role("button", name=re.compile("कहानी रिकॉर्ड करें")).count() == 0)
    page.screenshot(path=OUT + "account-pending-m.png", full_page=True)

    # 2. Directory: waiting villager cannot see numbers
    page.goto(BASE + "/sampark/directory")
    page.wait_for_load_state("networkidle")
    check("waiting villager sees 'numbers after check'", page.get_by_text("खाते की जाँच के बाद नंबर दिखेंगे").count() > 0)

    # 3. An admin approves (API as the Mukhiya, who is above admin)
    admin = b.new_context()
    r = admin.request.post(BASE + "/api/auth/login", headers=H, data={"login": BOSS[0], "password": BOSS[1]})
    check("super admin signs in on the shared login API", r.status == 200, r.status)
    users = admin.request.get(BASE + "/api/admin/users?status=pending").json()
    me = next(u for u in users["items"] if u["phone"] == PHONE)
    r = admin.request.post(BASE + f"/api/admin/users/{me['id']}/verify", headers=H, data={"decision": "approve"})
    check("approve works", r.status == 200, r.status)

    # 4. Verified: see a number in the directory
    page.goto(BASE + "/sampark/directory")
    page.wait_for_load_state("networkidle")
    page.get_by_role("button", name=re.compile("नंबर देखें")).first.click()
    expect(page.locator(".reveal__num").first).to_be_visible()
    check("verified villager sees a directory number", re.search(r"\d{6,}", page.locator(".reveal__num").first.inner_text()) is not None)

    # 5. Record a story in the browser (fake microphone)
    page.goto(BASE + "/account?send=story")
    page.wait_for_load_state("networkidle")
    page.get_by_role("button", name="रिकॉर्ड करें").click()
    expect(page.get_by_text(re.compile("रिकॉर्ड हो रहा है"))).to_be_visible()
    page.wait_for_timeout(2500)
    page.get_by_role("button", name="रोकें").click()
    expect(page.get_by_text("रिकॉर्डिंग जुड़ गई")).to_be_visible(timeout=15000)
    check("recording in the browser uploads", True)
    page.get_by_label("कहानी का शीर्षक").fill("गाँव का पुराना मेला")
    page.get_by_label("बुजुर्ग का नाम").fill("रामेश्वर बाबा")
    page.get_by_label("उम्र").fill("82")
    page.get_by_label("बुजुर्ग (या उनके परिवार) ने").check()
    page.screenshot(path=OUT + "account-story-m.png", full_page=True)
    page.get_by_role("button", name="भेजें").click()
    expect(page.get_by_text("भेज दिया! जाँच के बाद")).to_be_visible()
    expect(page.locator(".sub").first).to_contain_text("गाँव का पुराना मेला")
    check("story appears in 'what I have sent' as waiting", "जाँच बाकी" in page.locator(".sub").first.inner_text())
    q = admin.request.get(BASE + "/api/admin/resources/oral-history?status=pending").json()
    check("story waits in the admin queue", any(i.get("title", {}).get("hi") == "गाँव का पुराना मेला" for i in q["items"]))

    # 6. Suggestion
    page.goto(BASE + "/account?send=message")
    page.get_by_role("radio", name="शिकायत").check()
    page.get_by_label("आपकी बात").fill("पूरब टोला का हैंडपंप खराब है")
    page.get_by_role("button", name="भेजें").click()
    expect(page.get_by_text("भेज दिया। पंचायत की टीम इसे देखेगी।")).to_be_visible()
    check("complaint sent", True)
    page.screenshot(path=OUT + "account-verified-m.png", full_page=True)

    # 7. Villager cannot use the admin area
    page.goto(BASE + "/admin")
    expect(page.get_by_text("यह हिस्सा सिर्फ़ वेबसाइट टीम के लिए है")).to_be_visible()
    check("villager sees 'staff only' in /admin", True)
    status = page.request.get(BASE + "/api/admin/dashboard").status
    check("villager gets 403 from the admin API", status == 403, status)

    # 8. English pages and language memory
    page.goto(BASE + "/vikas")
    page.get_by_role("button", name="Read in English").click()
    expect(page).to_have_url(re.compile(r"/en/vikas$"))
    expect(page.locator("html")).to_have_attribute("lang", "en")
    check("language button moves to /en", True)
    page.goto(BASE + "/sampark/fame")
    expect(page).to_have_url(re.compile(r"/en/sampark/fame$"))
    check("chosen language is remembered on the next visit", True)
    page.get_by_role("button", name="हिंदी में पढ़ें").click()
    expect(page).to_have_url(re.compile(r"/sampark/fame$"))

    # 9. Sign out
    page.goto(BASE + "/account")
    page.get_by_role("button", name="लॉगआउट").click()
    expect(page).to_have_url(re.compile(r"/$"))
    check("sign out", page.request.get(BASE + "/api/auth/me").status == 401)
    b.close()

print(f"\n{sum(ok for _, ok in results)}/{len(results)} checks passed")
print("console errors:", len(console), console[:5])
sys.exit(0 if all(ok for _, ok in results) and not console else 1)
