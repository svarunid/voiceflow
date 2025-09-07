import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const TabNavigation: React.FC = () => {
  const location = useLocation();

  const tabs = [
    { path: '/contacts', label: 'Contacts' },
    { path: '/calls', label: 'Calls' },
  ];

  return (
    <nav className="mb-6">
      <div className="border-b border-gray-200">
        <div className="flex space-x-8">
          {tabs.map((tab) => {
            const isActive = location.pathname === tab.path;
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  isActive
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default TabNavigation;
