import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Layout from '@/components/Layout';
import Landing from '@/pages/Landing';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import VerifyEmail from '@/pages/VerifyEmail';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import RedeemInvite from '@/pages/RedeemInvite';
import MyActivity from '@/pages/MyActivity';
import AccountSettings from '@/pages/AccountSettings';
import AskQuestion from '@/pages/AskQuestion';
import CheckAnswer from '@/pages/CheckAnswer';
import GuideLibrary from '@/pages/GuideLibrary';
import GuideDetail from '@/pages/GuideDetail';
import SavedGuides from '@/pages/SavedGuides';
import MyMatters from '@/pages/MyMatters';
import NewMatter from '@/pages/NewMatter';
import MatterDetail from '@/pages/MatterDetail';
import Directory from '@/pages/Directory';
import BookProvider from '@/pages/BookProvider';
import CheckBooking from '@/pages/CheckBooking';
import WhereToGo from '@/pages/WhereToGo';
import MatterRoute from '@/pages/MatterRoute';
import Emergency from '@/pages/Emergency';
import NotFound from '@/pages/NotFound';

// The router does not reset the scroll position when the page changes. Without this a person
// who opens the SOS link from the middle of a long page would land below the crisis numbers.
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <Layout>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/redeem-invite" element={<RedeemInvite />} />
        <Route path="/my-activity" element={<MyActivity />} />
        <Route path="/settings" element={<AccountSettings />} />
        <Route path="/ask" element={<AskQuestion />} />
        <Route path="/ask/check" element={<CheckAnswer />} />
        <Route path="/guides" element={<GuideLibrary />} />
        <Route path="/guides/:id" element={<GuideDetail />} />
        <Route path="/saved" element={<SavedGuides />} />
        <Route path="/matters" element={<MyMatters />} />
        <Route path="/matters/new" element={<NewMatter />} />
        <Route path="/matters/:id" element={<MatterDetail />} />
        <Route path="/directory" element={<Directory />} />
        <Route path="/directory/book/:id" element={<BookProvider />} />
        <Route path="/directory/booking-check" element={<CheckBooking />} />
        <Route path="/where-to-go" element={<WhereToGo />} />
        <Route path="/where-to-go/:id" element={<MatterRoute />} />
        <Route path="/emergency" element={<Emergency />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}
