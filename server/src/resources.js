/**
 * Every type of content on the site, described once.
 * - `section`   : which part of the site it belongs to (sanskriti | vikas | sampark)
 * - `fields`    : see lib/fields.js. `heavy` = left out of list responses,
 *                 `secret` = never in public responses (only via an explicit reveal call)
 * - `validate`  : cross-field checks, returns [[path, message], ...]
 * - `derive`    : values computed on every save (cover photo, counts, ...)
 */
import { f } from './lib/fields.js';

const thisYear = new Date().getUTCFullYear();
const coverOf = (...lists) => {
  const p = lists.flat().find(Boolean);
  return p ? { url: p.url, thumb: p.thumb, width: p.width, height: p.height } : undefined;
};

export const RESOURCES = {
  /* ------------------------------ Sanskriti ------------------------------ */
  festivals: {
    section: 'sanskriti',
    label: ['Festivals & events', 'त्योहार और आयोजन'],
    singular: ['Festival / event', 'त्योहार / आयोजन'],
    titleField: 'title',
    dateField: 'date',
    sort: { date: -1 },
    searchFields: ['title.hi', 'title.en', 'location.hi', 'location.en'],
    filters: ['kind'],
    fields: {
      title: f.i18n(['Title', 'शीर्षक'], { required: true, max: 150 }),
      kind: f.select(
        ['Type', 'प्रकार'],
        [
          ['festival', 'Festival', 'त्योहार'],
          ['mela', 'Mela / fair', 'मेला'],
          ['event', 'Community event', 'सामुदायिक आयोजन'],
          ['other', 'Other', 'अन्य'],
        ],
        { required: true, default: 'festival' },
      ),
      date: f.date(['Date', 'तारीख'], { required: true }),
      location: f.i18n(['Place', 'स्थान'], { max: 150 }),
      summary: f.i18nLong(['Short summary', 'संक्षिप्त विवरण'], { max: 500, rows: 3 }),
      report: f.i18nLong(['Event report', 'आयोजन रिपोर्ट'], { heavy: true, rows: 10 }),
      photos: f.gallery(['Photos', 'फोटो'], { heavy: true, max: 30 }),
      videoUrl: f.embed(['YouTube video link', 'यूट्यूब वीडियो लिंक'], { heavy: true }),
    },
    extra: { cover: f.image(), photoCount: f.number() },
    derive: (d) => ({ cover: coverOf(d.photos), photoCount: d.photos?.length ?? 0 }),
  },

  'oral-history': {
    section: 'sanskriti',
    label: ['Oral history', 'बुज़ुर्गों की ज़ुबानी'],
    singular: ['Recording / story', 'रिकॉर्डिंग / किस्सा'],
    titleField: 'title',
    dateField: 'recordedOn',
    sort: { recordedOn: -1, createdAt: -1 },
    searchFields: ['title.hi', 'title.en', 'elderName.hi', 'elderName.en'],
    filters: [],
    fields: {
      title: f.i18n(['Story title', 'किस्से का शीर्षक'], { required: true, max: 150 }),
      elderName: f.i18n(['Elder\'s name', 'बुज़ुर्ग का नाम'], { required: true, max: 100 }),
      elderAge: f.number(['Elder\'s age', 'उम्र'], { min: 30, max: 120, int: true }),
      recordedOn: f.date(['Recorded on', 'रिकॉर्डिंग की तारीख']),
      photo: f.image(['Portrait', 'फोटो']),
      audio: f.audio(['Audio recording (mp3 / m4a / wav)', 'ऑडियो रिकॉर्डिंग (mp3 / m4a / wav)']),
      summary: f.i18nLong(['Short summary', 'संक्षिप्त विवरण'], { max: 600, rows: 3 }),
      transcript: f.i18nLong(['Written version / transcript', 'लिखित रूप'], { heavy: true, rows: 10 }),
      consent: f.bool(['The elder (or family) agreed to publish this', 'बुज़ुर्ग (या परिवार) ने इसे प्रकाशित करने की सहमति दी है'], {
        required: true,
        mustBeTrue: true,
        secret: true,
      }),
    },
  },

  wiki: {
    section: 'sanskriti',
    label: ['Tradition wiki', 'परंपरा कोश'],
    singular: ['Wiki article', 'लेख'],
    titleField: 'title',
    sort: { createdAt: -1 },
    searchFields: ['title.hi', 'title.en', 'summary.hi', 'summary.en'],
    filters: ['category'],
    fields: {
      title: f.i18n(['Title', 'शीर्षक'], { required: true, max: 150 }),
      category: f.select(
        ['Category', 'श्रेणी'],
        [
          ['customs', 'Customs & rituals', 'रीति-रिवाज'],
          ['attire', 'Attire & ornaments', 'पहनावा'],
          ['food', 'Food & cuisine', 'खान-पान'],
          ['art', 'Art & craft', 'कला और शिल्प'],
          ['other', 'Other', 'अन्य'],
        ],
        { required: true, default: 'customs' },
      ),
      summary: f.i18nLong(['Short summary', 'संक्षिप्त विवरण'], { max: 400, rows: 3 }),
      body: f.i18nLong(['Full article', 'पूरा लेख'], { heavy: true, rows: 12 }),
      photos: f.gallery(['Photos', 'फोटो'], { heavy: true, max: 10 }),
    },
    extra: { cover: f.image() },
    derive: (d) => ({ cover: coverOf(d.photos) }),
  },

  albums: {
    section: 'sanskriti',
    label: ['Photo gallery', 'फोटो गैलरी'],
    singular: ['Album', 'एल्बम'],
    titleField: 'title',
    dateField: undefined,
    yearField: 'year',
    sort: { year: -1, createdAt: -1 },
    searchFields: ['title.hi', 'title.en', 'event.hi', 'event.en'],
    filters: [],
    fields: {
      title: f.i18n(['Album title', 'एल्बम का नाम'], { required: true, max: 150 }),
      year: f.number(['Year', 'वर्ष'], { required: true, min: 1900, max: 2100, int: true, default: thisYear }),
      event: f.i18n(['Event', 'आयोजन'], { max: 150 }),
      photos: f.gallery(['Photos', 'फोटो'], { required: true, heavy: true, max: 100 }),
    },
    extra: { cover: f.image(), photoCount: f.number() },
    derive: (d) => ({ cover: coverOf(d.photos), photoCount: d.photos?.length ?? 0 }),
  },

  /* -------------------------------- Vikas -------------------------------- */
  projects: {
    section: 'vikas',
    label: ['Development projects', 'विकास कार्य'],
    singular: ['Project', 'कार्य'],
    titleField: 'title',
    sort: { updatedAt: -1 },
    searchFields: ['title.hi', 'title.en', 'mohalla.hi', 'mohalla.en', 'fundingSource.hi', 'fundingSource.en'],
    filters: ['phase'],
    fields: {
      title: f.i18n(['Project title', 'कार्य का नाम'], { required: true, max: 150 }),
      phase: f.select(
        ['Status', 'स्थिति'],
        [
          ['planned', 'Planned', 'प्रस्तावित'],
          ['in-progress', 'In progress', 'चालू'],
          ['completed', 'Completed', 'पूर्ण'],
        ],
        { required: true, default: 'planned' },
      ),
      progress: f.number(['Progress %', 'प्रगति %'], { min: 0, max: 100, int: true, help: ['Used when status is "In progress". Planned = 0, Completed = 100 automatically.', '"चालू" स्थिति में भरें। प्रस्तावित = 0, पूर्ण = 100 अपने आप।'] }),
      summary: f.i18nLong(['Short summary', 'संक्षिप्त विवरण'], { max: 500, rows: 3 }),
      details: f.i18nLong(['Details', 'विस्तृत जानकारी'], { heavy: true, rows: 8 }),
      mohalla: f.i18n(['Mohalla / ward / area', 'मोहल्ला / वार्ड / क्षेत्र'], { max: 100 }),
      location: f.latlng(['Location on map', 'नक्शे पर स्थान']),
      budgetAllocated: f.number(['Budget sanctioned (₹)', 'स्वीकृत बजट (₹)'], { min: 0, max: 1e11 }),
      budgetSpent: f.number(['Amount spent so far (₹)', 'अब तक खर्च (₹)'], { min: 0, max: 1e11 }),
      fundingSource: f.i18n(['Funding source / scheme', 'धन का स्रोत / योजना'], { max: 150 }),
      agency: f.i18n(['Executing agency / contractor', 'कार्यकारी एजेंसी / ठेकेदार'], { max: 150 }),
      startDate: f.date(['Start date', 'शुरू होने की तारीख']),
      expectedEnd: f.date(['Expected completion', 'पूरा होने की संभावित तारीख']),
      completedOn: f.date(['Completed on', 'पूर्ण होने की तारीख']),
      sanctionDoc: f.pdf(['Sanction / work order (PDF)', 'स्वीकृति / कार्यादेश (PDF)'], { heavy: true }),
      beforePhotos: f.gallery(['"Before" photos', '"पहले" की फोटो'], { heavy: true, max: 10 }),
      afterPhotos: f.gallery(['"After" photos', '"बाद" की फोटो'], { heavy: true, max: 10 }),
      photos: f.gallery(['Progress photos', 'कार्य की फोटो'], { heavy: true, max: 30 }),
      updates: f.list(
        ['Progress updates', 'प्रगति अपडेट'],
        {
          date: f.date(['Date', 'तारीख'], { required: true }),
          progress: f.number(['Progress %', 'प्रगति %'], { min: 0, max: 100, int: true }),
          note: f.i18nLong(['Update', 'अपडेट'], { required: true, max: 500, rows: 2 }),
        },
        { heavy: true, max: 60 },
      ),
    },
    extra: { cover: f.image() },
    derive: (d) => ({
      cover: coverOf(d.photos, d.afterPhotos, d.beforePhotos),
      progress: d.phase === 'completed' ? 100 : d.phase === 'planned' ? 0 : (d.progress ?? 0),
    }),
    validate: (d) => {
      const issues = [];
      if (d.phase === 'in-progress' && d.progress == null) issues.push(['progress', 'Enter the progress % for work in progress']);
      if (d.startDate && d.expectedEnd && new Date(d.expectedEnd) < new Date(d.startDate)) {
        issues.push(['expectedEnd', 'Expected completion is before the start date']);
      }
      return issues;
    },
  },

  notices: {
    section: 'vikas',
    label: ['Public notice board', 'सार्वजनिक सूचना पट्ट'],
    singular: ['Notice', 'सूचना'],
    titleField: 'title',
    dateField: 'date',
    sort: { date: -1, createdAt: -1 },
    searchFields: ['title.hi', 'title.en'],
    filters: ['category'],
    fields: {
      title: f.i18n(['Title', 'शीर्षक'], { required: true, max: 200 }),
      category: f.select(
        ['Category', 'श्रेणी'],
        [
          ['order', 'Panchayat order', 'पंचायत आदेश'],
          ['scheme', 'Government scheme', 'सरकारी योजना'],
          ['meeting', 'Gram Sabha / meeting', 'ग्राम सभा / बैठक'],
          ['general', 'General notice', 'सामान्य सूचना'],
        ],
        { required: true, default: 'general' },
      ),
      date: f.date(['Notice date', 'सूचना की तारीख'], { required: true }),
      body: f.i18nLong(['Notice text', 'सूचना का विवरण'], { heavy: true, max: 10000, rows: 8 }),
      attachment: f.pdf(['Attachment (PDF)', 'संलग्न फ़ाइल (PDF)']),
      link: f.url(['Official link', 'आधिकारिक लिंक']),
      important: f.bool(['Show in the top scrolling ticker', 'ऊपर चलने वाली पट्टी में दिखाएँ']),
      expiresOn: f.date(['Remove from ticker after', 'इस तारीख के बाद पट्टी से हटाएँ']),
    },
  },

  /* ------------------------------- Sampark -------------------------------- */
  directory: {
    section: 'sampark',
    label: ['Ainwan directory', 'ऐनवां निर्देशिका'],
    singular: ['Person / service', 'व्यक्ति / सेवा'],
    titleField: 'name',
    sort: { category: 1, name: 1 },
    searchFields: ['name', 'skills.hi', 'skills.en', 'mohalla'],
    filters: ['category'],
    publicSubmit: true,
    reveal: ['phone'],
    fields: {
      name: f.text(['Name', 'नाम'], { required: true, max: 100 }),
      category: f.select(
        ['Skill / service', 'कौशल / सेवा'],
        [
          ['electrician', 'Electrician', 'इलेक्ट्रीशियन'],
          ['plumber', 'Plumber', 'प्लंबर'],
          ['mason', 'Mason / construction', 'राजमिस्त्री / निर्माण'],
          ['carpenter', 'Carpenter', 'बढ़ई'],
          ['painter', 'Painter', 'पेंटर'],
          ['tailor', 'Tailor', 'दर्ज़ी'],
          ['driver', 'Driver / vehicle', 'ड्राइवर / वाहन'],
          ['teacher', 'Teacher / tutor', 'शिक्षक / ट्यूटर'],
          ['tech', 'Computer / mobile repair', 'कंप्यूटर / मोबाइल मरम्मत'],
          ['farm', 'Farm equipment / agri help', 'कृषि उपकरण / खेती में मदद'],
          ['health', 'Health worker', 'स्वास्थ्य कार्यकर्ता'],
          ['shop', 'Shop / small business', 'दुकान / छोटा व्यवसाय'],
          ['other', 'Other', 'अन्य'],
        ],
        { required: true, default: 'other' },
      ),
      skills: f.i18n(['What they do (short)', 'क्या काम करते हैं (संक्षेप में)'], { max: 150 }),
      mohalla: f.text(['Mohalla / tola', 'मोहल्ला / टोला'], { max: 100 }),
      experience: f.number(['Years of experience', 'अनुभव (वर्ष)'], { min: 0, max: 70, int: true }),
      phone: f.phone(['Phone number', 'फ़ोन नंबर'], { required: true, secret: true }),
      consent: f.bool(['I agree to show these details publicly on this website', 'मैं इन जानकारियों को वेबसाइट पर सार्वजनिक रूप से दिखाने की सहमति देता/देती हूँ'], {
        required: true,
        mustBeTrue: true,
        secret: true,
      }),
    },
  },

  youth: {
    section: 'sampark',
    label: ['Youth corner', 'युवा कोना'],
    singular: ['Entry', 'प्रविष्टि'],
    titleField: 'title',
    sort: { createdAt: -1 },
    searchFields: ['title.hi', 'title.en', 'summary.hi', 'summary.en'],
    filters: ['kind'],
    fields: {
      kind: f.select(
        ['Type', 'प्रकार'],
        [
          ['scholarship', 'Scholarship', 'छात्रवृत्ति'],
          ['exam', 'Exam / recruitment', 'परीक्षा / भर्ती'],
          ['resource', 'Study resource', 'अध्ययन सामग्री'],
          ['topper', 'Village topper', 'गाँव के टॉपर'],
        ],
        { required: true, default: 'scholarship' },
      ),
      title: f.i18n(['Title (or topper\'s name)', 'शीर्षक (या टॉपर का नाम)'], { required: true, max: 200 }),
      subtitle: f.i18n(['Organisation / exam / class', 'संस्था / परीक्षा / कक्षा'], { max: 150 }),
      summary: f.i18nLong(['Details / achievement', 'विवरण / उपलब्धि'], { max: 800, rows: 4 }),
      link: f.url(['Official link', 'आधिकारिक लिंक']),
      deadline: f.date(['Last date to apply', 'आवेदन की अंतिम तारीख']),
      year: f.number(['Year', 'वर्ष'], { min: 1950, max: 2100, int: true }),
      photo: f.image(['Photo (toppers only)', 'फोटो (केवल टॉपर)']),
      consent: f.bool(['Topper / guardian agreed to publish name and photo', 'टॉपर / अभिभावक ने नाम और फोटो प्रकाशित करने की सहमति दी है'], { secret: true }),
    },
    validate: (d) =>
      d.kind === 'topper' && !d.consent
        ? [['consent', 'Consent of the topper (or guardian) is required before publishing their name or photo']]
        : [],
  },

  fame: {
    section: 'sampark',
    label: ['Wall of fame', 'गौरव दीवार'],
    singular: ['Profile', 'प्रोफ़ाइल'],
    titleField: 'name',
    sort: { year: -1, createdAt: -1 },
    searchFields: ['name.hi', 'name.en', 'headline.hi', 'headline.en'],
    filters: ['field'],
    fields: {
      name: f.i18n(['Name', 'नाम'], { required: true, max: 100 }),
      field: f.select(
        ['Field', 'क्षेत्र'],
        [
          ['sports', 'Sports', 'खेल'],
          ['education', 'Education', 'शिक्षा'],
          ['social', 'Social work', 'समाज सेवा'],
          ['service', 'Public service / defence', 'सार्वजनिक सेवा / सेना'],
          ['arts', 'Arts & culture', 'कला और संस्कृति'],
          ['science', 'Science & technology', 'विज्ञान और तकनीक'],
          ['business', 'Business', 'व्यवसाय'],
          ['other', 'Other', 'अन्य'],
        ],
        { required: true, default: 'social' },
      ),
      headline: f.i18n(['One-line achievement', 'एक पंक्ति में उपलब्धि'], { required: true, max: 160 }),
      year: f.number(['Year', 'वर्ष'], { min: 1900, max: 2100, int: true }),
      photo: f.image(['Photo', 'फोटो']),
      bio: f.i18nLong(['Story', 'विस्तृत परिचय'], { heavy: true, max: 5000, rows: 8 }),
      consent: f.bool(['This person agreed to be featured', 'इस व्यक्ति ने प्रोफ़ाइल प्रकाशित करने की सहमति दी है'], {
        required: true,
        mustBeTrue: true,
        secret: true,
      }),
    },
  },
};

export const RESOURCE_KEYS = Object.keys(RESOURCES);

/* ----------------------------- Site settings ----------------------------- */

export const SETTINGS_FIELDS = {
  villageName: f.i18n(['Village name', 'गाँव का नाम'], { required: true, max: 60 }),
  tagline: f.i18n(['Tagline', 'टैगलाइन'], { max: 120 }),
  about: f.i18nLong(['About the village', 'गाँव के बारे में'], { max: 5000, rows: 8 }),
  heroImages: f.gallery(['Home page banner photos (real photos of the village)', 'होम पेज बैनर फोटो (गाँव की असली फोटो)'], { max: 6 }),
  officeAddress: f.i18n(['Panchayat office address', 'पंचायत कार्यालय का पता'], { max: 250 }),
  officeHours: f.i18n(['Office hours', 'कार्यालय समय'], { max: 120 }),
  phone: f.phone(['Office phone', 'कार्यालय फ़ोन']),
  email: f.text(['Contact email (also shown for privacy requests)', 'संपर्क ईमेल (गोपनीयता अनुरोध के लिए भी)'], { max: 120 }),
  facebook: f.url(['Facebook page', 'फेसबुक पेज']),
  youtube: f.url(['YouTube channel', 'यूट्यूब चैनल']),
  instagram: f.url(['Instagram', 'इंस्टाग्राम']),
  whatsapp: f.url(['WhatsApp channel / group link', 'व्हाट्सऐप चैनल / ग्रुप लिंक']),
  mapCenter: f.latlng(['Village centre on map', 'नक्शे पर गाँव का केंद्र']),
  mapZoom: f.number(['Map zoom (12–17)', 'नक्शे का ज़ूम (12–17)'], { min: 8, max: 18, int: true }),
  donationEnabled: f.bool(['Show the "Contribute to village" payment details', '"गाँव के लिए योगदान" भुगतान विवरण दिखाएँ']),
  donationNote: f.i18nLong(['Note shown above the payment details', 'भुगतान विवरण के ऊपर का संदेश'], { max: 1000, rows: 3 }),
  upiId: f.text(['UPI ID of the Panchayat / village fund', 'पंचायत / ग्राम कोष का UPI ID'], { max: 80 }),
  upiName: f.text(['Name on that UPI account', 'उस UPI खाते का नाम'], { max: 100 }),
  bankDetails: f.i18nLong(['Bank account details (name, A/C no., IFSC, branch)', 'बैंक खाते का विवरण (नाम, खाता संख्या, IFSC, शाखा)'], { max: 600, rows: 4 }),
};

export const SETTINGS_DEFAULTS = {
  villageName: { hi: 'ऐनवां', en: 'Ainwan' },
  tagline: { hi: 'परंपरा और प्रगति का संगम', en: 'A blend of Tradition and Progress' },
  mapCenter: { lat: 25.0961, lng: 85.3131 },
  mapZoom: 13,
};
