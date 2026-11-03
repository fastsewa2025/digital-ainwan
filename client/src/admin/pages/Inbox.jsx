import { useState } from 'react';
import { api, useFetch } from '../../lib/api.js';
import { Async, Meta, Pager } from '../../components/ui.jsx';
import { Chips, useListParams } from '../../components/filters.jsx';
import { useA } from '../useA.js';

const waNumber = (phone) => {
  const digits = phone.replace(/\D/g, '');
  if (phone.startsWith('+')) return digits;
  return digits.length === 10 ? `91${digits}` : digits;
};

function Message({ m, onChange }) {
  const { a, dt } = useA();
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);
  const mark = async (status) => {
    setBusy(true);
    try {
      await api.patch(`/admin/messages/${m._id}`, { status });
      onChange();
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await api.del(`/admin/messages/${m._id}`);
      onChange();
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className={`msg msg--${m.status}`}>
      <div className="msg__head">
        <p className="msg__who">
          <strong>{m.name || a('inbox.anonymous')}</strong>
          {m.place && <span className="muted">{m.place}</span>}
        </p>
        <Meta items={[m.helpType ? `${a(`inbox.type.${m.type}`)}: ${a(`inbox.help.${m.helpType}`)}` : a(`inbox.type.${m.type}`), dt(m.createdAt)]} />
      </div>
      <p className="msg__body">{m.message}</p>
      {(m.phone || m.email) && (
        <p className="small msg__contact" translate="no">
          {m.phone && (
            <>
              <a href={`tel:${m.phone}`}>{m.phone}</a> <a href={`https://wa.me/${waNumber(m.phone)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>{' '}
            </>
          )}
          {m.email && <a href={`mailto:${m.email}`}>{m.email}</a>}
        </p>
      )}
      <div className="adm-actions">
        {m.status !== 'read' && (
          <button type="button" className="btn btn--ghost btn--small" disabled={busy} onClick={() => mark('read')}>
            {a('inbox.markRead')}
          </button>
        )}
        {m.status !== 'archived' && (
          <button type="button" className="btn btn--ghost btn--small" disabled={busy} onClick={() => mark('archived')}>
            {a('inbox.archive')}
          </button>
        )}
        {m.status !== 'new' && (
          <button type="button" className="btn btn--ghost btn--small" disabled={busy} onClick={() => mark('new')}>
            {a('inbox.markNew')}
          </button>
        )}
        {sure ? (
          <>
            <button type="button" className="btn btn--danger btn--small" disabled={busy} onClick={remove}>
              {a('form.deleteYes')}
            </button>
            <button type="button" className="btn btn--ghost btn--small" onClick={() => setSure(false)}>
              {a('common.cancel')}
            </button>
          </>
        ) : (
          <button type="button" className="linklike linklike--danger" onClick={() => setSure(true)}>
            {a('form.delete')}
          </button>
        )}
      </div>
    </li>
  );
}

export default function Inbox() {
  const { a } = useA();
  const p = useListParams();
  const status = p.get('status') || 'all';
  const res = useFetch('/admin/messages', { status, page: p.page });
  const STATUS = ['new', 'read', 'archived'];

  return (
    <div className="adm-page">
      <h1 className="adm-title">{a('nav.inbox')}</h1>
      <p className="small muted">{a('inbox.privacy')}</p>
      <Chips
        label={a('list.status')}
        value={status === 'all' ? '' : status}
        onChange={(s) => p.set({ status: s })}
        options={STATUS.map((s) => ({ value: s, label: a(`inbox.status.${s}`) }))}
      />
      <Async res={res} empty={(d) => d.items.length === 0} emptyText={a('inbox.empty')}>
        {(d) => (
          <>
            <ul className="msgs">
              {d.items.map((m) => (
                <Message key={m._id} m={m} onChange={res.reload} />
              ))}
            </ul>
            <Pager page={d.page} pages={d.pages} onPage={(page) => p.set({ page })} />
          </>
        )}
      </Async>
    </div>
  );
}
