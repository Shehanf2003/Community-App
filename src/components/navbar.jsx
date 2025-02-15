import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import Notifications from './notifications';

const Navbar = () => {
  const { currentUser, userRole } = useAuth();
  const location = useLocation();
  const [username, setUsername] = useState('');

  useEffect(() => {
    const fetchUsername = async () => {
      if (currentUser?.uid) {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            setUsername(userDoc.data().username);
          }
        } catch (error) {
          console.error('Error fetching username:', error);
          setUsername('User');
        }
      }
    };

    fetchUsername();
  }, [currentUser]);

  const isActiveRoute = (route) => {
    return location.pathname === route ? 'bg-blue-700' : '';
  };

  const basePath = userRole === 'admin' ? '/admin' : '/user';
  const maintenancePath = `${basePath}/maintenance`;

  return (
    <nav className="bg-blue-600 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <span className="text-white text-xl font-bold">CommUnity</span>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-4">
              <Link
                to={basePath}
                className={`${isActiveRoute(basePath)} text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700`}
              >
                Announcement
              </Link>
              <Link
                to={maintenancePath}
                className={`${isActiveRoute(maintenancePath)} text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700`}
              >
                Maintenance Requests
              </Link>
            </div>
          </div>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="flex items-center space-x-3">
              <Notifications />
                <span className="text-white text-sm">
                  Welcome, {username || 'User'}
                </span>
               
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className="sm:hidden">
        <div className="px-2 pt-2 pb-3">
          <Link
            to={basePath}
            className={`${isActiveRoute(basePath)} text-white block px-3 py-2 rounded-md text-base font-medium hover:bg-blue-700`}
          >
            Announcement
          </Link>
          <Link
            to={maintenancePath}
            className={`${isActiveRoute(maintenancePath)} text-white block px-3 py-2 rounded-md text-base font-medium hover:bg-blue-700`}
          >
            Maintenance Requests
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;