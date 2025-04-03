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
}