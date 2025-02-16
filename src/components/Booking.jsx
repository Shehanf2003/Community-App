import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import Navbar from './navbar';

const ResourceBooking = () => {
  const { currentUser } = useAuth();
  const [resources, setResources] = useState([]);
  const [selectedResource, setSelectedResource] = useState(null);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [userBookings, setUserBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResources();
    fetchUserBookings();
    const cleanup = setupBookingCleanup();
    return () => cleanup();
  }, [currentUser]);

  const fetchResources = async () => {
    try {
      const resourcesRef = collection(db, 'resources');
      const snapshot = await getDocs(resourcesRef);
      const resourcesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setResources(resourcesList);
    } catch (error) {
      console.error('Error fetching resources:', error);
    }
  };

  const fetchUserBookings = async () => {
    try {
      const bookingsRef = collection(db, 'bookings');
      const q = query(bookingsRef, where('userId', '==', currentUser.uid));
      const snapshot = await getDocs(q);
      const bookingsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUserBookings(bookingsList);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching user bookings:', error);
      setLoading(false);
    }
  };

  const setupBookingCleanup = () => {
    const interval = setInterval(async () => {
      const now = new Date();
      const bookingsRef = collection(db, 'bookings');
      const snapshot = await getDocs(bookingsRef);
      
      snapshot.docs.forEach(async (bookingDoc) => {
        const booking = bookingDoc.data();
        const bookingEndTime = booking.endTime.toDate();
        
        if (bookingEndTime < now) {
          await deleteDoc(doc(db, 'bookings', bookingDoc.id));
        }
      });
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  };

  const handleBooking = async () => {
    if (!selectedResource || !bookingDate || !bookingTime) {
      alert('Please select all required fields');
      return;
    }

    const bookingDateTime = new Date(`${bookingDate}T${bookingTime}`);
    const endTime = new Date(bookingDateTime);
    endTime.setHours(endTime.getHours() + 2); // Default booking duration: 2 hours

    if (bookingDateTime < new Date()) {
      alert('Cannot book for past date/time');
      return;
    }

    try {
      // Check for conflicting bookings
      const bookingsRef = collection(db, 'bookings');
      const q = query(
        bookingsRef,
        where('resourceId', '==', selectedResource),
        where('startTime', '<=', Timestamp.fromDate(endTime)),
        where('endTime', '>=', Timestamp.fromDate(bookingDateTime))
      );
      const conflictingBookings = await getDocs(q);

      if (!conflictingBookings.empty) {
        alert('This time slot is already booked');
        return;
      }

      // Create new booking
      await addDoc(collection(db, 'bookings'), {
        resourceId: selectedResource,
        userId: currentUser.uid,
        startTime: Timestamp.fromDate(bookingDateTime),
        endTime: Timestamp.fromDate(endTime),
        createdAt: Timestamp.now()
      });

      alert('Booking successful!');
      fetchUserBookings();
      setSelectedResource(null);
      setBookingDate('');
      setBookingTime('');
    } catch (error) {
      console.error('Error creating booking:', error);
      alert('Error creating booking');
    }
  };

  const handleCancelBooking = async (bookingId) => {
    try {
      await deleteDoc(doc(db, 'bookings', bookingId));
      alert('Booking cancelled successfully');
      fetchUserBookings();
    } catch (error) {
      console.error('Error cancelling booking:', error);
      alert('Error cancelling booking');
    }
  };

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
          <Navbar />
    <div className="max-w-4xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Resource Booking</h2>
      
      {/* Booking Form */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h3 className="text-xl font-semibold mb-4">New Booking</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Select Resource</label>
            <select
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={selectedResource || ''}
              onChange={(e) => setSelectedResource(e.target.value)}
            >
              <option value="">Select a resource...</option>
              {resources.map((resource) => (
                <option key={resource.id} value={resource.id}>
                  {resource.name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Date</label>
            <input
              type="date"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={bookingDate}
              onChange={(e) => setBookingDate(e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Time</label>
            <input
              type="time"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={bookingTime}
              onChange={(e) => setBookingTime(e.target.value)}
            />
          </div>
          
          <button
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            onClick={handleBooking}
          >
            Book Resource
          </button>
        </div>
      </div>
      
      {/* User's Bookings */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-xl font-semibold mb-4">Your Bookings</h3>
        {userBookings.length === 0 ? (
          <p className="text-gray-500">No active bookings</p>
        ) : (
          <div className="space-y-4">
            {userBookings.map((booking) => {
              const resource = resources.find(r => r.id === booking.resourceId);
              return (
                <div key={booking.id} className="flex justify-between items-center p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">{resource?.name}</p>
                    <p className="text-sm text-gray-500">
                      {booking.startTime.toDate().toLocaleString()} - {booking.endTime.toDate().toLocaleString()}
                    </p>
                  </div>
                  <button
                    className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                    onClick={() => handleCancelBooking(booking.id)}
                  >
                    Cancel
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default ResourceBooking;