import { Suspense, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Layout from '@/components/Layout';
import Landing from '@/pages/Landing';
import RequireRole from '@/components/RequireRole';
import AppointmentsRedirect from '@/components/AppointmentsRedirect';
import WhereToGoRedirect from '@/components/WhereToGoRedirect';
import PageLoading from '@/components/PageLoading';
import { lazyPage } from '@/lib/lazyPage';

// The shell (Layout and the menus and the guard and the redirects) and the front page load with the app.
// Every other page downloads when it is first opened.
// So a visitor never downloads the staff pages and a student never downloads a page they do not open.
// The shell stays on screen while a page loads so the Emergency numbers link is always there.
// The old page stays up too with a thin bar under the top bar (Layout).
// lazyPage reloads once if a file has gone because a new version went live.
const Login = lazyPage(() => import('@/pages/Login'));
const Register = lazyPage(() => import('@/pages/Register'));
const VerifyEmail = lazyPage(() => import('@/pages/VerifyEmail'));
const ConfirmEmailChange = lazyPage(() => import('@/pages/ConfirmEmailChange'));
const ForgotPassword = lazyPage(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazyPage(() => import('@/pages/ResetPassword'));
const RedeemInvite = lazyPage(() => import('@/pages/RedeemInvite'));
const MyActivity = lazyPage(() => import('@/pages/MyActivity'));
const AccountSettings = lazyPage(() => import('@/pages/AccountSettings'));
const AskQuestion = lazyPage(() => import('@/pages/AskQuestion'));
const AskAI = lazyPage(() => import('@/pages/AskAI'));
const CheckAnswer = lazyPage(() => import('@/pages/CheckAnswer'));
const CheckRequest = lazyPage(() => import('@/pages/CheckRequest'));
const GuideLibrary = lazyPage(() => import('@/pages/GuideLibrary'));
const GuideDetail = lazyPage(() => import('@/pages/GuideDetail'));
const SavedGuides = lazyPage(() => import('@/pages/SavedGuides'));
const Home = lazyPage(() => import('@/pages/Home'));
const MyMatters = lazyPage(() => import('@/pages/MyMatters'));
const NewMatter = lazyPage(() => import('@/pages/NewMatter'));
const MatterDetail = lazyPage(() => import('@/pages/MatterDetail'));
const Calendar = lazyPage(() => import('@/pages/Calendar'));
const Appointments = lazyPage(() => import('@/pages/Appointments'));
const Directory = lazyPage(() => import('@/pages/Directory'));
const ProviderDetail = lazyPage(() => import('@/pages/ProviderDetail'));
const BookProvider = lazyPage(() => import('@/pages/BookProvider'));
const CheckBooking = lazyPage(() => import('@/pages/CheckBooking'));
const Emergency = lazyPage(() => import('@/pages/Emergency'));
const Search = lazyPage(() => import('@/pages/Search'));
const ReportProblem = lazyPage(() => import('@/pages/ReportProblem'));
const ReportSent = lazyPage(() => import('@/pages/ReportSent'));
const ReportCheck = lazyPage(() => import('@/pages/ReportCheck'));
const NotFound = lazyPage(() => import('@/pages/NotFound'));
const AdminDashboard = lazyPage(() => import('@/pages/AdminDashboard'));
const AdminGuides = lazyPage(() => import('@/pages/AdminGuides'));
const AdminGuideEditor = lazyPage(() => import('@/pages/AdminGuideEditor'));
const AdminChecklists = lazyPage(() => import('@/pages/AdminChecklists'));
const AdminChecklistEditor = lazyPage(() => import('@/pages/AdminChecklistEditor'));
const AdminRouteEditor = lazyPage(() => import('@/pages/AdminRouteEditor'));
const AdminProviders = lazyPage(() => import('@/pages/AdminProviders'));
const AdminProviderEditor = lazyPage(() => import('@/pages/AdminProviderEditor'));
const AdminContactEditor = lazyPage(() => import('@/pages/AdminContactEditor'));
const AdminLadderEditor = lazyPage(() => import('@/pages/AdminLadderEditor'));
const AdminRoutes = lazyPage(() => import('@/pages/AdminRoutes'));
const AdminUsers = lazyPage(() => import('@/pages/AdminUsers'));
const AdminInvites = lazyPage(() => import('@/pages/AdminInvites'));
const AdminContacts = lazyPage(() => import('@/pages/AdminContacts'));
const AdminReports = lazyPage(() => import('@/pages/AdminReports'));
const JoinCall = lazyPage(() => import('@/pages/JoinCall'));
const ExpertOverview = lazyPage(() => import('@/pages/ExpertOverview'));
const ExpertQuestions = lazyPage(() => import('@/pages/ExpertQuestions'));
const ExpertCalendar = lazyPage(() => import('@/pages/ExpertCalendar'));
const AdminCalendar = lazyPage(() => import('@/pages/AdminCalendar'));
const ExpertMatters = lazyPage(() => import('@/pages/ExpertMatters'));

// The router does not reset the scroll position when the page changes. Without this a person
// who opens the emergency numbers link from the middle of a long page would land below the crisis numbers.
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

// The staff workspaces. Each page sits inside the guard for its role.
const Expert = ({ children }) => <RequireRole roles={['legal_expert']}>{children}</RequireRole>;
const Admin = ({ children }) => <RequireRole roles={['admin']}>{children}</RequireRole>;

export default function App() {
  return (
    <Layout>
      <ScrollToTop />
      <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/confirm-email-change" element={<ConfirmEmailChange />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/redeem-invite" element={<RedeemInvite />} />
        <Route path="/admin" element={<Admin><AdminDashboard /></Admin>} />
        <Route path="/admin/calendar" element={<Admin><AdminCalendar /></Admin>} />
        <Route path="/admin/appointments" element={<AppointmentsRedirect to="/admin/calendar" />} />
        <Route path="/admin/guides" element={<Admin><AdminGuides /></Admin>} />
        <Route path="/admin/guides/new" element={<Admin><AdminGuideEditor /></Admin>} />
        <Route path="/admin/guides/:id" element={<Admin><AdminGuideEditor /></Admin>} />
        <Route path="/admin/checklists" element={<Admin><AdminChecklists /></Admin>} />
        <Route path="/admin/checklists/new" element={<Admin><AdminChecklistEditor /></Admin>} />
        <Route path="/admin/checklists/:id" element={<Admin><AdminChecklistEditor /></Admin>} />
        <Route path="/admin/providers" element={<Admin><AdminProviders /></Admin>} />
        <Route path="/admin/providers/new" element={<Admin><AdminProviderEditor /></Admin>} />
        <Route path="/admin/providers/:id" element={<Admin><AdminProviderEditor /></Admin>} />
        <Route path="/admin/routes" element={<Admin><AdminRoutes /></Admin>} />
        <Route path="/admin/routes/new" element={<Admin><AdminRouteEditor /></Admin>} />
        <Route path="/admin/routes/:id" element={<Admin><AdminRouteEditor /></Admin>} />
        <Route path="/admin/ladder/new" element={<Admin><AdminLadderEditor /></Admin>} />
        <Route path="/admin/ladder/:id" element={<Admin><AdminLadderEditor /></Admin>} />
        <Route path="/admin/users" element={<Admin><AdminUsers /></Admin>} />
        <Route path="/admin/invites" element={<Admin><AdminInvites /></Admin>} />
        <Route path="/admin/contacts" element={<Admin><AdminContacts /></Admin>} />
        <Route path="/admin/contacts/new" element={<Admin><AdminContactEditor /></Admin>} />
        <Route path="/admin/contacts/:id" element={<Admin><AdminContactEditor /></Admin>} />
        <Route path="/admin/reports" element={<Admin><AdminReports /></Admin>} />
        <Route path="/expert" element={<Expert><ExpertOverview /></Expert>} />
        <Route path="/expert/questions" element={<Expert><ExpertQuestions /></Expert>} />
        <Route path="/expert/calendar" element={<Expert><ExpertCalendar /></Expert>} />
        <Route path="/expert/appointments" element={<AppointmentsRedirect to="/expert/calendar" />} />
        <Route path="/expert/bookings" element={<AppointmentsRedirect to="/expert/calendar" />} />
        <Route path="/expert/matters" element={<Expert><ExpertMatters /></Expert>} />
        <Route path="/my-activity" element={<MyActivity />} />
        <Route path="/call/:id" element={<JoinCall />} />
        <Route path="/settings" element={<AccountSettings />} />
        <Route path="/ask" element={<AskQuestion />} />
        <Route path="/ask-ai" element={<AskAI />} />
        <Route path="/ask/check" element={<CheckAnswer />} />
        <Route path="/check-request" element={<CheckRequest />} />
        <Route path="/guides" element={<GuideLibrary />} />
        <Route path="/guides/:id" element={<GuideDetail />} />
        <Route path="/saved" element={<SavedGuides />} />
        <Route path="/home" element={<Home />} />
        <Route path="/matters" element={<MyMatters />} />
        <Route path="/matters/new" element={<NewMatter />} />
        <Route path="/matters/:id" element={<MatterDetail />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/appointments" element={<Appointments />} />
        <Route path="/directory" element={<Directory />} />
        <Route path="/directory/book/:id" element={<BookProvider />} />
        <Route path="/directory/booking-check" element={<CheckBooking />} />
        <Route path="/directory/:id" element={<ProviderDetail />} />
        <Route path="/where-to-go" element={<WhereToGoRedirect />} />
        <Route path="/where-to-go/:id" element={<WhereToGoRedirect withRoute />} />
        <Route path="/search" element={<Search />} />
        <Route path="/report" element={<ReportProblem />} />
        <Route path="/report/sent" element={<ReportSent />} />
        <Route path="/report/check" element={<ReportCheck />} />
        <Route path="/emergency" element={<Emergency />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </Layout>
  );
}
