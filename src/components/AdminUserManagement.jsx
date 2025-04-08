import React, { useState, useEffect } from 'react';
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, createUserWithEmailAndPassword, getIdToken } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, updateDoc, query, where } from 'firebase/firestore';
import { Trash2, Edit2, AlertTriangle, CheckCircle, Search } from "lucide-react";
