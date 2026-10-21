import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../../components/Icon';
import Tabs from '../../components/Tabs';
import { PageHead } from '../../components/Misc';
import { useTitle } from '../../utils/useTitle';
import { CALCULATORS, calculatorById } from './parts/calculators/registry';
import NotFoundBlock from './parts/NotFoundBlock';

function Index() {
  return (
    <section className="section">
      <div className="container">
        <ul className="pub-svc-grid pub-svc-grid--4">
          {CALCULATORS.map((c) => (
            <li key={c.id}>
              <Link to={`/calculators/${c.id}`} className="pub-svc">
                <span className="pub-svc__icon">
                  <Icon name={c.icon} size={26} strokeWidth={1.3} />
                </span>
                <h2 className="pub-svc__title">{c.title}</h2>
                <p className="small muted">{c.short}</p>
                <span className="pub-svc__more">
                  Open <span aria-hidden="true">→</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default function Calculators() {
  const { kind } = useParams();
  const navigate = useNavigate();
  const calc = kind ? calculatorById(kind) : null;
  useTitle(calc ? calc.title : 'Calculators');

  if (kind && !calc) {
    return <NotFoundBlock title="Calculator not found" message="That calculator doesn’t exist. Choose one of our eight planning calculators." backTo="/calculators" backLabel="All calculators" />;
  }

  const C = calc?.Component;
  return (
    <>
      <PageHead eyebrow="Planning tools" title={calc ? calc.title : 'Financial calculators'} lead={calc ? calc.short : 'Simple, transparent tools to help you think through SIPs, goals, tax saving and retirement. All calculations run in your browser.'} />
      {calc ? (
        <section className="section pub-tight-top">
          <div className="container">
            <Tabs tabs={CALCULATORS.map((c) => ({ id: c.id, label: c.label }))} value={calc.id} onChange={(id) => navigate(`/calculators/${id}`)} label="Choose a calculator" />
            <div role="tabpanel" aria-label={calc.title}>
              <C key={calc.id} sync headingLevel={2} />
            </div>
          </div>
        </section>
      ) : (
        <Index />
      )}
    </>
  );
}
