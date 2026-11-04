import { useState } from 'react';
import { api, useFetch } from '../../lib/api.js';
import { DEFAULT_SETTINGS } from '../../lib/settings.jsx';
import { Async } from '../../components/ui.jsx';
import { useA } from '../useA.js';
import { useMeta } from '../meta.jsx';
import { FieldInput } from '../inputs/FieldInput.jsx';
import { formFromDoc, issueMap, toPayload } from '../formModel.js';

function SettingsForm({ saved }) {
  const { a, err } = useA();
  const { settingsFields } = useMeta();
  const [values, setValues] = useState(() => formFromDoc(settingsFields, { ...DEFAULT_SETTINGS, ...saved }));
  const [issues, setIssues] = useState({});
  const [state, setState] = useState({ busy: false, problem: null, done: false });

  const save = async () => {
    setState({ busy: true, problem: null, done: false });
    setIssues({});
    try {
      await api.put('/admin/settings', toPayload(settingsFields, values));
      setState({ busy: false, problem: null, done: true });
    } catch (error) {
      setIssues(issueMap(error));
      setState({ busy: false, problem: error.message, done: false });
    }
  };

  return (
    <form className="adm-form" onSubmit={(e) => e.preventDefault()} noValidate>
      <p className="alert alert--warn">{a('settings.warn')}</p>
      <p className="small muted">{a('form.legend')}</p>
      {Object.entries(settingsFields).map(([key, desc]) => (
        <FieldInput key={key} name={key} desc={desc} value={values[key]} onChange={(v) => setValues((o) => ({ ...o, [key]: v }))} issues={issues} />
      ))}
      {state.problem && (
        <p className="alert alert--error" role="alert">
          {err(state.problem)}
        </p>
      )}
      {state.done && (
        <p className="alert" role="status">
          {a('settings.saved')}
        </p>
      )}
      <div className="adm-actions">
        <button type="button" className="btn btn--primary" disabled={state.busy} onClick={save}>
          {state.busy ? a('common.saving') : a('settings.save')}
        </button>
      </div>
    </form>
  );
}

export default function SettingsPage() {
  const { a } = useA();
  const res = useFetch('/admin/settings');
  return (
    <div className="adm-page">
      <h1 className="adm-title">{a('nav.settings')}</h1>
      <Async res={res}>{(doc) => <SettingsForm saved={doc} />}</Async>
    </div>
  );
}
