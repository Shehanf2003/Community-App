import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, Timestamp, getDoc, orderBy, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

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
  const [loading, setLoading] = useState(true);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [availableTimeSlots, setAvailableTimeSlots] = useState([]);
  const [timeSlotLoading, setTimeSlotLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('new'); // 'new', 'your'
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [bookingToCancel, setBookingToCancel] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeBookingFilter, setActiveBookingFilter] = useState('upcoming'); // 'upcoming', 'past', 'all'
  const [searchTerm, setSearchTerm] = useState('');
  
  // Minimum selectable date (today)
  const today = new Date().toISOString().split('T')[0];
  
  // Hardcoded resources with more details for better UX
  const resources = [
    { 
      id: 'community-hall-1', 
      name: 'Community Hall A', 
      type: 'community_hall', 
      capacity: 100,
      description: 'Large hall suitable for gatherings, presentations, and community events',
      amenities: ['Projector', 'Sound system', 'Tables', 'Chairs', 'Kitchen access'],
      image: '/images/community-hall-a.jpg'
    },
    { 
      id: 'outdoor-area-1', 
      name: 'Outdoor Party Area', 
      type: 'outdoor_party_area', 
      capacity: 50,
      description: 'Covered outdoor space perfect for small gatherings and celebrations',
      amenities: ['BBQ facilities', 'Picnic tables', 'Power outlets', 'Lighting'],
      image: '/images/outdoor-area.jpg'
    },
    { 
      id: 'meeting-room-1', 
      name: 'Conference Room 1', 
      type: 'meeting_room', 
      capacity: 20,
      description: 'Professional meeting room with video conferencing capabilities',
      amenities: ['Video conferencing', 'Whiteboard', 'TV display', 'Water service'],
      image: '/images/conference-room.jpg'
    },
    { 
      id: 'meeting-room-2', 
      name: 'Board Room', 
      type: 'meeting_room', 
      capacity: 12,
      description: 'Executive-style meeting room for smaller groups and discussions',
      amenities: ['Premium chairs', 'Video conferencing', 'Coffee service'],
      image: '/images/board-room.jpg'
    }
  ];

  useEffect(() => {
    fetchUserBookings();
    const cleanup = setupBookingCleanup();
    return () => cleanup();
  }, [currentUser]);

  // Update available time slots whenever resource or date changes
  useEffect(() => {
    if (selectedResource && bookingDate) {
      checkAvailableTimeSlots();
    }
  }, [selectedResource, bookingDate, duration]);

  // Dismiss success and error messages after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const fetchUserBookings = async () => {
    setBookingsLoading(true);
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
    } catch (error) {
      console.error('Error fetching user bookings:', error);
      setError('Failed to load your bookings. Please try again.');
    } finally {
      setLoading(false);
      setBookingsLoading(false);
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
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  };

  // Check for available time slots on the selected date
  const checkAvailableTimeSlots = async () => {
    if (!selectedResource || !bookingDate) return;
    
    setTimeSlotLoading(true);
    setAvailableTimeSlots([]);
    
    try {
      // Create date range for the selected date (midnight to midnight)
      const startOfDay = new Date(`${bookingDate}T00:00:00`);
      const endOfDay = new Date(`${bookingDate}T23:59:59`);
      
      // Get all bookings for this resource and date
      const bookingsRef = collection(db, 'bookings');
      const q = query(
        bookingsRef,
        where('resourceId', '==', selectedResource),
        where('startTime', '>=', Timestamp.fromDate(startOfDay)),
        where('startTime', '<=', Timestamp.fromDate(endOfDay))
      );
      
      const snapshot = await getDocs(q);
      const dayBookings = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          startTime: data.startTime.toDate(),
          endTime: data.endTime.toDate()
        };
      });
      
      // Generate available time slots (hourly from 8AM to 8PM)
      const slots = [];
      const businessHoursStart = 8; // 8AM
      const businessHoursEnd = 20; // 8PM
      
      for (let hour = businessHoursStart; hour < businessHoursEnd; hour++) {
        const slotStart = new Date(`${bookingDate}T${hour.toString().padStart(2, '0')}:00:00`);
        const slotEnd = new Date(slotStart);
        slotEnd.setHours(slotEnd.getHours() + parseInt(duration));
        
        // Skip past slots
        if (slotEnd <= new Date()) continue;
        
        // Skip slots that would end after business hours
        if (slotEnd.getHours() > businessHoursEnd) continue;
        
        // Check if this slot conflicts with any existing bookings
        const isAvailable = !dayBookings.some(booking => {
          return (slotStart < booking.endTime && slotEnd > booking.startTime);
        });
        
        if (isAvailable) {
          slots.push({
            time: hour.toString().padStart(2, '0') + ":00",
            available: true
          });
        }
      }
      
      setAvailableTimeSlots(slots);
    } catch (error) {
      console.error('Error checking available time slots:', error);
      setError('Failed to check availability. Please try again.');
    } finally {
      setTimeSlotLoading(false);
    }
  };

  const handleBooking = async () => {
    if (!selectedResource || !bookingDate || !bookingTime || !purpose || !attendees) {
      setError('Please fill in all required fields');
      return;
    }

    const bookingDateTime = new Date(`${bookingDate}T${bookingTime}`);
    const endTime = new Date(bookingDateTime);
    endTime.setHours(endTime.getHours() + parseInt(duration));

    if (bookingDateTime < new Date()) {
      setError('Cannot book for past date/time');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Use a transaction to ensure no double-booking occurs
      await runTransaction(db, async (transaction) => {
        // Check for conflicting bookings
        const bookingsRef = collection(db, 'bookings');
        const q = query(
          bookingsRef,
          where('resourceId', '==', selectedResource),
          where('startTime', '<=', Timestamp.fromDate(endTime)),
          where('endTime', '>=', Timestamp.fromDate(bookingDateTime))
        );
        
        const conflictingBookingsSnapshot = await getDocs(q);
        
        if (!conflictingBookingsSnapshot.empty) {
          throw new Error('This time slot is already booked');
        }

        // Get resource details from hardcoded list
        const resourceData = resources.find(r => r.id === selectedResource);
        
        if (!resourceData) {
          throw new Error('Resource not found');
        }

        // Validate attendees against capacity
        if (parseInt(attendees) > resourceData.capacity) {
          throw new Error(`Maximum capacity for this resource is ${resourceData.capacity} people`);
        }

        // Create new booking document reference
        const newBookingRef = doc(collection(db, 'bookings'));
        
        // Set the booking data within the transaction
        transaction.set(newBookingRef, {
          resourceId: selectedResource,
          resourceName: resourceData.name,
          userId: currentUser.uid,
          userName: currentUser.displayName || currentUser.email,
          startTime: Timestamp.fromDate(bookingDateTime),
          endTime: Timestamp.fromDate(endTime),
          purpose: purpose,
          attendees: parseInt(attendees),
          createdAt: Timestamp.now()
        });
        
        return newBookingRef;
      });

      setSuccessMessage('Booking successful! Your resource has been reserved.');
      fetchUserBookings();
      checkAvailableTimeSlots(); // Refresh available slots
      resetForm();
      setActiveTab('your'); // Switch to user bookings tab after successful booking
    } catch (error) {
      console.error('Error creating booking:', error);
      setError(`Booking failed: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleResourceSelect = (resourceId) => {
    setSelectedResource(resourceId);
    const resourceDetails = resources.find(r => r.id === resourceId);
    setSelectedResourceDetails(resourceDetails || null);
    setBookingTime(''); // Reset time when resource changes
    if (bookingDate) {
      checkAvailableTimeSlots();
    }
  };
  
  const handleDateChange = (date) => {
    setBookingDate(date);
    setBookingTime(''); // Reset time when date changes
  };
  
  const resetForm = () => {
    setSelectedResource(null);
    setSelectedResourceDetails(null);
    setBookingDate('');
    setBookingTime('');
    setDuration(2);
    setPurpose('');
    setAttendees('');
    setAvailableTimeSlots([]);
    setError(null);
  };

  const confirmCancelBooking = (booking) => {
    setBookingToCancel(booking);
  };

  const handleCancelBooking = async () => {
    if (!bookingToCancel) return;
    
    setIsSubmitting(true);
    try {
      // Get the booking to verify ownership
      const bookingRef = doc(db, 'bookings', bookingToCancel.id);
      const bookingSnap = await getDoc(bookingRef);
      
      if (!bookingSnap.exists()) {
        setError('Booking not found');
        return;
      }
      
      const bookingData = bookingSnap.data();
      
      // Only the booking owner can cancel
      if (bookingData.userId !== currentUser.uid) {
        setError('You can only cancel your own bookings');
        return;
      }
      
      await deleteDoc(bookingRef);
      setSuccessMessage('Booking cancelled successfully');
      setBookingToCancel(null);
      fetchUserBookings();
      checkAvailableTimeSlots(); // Refresh available slots
    } catch (error) {
      console.error('Error cancelling booking:', error);
      setError(`Failed to cancel booking: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDurationChange = (newDuration) => {
    setDuration(newDuration);
    setBookingTime(''); // Reset time slot when duration changes
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate();
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  };

  const getDurationInHours = (startTime, endTime) => {
    if (!startTime || !endTime) return '';
    
    const start = startTime.toDate();
    const end = endTime.toDate();
    const durationMs = end - start;
    const durationHours = durationMs / (1000 * 60 * 60);
    
    return durationHours === 1 ? '1 hour' : `${durationHours} hours`;
  };

  const filterBookings = (bookings, filter, search) => {
    const now = new Date();
    let filtered = [...bookings];
    
    // Apply time filter
    if (filter === 'upcoming') {
      filtered = filtered.filter(booking => booking.endTime.toDate() > now);
    } else if (filter === 'past') {
      filtered = filtered.filter(booking => booking.endTime.toDate() <= now);
    }
    
    // Apply search if provided
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(booking => 
        booking.resourceName?.toLowerCase().includes(searchLower) ||
        booking.purpose?.toLowerCase().includes(searchLower) ||
        booking.userName?.toLowerCase().includes(searchLower)
      );
    }
    
    return filtered;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <div className="flex items-center space-x-4 bg-white p-6 rounded-lg shadow-md">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          <p className="text-gray-700 font-medium">Loading resource booking system...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-fixed bg-cover bg-center" style={{ backgroundImage: "url('/CU3.jpg')" }}>
      <div className="min-h-screen bg-gradient-to-b from-white/70 to-white/90 backdrop-blur-sm py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white shadow-xl rounded-xl overflow-hidden border border-gray-100">
            {/* Header with blue background */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-white">Resource Booking</h1>
            </div>
          </div>

            <div className="min-h-screen bg-gray-50 pb-12">
              <div className="max-w-6xl mx-auto p-4">
                
                {/* Success & Error Messages */}
                {successMessage && (
                  <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-6 rounded-md flex justify-between items-center">
                    <div className="flex items-center">
                      <svg className="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-green-700">{successMessage}</p>
                    </div>
                    <button 
                      onClick={() => setSuccessMessage(null)}
                      className="text-green-500 hover:text-green-700"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
                
                {error && (
                  <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6 rounded-md flex justify-between items-center">
                    <div className="flex items-center">
                      <svg className="h-5 w-5 text-red-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <p className="text-red-700">{error}</p>
                    </div>
                    <button 
                      onClick={() => setError(null)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
                
                {/* Tab Navigation */}
                <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
                  <div className="border-b border-gray-200">
                    <nav className="flex -mb-px">
                      <button
                        className={`${
                          activeTab === 'new'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-md transition-colors`}
                        onClick={() => setActiveTab('new')}
                      >
                        New Booking
                      </button>
                      <button
                        className={`${
                          activeTab === 'your'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-md transition-colors`}
                        onClick={() => setActiveTab('your')}
                      >
                        Your Bookings
                      </button>
                    </nav>
                  </div>
                  
                  {/* Tab Content */}
                  <div className="p-6">
                    {/* New Booking Tab */}
                    {activeTab === 'new' && (
                      <div>
                        <h3 className="text-xl font-semibold mb-6">Reserve a Resource</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          {/* Left Column - Resource Selection */}
                          <div>
                            <h4 className="font-medium mb-4 text-gray-700">1. Select a Resource</h4>
                            <div className="grid grid-cols-1 gap-4">
                              {resources.map(resource => (
                                <div 
                                  key={resource.id}
                                  className={`border rounded-lg p-4 cursor-pointer transition-all duration-150 ${
                                    selectedResource === resource.id 
                                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
                                      : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                                  }`}
                                  onClick={() => handleResourceSelect(resource.id)}
                                >
                                  <div className="flex items-start space-x-4">
                                    <div className="flex-shrink-0 h-16 w-16 bg-gray-200 rounded-md overflow-hidden">
                                      {/* Placeholder image or resource icon */}
                                      <div className="h-full w-full flex items-center justify-center text-gray-500">
                                        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                        </svg>
                                      </div>
                                    </div>
                                    <div className="flex-grow">
                                      <h5 className="font-medium">{resource.name}</h5>
                                      <p className="text-sm text-gray-500 mt-1">Capacity: {resource.capacity} people</p>
                                      <p className="text-sm text-gray-500">Type: {resource.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                                    </div>
                                    <div className="flex-shrink-0">
                                      {selectedResource === resource.id && (
                                        <svg className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          {/* Right Column - Booking Details */}
                          <div>
                            {selectedResourceDetails ? (
                              <div>
                                <h4 className="font-medium mb-4 text-gray-700">2. Booking Details</h4>
                                
                                <div className="bg-blue-50 p-4 rounded-md mb-6">
                                  <h5 className="font-medium text-blue-800 mb-2">{selectedResourceDetails.name}</h5>
                                  <p className="text-sm text-blue-700 mb-2">{selectedResourceDetails.description}</p>
                                  <div className="mt-2">
                                    <p className="text-sm font-medium text-blue-800 mb-1">Amenities:</p>
                                    <div className="flex flex-wrap gap-2">
                                      {selectedResourceDetails.amenities.map((amenity, index) => (
                                        <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                          {amenity}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="space-y-4">
                                  <div>
                                    <label htmlFor="purpose" className="block text-sm font-medium text-gray-700 mb-1">
                                      Purpose of Booking *
                                    </label>
                                    <input
                                      id="purpose"
                                      type="text"
                                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                      value={purpose}
                                      onChange={(e) => setPurpose(e.target.value)}
                                      placeholder="E.g., Team meeting, Community event, etc."
                                    />
                                  </div>

                                  <div>
                                    <label htmlFor="attendees" className="block text-sm font-medium text-gray-700 mb-1">
                                      Number of Attendees *
                                    </label>
                                    <div className="flex items-center">
                                      <input
                                        id="attendees"
                                        type="number"
                                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                        value={attendees}
                                        onChange={(e) => setAttendees(e.target.value)}
                                        min="1"
                                        max={selectedResourceDetails.capacity}
                                      />
                                      <span className="ml-2 text-sm text-gray-500">
                                        (Max: {selectedResourceDetails.capacity})
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <label htmlFor="booking-date" className="block text-sm font-medium text-gray-700 mb-1">
                                      Date *
                                    </label>
                                    <input
                                      id="booking-date"
                                      type="date"
                                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                      value={bookingDate}
                                      onChange={(e) => handleDateChange(e.target.value)}
                                      min={today}
                                    />
                                  </div>
                                  
                                  <div>
                                    <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">
                                      Duration *
                                    </label>
                                    <div className="grid grid-cols-4 gap-2">
                                      {[1, 2, 4, 8].map((hours) => (
                                        <button
                                          key={hours}
                                          type="button"
                                          className={`py-2 px-4 rounded-md ${
                                            duration == hours
                                              ? 'bg-blue-600 text-white'
                                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                          }`}
                                          onClick={() => handleDurationChange(hours)}
                                        >
                                          {hours} hr{hours > 1 ? 's' : ''}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                  
                                  {bookingDate && (
                                    <div>
                                      <label htmlFor="time-slot" className="block text-sm font-medium text-gray-700 mb-1">
                                        Time Slot *
                                      </label>
                                      {timeSlotLoading ? (
                                        <div className="flex items-center space-x-2 text-sm text-gray-500 h-11">
                                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500"></div>
                                          <span>Checking availability...</span>
                                        </div>
                                      ) : availableTimeSlots.length > 0 ? (
                                        <div className="grid grid-cols-3 gap-2">
                                          {availableTimeSlots.map(slot => (
                                            <button
                                              key={slot.time}
                                              type="button"
                                              className={`py-2 px-3 rounded-md text-center ${
                                                bookingTime === slot.time
                                                  ? 'bg-blue-600 text-white'
                                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                              }`}
                                              onClick={() => setBookingTime(slot.time)}
                                            >
                                              {slot.time}
                                            </button>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded text-sm text-yellow-700">
                                          No available time slots for the selected date and duration. Please try a different date or adjust your duration.
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  <div className="pt-4">
                                    <button
                                      className={`w-full py-3 px-4 rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                                        !selectedResource || !bookingDate || !bookingTime || !purpose || !attendees || isSubmitting
                                          ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                                      }`}
                                      onClick={handleBooking}
                                      disabled={!selectedResource || !bookingDate || !bookingTime || !purpose || !attendees || isSubmitting}
                                    >
                                      {isSubmitting ? (
                                        <div className="flex items-center justify-center">
                                          <div className="animate-spin mr-2 h-5 w-5 border-t-2 border-b-2 border-white rounded-full"></div>
                                          Processing...
                                        </div>
                                      ) : (
                                        'Book Resource'
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="h-full flex items-center justify-center">
                                <div className="text-center p-8">
                                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <h3 className="mt-2 text-sm font-medium text-gray-900">Start by selecting a resource</h3>
                                  <p className="mt-1 text-sm text-gray-500">Choose a resource from the list to begin booking</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Your Bookings Tab */}
                    {activeTab === 'your' && (
                      <div>
                        <div className="flex justify-between items-center mb-6">
                          <h3 className="text-xl font-semibold">Your Bookings</h3>
                          <div className="flex items-center space-x-2">
                            <button
                              className={`px-3 py-1 rounded-full text-sm font-medium ${
                                activeBookingFilter === 'upcoming' 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                              onClick={() => setActiveBookingFilter('upcoming')}
                            >
                              Upcoming
                            </button>
                            <button
                              className={`px-3 py-1 rounded-full text-sm font-medium ${
                                activeBookingFilter === 'past' 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                              onClick={() => setActiveBookingFilter('past')}
                            >
                              Past
                            </button>
                            <button
                              className={`px-3 py-1 rounded-full text-sm font-medium ${
                                activeBookingFilter === 'all' 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                              onClick={() => setActiveBookingFilter('all')}
                            >
                              All
                            </button>
                          </div>
                        </div>
                        
                        {bookingsLoading ? (
                          <div className="flex justify-center items-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                            <span className="ml-2 text-gray-700">Loading your bookings...</span>
                          </div>
                        ) : (
                          <>
                            {filterBookings(userBookings, activeBookingFilter, searchTerm).length === 0 ? (
                              <div className="bg-white text-center py-12 rounded-lg border border-gray-200">
                                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <h3 className="mt-2 text-sm font-medium text-gray-900">No bookings found</h3>
                                {activeBookingFilter === 'upcoming' ? (
                                  <p className="mt-1 text-sm text-gray-500">You don't have any upcoming bookings</p>
                                ) : activeBookingFilter === 'past' ? (
                                  <p className="mt-1 text-sm text-gray-500">You don't have any past bookings</p>
                                ) : (
                                  <p className="mt-1 text-sm text-gray-500">You haven't made any bookings yet</p>
                                )}
                                <div className="mt-6">
                                  <button
                                    type="button"
                                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                    onClick={() => setActiveTab('new')}
                                  >
                                    Create a booking
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 gap-4">
                                {filterBookings(userBookings, activeBookingFilter, searchTerm).map((booking) => {
                                  const startTime = booking.startTime.toDate();
                                  const endTime = booking.endTime.toDate();
                                  const isPast = endTime < new Date();
                                  const isToday = new Date().toDateString() === startTime.toDateString();
                                  
                                  return (
                                    <div 
                                      key={booking.id} 
                                      className={`border rounded-lg shadow-sm overflow-hidden ${
                                        isPast ? 'bg-gray-50 border-gray-200' : isToday ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
                                      }`}
                                    >
                                      <div className="p-5">
                                        <div className="sm:flex sm:items-start sm:justify-between">
                                          <div>
                                            <div className="flex items-center">
                                              <h4 className="text-lg font-medium text-gray-900">
                                                {booking.resourceName || 'Unknown Resource'}
                                              </h4>
                                              {isToday && !isPast && (
                                                <span className="ml-2 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                  Today
                                                </span>
                                              )}
                                              {isPast && (
                                                <span className="ml-2 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                  Past
                                                </span>
                                              )}
                                            </div>
                                            
                                            <div className="mt-2 text-sm text-gray-500">
                                              <p><span className="font-medium">Purpose:</span> {booking.purpose}</p>
                                              <p><span className="font-medium">When:</span> {formatDateTime(booking.startTime)}</p>
                                              <p><span className="font-medium">Duration:</span> {getDurationInHours(booking.startTime, booking.endTime)}</p>
                                              <p><span className="font-medium">Attendees:</span> {booking.attendees} people</p>
                                            </div>
                                          </div>
                                          
                                          {!isPast && (
                                            <div className="mt-4 sm:mt-0 sm:ml-6">
                                              <button
                                                type="button"
                                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                                onClick={() => confirmCancelBooking(booking)}
                                              >
                                                Cancel Booking
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Confirmation Modal */}
              {bookingToCancel && (
                <div className="fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                  <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
                    <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                    <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                      <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div className="sm:flex sm:items-start">
                          <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          </div>
                          <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                            <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                              Cancel Booking
                            </h3>
                            <div className="mt-2">
                              <p className="text-sm text-gray-500">
                                Are you sure you want to cancel your booking for <span className="font-medium">{bookingToCancel.resourceName}</span> on <span className="font-medium">{formatDateTime(bookingToCancel.startTime)}</span>? This action cannot be undone.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                        <button 
                          type="button" 
                          className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                          onClick={handleCancelBooking}
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? (
                            <div className="flex items-center">
                              <div className="animate-spin mr-2 h-4 w-4 border-t-2 border-b-2 border-white rounded-full"></div>
                              Processing...
                            </div>
                          ) : (
                            'Cancel Booking'
                          )}
                        </button>
                        <button 
                          type="button" 
                          className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                          onClick={() => setBookingToCancel(null)}
                          disabled={isSubmitting}
                        >
                          Go Back
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResourceBooking;