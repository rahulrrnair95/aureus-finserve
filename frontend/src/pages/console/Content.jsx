import { useSearchParams } from 'react-router-dom';
import { useTitle } from '../../utils/useTitle';
import Tabs from '../../components/Tabs';
import { PageTitle } from './parts/ui';
import Articles from './parts/content/Articles';
import Faqs from './parts/content/Faqs';
import Banners from './parts/content/Banners';
import Pages from './parts/content/Pages';
import HomeContent from './parts/content/HomeContent';
import AboutContent from './parts/content/AboutContent';
import ServicesContent from './parts/content/ServicesContent';
import Amcs from './parts/content/Amcs';
import Testimonials from './parts/content/Testimonials';
import Team from './parts/content/Team';
import SiteSettings from './parts/content/SiteSettings';

const TABS = [
  { id: 'articles', label: 'Articles', C: Articles },
  { id: 'faqs', label: 'FAQs', C: Faqs },
  { id: 'banners', label: 'Banners', C: Banners },
  { id: 'pages', label: 'Pages', C: Pages },
  { id: 'home', label: 'Home', C: HomeContent },
  { id: 'about', label: 'About', C: AboutContent },
  { id: 'services', label: 'Services', C: ServicesContent },
  { id: 'amcs', label: 'AMC partners', C: Amcs },
  { id: 'testimonials', label: 'Testimonials', C: Testimonials },
  { id: 'team', label: 'Team', C: Team },
  { id: 'site', label: 'Site settings', C: SiteSettings },
];

export default function Content() {
  useTitle('Content');
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'articles';
  const Current = TABS.find((t) => t.id === tab).C;

  return (
    <div className="stack-lg">
      <PageTitle eyebrow="Administration" title="Website content" />
      <Tabs label="Content sections" tabs={TABS.map(({ id, label }) => ({ id, label }))} value={tab} onChange={(id) => setParams({ tab: id }, { replace: true })} />
      <div role="tabpanel" aria-label={TABS.find((t) => t.id === tab).label} className="con-tabpanel">
        <Current key={tab} />
      </div>
    </div>
  );
}
