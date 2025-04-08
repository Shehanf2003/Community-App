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
  const [allBookings, setAllBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [availableTimeSlots, setAvailableTimeSlots] = useState([]);
  const [timeSlotLoading, setTimeSlotLoading] = useState(false);

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

  // Update available time slots whenever resource or date changes
  useEffect(() => {
    if (selectedResource && bookingDate) {
      checkAvailableTimeSlots();
    }
  }, [selectedResource, bookingDate]);

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

  // Check for available time slots on the selected date
  const checkAvailableTimeSlots = async () => {
    if (!selectedResource || !bookingDate) return;
    
    setTimeSlotLoading(true);
    
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
      setTimeSlotLoading(false);
    } catch (error) {
      console.error('Error checking available time slots:', error);
      setTimeSlotLoading(false);
    }
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
  } }