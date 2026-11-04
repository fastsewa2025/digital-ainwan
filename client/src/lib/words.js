/**
 * Amounts in words for receipts, Indian style (lakh, crore), in Hindi and English.
 * 5100 -> "पाँच हज़ार एक सौ" / "Five thousand one hundred"
 */
const HI = [
  'शून्य', 'एक', 'दो', 'तीन', 'चार', 'पाँच', 'छह', 'सात', 'आठ', 'नौ', 'दस',
  'ग्यारह', 'बारह', 'तेरह', 'चौदह', 'पंद्रह', 'सोलह', 'सत्रह', 'अठारह', 'उन्नीस', 'बीस',
  'इक्कीस', 'बाईस', 'तेईस', 'चौबीस', 'पच्चीस', 'छब्बीस', 'सत्ताईस', 'अट्ठाईस', 'उनतीस', 'तीस',
  'इकतीस', 'बत्तीस', 'तैंतीस', 'चौंतीस', 'पैंतीस', 'छत्तीस', 'सैंतीस', 'अड़तीस', 'उनतालीस', 'चालीस',
  'इकतालीस', 'बयालीस', 'तैंतालीस', 'चवालीस', 'पैंतालीस', 'छियालीस', 'सैंतालीस', 'अड़तालीस', 'उनचास', 'पचास',
  'इक्यावन', 'बावन', 'तिरपन', 'चौवन', 'पचपन', 'छप्पन', 'सत्तावन', 'अट्ठावन', 'उनसठ', 'साठ',
  'इकसठ', 'बासठ', 'तिरसठ', 'चौंसठ', 'पैंसठ', 'छियासठ', 'सड़सठ', 'अड़सठ', 'उनहत्तर', 'सत्तर',
  'इकहत्तर', 'बहत्तर', 'तिहत्तर', 'चौहत्तर', 'पचहत्तर', 'छिहत्तर', 'सतहत्तर', 'अठहत्तर', 'उन्यासी', 'अस्सी',
  'इक्यासी', 'बयासी', 'तिरासी', 'चौरासी', 'पचासी', 'छियासी', 'सत्तासी', 'अट्ठासी', 'नवासी', 'नब्बे',
  'इक्यानवे', 'बानवे', 'तिरानवे', 'चौरानवे', 'पंचानवे', 'छियानवे', 'सत्तानवे', 'अट्ठानवे', 'निन्यानवे',
];
const EN_ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const en99 = (n) => (n < 20 ? EN_ONES[n] : `${EN_TENS[Math.floor(n / 10)]}${n % 10 ? `-${EN_ONES[n % 10]}` : ''}`);

const SCALE = [
  [10_000_000, 'करोड़', 'crore'],
  [100_000, 'लाख', 'lakh'],
  [1000, 'हज़ार', 'thousand'],
  [100, 'सौ', 'hundred'],
];

function spell(n, lang) {
  const small = (x) => (lang === 'hi' ? HI[x] : en99(x));
  const parts = [];
  let rest = n;
  for (const [size, hi, en] of SCALE) {
    if (rest >= size) {
      const count = Math.floor(rest / size);
      // crores can exceed 99 ("एक सौ करोड़"), so spell the count itself
      parts.push(`${count > 99 ? spell(count, lang) : small(count)} ${lang === 'hi' ? hi : en}`);
      rest %= size;
    }
  }
  if (rest > 0 || parts.length === 0) parts.push(small(rest));
  return parts.join(' ');
}

export function amountInWords(amount, lang) {
  const n = Math.round(Math.abs(Number(amount) || 0));
  const words = spell(n, lang);
  return lang === 'hi' ? `${words} रुपये मात्र` : `${words.charAt(0).toUpperCase()}${words.slice(1)} rupees only`;
}
