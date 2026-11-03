import { useI18n } from '../lib/i18n.jsx';
import { useFetch } from '../lib/api.js';
import { Async, PageHead, Pager, useTitle } from '../components/ui.jsx';
import { Chips, SearchBox, useListParams } from '../components/filters.jsx';
import { ProjectRow, VillageBar } from '../components/project.jsx';

const PHASES = ['in-progress', 'planned', 'completed'];

export default function Projects() {
  const { t, fmtNum } = useI18n();
  useTitle(t('vikas.title'));
  const p = useListParams();
  const summary = useFetch('/public/home'); // gives the counts and budget totals for the whole village
  const res = useFetch('/public/content/projects', { phase: p.get('phase'), q: p.get('q'), page: p.page, limit: 10 });

  const stats = summary.data?.stats;
  const count = (phase) => {
    if (!stats) return undefined;
    const key = phase === 'in-progress' ? 'inProgress' : phase;
    return stats.projects[key];
  };

  return (
    <>
      <PageHead module="vikas" title={t('vikas.title')} intro={t('vikas.intro')} />
      <div className="page">
        <div className="wrap">
          {stats && <VillageBar stats={stats} />}
          <div className="toolbar">
            <SearchBox value={p.get('q')} onChange={(q) => p.set({ q })} placeholder={t('vikas.searchPh')} />
          </div>
          <Chips
            label={t('vikas.title')}
            value={p.get('phase')}
            onChange={(phase) => p.set({ phase })}
            options={PHASES.map((ph) => ({ value: ph, label: t(`phase.${ph}`), count: count(ph) }))}
          />
          <Async res={res} empty={(d) => d.items.length === 0} emptyText={p.get('q') || p.get('phase') ? t('common.nothingFound') : t('vikas.empty')}>
            {(d) => (
              <>
                <p className="small muted listcount">{t('vikas.count', { n: fmtNum(d.total) })}</p>
                <ul className="prows">
                  {d.items.map((pr) => (
                    <ProjectRow key={pr._id} p={pr} />
                  ))}
                </ul>
                <Pager page={d.page} pages={d.pages} onPage={(page) => p.set({ page })} />
              </>
            )}
          </Async>
          {stats?.budget.allocated > 0 && <p className="small muted note">{t('vikas.budgetNote')}</p>}
        </div>
      </div>
    </>
  );
}
