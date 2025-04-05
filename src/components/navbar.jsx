import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import Notifications from './notifications';
import { Menu, X, ChevronDown, User as UserIcon, LogOut, Home, Wrench, Calendar, MessageSquare } from 'lucide-react';

const Navbar = () => {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const profileDropdownRef = useRef(null);

  useEffect(() => {
    const fetchUsername = async () => {
      setIsLoading(true);
      if (currentUser?.uid) {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            setUsername(userDoc.data().username);
          }
        } catch (error) {
          console.error('Error fetching username:', error);
          setUsername('User');
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    };

    fetchUsername();
  }, [currentUser]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setIsProfileDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Close mobile menu when navigating
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  };

  const isActiveRoute = (route) => {
    return location.pathname === route;
  };

  // Navigation items configuration - removed Community Directory
  const navItems = [
    { path: '/user', label: 'Announcements', icon: <Home size={18} /> },
    { path: '/user/maintenance', label: 'Maintenance Requests', icon: <Wrench size={18} /> },
    { path: '/user/resources', label: 'Resource Booking', icon: <Calendar size={18} /> },
    { path: '/user/forum', label: 'Community Forum', icon: <MessageSquare size={18} /> }
  ];

  return (
    <nav className="bg-blue-600 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and brand */}
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <img 
                src="/cu1.png" 
                alt="Community Logo" 
                className="h-8 w-auto"
              />
              <span className="ml-2 text-white font-medium hidden sm:block">Community Portal</span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 
                  ${isActiveRoute(item.path)
                    ? 'bg-blue-700 text-white shadow-inner'
                    : 'text-blue-100 hover:bg-blue-500 hover:text-white'
                  }`}
                aria-current={isActiveRoute(item.path) ? 'page' : undefined}
              >
                <span className="mr-1.5">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>

          {/* User Menu and Notifications */}
          <div className="flex items-center space-x-2">
            <Notifications />
            
            <div className="relative" ref={profileDropdownRef}>
              <button
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className="flex items-center space-x-2 text-sm rounded-full text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-blue-600 focus:ring-white p-1 hover:bg-blue-500 transition-colors duration-150"
                id="user-menu-button"
                aria-expanded={isProfileDropdownOpen}
                aria-haspopup="true"
              >
                <span className="sr-only">Open user menu</span>
                <div className="bg-blue-700 rounded-full p-1.5">
                  <UserIcon className="h-5 w-5 text-white" aria-hidden="true" />
                </div>
                <div className="hidden md:flex items-center">
                  <span className="text-white text-sm">
                    {isLoading ? 'Loading...' : username || 'User'}
                  </span>
                  <ChevronDown className="ml-1 h-4 w-4 text-white" />
                </div>
              </button>

              {/* Profile dropdown - removed "Your Profile" option */}
              {isProfileDropdownOpen && (
                <div
                  className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
                  role="menu"
                  aria-orientation="vertical"
                  aria-labelledby="user-menu-button"
                  tabIndex="-1"
                >
                  <div className="px-4 py-2 text-sm text-gray-700 border-b">
                    Signed in as <span className="font-semibold">{username || 'User'}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                    role="menuitem"
                    tabIndex="-1"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="flex items-center md:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-blue-600 focus:ring-white"
                aria-expanded={isMobileMenuOpen}
              >
                <span className="sr-only">{isMobileMenuOpen ? 'Close main menu' : 'Open main menu'}</span>
                {isMobileMenuOpen ? (
                  <X className="block h-6 w-6" aria-hidden="true" />
                ) : (
                  <Menu className="block h-6 w-6" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className={`md:hidden transition-all duration-200 ease-in-out ${isMobileMenuOpen ? 'max-h-screen' : 'max-h-0 overflow-hidden'}`}>
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-blue-700">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center px-3 py-2 rounded-md text-base font-medium ${
                isActiveRoute(item.path)
                  ? 'bg-blue-800 text-white'
                  : 'text-blue-100 hover:bg-blue-600 hover:text-white'
              }`}
              aria-current={isActiveRoute(item.path) ? 'page' : undefined}
            >
              <span className="mr-2">{item.icon}</span>
              {item.label}
            </Link>
          ))}
          <div className="border-t border-blue-800 pt-2 mt-2">
            <div className="px-3 py-2 text-blue-100 text-sm">
              Signed in as <span className="font-medium">{username || 'User'}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex w-full items-center px-3 py-2 rounded-md text-base font-medium text-blue-100 hover:bg-blue-600 hover:text-white"
            >
              <LogOut className="mr-2 h-5 w-5" />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
