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

<<<<<<< HEAD
=======
  useEffect(() => {
    fetchUserBookings();
    fetchAllBookings();
    const cleanup = setupBookingCleanup();
    return () => cleanup();
  }, [currentUser]);
}
>>>>>>> 2200b5622a85f36356741abc7fbe25d44dbc3e44
