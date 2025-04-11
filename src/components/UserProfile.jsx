import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { User, Mail, Home, Key } from 'lucide-react';

const UserProfile = () => {
  const { currentUser } = useAuth();
  const [userData, setUserData] = useState({
    username: '',
    fullName: '',
    email: '',
    address: '',
    registeredAt: ''
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      setIsLoading(true);
      try {
        if (!currentUser?.uid) {
          setIsLoading(false);
          return;
        }
        
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          
          // Format registration date if available
          let formattedDate = '';
          if (data.registeredAt) {
            if (data.registeredAt.toDate) {
              // If it's a Firestore timestamp
              formattedDate = data.registeredAt.toDate().toLocaleDateString();
            } else if (typeof data.registeredAt === 'string') {
              // If it's a string date
              formattedDate = data.registeredAt;
            }
          }
          
          setUserData({
            username: data.username || '',
            fullName: data.fullName || '',
            email: data.email || currentUser.email || '',
            address: data.address || '',
            registeredAt: formattedDate || 'Not available'
          });
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [currentUser]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white/70 to-white/90 backdrop-blur-sm py-6 px-4 sm:px-6 lg:px-8">
      <div className="min-h-screen bg-gray-50 flex justify-center items-center min-h-screen bg-fixed bg-cover bg-center" style={{ backgroundImage: "url('/CU3.jpg')" }}>
      <div className="flex items-center space-x-4 bg-white p-6 rounded-lg shadow-md">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        <p className="text-gray-700 font-medium">Loading user profile...</p>
      </div>
      </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-fixed bg-cover bg-center" style={{ backgroundImage: "url('/CU3.jpg')" }}>
      <div className="min-h-screen bg-gradient-to-b from-white/70 to-white/90 backdrop-blur-sm py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-xl overflow-hidden border border-gray-100">
            {/* Blue header based on the screenshot */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6">
              <div>
                <h1 className="text-xl font-bold text-white">My Profile</h1>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left column */}
                <div className="space-y-6">
                  <div className="flex items-start space-x-4">
                    <div className="bg-blue-100 p-2 rounded-full">
                      <User className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-gray-500">Full Name</h3>
                      <p className="text-lg font-medium text-gray-900">{userData.fullName || 'Not provided'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-4">
                    <div className="bg-blue-100 p-2 rounded-full">
                      <User className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-gray-500">Username</h3>
                      <p className="text-lg font-medium text-gray-900">{userData.username || 'Not provided'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-4">
                    <div className="bg-blue-100 p-2 rounded-full">
                      <Mail className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-gray-500">Email Address</h3>
                      <p className="text-lg font-medium text-gray-900">{userData.email || 'Not provided'}</p>
                    </div>
                  </div>
                </div>
                
                {/* Right column */}
                <div className="space-y-6">
                  <div className="flex items-start space-x-4">
                    <div className="bg-blue-100 p-2 rounded-full">
                      <Home className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-gray-500">Apartment Address</h3>
                      <p className="text-lg font-medium text-gray-900">{userData.address || 'Not provided'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-4">
                    <div className="bg-blue-100 p-2 rounded-full">
                      <svg className="h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-gray-500">Registered Since</h3>
                      <p className="text-lg font-medium text-gray-900">{userData.registeredAt}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-8 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                <Link 
                  to="/user/change-password" 
                  className="inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Key className="mr-2 h-4 w-4" />
                  Change Password
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;