import React, { useState, useEffect } from 'react';
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import Navbar from './navbar';

const ContactManagement = () => {
    const [contacts, setContacts] = useState([]);
  
    


    const db = getFirestore();

    useEffect(() => {
        fetchContacts();
    }, []);

    const fetchContacts = async () => {
        try {
            const contactsCollection = collection(db, 'community_contacts');
            const contactsSnapshot = await getDocs(contactsCollection);
            const contactsList = contactsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setContacts(contactsList);
        } catch (err) {
            setError('Error fetching contacts: ' + err.message);
        }
    };

   

    return (
        <div className="min-h-screen bg-gray-50">
        <Navbar />
       
        <div className="max-w-4xl mx-auto p-4">
           
            <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-4">Contact List</h3>
                <div className="space-y-4">
                    {contacts.map((contact) => (
                          <div>
                          <div className="flex justify-between items-start">
                              <div>
                                  <h4 className="font-medium">{contact.name}</h4>
                                  <p className="text-sm text-gray-600">{contact.role}</p>
                                  <p className="text-sm text-gray-600">{contact.department}</p>
                                  <p className="text-sm text-gray-600">{contact.email}</p>
                                  <p className="text-sm text-gray-600">{contact.phone}</p>
                              </div>
                            
                          </div>
                      </div>
                    
                    ))}
                </div>
            </div>
         </div>
    </div>
    );
};

export default ContactManagement;