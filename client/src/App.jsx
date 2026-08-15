import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import Layout from './components/Layout.jsx';
import { LoadingState } from './components/ui.jsx';
import Home from './pages/Home.jsx';

// Story pages load eagerly enough to feel instant; the admin panel is a
// separate concern entirely and should never be in a guest's bundle.
const Stay = lazy(() => import('./pages/Stay.jsx'));
const Experiences = lazy(() => import('./pages/Experiences.jsx'));
const TheLand = lazy(() => import('./pages/TheLand.jsx'));
const Gallery = lazy(() => import('./pages/Gallery.jsx'));
const LocalGuide = lazy(() => import('./pages/LocalGuide.jsx'));
const Animals = lazy(() => import('./pages/Animals.jsx'));
const AnimalProfile = lazy(() => import('./pages/AnimalProfile.jsx'));
const GardenOfErin = lazy(() => import('./pages/GardenOfErin.jsx'));
const Book = lazy(() => import('./pages/Book.jsx'));
const BookingConfirmed = lazy(() => import('./pages/BookingConfirmed.jsx'));
const ManageBooking = lazy(() => import('./pages/ManageBooking.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));

const AdminApp = lazy(() => import('./admin/AdminApp.jsx'));

export default function App() {
  return (
    <Suspense fallback={<LoadingState />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="stay" element={<Stay />} />
          <Route path="experiences" element={<Experiences />} />
          <Route path="the-land" element={<TheLand />} />
          <Route path="gallery" element={<Gallery />} />
          <Route path="local-guide" element={<LocalGuide />} />
          <Route path="animals" element={<Animals />} />
          <Route path="animals/:slug" element={<AnimalProfile />} />
          <Route path="garden-of-erin" element={<GardenOfErin />} />

          <Route path="book" element={<Book />} />
          <Route path="booking/confirmed" element={<BookingConfirmed />} />
          <Route path="booking/manage/:token" element={<ManageBooking />} />

          {/* Kind redirects for addresses people guess at. */}
          <Route path="the-garden-of-erin" element={<Navigate to="/garden-of-erin" replace />} />
          <Route path="meet-the-animals" element={<Navigate to="/animals" replace />} />

          <Route path="*" element={<NotFound />} />
        </Route>

        <Route path="/admin/*" element={<AdminApp />} />
      </Routes>
    </Suspense>
  );
}
