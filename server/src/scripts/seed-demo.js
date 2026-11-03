/**
 * Fills a TEST database with clearly-labelled sample content so you can see the site working.
 *   npm run seed:demo             add sample content
 *   npm run seed:demo -- --remove delete it again
 * Refuses to run when NODE_ENV=production (a transparency portal must never show made-up
 * budgets as if they were real). Pass --force only if you really mean it.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { loadConfig } from '../config.js';
import { connectDb, disconnectDb } from '../db.js';
import { RESOURCES, SETTINGS_DEFAULTS } from '../resources.js';
import { modelFor } from '../models/index.js';

const config = loadConfig();
const remove = process.argv.includes('--remove');
if (config.isProd && !process.argv.includes('--force')) {
  console.error('\n✖ Refusing to add sample data when NODE_ENV=production. (Use --force if you are sure.)\n');
  process.exit(1);
}

const S = (en, hi) => ({ en: `[Sample] ${en}`, hi: `[नमूना] ${hi}` });
const T = (en, hi) => ({ en, hi });
const year = new Date().getUTCFullYear();
const day = (m, d, y = year) => new Date(Date.UTC(y, m - 1, d));
const centre = SETTINGS_DEFAULTS.mapCenter;
const near = (i) => ({ lat: +(centre.lat + ((i * 37) % 11 - 5) * 0.0012).toFixed(5), lng: +(centre.lng + ((i * 53) % 13 - 6) * 0.0012).toFixed(5) });

async function sampleImage(label, c1, c2) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
    <rect width="1200" height="800" fill="url(#g)"/><circle cx="930" cy="190" r="90" fill="#ffd36b" fill-opacity=".8"/>
    <path d="M0 620 Q300 520 600 600 T1200 570 V800 H0Z" fill="#000" fill-opacity=".18"/>
    <text x="60" y="750" font-family="sans-serif" font-size="34" fill="#fff" fill-opacity=".9">SAMPLE IMAGE · ${label}</text></svg>`;
  const id = crypto.randomBytes(12).toString('hex');
  const dir = path.join(config.uploadDir, 'images');
  await fs.mkdir(dir, { recursive: true });
  const img = sharp(Buffer.from(svg));
  await img.clone().resize({ width: 1200 }).webp({ quality: 80 }).toFile(path.join(dir, `${id}.webp`));
  await img.clone().resize({ width: 480 }).webp({ quality: 72 }).toFile(path.join(dir, `${id}_t.webp`));
  return { url: `/uploads/images/${id}.webp`, thumb: `/uploads/images/${id}_t.webp`, width: 1200, height: 800 };
}

const isSample = { $or: [{ 'title.en': /^\[Sample\]/ }, { 'name.en': /^\[Sample\]/ }, { name: /^\[Sample\]/ }] };

await connectDb(config.mongoUri);
try {
  if (remove) {
    let n = 0;
    for (const key of Object.keys(RESOURCES)) n += (await modelFor(key).deleteMany(isSample)).deletedCount;
    console.log(`\n✔ Removed ${n} sample entries. (Sample image files stay in ${config.uploadDir}.)\n`);
  } else {
    const add = (key, data) => {
      const def = RESOURCES[key];
      return modelFor(key).create({ ...data, ...(def.derive?.(data) ?? {}), status: 'published', publishedAt: new Date(), source: 'admin' });
    };
    const imgs = [
      await sampleImage('Fields', '#2f6b3f', '#a7c957'),
      await sampleImage('Village', '#7a4b2a', '#e3a31b'),
      await sampleImage('Festival', '#b5482f', '#f2b134'),
      await sampleImage('Pond', '#1d5c63', '#7ec8c3'),
    ];

    await add('festivals', { title: S('Holi gathering', 'होली मिलन'), kind: 'festival', date: day(3, 14), location: T('Village chowk', 'गाँव का चौक'), summary: T('Sample entry showing how a festival with photos appears.', 'नमूना प्रविष्टि: फोटो के साथ त्योहार ऐसे दिखता है।'), report: T('Replace this with the real event report.', 'इसे असली आयोजन रिपोर्ट से बदलें।'), photos: [imgs[2], imgs[1]] });
    await add('festivals', { title: S('Chhath Puja at the pond', 'तालाब पर छठ पूजा'), kind: 'festival', date: day(11, 7, year - 1), location: T('Village pond', 'गाँव का तालाब'), summary: T('Sample entry from last year.', 'पिछले साल की नमूना प्रविष्टि।'), photos: [imgs[3]] });
    await add('festivals', { title: S('Annual village mela', 'वार्षिक ग्राम मेला'), kind: 'mela', date: day(1, 15, year - 2), summary: T('Sample entry from two years ago.', 'दो साल पहले की नमूना प्रविष्टि।'), photos: [imgs[1]] });

    await add('oral-history', { title: S('How the first well was dug', 'पहला कुआँ कैसे खुदा'), elderName: T('Sample Elder', 'नमूना बुज़ुर्ग'), elderAge: 82, recordedOn: day(8, 2), summary: T('A sample recording entry (no audio attached).', 'नमूना रिकॉर्डिंग प्रविष्टि (ऑडियो संलग्न नहीं)।'), transcript: T('The written version of the story goes here.', 'कहानी का लिखित रूप यहाँ आएगा।'), consent: true });
    await add('wiki', { title: S('Wedding customs', 'विवाह की रस्में'), category: 'customs', summary: T('Sample article about local customs.', 'स्थानीय रीति-रिवाज पर नमूना लेख।'), body: T('Write the full article here.', 'पूरा लेख यहाँ लिखें।'), photos: [imgs[1]] });
    await add('wiki', { title: S('Traditional dishes', 'पारंपरिक व्यंजन'), category: 'food', summary: T('Sample article about food.', 'खान-पान पर नमूना लेख।') });
    await add('albums', { title: S('Village in monsoon', 'बरसात में गाँव'), year, event: T('Monsoon', 'बरसात'), photos: imgs.map((p, i) => ({ ...p, caption: T(`Sample photo ${i + 1}`, `नमूना फोटो ${i + 1}`) })) });

    await add('projects', { title: S('New water tank', 'नई पानी की टंकी'), phase: 'planned', summary: T('Sample planned project.', 'नमूना प्रस्तावित कार्य।'), mohalla: T('North tola', 'उत्तर टोला'), location: near(1), budgetAllocated: 1250000, fundingSource: T('Sample scheme', 'नमूना योजना'), expectedEnd: day(12, 31) });
    await add('projects', { title: S('Road repair — main lane', 'मुख्य गली की सड़क मरम्मत'), phase: 'in-progress', progress: 40, summary: T('Sample project that is 40% complete.', 'नमूना कार्य जो 40% पूर्ण है।'), mohalla: T('Main lane', 'मुख्य गली'), location: near(2), budgetAllocated: 800000, budgetSpent: 310000, fundingSource: T('Sample scheme', 'नमूना योजना'), startDate: day(9, 1), expectedEnd: day(12, 15), photos: [imgs[0]], updates: [{ date: day(9, 20), progress: 20, note: T('Material arrived.', 'सामग्री पहुँची।') }, { date: day(10, 25), progress: 40, note: T('First stretch done.', 'पहला हिस्सा पूरा।') }] });
    await add('projects', { title: S('Street lights', 'गलियों में स्ट्रीट लाइट'), phase: 'in-progress', progress: 75, mohalla: T('South tola', 'दक्षिण टोला'), location: near(3), budgetAllocated: 300000, budgetSpent: 240000, startDate: day(8, 10) });
    await add('projects', { title: S('Community hall painting', 'सामुदायिक भवन की पुताई'), phase: 'completed', summary: T('Sample completed project with before/after photos.', 'नमूना पूर्ण कार्य (पहले/बाद की फोटो सहित)।'), mohalla: T('Centre', 'केंद्र'), location: near(4), budgetAllocated: 120000, budgetSpent: 118500, completedOn: day(7, 5), beforePhotos: [imgs[1]], afterPhotos: [imgs[0]] });

    await add('notices', { title: S('Gram Sabha meeting', 'ग्राम सभा की बैठक'), category: 'meeting', date: day(11, 1), important: true, body: T('Sample notice. The date and agenda go here.', 'नमूना सूचना। तारीख और एजेंडा यहाँ।') });
    await add('notices', { title: S('Scheme enrolment camp', 'योजना पंजीकरण शिविर'), category: 'scheme', date: day(10, 20), important: true, expiresOn: day(12, 31) });
    await add('notices', { title: S('Water supply timing change', 'जल आपूर्ति के समय में बदलाव'), category: 'order', date: day(10, 5) });

    await add('directory', { name: '[Sample] Electrician', category: 'electrician', skills: T('House wiring and repairs', 'घरेलू वायरिंग और मरम्मत'), mohalla: 'North tola', experience: 8, phone: '+910000000001', consent: true });
    await add('directory', { name: '[Sample] Maths tutor', category: 'teacher', skills: T('Classes 8–12', 'कक्षा 8–12'), mohalla: 'Centre', experience: 4, phone: '+910000000002', consent: true });
    await add('directory', { name: '[Sample] Tailor', category: 'tailor', skills: T('Stitching and alterations', 'सिलाई और अल्टरेशन'), mohalla: 'South tola', experience: 12, phone: '+910000000003', consent: true });

    await add('youth', { kind: 'scholarship', title: S('State merit scholarship', 'राज्य मेधावृत्ति'), subtitle: T('Sample organisation', 'नमूना संस्था'), summary: T('Sample scholarship entry with a deadline.', 'नमूना छात्रवृत्ति प्रविष्टि (अंतिम तारीख सहित)।'), deadline: day(12, 20), link: 'https://example.org' });
    await add('youth', { kind: 'exam', title: S('Competitive exam calendar', 'प्रतियोगी परीक्षा कैलेंडर'), summary: T('Sample exam resource.', 'नमूना परीक्षा सामग्री।'), link: 'https://example.org' });
    await add('youth', { kind: 'topper', title: S('Sample Topper', 'नमूना टॉपर'), subtitle: T('Class 10', 'कक्षा 10'), summary: T('Sample topper entry.', 'नमूना टॉपर प्रविष्टि।'), year: year - 1, consent: true });
    await add('fame', { name: S('Sample Athlete', 'नमूना खिलाड़ी'), field: 'sports', headline: T('District-level medal winner', 'ज़िला स्तर पर पदक विजेता'), year: year - 1, photo: imgs[0], bio: T('Sample profile.', 'नमूना प्रोफ़ाइल।'), consent: true });
    await add('fame', { name: S('Sample Teacher', 'नमूना शिक्षक'), field: 'education', headline: T('Taught three generations', 'तीन पीढ़ियों को पढ़ाया'), consent: true });

    console.log('\n✔ Sample content added. Every entry is labelled [Sample] / [नमूना].\n  Remove it later with: npm run seed:demo -- --remove\n');
  }
} finally {
  await disconnectDb();
}
