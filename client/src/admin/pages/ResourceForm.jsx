import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { api, useFetch } from '../../lib/api.js';
import { Async } from '../../components/ui.jsx';
import { useA } from '../useA.js';
import { useMeta } from '../meta.jsx';
import { useSession } from '../session.jsx';
import { StatusBadge } from '../StatusBadge.jsx';
import { FieldInput } from '../inputs/FieldInput.jsx';
import { emptyForm, formFromDoc, issueMap, toPayload } from '../formModel.js';

function Editor({ resource, def, doc, onSaved }) {
  const { a, pick, dt, err } = useA();
  const { user, isSuper } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const summary = useRef(null);
  const reasonRef = useRef(null);
  const isNew = !doc;

  const [values, setValues] = useState(() => (doc ? formFromDoc(def.fields, doc) : emptyForm(def.fields)));
  const [issues, setIssues] = useState({});
  const [state, setState] = useState({ busy: false, problem: null, flash: location.state?.flash ?? null });
  const [dirty, setDirty] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const status = doc?.status ?? 'new';
  const mine = String(doc?.createdBy?.id) === String(user.id);
  const canDelete = !isNew && (isSuper || (mine && (status === 'draft' || status === 'rejected')));

  useEffect(() => {
    if (!dirty) return undefined;
    const guard = (e) => e.preventDefault(); // the browser then asks before closing the tab
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);

  useEffect(() => {
    if (Object.keys(issues).length) summary.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [issues]);

  // The reason box opens below the save buttons, which may be out of sight: bring it into view and focus it.
  useEffect(() => {
    if (!rejecting) return;
    reasonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    reasonRef.current?.focus({ preventScroll: true });
  }, [rejecting]);

  const setField = (key) => (v) => {
    setValues((o) => ({ ...o, [key]: v }));
    setDirty(true);
  };

  const run = async (fn) => {
    setState({ busy: true, problem: null, flash: null });
    setIssues({});
    try {
      await fn();
    } catch (error) {
      setIssues(issueMap(error));
      setState({ busy: false, problem: error.code === 'VALIDATION' ? a('form.fixErrors') : error.message, flash: null });
      return;
    }
    setState((s) => ({ ...s, busy: false }));
  };

  /** `next` is the status to ask for; leaving it out keeps whatever the server decides (see the rules in the buttons below). */
  const save = (next) =>
    run(async () => {
      const body = toPayload(def.fields, values);
      if (next) body.status = next;
      if (isNew) {
        const saved = await api.post(`/admin/resources/${resource}`, body);
        setDirty(false);
        navigate(`/admin/content/${resource}/${saved._id}`, { replace: true, state: { flash: 'saved' } });
      } else {
        await api.put(`/admin/resources/${resource}/${doc._id}`, body);
        setDirty(false);
        navigate(`/admin/content/${resource}/${doc._id}`, { replace: true, state: { flash: 'saved' } });
        onSaved(); // fetch the item again so the status and dates on screen are the server's
      }
    });

  const setStatus = (next, why) =>
    run(async () => {
      await api.post(`/admin/resources/${resource}/${doc._id}/status`, { status: next, reason: why });
      setDirty(false);
      navigate(`/admin/content/${resource}`);
    });

  const remove = () =>
    run(async () => {
      await api.del(`/admin/resources/${resource}/${doc._id}`);
      setDirty(false);
      navigate(`/admin/content/${resource}`);
    });

  const busy = state.busy;
  const problems = Object.keys(issues).length;

  return (
    <div className="adm-page">
      <p>
        <Link to={`/admin/content/${resource}`}>← {pick(def.label)}</Link>
      </p>
      <div className="adm-head">
        <h1 className="adm-title">{isNew ? a('form.newTitle', { what: pick(def.singular) }) : pick(def.singular)}</h1>
        {!isNew && <StatusBadge status={status} />}
      </div>

      {state.flash && (
        <p className="alert" role="status">
          {a('form.saved')}
        </p>
      )}
      {doc?.source === 'public' && status === 'pending' && <p className="alert alert--warn">{a('form.fromPublic')}</p>}
      {status === 'rejected' && (
        <p className="alert alert--error">
          <strong>{a('form.rejectedBecause')}</strong> {doc.rejectReason}
        </p>
      )}
      {!isSuper && status === 'published' && <p className="alert alert--warn">{a('form.editorPublishedWarn')}</p>}
      {problems > 0 && (
        <p ref={summary} className="alert alert--error" role="alert">
          {a('form.fixErrors')}
        </p>
      )}
      {state.problem && problems === 0 && (
        <p className="alert alert--error" role="alert">
          {err(state.problem)}
        </p>
      )}

      <form className="adm-form" onSubmit={(e) => e.preventDefault()} noValidate>
        <p className="small muted">{a('form.legend')}</p>
        {Object.entries(def.fields).map(([key, desc]) => (
          <FieldInput key={key} name={key} desc={desc} value={values[key]} onChange={setField(key)} issues={issues} />
        ))}

        <div className="adm-actions">
          {/* Editors can only draft or submit; the Mukhiya can publish. The server enforces the same rules. */}
          {isSuper ? (
            <>
              <button type="button" className="btn btn--primary" disabled={busy} onClick={() => save('published')}>
                {status === 'published' ? a('form.saveChanges') : status === 'pending' ? a('form.approve') : a('form.publish')}
              </button>
              {status !== 'published' && (
                <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => save(status === 'pending' ? 'pending' : 'draft')}>
                  {status === 'pending' ? a('form.saveChanges') : a('form.saveDraft')}
                </button>
              )}
              {status === 'published' && (
                <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => save('draft')}>
                  {a('form.unpublish')}
                </button>
              )}
              {status === 'pending' && (
                <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => setRejecting((r) => !r)} aria-expanded={rejecting}>
                  {a('form.reject')}
                </button>
              )}
            </>
          ) : status === 'pending' ? (
            <button type="button" className="btn btn--primary" disabled={busy} onClick={() => save()}>
              {a('form.saveChanges')}
            </button>
          ) : (
            <>
              <button type="button" className="btn btn--primary" disabled={busy} onClick={() => save('pending')}>
                {status === 'published' ? a('form.submitChanges') : a('form.submit')}
              </button>
              {status !== 'published' && (
                <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => save('draft')}>
                  {a('form.saveDraft')}
                </button>
              )}
            </>
          )}
          {busy && <span className="small muted">{a('common.saving')}</span>}
        </div>

        {rejecting && (
          <div className="adm-reject">
            <label className="field__label" htmlFor="reject-reason">
              {a('form.rejectAsk')}
            </label>
            <textarea ref={reasonRef} id="reject-reason" className="input" rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
            {issues.reason && <p className="field__error">{err(issues.reason)}</p>}
            <div>
              <button type="button" className="btn btn--danger btn--small" disabled={busy || reason.trim().length < 3} onClick={() => setStatus('rejected', reason.trim())}>
                {a('form.rejectConfirm')}
              </button>
            </div>
          </div>
        )}

        {canDelete && (
          <div className="adm-danger">
            {confirmDelete ? (
              <>
                <p>{a('form.deleteAsk')}</p>
                <button type="button" className="btn btn--danger btn--small" disabled={busy} onClick={remove}>
                  {a('form.deleteYes')}
                </button>{' '}
                <button type="button" className="btn btn--ghost btn--small" onClick={() => setConfirmDelete(false)}>
                  {a('common.cancel')}
                </button>
              </>
            ) : (
              <button type="button" className="linklike linklike--danger" onClick={() => setConfirmDelete(true)}>
                {a('form.delete')}
              </button>
            )}
          </div>
        )}

        {!isNew && (
          <dl className="adm-trail small muted">
            {doc.createdBy?.name && (
              <div>
                <dt>{a('trail.created')}</dt>
                <dd>
                  {doc.createdBy.name}, {dt(doc.createdAt)}
                </dd>
              </div>
            )}
            {doc.updatedBy?.name && (
              <div>
                <dt>{a('trail.updated')}</dt>
                <dd>
                  {doc.updatedBy.name}, {dt(doc.updatedAt)}
                </dd>
              </div>
            )}
            {doc.publishedBy?.name && (
              <div>
                <dt>{a('trail.published')}</dt>
                <dd>
                  {doc.publishedBy.name}, {dt(doc.publishedAt)}
                </dd>
              </div>
            )}
          </dl>
        )}
      </form>
    </div>
  );
}

export default function ResourceForm() {
  const { resource, id } = useParams();
  const meta = useMeta();
  const def = meta.resources[resource];
  const res = useFetch(def && id ? `/admin/resources/${resource}/${id}` : null);
  if (!def) return <p className="adm-page alert alert--error">404</p>;
  if (!id) return <Editor key="new" resource={resource} def={def} doc={null} onSaved={() => {}} />;
  return (
    <Async res={res}>
      {(doc) => <Editor key={`${doc._id}${doc.updatedAt}`} resource={resource} def={def} doc={doc} onSaved={res.reload} />}
    </Async>
  );
}
