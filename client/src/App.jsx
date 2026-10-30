import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Layout from '@/components/Layout';
import Landing from '@/pages/Landing';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import VerifyEmail from '@/pages/VerifyEmail';
import ConfirmEmailChange from '@/pages/ConfirmEmailChange';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import RedeemInvite from '@/pages/RedeemInvite';
import RequireRole from '@/components/RequireRole';
import MyActivity from '@/pages/MyActivity';
import AccountSettings from '@/pages/AccountSettings';
import AskQuestion from '@/pages/AskQuestion';
import CheckAnswer from '@/pages/CheckAnswer';
import CheckRequest from '@/pages/CheckRequest';
import GuideLibrary from '@/pages/GuideLibrary';
import GuideDetail from '@/pages/GuideDetail';
import SavedGuides from '@/pages/SavedGuides';
import MyMatters from '@/pages/MyMatters';
import NewMatter from '@/pages/NewMatter';
import MatterDetail from '@/pages/MatterDetail';
import Directory from '@/pages/Directory';
import ProviderDetail from '@/pages/ProviderDetail';
import BookProvider from '@/pages/BookProvider';
import CheckBooking from '@/pages/CheckBooking';
import WhereToGo from '@/pages/WhereToGo';
import MatterRoute from '@/pages/MatterRoute';
import Emergency from '@/pages/Emergency';
import Search from '@/pages/Search';
import NotFound from '@/pages/NotFound';

// Staff pages are loaded when first opened. A student or a visitor never downloads them.
const AdminDashboard = lazy(() => import('@/pages/AdminDashboard'));
const AdminGuides = lazy(() => import('@/pages/AdminGuides'));
const AdminGuideEditor = lazy(() => import('@/pages/AdminGuideEditor'));
const AdminChecklists = lazy(() => import('@/pages/AdminChecklists'));
const AdminChecklistEditor = lazy(() => import('@/pages/AdminChecklistEditor'));
const AdminProviders = lazy(() => import('@/pages/AdminProviders'));
const AdminRoutes = lazy(() => import('@/pages/AdminRoutes'));
const AdminUsers = lazy(() => import('@/pages/AdminUsers'));
const AdminInvites = lazy(() => import('@/pages/AdminInvites'));
const AdminContacts = lazy(() => import('@/pages/AdminContacts'));
const ExpertQuestions = lazy(() => import('@/pages/ExpertQuestions'));
const ExpertBookings = lazy(() => import('@/pages/ExpertBookings'));
const ExpertMatters = lazy(() => import('@/pages/ExpertMatters'));

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
      <Suspense fallback={<p role="status" className="text-muted-foreground">Loading the page…</p>}>
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
        <Route path="/admin/guides" element={<Admin><AdminGuides /></Admin>} />
        <Route path="/admin/guides/new" element={<Admin><AdminGuideEditor /></Admin>} />
        <Route path="/admin/guides/:id" element={<Admin><AdminGuideEditor /></Admin>} />
        <Route path="/admin/checklists" element={<Admin><AdminChecklists /></Admin>} />
        <Route path="/admin/checklists/new" element={<Admin><AdminChecklistEditor /></Admin>} />
        <Route path="/admin/checklists/:id" element={<Admin><AdminChecklistEditor /></Admin>} />
        <Route path="/admin/providers" element={<Admin><AdminProviders /></Admin>} />
        <Route path="/admin/routes" element={<Admin><AdminRoutes /></Admin>} />
        <Route path="/admin/users" element={<Admin><AdminUsers /></Admin>} />
        <Route path="/admin/invites" element={<Admin><AdminInvites /></Admin>} />
        <Route path="/admin/contacts" element={<Admin><AdminContacts /></Admin>} />
        <Route path="/expert/questions" element={<Expert><ExpertQuestions /></Expert>} />
        <Route path="/expert/bookings" element={<Expert><ExpertBookings /></Expert>} />
        <Route path="/expert/matters" element={<Expert><ExpertMatters /></Expert>} />
        <Route path="/my-activity" element={<MyActivity />} />
        <Route path="/settings" element={<AccountSettings />} />
        <Route path="/ask" element={<AskQuestion />} />
        <Route path="/ask/check" element={<CheckAnswer />} />
        <Route path="/check-request" element={<CheckRequest />} />
        <Route path="/guides" element={<GuideLibrary />} />
        <Route path="/guides/:id" element={<GuideDetail />} />
        <Route path="/saved" element={<SavedGuides />} />
        <Route path="/matters" element={<MyMatters />} />
        <Route path="/matters/new" element={<NewMatter />} />
        <Route path="/matters/:id" element={<MatterDetail />} />
        <Route path="/directory" element={<Directory />} />
        <Route path="/directory/book/:id" element={<BookProvider />} />
        <Route path="/directory/booking-check" element={<CheckBooking />} />
        <Route path="/directory/:id" element={<ProviderDetail />} />
        <Route path="/where-to-go" element={<WhereToGo />} />
        <Route path="/where-to-go/:id" element={<MatterRoute />} />
        <Route path="/search" element={<Search />} />
        <Route path="/emergency" element={<Emergency />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </Layout>
  );
}
