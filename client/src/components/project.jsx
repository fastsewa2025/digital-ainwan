import { Link } from 'react-router';
import { useI18n } from '../lib/i18n.jsx';
import { Furrow, Photo, PhaseTag } from './ui.jsx';

/** One bar for the whole village: how much of the work is done, under way, and still to come. */
export function VillageBar({ stats }) {
  const { t, fmtINR } = useI18n();
  const { planned, inProgress, completed } = stats.projects;
  const total = planned + inProgress + completed;
  if (!total) return null;
  const parts = [
    { key: 'completed', n: completed, cls: 'vbar__seg--done' },
    { key: 'in-progress', n: inProgress, cls: 'vbar__seg--now' },
    { key: 'planned', n: planned, cls: 'vbar__seg--next' },
  ];
  return (
    <div className="vbar">
      <div className="vbar__bar" role="img" aria-label={parts.map((p) => `${t(`phase.${p.key}`)}: ${p.n}`).join(', ')}>
        {parts.map((p) => p.n > 0 && <span key={p.key} className={`vbar__seg ${p.cls}`} style={{ flexGrow: p.n }} />)}
      </div>
      <ul className="vbar__legend">
        {parts.map((p) => (
          <li key={p.key}>
            <PhaseTag phase={p.key} /> <strong>{p.n}</strong>
          </li>
        ))}
      </ul>
      {stats.budget.allocated > 0 && (
        <p className="vbar__money">
          {t('vikas.sanctioned')}: <strong>{fmtINR(stats.budget.allocated)}</strong>
          <span className="vbar__gap" />
          {t('vikas.spent')}: <strong>{fmtINR(stats.budget.spent)}</strong>
        </p>
      )}
    </div>
  );
}

export function ProjectRow({ p }) {
  const { t, L, fmtINR } = useI18n();
  return (
    <li className="prow">
      <Link className="prow__link" to={`/vikas/projects/${p._id}`}>
        <Photo img={p.cover} seed={p._id} alt="" ratio="4 / 3" className="prow__photo" />
        <div className="prow__body">
          <h3 className="prow__title">{L(p.title)}</h3>
          {p.mohalla && <p className="muted small">{L(p.mohalla)}</p>}
          <div className="prow__meta">
            <PhaseTag phase={p.phase} />
            {p.budgetAllocated != null && <span className="small">{fmtINR(p.budgetAllocated)}</span>}
          </div>
        </div>
        <div className="prow__bar">
          <div className="prow__pct">{p.progress ?? 0}%</div>
          <Furrow value={p.progress} label={`${t('vikas.progress')}: ${p.progress ?? 0}%`} />
        </div>
      </Link>
    </li>
  );
}
