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
  const resourcesPath = `${basePath}/resources`;

  return (
    <nav className="bg-blue-600">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-16">
          
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center space-x-2">
              <img 
                src="/cu1.png" 
                alt="CU Logo" 
                className="h-8 w-8"
              />
              
            </div>
          </div>

          
          <div className="hidden md:flex items-center justify-center flex-1 ml-8">
            <div className="flex space-x-4">
              <Link
                to={basePath}
                className={`${isActiveRoute(basePath)} text-white px-3 py-2 text-sm font-medium hover:bg-blue-700 rounded-md`}
              >
                Announcement
              </Link>
              <Link
                to={`${basePath}/maintenance`}
                className={`${isActiveRoute(`${basePath}/maintenance`)} text-white px-3 py-2 text-sm font-medium hover:bg-blue-700 rounded-md`}
              >
                Maintenance Requests
              </Link>
              <Link
                to={`${basePath}/resources`}
                className={`${isActiveRoute(`${basePath}/resources`)} text-white px-3 py-2 text-sm font-medium hover:bg-blue-700 rounded-md`}
              >
                Resource Booking
              </Link>
              <Link
                to={`${basePath}/forum`}
                className={`${isActiveRoute(`${basePath}/forum`)} text-white px-3 py-2 text-sm font-medium hover:bg-blue-700 rounded-md`}
              >
                Community Forum
              </Link>
              <Link
                  to={`${basePath}/community`}
                  className={`${isActiveRoute(`${basePath}/community`)} text-white px-3 py-2 text-sm font-medium hover:bg-blue-700 rounded-md`}
              >
                  Community Directory
              </Link>
            </div>
          </div>

          
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Notifications />
            </div>
            <div className="flex items-center">
              <span className="text-white text-sm">
                Welcome, {username || 'User'}
              </span>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1">
            <Link
              to={basePath}
              className={`${isActiveRoute(basePath)} text-white block px-3 py-2 rounded-md text-base font-medium hover:bg-blue-700`}
            >
              Announcement
            </Link>
            <Link
              to={`${basePath}/maintenance`}
              className={`${isActiveRoute(`${basePath}/maintenance`)} text-white block px-3 py-2 rounded-md text-base font-medium hover:bg-blue-700`}
            >
              Maintenance Requests
            </Link>
            <Link
              to={`${basePath}/resources`}
              className={`${isActiveRoute(`${basePath}/resources`)} text-white block px-3 py-2 rounded-md text-base font-medium hover:bg-blue-700`}
            >
              Resource Booking
            </Link>
            <Link
              to={`${basePath}/forum`}
              className={`${isActiveRoute(`${basePath}/forum`)} text-white block px-3 py-2 rounded-md text-base font-medium hover:bg-blue-700`}
            >
              Community Forum
            </Link>
            <Link
              to={`${basePath}/community`}
              className={`${isActiveRoute(`${basePath}/community`)} text-white block px-3 py-2 rounded-md text-base font-medium hover:bg-blue-700`}
          >
              Community Directory
          </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;