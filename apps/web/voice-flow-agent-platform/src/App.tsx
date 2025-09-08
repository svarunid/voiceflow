import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import ContactsTab from './pages/ContactsTab';
import CallsTab from './pages/CallsTab';
import ContactDetail from './pages/ContactDetail';
import AttemptDetail from './pages/AttemptDetail';
import TabNavigation from './components/TabNavigation';

function App() {
  const location = useLocation();
  const isDetailPage = location.pathname.includes('/contact/') || location.pathname.includes('/attempt/');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                Voice Flow - Debt Collection Portal
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!isDetailPage && <TabNavigation />}

        <Routes>
          <Route path="/" element={<Navigate to="/contacts" replace />} />
          <Route path="/contacts" element={<ContactsTab />} />
          <Route path="/calls" element={<CallsTab />} />
          <Route path="/contact/:contactId" element={<ContactDetail />} />
          <Route path="/attempt/:attemptId" element={<AttemptDetail />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
