import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { AdminAuthProvider, useAdminAuth } from './AdminAuth.jsx';
import AdminLayout from './AdminLayout.jsx';
import Login from './Login.jsx';
import { LoadingState } from '../components/ui.jsx';

const Dashboard = lazy(() => import('./Dashboard.jsx'));
const BookingsList = lazy(() => import('./BookingsList.jsx'));
const BookingDetail = lazy(() => import('./BookingDetail.jsx'));
const CalendarBlocks = lazy(() => import('./CalendarBlocks.jsx'));
const PropertiesIndex = lazy(() => import('./PropertiesIndex.jsx'));
const PropertySettings = lazy(() => import('./PropertySettings.jsx'));
const DiscountsEditor = lazy(() => import('./DiscountsEditor.jsx'));
const ContentEditor = lazy(() => import('./ContentEditor.jsx'));
const AnimalsEditor = lazy(() => import('./AnimalsEditor.jsx'));
const MediaManager = lazy(() => import('./MediaManager.jsx'));

/**
 * Gate for every admin screen. The server is the real authority — this only
 * decides what to render while the session probe is in flight, and sends
 * unauthenticated visitors to the login form with their destination preserved.
 */
function RequireAdmin({ children }) {
  const { admin, checking } = useAdminAuth();
  const location = useLocation();

  if (checking) return <LoadingState label="Checking your session" />;
  if (!admin) return <Navigate to="/admin/login" replace state={{ from: location }} />;
  return children;
}

export default function AdminApp() {
  return (
    <AdminAuthProvider>
      <Suspense fallback={<LoadingState />}>
        <Routes>
          <Route path="login" element={<Login />} />

          <Route
            element={
              <RequireAdmin>
                <AdminLayout />
              </RequireAdmin>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="bookings" element={<BookingsList />} />
            <Route path="bookings/:id" element={<BookingDetail />} />
            <Route path="calendar" element={<CalendarBlocks />} />
            <Route path="properties" element={<PropertiesIndex />} />
            <Route path="properties/:id" element={<PropertySettings />} />
            <Route path="discounts" element={<DiscountsEditor />} />
            <Route path="content" element={<ContentEditor />} />
            <Route path="content/:slug" element={<ContentEditor />} />
            <Route path="animals" element={<AnimalsEditor />} />
            <Route path="media" element={<MediaManager />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </AdminAuthProvider>
  );
}
