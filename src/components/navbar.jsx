import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import MaintenanceRequest from './components/MaintenanceRequest.jsx';


const Navbar = () => {
  const { currentUser } = useAuth();
  const location = useLocation();

  const isActiveRoute = (route) => {
    return location.pathname === route ? 'bg-blue-700' : '';
  };

  return (
    <nav className="bg-blue-600 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <span className="text-white text-xl font-bold">Dashboard</span>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-4">
              <Link
                to="/dashboard"
                className={`${isActiveRoute('/dashboard')} text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700`}
              >
                Announcements
              </Link>
              <Link
                to="/maintenance"
                className={`${isActiveRoute('/maintenance')} text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700`}
              >
                Maintenance Requests
              </Link>
            </div>
          </div>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="flex items-center space-x-3">
                <span className="text-white text-sm">
                  Welcome, {currentUser?.displayName || 'User'}
                </span>
                <img
                  className="h-8 w-8 rounded-full bg-blue-300"
                  src={currentUser?.photoURL || '/api/placeholder/32/32'}
                  alt="User avatar"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className="sm:hidden">
        <div className="px-2 pt-2 pb-3 space-y-1">
          <Link
            to="/dashboard"
            className={`${isActiveRoute('/dashboard')} text-white block px-3 py-2 rounded-md text-base font-medium hover:bg-blue-700`}
          >
            Announcements
          </Link>
          <Link
            to="/maintenance"
            className={`${isActiveRoute('/maintenance')} text-white block px-3 py-2 rounded-md text-base font-medium hover:bg-blue-700`}
          >
            Maintenance Requests
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;