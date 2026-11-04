/**
 * The server answers in English. On Hindi screens (public site and admin) the red messages are
 * translated here, so nobody has to read English to find out what is wrong. A message that is not
 * in this list is shown as the server wrote it (never hidden).
 */
const HI = {
  // fields
  Required: 'यह भरना ज़रूरी है',
  'Enter at least one language (Hindi or English)': 'हिन्दी या अंग्रेज़ी में से कम से कम एक भाषा में भरें',
  'Enter a valid number': 'सही संख्या लिखें',
  'Enter a whole number': 'पूरी संख्या लिखें (दशमलव नहीं)',
  'Enter a valid date': 'सही तारीख चुनें',
  'Date out of range': 'तारीख सही सीमा में नहीं है',
  'This confirmation is required': 'यह सहमति ज़रूरी है',
  'Choose one of the options': 'सूची में से एक विकल्प चुनें',
  'Enter a full link starting with https://': 'पूरा लिंक लिखें, जो https:// से शुरू हो',
  'Only YouTube links are supported': 'सिर्फ़ यूट्यूब का लिंक चलेगा',
  'Enter a valid phone number': 'सही फ़ोन नंबर लिखें',
  'Add at least one photo': 'कम से कम एक फोटो जोड़ें',
  'Invalid image': 'फोटो सही नहीं है',
  'Invalid audio file': 'ऑडियो फ़ाइल सही नहीं है',
  'Invalid PDF file': 'PDF फ़ाइल सही नहीं है',
  'Invalid URL': 'सही वेब लिंक लिखें',
  'Invalid email address': 'सही ईमेल लिखें',
  'Enter a valid e-mail': 'सही ईमेल लिखें',
  'Enter a valid e-mail address': 'सही ईमेल लिखें',
  'A UPI ID looks like name@bank': 'UPI आईडी ऐसी होती है: नाम@बैंक',
  'Enter a name': 'नाम लिखें',
  'A user with this e-mail already exists': 'इस ईमेल से पहले से एक खाता है',
  'Write a short reason so the editor knows what to fix': 'एक छोटा कारण लिखें, ताकि संपादक को पता चले क्या ठीक करना है',
  'Consent of the topper (or guardian) is required before publishing their name or photo': 'नाम या फोटो प्रकाशित करने से पहले टॉपर (या अभिभावक) की सहमति ज़रूरी है',
  'Invalid input': 'जानकारी सही नहीं है',
  'Enter the progress % for work in progress': '"चालू" कार्य की प्रगति % लिखें',
  'Expected completion is before the start date': 'पूरा होने की तारीख, शुरू होने की तारीख से पहले है',
  // passwords
  'Use at most 128 characters': 'ज़्यादा से ज़्यादा 128 अक्षर रखें',
  'That password is too common': 'यह पासवर्ड बहुत आम है, कोई और चुनें',
  'Do not include your e-mail name in the password': 'पासवर्ड में अपने ईमेल का नाम न रखें',
  'Not correct': 'सही नहीं है',
  'Current password is not correct': 'अभी का पासवर्ड सही नहीं है',
  'Must be different from the current one': 'अभी वाले पासवर्ड से अलग होना चाहिए',
  'Choose a different password': 'कोई और पासवर्ड चुनें',
  'Password is not correct': 'पासवर्ड सही नहीं है',
  'A password of only numbers is easy to guess. Add some letters.': 'सिर्फ़ अंकों वाला पासवर्ड आसानी से अंदाज़ा लग जाता है। कुछ अक्षर भी जोड़ें।',
  'Do not use your mobile number in the password': 'पासवर्ड में अपना मोबाइल नंबर न रखें',
  // accounts
  'Enter your name': 'अपना नाम लिखें',
  'Enter a valid 10-digit mobile number': 'सही 10 अंकों का मोबाइल नंबर लिखें',
  'This mobile number is already registered. Sign in instead.': 'यह मोबाइल नंबर पहले से रजिस्टर है। लॉगिन करें।',
  'This e-mail is already registered': 'यह ईमेल पहले से रजिस्टर है',
  'Please tick this box to continue': 'आगे बढ़ने के लिए इसे टिक करें',
  'Choose one': 'एक विकल्प चुनें',
  'Wrong mobile number / e-mail or password': 'मोबाइल नंबर / ईमेल या पासवर्ड ग़लत है',
  'Your account is waiting for the Panchayat to verify it': 'आपका खाता पंचायत की जाँच का इंतज़ार कर रहा है',
  'You can manage only accounts below your own level': 'आप सिर्फ़ अपने से नीचे के स्तर के खाते बदल सकते हैं',
  'Only a super admin can add admins': 'एडमिन सिर्फ़ मुख्य एडमिन जोड़ सकते हैं',
  'Only a super admin can change roles': 'भूमिका सिर्फ़ मुख्य एडमिन बदल सकते हैं',
  'At least one active super admin must remain': 'कम से कम एक चालू मुख्य एडमिन रहना ज़रूरी है',
  'Only villager accounts need verification': 'सिर्फ़ ग्रामीण खातों की जाँच होती है',
  'Write a short reason so the person knows what to do': 'एक छोटा कारण लिखें, ताकि व्यक्ति को पता चले क्या करना है',
  'Write a short reason so the writer knows what to fix': 'एक छोटा कारण लिखें, ताकि लिखने वाले को पता चले क्या ठीक करना है',
  'Give an e-mail or a mobile number': 'ईमेल या मोबाइल नंबर में से एक दें',
  'A user with this mobile number already exists': 'इस मोबाइल नंबर से पहले से एक खाता है',
  'Staff accounts are removed by a super admin': 'स्टाफ़ खाते मुख्य एडमिन ही हटाते हैं',
  // things villagers send
  'Add the recording': 'रिकॉर्डिंग जोड़ें',
  'Please confirm this': 'कृपया इसकी पुष्टि करें',
  'Wait until your earlier listings are checked': 'पहले भेजी गई प्रविष्टियों की जाँच होने तक रुकें',
  'You have looked up many numbers today. Please try again tomorrow.': 'आज आपने बहुत नंबर देख लिए। कल फिर कोशिश करें।',
  // settings
  'Paste the link or code from Google My Maps → Share → Embed on my site': 'Google My Maps → Share → Embed on my site से लिंक या कोड चिपकाएँ',
  'A PIN code has 6 digits': 'पिन कोड 6 अंकों का होता है',
  'Paste only the code from the Google meta tag': 'Google meta टैग से सिर्फ़ कोड चिपकाएँ',
  // actions
  'Please fix the highlighted fields': 'लाल निशान वाली जगहें ठीक करें',
  'Only the Mukhiya (super admin) can publish': 'सिर्फ़ मुखिया (मुख्य एडमिन) प्रकाशित कर सकते हैं',
  'Only the Mukhiya (super admin) can publish, reject or unpublish': 'सिर्फ़ मुखिया (मुख्य एडमिन) प्रकाशित, वापस या बंद कर सकते हैं',
  'Editors can delete only their own drafts': 'संपादक सिर्फ़ अपने ड्राफ्ट हटा सकते हैं',
  'Admins can delete only their own drafts': 'एडमिन सिर्फ़ अपने ड्राफ्ट हटा सकते हैं',
  'You cannot change your own role or deactivate yourself': 'आप अपनी भूमिका नहीं बदल सकते और खुद को बंद नहीं कर सकते',
  'You do not have permission to do this': 'आपको यह करने की अनुमति नहीं है',
  'Please sign in': 'कृपया साइन इन करें',
  'Session expired. Please sign in again.': 'सत्र समाप्त हो गया। कृपया फिर से साइन इन करें।',
  'Invalid e-mail or password': 'ईमेल या पासवर्ड ग़लत है',
  'Please set a new password first': 'पहले नया पासवर्ड बनाएँ',
  'That value already exists': 'यह पहले से मौजूद है (शायद यह ईमेल पहले से किसी के पास है)',
  'Not found': 'नहीं मिला',
  'Unknown content type': 'सामग्री का प्रकार पहचाना नहीं गया',
  // uploads
  'No file received': 'कोई फ़ाइल नहीं मिली',
  'That file is too large': 'यह फ़ाइल बहुत बड़ी है',
  'Upload failed': 'अपलोड नहीं हो सका',
  'Please upload a JPG, PNG or WebP photo': 'कृपया JPG, PNG या WebP फोटो चुनें',
  'That photo could not be read. Try another file.': 'यह फोटो पढ़ी नहीं जा सकी। कोई और फ़ाइल आज़माएँ।',
  'Please upload an MP3, M4A, OGG, AAC or WAV recording': 'कृपया MP3, M4A, OGG, AAC या WAV रिकॉर्डिंग चुनें',
  'Please upload a PDF file': 'कृपया PDF फ़ाइल चुनें',
  // general
  'No connection': 'इंटरनेट नहीं मिला। कनेक्शन देखें।',
  'Too many requests. Please wait a little and try again.': 'बहुत ज़्यादा कोशिशें हुईं। थोड़ी देर बाद फिर करें।',
  'Something went wrong on our side': 'हमारी तरफ़ से कुछ गड़बड़ हुई। थोड़ी देर बाद फिर करें।',
  'Request failed': 'काम नहीं हो सका। फिर कोशिश करें।',
  'Invalid data': 'जानकारी सही नहीं है',
  'Invalid request body': 'जानकारी सही नहीं है',
  'Request is too large': 'भेजी गई जानकारी बहुत बड़ी है',
  'Blocked: request did not come from the website': 'यह अनुरोध वेबसाइट से नहीं आया, इसलिए रोका गया',
};

// Messages that carry a number: "Maximum 150 characters", "At most 30 photos", zod's own wording, ...
const PATTERNS_HI = [
  [/^Use at least (\d+) characters$/, (n) => `कम से कम ${n} अक्षर या अंक रखें`],
  [/^Too many wrong attempts\. Try again after (\d+) minutes\.$/, (n) => `बहुत ग़लत कोशिशें हुईं। ${n} मिनट बाद फिर करें।`],
  [/^Maximum (\d+) characters$/, (n) => `ज़्यादा से ज़्यादा ${n} अक्षर लिखें`],
  [/^Minimum (\S+)$/, (n) => `कम से कम ${n} होना चाहिए`],
  [/^Maximum (\S+)$/, (n) => `${n} से ज़्यादा नहीं होना चाहिए`],
  [/^At most (\d+) photos$/, (n) => `ज़्यादा से ज़्यादा ${n} फोटो`],
  [/^At most (\d+) entries$/, (n) => `ज़्यादा से ज़्यादा ${n} प्रविष्टियाँ`],
  [/^Too big: expected string to have <=(\d+) characters$/, (n) => `ज़्यादा से ज़्यादा ${n} अक्षर लिखें`],
  [/^Too small: expected string to have >=(\d+) characters?$/, (n) => `कम से कम ${n} अक्षर लिखें`],
  [/^Too big: expected number to be <=(\S+)$/, (n) => `${n} से ज़्यादा नहीं होना चाहिए`],
  [/^Too small: expected number to be >=(\S+)$/, (n) => `कम से कम ${n} होना चाहिए`],
];

export function translateError(message, lang) {
  if (lang !== 'hi' || !message) return message;
  if (HI[message]) return HI[message];
  for (const [pattern, make] of PATTERNS_HI) {
    const m = pattern.exec(message);
    if (m) return make(...m.slice(1));
  }
  return message;
}
