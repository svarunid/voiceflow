import { Outlet, NavLink } from 'react-router-dom';
import { UsersIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline';

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-3xl font-bold text-gray-900">
              Voice Flow Testing Platform
            </h1>
          </div>
        </div>
      </header>

      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <NavLink
              to="/personas"
              className={({ isActive }) =>
                `flex items-center px-1 py-4 text-sm font-medium border-b-2 ${
                  isActive
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`
              }
            >
              <UsersIcon className="h-5 w-5 mr-2" />
              Personas
            </NavLink>
            <NavLink
              to="/tests"
              className={({ isActive }) =>
                `flex items-center px-1 py-4 text-sm font-medium border-b-2 ${
                  isActive
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`
              }
            >
              <ClipboardDocumentListIcon className="h-5 w-5 mr-2" />
              Tests
            </NavLink>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
