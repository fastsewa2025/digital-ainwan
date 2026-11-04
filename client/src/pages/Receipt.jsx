import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useFetch } from '../lib/api.js';
import { amountInWords } from '../lib/words.js';
import { LeafHeart, Icon } from '../components/Icons.jsx';
import { Loading } from '../components/ui.jsx';
import { STRINGS } from '../lib/strings.js';

/* A receipt is printed and shown to others, so it is always in both languages: Hindi, then English. */
const both = (key) => `${STRINGS.hi[key]} / ${STRINGS.en[key]}`;
const pick = (v, lang) => (typeof v === 'string' ? v : v?.[lang] || v?.hi || v?.en || '');
const inr = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n ?? 0);
const date = (d) => (d ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(d)) : '');

export default function Receipt() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { data, error, loading } = useFetch(`/public/receipt/${id}`, { k: params.get('k') ?? '' });

  useEffect(() => {
    document.title = data ? `${data.receiptNo} · ${pick(data.villageName, 'hi')}` : both('rcpt.title');
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, [data]);

  if (loading) return <Loading />;
  if (error || !data) {
    return (
      <main className="rcpt-page">
        <p className="alert alert--error" role="alert">
          {both('rcpt.invalid')}
        </p>
      </main>
    );
  }
  const receiver = pick(data.teamName, 'hi') || pick(data.panchayatName, 'hi') || pick(data.villageName, 'hi');
  const rows = [
    ['rcpt.no', data.receiptNo],
    ['rcpt.date', date(data.date)],
    ['rcpt.from', `${data.donorName}${data.place ? `, ${data.place}` : ''}`],
    ['rcpt.amount', inr(data.amount)],
    ['rcpt.words', `${amountInWords(data.amount, 'hi')} (${amountInWords(data.amount, 'en')})`],
    ['rcpt.mode', both(`kosh.mode.${data.mode}`)],
    ['rcpt.purpose', pick(data.purpose, 'hi') || both('kosh.general')],
    ['rcpt.by', receiver],
  ];
  return (
    <main className="rcpt-page">
      <article className="rcpt">
        <header className="rcpt__head">
          <LeafHeart className="rcpt__leaf" />
          <div>
            <p className="rcpt__village">
              {pick(data.villageName, 'hi')} · {pick(data.villageName, 'en')}
            </p>
            {data.officeAddress && <p className="small">{pick(data.officeAddress, 'hi')}</p>}
          </div>
        </header>
        <h1 className="rcpt__title">{both('rcpt.title')}</h1>
        <dl className="rcpt__rows">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt>{both(k)}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <p className="rcpt__thanks">{both('rcpt.thanks')}</p>
        <p className="small">{both('rcpt.digital')}</p>
        <p className="small">
          {both('rcpt.check')} <span className="rcpt__url">{window.location.href}</span>
        </p>
      </article>
      <p className="rcpt__print">
        <button type="button" className="btn btn--primary" onClick={() => window.print()}>
          <Icon name="print" size={20} />
          {both('rcpt.print')}
        </button>
      </p>
    </main>
  );
}
