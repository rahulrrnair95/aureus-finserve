/**
 * Responsive table: real <table> on ≥768px, card list on mobile.
 * columns: [{ key, header, render?(row), num?: bool, mobile?: false (hide on card), primary?: bool (card title) }]
 * <DataTable columns rows rowKey="id" onRowClick={(row)=>...} caption="..." highlight={(row)=>bool} footer={<tr>..</tr>} />
 */
export default function DataTable({ columns, rows, rowKey = 'id', onRowClick, caption, highlight, footer, rowLabel }) {
  const keyOf = (r, i) => (typeof rowKey === 'function' ? rowKey(r, i) : r[rowKey] ?? i);
  const cell = (c, r) => (c.render ? c.render(r) : r[c.key] ?? '—');
  const primary = columns.find((c) => c.primary) || columns[0];
  const clickProps = (r) =>
    onRowClick
      ? {
          className: `${highlight?.(r) ? 'is-highlight ' : ''}is-clickable`,
          tabIndex: 0,
          onClick: () => onRowClick(r),
          onKeyDown: (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onRowClick(r);
            }
          },
          'aria-label': rowLabel ? rowLabel(r) : undefined,
        }
      : { className: highlight?.(r) ? 'is-highlight' : undefined };

  return (
    <div className="rtable rtable--responsive">
      <div className="table-wrap">
        <table className="table">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={c.num ? 'is-num' : undefined}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={keyOf(r, i)} {...clickProps(r)}>
                {columns.map((c) => (
                  <td key={c.key} className={c.num ? 'is-num' : undefined}>
                    {cell(c, r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer && <tfoot>{footer}</tfoot>}
        </table>
      </div>
      <ul className="rtable-cards" aria-label={caption}>
        {rows.map((r, i) => {
          const p = clickProps(r);
          return (
            <li key={keyOf(r, i)} className={`rcard ${p.className || ''}`} tabIndex={p.tabIndex} onClick={p.onClick} onKeyDown={p.onKeyDown} aria-label={p['aria-label']}>
              <div className="rcard__title">{cell(primary, r)}</div>
              <dl>
                {columns
                  .filter((c) => c !== primary && c.mobile !== false)
                  .map((c) => (
                    <div key={c.key} style={{ display: 'contents' }}>
                      <dt>{c.header}</dt>
                      <dd className={c.num ? 'num' : undefined}>{cell(c, r)}</dd>
                    </div>
                  ))}
              </dl>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
