import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, Timestamp, getDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import Navbar from './navbar';

const ResourceBooking = () => {
  const { currentUser } = useAuth();
  const [selectedResource, setSelectedResource] = useState(null);
  const [selectedResourceDetails, setSelectedResourceDetails] = useState(null);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [duration, setDuration] = useState(2);
  const [purpose, setPurpose] = useState('');
  const [attendees, setAttendees] = useState('');
  const [userBookings, setUserBookings] = useState([]);
  const [allBookings, setAllBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Hardcoded resources
  const resources = [
    { id: 'community-hall-1', name: 'Community Hall A', type: 'community_hall', capacity: 100 },
    { id: 'outdoor-area-1', name: 'Outdoor Party Area', type: 'outdoor_party_area', capacity: 50 },
    { id: 'meeting-room-1', name: 'Conference Room 1', type: 'meeting_room', capacity: 20 },
    { id: 'meeting-room-2', name: 'Board Room', type: 'meeting_room', capacity: 12 }
  ];

  useEffect(() => {
    fetchUserBookings();
    fetchAllBookings();
    const cleanup = setupBookingCleanup();
    return () => cleanup();
  }, [currentUser]);

  const fetchUserBookings = async () => {
    try {
      const bookingsRef = collection(db, 'bookings');
      const q = query(
        bookingsRef, 
        where('userId', '==', currentUser.uid),
        orderBy('startTime', 'asc')
      );
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

  const fetchAllBookings = async () => {
    try {
      const bookingsRef = collection(db, 'bookings');
      const q = query(
        bookingsRef,
        orderBy('startTime', 'asc')
      );
      const snapshot = await getDocs(q);
      const bookingsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Include a flag to determine if the current user owns this booking
        isOwner: doc.data().userId === currentUser.uid
      }));
      setAllBookings(bookingsList);
    } catch (error) {
      console.error('Error fetching all bookings:', error);
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
      
      // Refresh bookings after cleanup
      fetchUserBookings();
      fetchAllBookings();
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  };

  const handleBooking = async () => {
    if (!selectedResource || !bookingDate || !bookingTime || !purpose || !attendees) {
      alert('Please fill in all required fields');
      return;
    }

    const bookingDateTime = new Date(`${bookingDate}T${bookingTime}`);
    const endTime = new Date(bookingDateTime);
    endTime.setHours(endTime.getHours() + parseInt(duration));

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

      // Get resource details from hardcoded list
      const resourceData = resources.find(r => r.id === selectedResource);
      
      if (!resourceData) {
        alert('Resource not found');
        return;
      }

      // Validate attendees against capacity
      if (parseInt(attendees) > resourceData.capacity) {
        alert(`Maximum capacity for this resource is ${resourceData.capacity} people`);
        return;
      }

      // Create new booking
      await addDoc(collection(db, 'bookings'), {
        resourceId: selectedResource,
        resourceName: resourceData.name,
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email,  // Include user name for display
        startTime: Timestamp.fromDate(bookingDateTime),
        endTime: Timestamp.fromDate(endTime),
        purpose: purpose,
        attendees: parseInt(attendees),
        createdAt: Timestamp.now()
      });

      alert('Booking successful!');
      fetchUserBookings();
      fetchAllBookings();
      resetForm();
    } catch (error) {
      console.error('Error creating booking:', error);
      alert('Error creating booking: ' + error.message);
    }
  };
  
  const handleResourceSelect = (resourceId) => {
    setSelectedResource(resourceId);
    const resourceDetails = resources.find(r => r.id === resourceId);
    setSelectedResourceDetails(resourceDetails || null);
  };
  
  const resetForm = () => {
    setSelectedResource(null);
    setSelectedResourceDetails(null);
    setBookingDate('');
    setBookingTime('');
    setDuration(2);
    setPurpose('');
    setAttendees('');
  };

  const handleCancelBooking = async (bookingId) => {
    try {
      // Get the booking to verify ownership
      const bookingRef = doc(db, 'bookings', bookingId);
      const bookingSnap = await getDoc(bookingRef);
      
      if (!bookingSnap.exists()) {
        alert('Booking not found');
        return;
      }
      
      const bookingData = bookingSnap.data();
      
      // Only the booking owner can cancel
      if (bookingData.userId !== currentUser.uid) {
        alert('You can only cancel your own bookings');
        return;
      }
      
      await deleteDoc(bookingRef);
      alert('Booking cancelled successfully');
      fetchUserBookings();
      fetchAllBookings();
    } catch (error) {
      console.error('Error cancelling booking:', error);
      alert('Error cancelling booking: ' + error.message);
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
                onChange={(e) => handleResourceSelect(e.target.value)}
              >
                <option value="">Select a resource</option>
                {resources.map(resource => (
                  <option key={resource.id} value={resource.id}>
                    {resource.name}
                  </option>
                ))}
              </select>
            </div>
            {selectedResourceDetails && (
              <div className="bg-blue-50 p-4 rounded-md">
                <h4 className="font-medium text-blue-700 mb-2">Selected Resource Details</h4>
                <p className="text-sm text-blue-600">Type: {selectedResourceDetails.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                <p className="text-sm text-blue-600">Maximum Capacity: {selectedResourceDetails.capacity} people</p>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Purpose</label>
              <input
                type="text"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Enter booking purpose"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Number of Attendees</label>
              <input
                type="number"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                value={attendees}
                onChange={(e) => setAttendees(e.target.value)}
                min="1"
              />
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

            <div>
              <label className="block text-sm font-medium text-gray-700">Duration (hours)</label>
              <select
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              >
                <option value="1">1 hour</option>
                <option value="2">2 hours</option>
                <option value="4">4 hours</option>
                <option value="8">8 hours</option>
              </select>
            </div>
            
            <button
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              onClick={handleBooking}
            >
              Book Resource
            </button>
          </div>
        </div>
        
        {/* All Bookings */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h3 className="text-xl font-semibold mb-4">All Resource Bookings</h3>
          {allBookings.length === 0 ? (
            <p className="text-gray-500">No active bookings</p>
          ) : (
            <div className="space-y-4">
              {allBookings.map((booking) => {
                const startTime = booking.startTime.toDate();
                const endTime = booking.endTime.toDate();
                const isPast = endTime < new Date();
                
                return (
                  <div 
                    key={booking.id} 
                    className={`flex justify-between items-center p-4 border rounded-lg ${isPast ? 'bg-gray-50' : 'bg-white'}`}
                  >
                    <div>
                      <p className="font-medium">{booking.resourceName || 'Unknown Resource'}</p>
                      <p className="text-sm text-gray-500">
                        {startTime.toLocaleString()} - {endTime.toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">Purpose: {booking.purpose}</p>
                      <p className="text-sm text-gray-600">Booked by: {booking.userName || 'Unknown User'}</p>
                    </div>
                    {booking.isOwner && !isPast && (
                      <button
                        className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                        onClick={() => handleCancelBooking(booking.id)}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      
        {/* User's Bookings */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">Your Bookings</h3>
          {userBookings.length === 0 ? (
            <p className="text-gray-500">You have no active bookings</p>
          ) : (
            <div className="space-y-4">
              {userBookings.map((booking) => {
                const startTime = booking.startTime.toDate();
                const endTime = booking.endTime.toDate();
                const isPast = endTime < new Date();
                
                return (
                  <div 
                    key={booking.id} 
                    className={`flex justify-between items-center p-4 border rounded-lg ${isPast ? 'bg-gray-50' : 'bg-white'}`}
                  >
                    <div>
                      <p className="font-medium">{booking.resourceName || 'Unknown Resource'}</p>
                      <p className="text-sm text-gray-500">
                        {startTime.toLocaleString()} - {endTime.toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">Purpose: {booking.purpose}</p>
                    </div>
                    {!isPast && (
                      <button
                        className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                        onClick={() => handleCancelBooking(booking.id)}
                      >
                        Cancel
                      </button>
                    )}
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