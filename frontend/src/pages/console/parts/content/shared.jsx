// Generic building blocks for the Content (CMS) tabs.
import { useEffect, useState } from 'react';
import { useApi } from '../../../../api/useApi';
import { friendlyError } from '../../../../api/client';
import Button from '../../../../components/Button';
import Modal from '../../../../components/Modal';
import ConfirmDialog from '../../../../components/ConfirmDialog';
import DataTable from '../../../../components/DataTable';
import { Alert, Async, EmptyState } from '../../../../components/States';
import { SkeletonBlock } from '../../../../components/Skeleton';
import { useToast } from '../../../../components/Toast';
import Icon from '../../../../components/Icon';
import { fieldErrors } from '../common';
import { RowButton } from '../ui';

/**
 * List + create/edit modal + delete confirm.
 * props:
 *  title, noun ('article'), intro, load(), create?(body), update(row, body), remove?(row),
 *  columns, rowKey, blank (form defaults), toForm(row), toBody(form), validate?(form) → {field: msg},
 *  renderForm({ form, set, setForm, errors, row, replaceRow }), wide, sortRows?(rows)
 */
export function CrudSection({ title, noun, intro, load, create, update, remove, columns, rowKey = 'id', blank, toForm, toBody, validate, renderForm, wide = false, sortRows }) {
  const toast = useToast();
  const list = useApi(load, []);
  const [open, setOpen] = useState(false);
  const [row, setRow] = useState(null);
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState(null);

  const keyOf = (r) => (typeof rowKey === 'function' ? rowKey(r) : r[rowKey]);
  const replaceRow = (saved) => {
    list.setData((rows) => (rows || []).map((r) => (keyOf(r) === keyOf(saved) ? { ...r, ...saved } : r)));
    setRow((cur) => (cur && keyOf(cur) === keyOf(saved) ? { ...cur, ...saved } : cur));
  };

  const openFor = (r) => {
    setRow(r);
    setForm(r ? toForm(r) : blank);
    setErrors({});
    setError(null);
    setOpen(true);
  };

  const set = (k) => (e) => {
    const t = e?.target;
    const v = t ? (t.type === 'checkbox' ? t.checked : t.value) : e;
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const save = async (e) => {
    e.preventDefault();
    const v = validate ? validate(form, row) : {};
    setErrors(v);
    if (Object.keys(v).length) return;
    setSaving(true);
    setError(null);
    try {
      const body = toBody(form, row);
      if (row) {
        const saved = await update(row, body);
        replaceRow(saved || { ...row, ...body });
      } else {
        const saved = await create(body);
        list.setData((rows) => [...(rows || []), saved]);
      }
      toast.success(`${capital(noun)} saved.`);
      setOpen(false);
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    setDeleteErr(null);
    try {
      await remove(toDelete);
      list.setData((rows) => (rows || []).filter((r) => keyOf(r) !== keyOf(toDelete)));
      toast.success(`${capital(noun)} deleted.`);
      setToDelete(null);
    } catch (err) {
      setDeleteErr(friendlyError(err));
    } finally {
      setDeleting(false);
    }
  };

  const cols = [
    ...columns,
    {
      key: '__actions',
      header: <span className="sr-only">Actions</span>,
      render: (r) => (
        <div className="row con-row-actions">
          <RowButton variant="outline" onClick={() => openFor(r)} aria-label={`Edit ${noun} ${labelOf(r, columns)}`}>
            <Icon name="edit" size={16} /> Edit
          </RowButton>
          {remove && (
            <RowButton variant="ghost" onClick={() => setToDelete(r)} aria-label={`Delete ${noun} ${labelOf(r, columns)}`}>
              <Icon name="trash" size={16} /> Delete
            </RowButton>
          )}
        </div>
      ),
    },
  ];

  const formId = `con-crud-${noun.replace(/\W+/g, '-')}`;

  return (
    <section className="stack" aria-label={title}>
      <div className="row row--between">
        <div>
          <h2 className="con-h2">{title}</h2>
          {intro && <p className="small muted con-intro">{intro}</p>}
        </div>
        {create && (
          <Button onClick={() => openFor(null)}>
            <Icon name="plus" size={18} /> New {noun}
          </Button>
        )}
      </div>

      <Async state={list} skeleton={<SkeletonBlock rows={5} height={26} />} empty={(d) => !d?.length} emptyView={<EmptyState title={`No ${noun}s yet`} icon="book" />}>
        {(rows) => <DataTable caption={title} columns={cols} rows={sortRows ? sortRows(rows) : rows} rowKey={(r, i) => keyOf(r) ?? i} />}
      </Async>

      <Modal
        open={open}
        wide={wide}
        onClose={() => !saving && setOpen(false)}
        title={row ? `Edit ${noun}` : `New ${noun}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form={formId} loading={saving}>
              Save
            </Button>
          </>
        }
      >
        <form id={formId} className="stack" onSubmit={save} noValidate>
          {error && <Alert type="error">{error}</Alert>}
          {open && renderForm({ form, set, setForm, errors, row, replaceRow })}
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title={`Delete this ${noun}?`}
        confirmLabel="Delete"
        danger
        loading={deleting}
        error={deleteErr}
        onConfirm={doDelete}
        onClose={() => {
          setToDelete(null);
          setDeleteErr(null);
        }}
      >
        <p>
          “{toDelete ? labelOf(toDelete, columns) : ''}” will be removed from the website. This cannot be undone.
        </p>
      </ConfirmDialog>
    </section>
  );
}

function labelOf(r, columns) {
  const p = columns.find((c) => c.primary) || columns[0];
  const v = r[p.key];
  return typeof v === 'string' ? v : String(v ?? '');
}

const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Repeatable rows editor inside a fieldset.
 * <RepeatList legend="Values" items={arr} onChange={setArr} newItem={() => ({title:'',text:''})} render={(item, update, i) => ...} fixed />
 */
export function RepeatList({ legend, hint, items, onChange, newItem, render, addLabel = 'Add row', fixed = false, min = 0, max = 50, itemLabel = 'row', reorder = false }) {
  const list = items || [];
  const update = (i) => (patch) => onChange(list.map((x, j) => (j === i ? (typeof patch === 'function' ? patch(x) : { ...x, ...patch }) : x)));
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <fieldset className="con-fieldset">
      <legend className="field__label">{legend}</legend>
      {hint && <p className="tiny muted">{hint}</p>}
      <ol className="con-repeat">
        {list.map((item, i) => (
          <li key={i} className="con-repeat__item">
            <div className="con-repeat__body">{render(item, update(i), i)}</div>
            <div className="row con-row-actions">
              {reorder && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${itemLabel} ${i + 1} up`}>
                    ↑ Up
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label={`Move ${itemLabel} ${i + 1} down`}>
                    ↓ Down
                  </Button>
                </>
              )}
              {!fixed && list.length > min && (
                <Button variant="ghost" size="sm" onClick={() => onChange(list.filter((_, j) => j !== i))} aria-label={`Remove ${itemLabel} ${i + 1}`}>
                  <Icon name="trash" size={16} /> Remove
                </Button>
              )}
            </div>
          </li>
        ))}
      </ol>
      {!fixed && list.length < max && (
        <Button variant="outline" size="sm" onClick={() => onChange([...list, newItem()])}>
          <Icon name="plus" size={16} /> {addLabel}
        </Button>
      )}
    </fieldset>
  );
}

/**
 * Single-document editor (GET → form → PUT).
 * props: title, intro, load(), save(body), toForm(data), toBody(form), render({form, setForm, set, errors})
 */
export function DocEditor({ title, intro, load, save, toForm, toBody, render, validate }) {
  const toast = useToast();
  const q = useApi(load, []);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (q.data !== undefined && form === null) setForm(toForm(q.data || {}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data]);

  const setF = (u) => {
    setDirty(true);
    setForm(u);
  };
  const set = (k) => (e) => {
    const t = e?.target;
    const v = t ? (t.type === 'checkbox' ? t.checked : t.value) : e;
    setF((f) => ({ ...f, [k]: v }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const v = validate ? validate(form) : {};
    setErrors(v);
    if (Object.keys(v).length) {
      setError('Please fix the highlighted fields.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await save(toBody(form));
      if (saved && typeof saved === 'object') setForm(toForm(saved));
      setDirty(false);
      toast.success(`${title} saved.`);
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="stack" aria-label={title}>
      <div>
        <h2 className="con-h2">{title}</h2>
        {intro && <p className="small muted con-intro">{intro}</p>}
      </div>
      {q.error && !form ? (
        <Async state={q}>{() => null}</Async>
      ) : !form ? (
        <SkeletonBlock rows={6} height={30} />
      ) : (
        <form className="card stack-lg" onSubmit={submit} noValidate>
          {error && <Alert type="error">{error}</Alert>}
          {render({ form, setForm: setF, set, errors })}
          <div className="row row--end con-sticky-save">
            {dirty && <span className="tiny muted">Unsaved changes</span>}
            <Button type="submit" loading={saving}>
              Save {title.toLowerCase()}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

/** Validate an http(s) URL or empty. */
export const isUrlOrEmpty = (v) => !v || /^https?:\/\/\S+$/i.test(v) || /^\/\S*$/.test(v);
