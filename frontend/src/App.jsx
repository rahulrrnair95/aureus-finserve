import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { SiteProvider } from './auth/SiteContext';
import RequireRole from './auth/RequireRole';
import { ToastProvider } from './components/Toast';
import { PageLoader } from './components/Skeleton';
import PublicLayout from './layouts/PublicLayout';
import { STATIC_SITE } from './utils/siteMode';

// Public
const Home = lazy(() => import('./pages/public/Home'));
const About = lazy(() => import('./pages/public/About'));
const Services = lazy(() => import('./pages/public/Services'));
const ServiceDetail = lazy(() => import('./pages/public/ServiceDetail'));
const AmcPartners = lazy(() => import('./pages/public/AmcPartners'));
const FundExplorer = lazy(() => import('./pages/public/FundExplorer'));
const SchemeDetail = lazy(() => import('./pages/public/SchemeDetail'));
const Nfos = lazy(() => import('./pages/public/Nfos'));
const NfoDetail = lazy(() => import('./pages/public/NfoDetail'));
const Calculators = lazy(() => import('./pages/public/Calculators'));
const Knowledge = lazy(() => import('./pages/public/Knowledge'));
const Article = lazy(() => import('./pages/public/Article'));
const Contact = lazy(() => import('./pages/public/Contact'));
// Grievance redressal page removed from the site for now (file kept: pages/public/Grievance.jsx)
// const Grievance = lazy(() => import('./pages/public/Grievance'));
const LegalPage = lazy(() => import('./pages/public/LegalPage'));
const NotFound = lazy(() => import('./pages/public/NotFound'));

// Dynamic parts (backend + database): not registered in the static build (src/utils/siteMode.js). The `STATIC_SITE ? null :`
// guards are constant-folded at build time, so these chunks are not emitted into dist-static at all.
const Kyc = STATIC_SITE ? null : lazy(() => import('./pages/public/Kyc'));
const KycStatus = STATIC_SITE ? null : lazy(() => import('./pages/public/KycStatus'));

// Auth
const Login = STATIC_SITE ? null : lazy(() => import('./pages/auth/Login'));
const ForgotPassword = STATIC_SITE ? null : lazy(() => import('./pages/auth/ForgotPassword'));
const Activate = STATIC_SITE ? null : lazy(() => import('./pages/auth/Activate'));

// Investor
const InvestorLayout = STATIC_SITE ? null : lazy(() => import('./layouts/InvestorLayout'));
const Overview = STATIC_SITE ? null : lazy(() => import('./pages/investor/Overview'));
const Holdings = STATIC_SITE ? null : lazy(() => import('./pages/investor/Holdings'));
const Sips = STATIC_SITE ? null : lazy(() => import('./pages/investor/Sips'));
const Transact = STATIC_SITE ? null : lazy(() => import('./pages/investor/Transact'));
const Orders = STATIC_SITE ? null : lazy(() => import('./pages/investor/Orders'));
const Reports = STATIC_SITE ? null : lazy(() => import('./pages/investor/Reports'));
const Goals = STATIC_SITE ? null : lazy(() => import('./pages/investor/Goals'));
const Profile = STATIC_SITE ? null : lazy(() => import('./pages/investor/Profile'));
const ServiceRequests = STATIC_SITE ? null : lazy(() => import('./pages/investor/ServiceRequests'));
const Notifications = STATIC_SITE ? null : lazy(() => import('./pages/investor/Notifications'));
const ContactRm = STATIC_SITE ? null : lazy(() => import('./pages/investor/ContactRm'));
const InvestorSettings = STATIC_SITE ? null : lazy(() => import('./pages/investor/Settings'));

// Console
const ConsoleLayout = STATIC_SITE ? null : lazy(() => import('./layouts/ConsoleLayout'));
const Dashboard = STATIC_SITE ? null : lazy(() => import('./pages/console/Dashboard'));
const Clients = STATIC_SITE ? null : lazy(() => import('./pages/console/Clients'));
const ClientDetail = STATIC_SITE ? null : lazy(() => import('./pages/console/ClientDetail'));
const Leads = STATIC_SITE ? null : lazy(() => import('./pages/console/Leads'));
const KycRequests = STATIC_SITE ? null : lazy(() => import('./pages/console/Kyc'));
const OrderDesk = STATIC_SITE ? null : lazy(() => import('./pages/console/OrderDesk'));
const Tickets = STATIC_SITE ? null : lazy(() => import('./pages/console/Tickets'));
const Brokerage = STATIC_SITE ? null : lazy(() => import('./pages/console/Brokerage'));
const Content = STATIC_SITE ? null : lazy(() => import('./pages/console/Content'));
const Users = STATIC_SITE ? null : lazy(() => import('./pages/console/Users'));
const Audit = STATIC_SITE ? null : lazy(() => import('./pages/console/Audit'));
const DataSync = STATIC_SITE ? null : lazy(() => import('./pages/console/DataSync'));
const NfoAdmin = STATIC_SITE ? null : lazy(() => import('./pages/console/Nfos'));
const ConsoleSettings = STATIC_SITE ? null : lazy(() => import('./pages/console/Settings'));

const admin = (el) => <RequireRole roles={['ADMIN']}>{el}</RequireRole>;

export default function App() {
  return (
    <ToastProvider>
      <SiteProvider>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route element={<PublicLayout />}>
                <Route index element={<Home />} />
                <Route path="about" element={<About />} />
                <Route path="services" element={<Services />} />
                <Route path="services/:slug" element={<ServiceDetail />} />
                <Route path="amc-partners" element={<AmcPartners />} />
                <Route path="funds" element={<FundExplorer />} />
                <Route path="funds/:id" element={<SchemeDetail />} />
                <Route path="nfo" element={<Nfos />} />
                <Route path="nfo/:id" element={<NfoDetail />} />
                <Route path="calculators" element={<Calculators />} />
                <Route path="calculators/:kind" element={<Calculators />} />
                <Route path="learn" element={<Knowledge />} />
                <Route path="learn/articles/:slug" element={<Article />} />
                <Route path="contact" element={<Contact />} />
                {/* <Route path="grievance" element={<Grievance />} /> */}
                {!STATIC_SITE && <Route path="kyc" element={<Kyc />} />}
                {!STATIC_SITE && <Route path="kyc/status" element={<KycStatus />} />}
                <Route path="legal/:key" element={<LegalPage />} />
                <Route path="*" element={<NotFound />} />
              </Route>

              {!STATIC_SITE && (
              <>
              <Route path="login" element={<Login />} />
              <Route path="forgot-password" element={<ForgotPassword />} />
              <Route path="activate/:token" element={<Activate />} />

              <Route
                path="app"
                element={
                  <RequireRole roles={['INVESTOR']}>
                    <InvestorLayout />
                  </RequireRole>
                }
              >
                <Route index element={<Overview />} />
                <Route path="holdings" element={<Holdings />} />
                <Route path="sips" element={<Sips />} />
                <Route path="transact" element={<Transact />} />
                <Route path="orders" element={<Orders />} />
                <Route path="reports" element={<Reports />} />
                <Route path="goals" element={<Goals />} />
                <Route path="profile" element={<Profile />} />
                <Route path="service" element={<ServiceRequests />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="rm" element={<ContactRm />} />
                <Route path="settings" element={<InvestorSettings />} />
              </Route>

              <Route
                path="console"
                element={
                  <RequireRole roles={['RM', 'ADMIN']}>
                    <ConsoleLayout />
                  </RequireRole>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="clients" element={<Clients />} />
                <Route path="clients/:id" element={<ClientDetail />} />
                <Route path="leads" element={<Leads />} />
                <Route path="kyc" element={<KycRequests />} />
                <Route path="orders" element={<OrderDesk />} />
                <Route path="tickets" element={<Tickets />} />
                <Route path="brokerage" element={admin(<Brokerage />)} />
                <Route path="content" element={admin(<Content />)} />
                <Route path="users" element={admin(<Users />)} />
                <Route path="audit" element={admin(<Audit />)} />
                <Route path="sync" element={admin(<DataSync />)} />
                <Route path="nfos" element={<NfoAdmin />} />
                <Route path="settings" element={<ConsoleSettings />} />
              </Route>
              </>
              )}
            </Routes>
          </Suspense>
        </AuthProvider>
      </SiteProvider>
    </ToastProvider>
  );
}
