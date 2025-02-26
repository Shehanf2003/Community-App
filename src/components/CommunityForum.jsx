import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, addDoc, updateDoc, doc, deleteDoc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import Navbar from './navbar';

const CommunityForum = () => {
  const [threads, setThreads] = useState([]);
  const [newThread, setNewThread] = useState({ title: '', content: '' });
  const [selectedThread, setSelectedThread] = useState(null);
  const [newComment, setNewComment] = useState('');
  const { currentUser } = useAuth();

  useEffect(() => {
    fetchThreads();
  }, []);

  const fetchThreads = async () => {
    try {
      const threadsQuery = query(collection(db, 'forum_threads'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(threadsQuery);
      const threadsData = await Promise.all(snapshot.docs.map(async (doc) => {
        const thread = { id: doc.id, ...doc.data() };
        const commentsQuery = query(collection(db, 'forum_comments'), orderBy('createdAt', 'asc'));
        const commentsSnapshot = await getDocs(commentsQuery);
        thread.comments = commentsSnapshot.docs
          .filter(comment => comment.data().threadId === doc.id)
          .map(comment => ({ id: comment.id, ...comment.data() }));
        return thread;
      }));
      setThreads(threadsData);
    } catch (error) {
      console.error('Error fetching threads:', error);
    }
  };

  const createThread = async (e) => {
    e.preventDefault();
    try {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const userData = userDoc.data();
      
      const threadRef = await addDoc(collection(db, 'forum_threads'), {
        title: newThread.title,
        content: newThread.content,
        userId: currentUser.uid,
        username: userData.username,
        createdAt: new Date(),
        likes: 0,
        dislikes: 0
      });
      setNewThread({ title: '', content: '' });
      fetchThreads();
    } catch (error) {
      console.error('Error creating thread:', error);
    }
  };

  const deleteThread = async (threadId) => {
    try {
      await deleteDoc(doc(db, 'forum_threads', threadId));
      
      const commentsQuery = query(collection(db, 'forum_comments'));
      const commentsSnapshot = await getDocs(commentsQuery);
      const threadComments = commentsSnapshot.docs.filter(doc => doc.data().threadId === threadId);
      
      await Promise.all(threadComments.map(comment => 
        deleteDoc(doc(db, 'forum_comments', comment.id))
      ));
      
      fetchThreads();
    } catch (error) {
      console.error('Error deleting thread:', error);
    }
  };

  const addComment = async (threadId) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const userData = userDoc.data();
      
      await addDoc(collection(db, 'forum_comments'), {
        threadId,
        content: newComment,
        userId: currentUser.uid,
        username: userData.username,
        createdAt: new Date()
      });
      setNewComment('');
      fetchThreads();
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleVote = async (threadId, voteType) => {
    try {
      const threadRef = doc(db, 'forum_threads', threadId);
      const threadDoc = await getDoc(threadRef);
      const currentVotes = threadDoc.data()[voteType];
      await updateDoc(threadRef, {
        [voteType]: currentVotes + 1
      });
      fetchThreads();
    } catch (error) {
      console.error('Error updating votes:', error);
    }
  };

  return (
    <div>
    
      <div className="max-w-4xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">Community Forum</h1>
        
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Create New Thread</h2>
          <form onSubmit={createThread}>
            <input
              type="text"
              placeholder="Thread Title"
              className="w-full p-2 border rounded mb-4"
              value={newThread.title}
              onChange={(e) => setNewThread({ ...newThread, title: e.target.value })}
              required
            />
            <textarea
              placeholder="Thread Content"
              className="w-full p-2 border rounded mb-4"
              value={newThread.content}
              onChange={(e) => setNewThread({ ...newThread, content: e.target.value })}
              required
            />
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Create Thread
            </button>
          </form>
        </div>

        <div className="space-y-6">
          {threads.map((thread) => (
            <div key={thread.id} className="bg-white shadow rounded-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold mb-2">{thread.title}</h3>
                  <p className="text-sm text-gray-500">Posted by {thread.username}</p>
                </div>
                {currentUser?.uid === thread.userId ? (
                  <button
                    onClick={() => deleteThread(thread.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                ) : null}
              </div>
              <p className="text-gray-600 mb-4">{thread.content}</p>
              <div className="flex items-center space-x-4 mb-4">
                <button
                  onClick={() => handleVote(thread.id, 'likes')}
                  className="flex items-center space-x-1 text-green-600"
                >
                  <span>👍 {thread.likes}</span>
                </button>
                <button
                  onClick={() => handleVote(thread.id, 'dislikes')}
                  className="flex items-center space-x-1 text-red-600"
                >
                  <span>👎 {thread.dislikes}</span>
                </button>
              </div>

              <div className="mt-4">
                <h4 className="font-semibold mb-2">Comments</h4>
                <div className="space-y-2">
                  {thread.comments?.map((comment) => (
                    <div key={comment.id} className="bg-gray-50 p-3 rounded">
                      <p className="text-sm">{comment.content}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        By {comment.username} at {comment.createdAt.toDate().toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <textarea
                    placeholder="Add a comment..."
                    className="w-full p-2 border rounded mb-2"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                  />
                  <button
                    onClick={() => addComment(thread.id)}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  >
                    Add Comment
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CommunityForum;