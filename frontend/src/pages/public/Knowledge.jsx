import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Tabs from '../../components/Tabs';
import { Field, Input } from '../../components/Field';
import { Accordion, PageHead } from '../../components/Misc';
import { Async, EmptyState } from '../../components/States';
import { Skeleton, SkeletonBlock } from '../../components/Skeleton';
import { publicApi } from '../../api/endpoints';
import { useApi } from '../../api/useApi';
import { useTitle } from '../../utils/useTitle';
import ArticleCard from './parts/ArticleCard';
import RichText from './parts/RichText';

const TABS = [
  { id: 'articles', label: 'Articles' },
  { id: 'faqs', label: 'FAQs' },
  { id: 'glossary', label: 'Glossary' },
];

function Articles({ category, setCategory }) {
  // Full list once (to derive categories), filtered list per category from the API.
  const all = useApi(() => publicApi.articles(), []);
  const filtered = useApi(() => (category ? publicApi.articles(category) : Promise.resolve(null)), [category]);
  const categories = useMemo(() => [...new Set((all.data || []).map((a) => a.category).filter(Boolean))].sort(), [all.data]);
  const state = category ? filtered : all;

  return (
    <div className="stack-lg">
      {categories.length > 1 && (
        <div className="pub-chips" role="group" aria-label="Filter articles by category">
          <button type="button" className="pub-filter-chip" aria-pressed={!category} onClick={() => setCategory('')}>
            All
          </button>
          {categories.map((c) => (
            <button key={c} type="button" className="pub-filter-chip" aria-pressed={category === c} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>
      )}
      <Async
        state={state}
        empty={(d) => !d.length}
        emptyView={<EmptyState title="No articles yet" icon="book">New articles will appear here soon.</EmptyState>}
        skeleton={
          <div className="grid grid-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} height={200} style={{ borderRadius: 8 }} />
            ))}
          </div>
        }
      >
        {(list) => (
          <div className="grid grid-3">
            {list.map((a) => (
              <ArticleCard key={a.id} a={a} headingLevel={2} />
            ))}
          </div>
        )}
      </Async>
    </div>
  );
}

function Faqs() {
  const q = useApi(() => publicApi.faqs(), []);
  return (
    <Async state={q} empty={(d) => !d.length} emptyView={<EmptyState title="No FAQs yet" icon="help" />} skeleton={<SkeletonBlock rows={8} height={40} />}>
      {(faqs) => {
        const groups = {};
        faqs.forEach((f) => {
          const k = f.category || 'General';
          (groups[k] = groups[k] || []).push(f);
        });
        return (
          <div className="stack-lg pub-narrow" style={{ marginLeft: 0 }}>
            {Object.entries(groups).map(([cat, items]) => (
              <section key={cat} aria-label={cat}>
                <h2 className="pub-group-title">{cat}</h2>
                <Accordion items={items.map((f) => ({ id: f.id, title: f.question, content: <RichText body={f.answer} /> }))} />
              </section>
            ))}
          </div>
        );
      }}
    </Async>
  );
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function Glossary() {
  const q = useApi(() => publicApi.glossary(), []);
  const [term, setTerm] = useState('');
  const [letter, setLetter] = useState('');
  return (
    <Async state={q} empty={(d) => !d.length} emptyView={<EmptyState title="Glossary coming soon" icon="book" />} skeleton={<SkeletonBlock rows={8} />}>
      {(items) => {
        const sorted = [...items].sort((a, b) => a.term.localeCompare(b.term));
        const available = new Set(sorted.map((g) => g.term.charAt(0).toUpperCase()));
        const t = term.trim().toLowerCase();
        const shown = sorted.filter((g) => (!letter || g.term.charAt(0).toUpperCase() === letter) && (!t || g.term.toLowerCase().includes(t) || g.definition.toLowerCase().includes(t)));
        return (
          <div className="stack-lg">
            <div className="pub-gloss-tools">
              <Field label="Search the glossary">
                <Input type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="e.g. NAV, exit load" />
              </Field>
              <div className="pub-letters" role="group" aria-label="Filter by first letter">
                <button type="button" className="pub-letter" aria-pressed={!letter} onClick={() => setLetter('')}>
                  All
                </button>
                {LETTERS.map((l) => (
                  <button key={l} type="button" className="pub-letter" aria-pressed={letter === l} disabled={!available.has(l)} onClick={() => setLetter(l)} aria-label={`Terms starting with ${l}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <p className="small muted" aria-live="polite" style={{ margin: 0 }}>
              {shown.length} term{shown.length === 1 ? '' : 's'}
            </p>
            {shown.length ? (
              <dl className="pub-gloss">
                {shown.map((g) => (
                  <div key={g.term} className="pub-gloss__item">
                    <dt>{g.term}</dt>
                    <dd>{g.definition}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <EmptyState title="No matching terms" icon="search" />
            )}
          </div>
        );
      }}
    </Async>
  );
}

export default function Knowledge() {
  const [sp, setSp] = useSearchParams();
  const tab = TABS.some((t) => t.id === sp.get('tab')) ? sp.get('tab') : 'articles';
  const category = sp.get('category') || '';
  useTitle(tab === 'faqs' ? 'FAQs' : tab === 'glossary' ? 'Glossary' : 'Knowledge centre');

  const setTab = (id) => setSp(id === 'articles' ? {} : { tab: id }, { replace: true });
  const setCategory = (c) => setSp(c ? { category: c } : {}, { replace: true });

  return (
    <>
      <PageHead eyebrow="Knowledge centre" title="Learn before you invest" lead="Plain-language articles, answers to common questions, and a glossary of mutual fund terms." />
      <section className="section pub-tight-top">
        <div className="container">
          <Tabs tabs={TABS} value={tab} onChange={setTab} label="Knowledge centre sections" />
          <div role="tabpanel" aria-label={TABS.find((t) => t.id === tab).label}>
            {tab === 'articles' && <Articles category={category} setCategory={setCategory} />}
            {tab === 'faqs' && <Faqs />}
            {tab === 'glossary' && <Glossary />}
          </div>
        </div>
      </section>
    </>
  );
}
