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
    const [timeSlotLoading, setTimeSlotLoading] = useState(false); }