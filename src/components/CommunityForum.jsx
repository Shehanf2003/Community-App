import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, addDoc, updateDoc, doc, deleteDoc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import ImageUploader from './ImageUploader';
import ThreadImage from './ThreadImage';

const CommunityForum = () => {
  const [threads, setThreads] = useState([]);
  const [newThread, setNewThread] = useState({ title: '', content: '' });
  const [selectedThread, setSelectedThread] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [imageData, setImageData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('newest'); // 'newest', 'popular'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const { currentUser } = useAuth();

  useEffect(() => {
    fetchThreads();
  }, [filter]);

  const fetchThreads = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const threadsQuery = query(collection(db, 'forum_threads'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(threadsQuery);
      
      // Use Promise.all to wait for all comment fetching to complete
      const threadsData = await Promise.all(snapshot.docs.map(async (doc) => {
        const threadData = doc.data();
        const thread = { id: doc.id, ...threadData };
        
        // Ensure createdAt is properly handled
        if (thread.createdAt && typeof thread.createdAt.toDate === 'function') {
          thread.createdAt = thread.createdAt;
        }
        
        // Use where clause for more efficient filtering
        const commentsQuery = query(
          collection(db, 'forum_comments'), 
          where('threadId', '==', doc.id),
          orderBy('createdAt', 'asc')
        );
        
        const commentsSnapshot = await getDocs(commentsQuery);
        thread.comments = commentsSnapshot.docs.map(comment => ({
          id: comment.id,
          ...comment.data()
        }));
        
        return thread;
      }));
      
      // Apply sorting based on filter
      let sortedThreads = [...threadsData];
      if (filter === 'popular') {
        sortedThreads.sort((a, b) => (b.likes - b.dislikes) - (a.likes - a.dislikes));
      }
      
      setThreads(sortedThreads);
    } catch (error) {
      console.error('Error fetching threads:', error);
      setError('Failed to load threads. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUploaded = (data) => {
    setImageData(data);
  };

  const createThread = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const userData = userDoc.data();
      
      // Create thread document with optional image data
      const threadData = {
        title: newThread.title,
        content: newThread.content,
        userId: currentUser.uid,
        username: userData.username,
        createdAt: new Date(),
        likes: 0,
        dislikes: 0
      };
      
      // Add image data if available
      if (imageData) {
        threadData.imageUrl = imageData.imageUrl || imageData.url;
        threadData.imageId = imageData.imageId || imageData.id;
        
        if (imageData.shareUrl) {
          threadData.shareUrl = imageData.shareUrl;
        }
        
        if (imageData.webUrl) {
          threadData.webUrl = imageData.webUrl;
        }
      }
      
      // Add the new thread document and get its ID
      const threadRef = await addDoc(collection(db, 'forum_threads'), threadData);
      
      // Create a local copy of the new thread with comments array
      const newThreadWithId = {
        id: threadRef.id,
        ...threadData,
        comments: []
      };
      
      // Update the threads state to include the new thread
      // This is the key change - adding the new thread to state immediately
      setThreads(prevThreads => [newThreadWithId, ...prevThreads]);
      
      // Reset form
      setNewThread({ title: '', content: '' });
      setImageData(null);
    } catch (error) {
      console.error('Error creating thread:', error);
      setError('Failed to create thread. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteThread = async (threadId) => {
    if (confirmDelete !== threadId) {
      setConfirmDelete(threadId);
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'forum_threads', threadId));
      
      // Use where clause for more efficient comment deletion
      const commentsQuery = query(
        collection(db, 'forum_comments'),
        where('threadId', '==', threadId)
      );
      const commentsSnapshot = await getDocs(commentsQuery);
      
      await Promise.all(commentsSnapshot.docs.map(commentDoc => 
        deleteDoc(doc(db, 'forum_comments', commentDoc.id))
      ));
      
      setConfirmDelete(null);
      // Update threads state directly instead of re-fetching
      setThreads(prevThreads => prevThreads.filter(thread => thread.id !== threadId));
    } catch (error) {
      console.error('Error deleting thread:', error);
      setError('Failed to delete thread. Please try again.');
    }
  };

  const cancelDelete = () => {
    setConfirmDelete(null);
  };

  const addComment = async (threadId) => {
    if (!newComment.trim()) return;
    
    setIsSubmitting(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const userData = userDoc.data();
      
      const commentData = {
        threadId,
        content: newComment,
        userId: currentUser.uid,
        username: userData.username,
        createdAt: new Date()
      };
      
      const commentRef = await addDoc(collection(db, 'forum_comments'), commentData);
      
      // Update the threads state directly with the new comment
      setThreads(prevThreads => 
        prevThreads.map(thread => {
          if (thread.id === threadId) {
            return {
              ...thread,
              comments: [
                ...thread.comments,
                { id: commentRef.id, ...commentData }
              ]
            };
          }
          return thread;
        })
      );
      
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
      setError('Failed to add comment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVote = async (threadId, voteType) => {
    if (!currentUser) {
      setError('Please sign in to vote on threads');
      return;
    }
    
    try {
      const threadRef = doc(db, 'forum_threads', threadId);
      const threadDoc = await getDoc(threadRef);
      const currentVotes = threadDoc.data()[voteType];
      await updateDoc(threadRef, {
        [voteType]: currentVotes + 1
      });
      
      // Update threads state directly instead of re-fetching
      setThreads(prevThreads => 
        prevThreads.map(thread => {
          if (thread.id === threadId) {
            return {
              ...thread,
              [voteType]: (thread[voteType] || 0) + 1
            };
          }
          return thread;
        })
      );
    } catch (error) {
      console.error('Error updating votes:', error);
      setError('Failed to register vote. Please try again.');
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    
    // Handle both Firestore Timestamp objects and JavaScript Date objects
    const date = typeof timestamp.toDate === 'function' ? timestamp.toDate() : timestamp;
    
    return new Intl.DateTimeFormat('en-US', { 
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div>
      <div className="max-w-4xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">Community Forum</h1>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 relative">
            <span className="block sm:inline">{error}</span>
            <span className="absolute top-0 right-0 px-4 py-3" onClick={() => setError(null)}>
              <span className="text-red-500 font-bold">×</span>
            </span>
          </div>
        )}
        
        {!currentUser && (
          <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-4">
            Please sign in to create threads and join the discussion.
          </div>
        )}
        
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Create New Thread</h2>
          <form onSubmit={createThread}>
            <div className="mb-4">
              <label htmlFor="thread-title" className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              <input
                id="thread-title"
                type="text"
                placeholder="Enter a descriptive title"
                className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                value={newThread.title}
                onChange={(e) => setNewThread({ ...newThread, title: e.target.value })}
                required
                disabled={!currentUser || isSubmitting}
              />
            </div>
            
            <div className="mb-4">
              <label htmlFor="thread-content" className="block text-sm font-medium text-gray-700 mb-1">
                Content
              </label>
              <textarea
                id="thread-content"
                placeholder="Share your thoughts, questions, or ideas..."
                className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500 min-h-32"
                value={newThread.content}
                onChange={(e) => setNewThread({ ...newThread, content: e.target.value })}
                required
                disabled={!currentUser || isSubmitting}
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Add an Image (Optional)
              </label>
              {currentUser ? (
                <>
                  <ImageUploader onImageUploaded={handleImageUploaded} disabled={isSubmitting} />
                  {imageData && (
                    <div className="mt-4 p-3 border rounded bg-gray-50">
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-sm font-medium text-gray-700">This image will be posted with your thread:</p>
                        <button 
                          type="button" 
                          className="text-red-600 hover:text-red-800"
                          onClick={() => setImageData(null)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-gray-500 mb-2">
                  Sign in to upload images
                </div>
              )}
            </div>
            
            <button
              type="submit"
              className={`px-4 py-2 rounded transition ${
                currentUser && !isSubmitting
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-400 text-white cursor-not-allowed'
              }`}
              disabled={!currentUser || isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Thread'}
            </button>
          </form>
        </div>

        <div className="mb-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold">Discussions</h2>
          <div className="flex items-center space-x-2">
            <label htmlFor="sort-filter" className="text-sm text-gray-600">Sort by:</label>
            <select
              id="sort-filter"
              className="p-2 border rounded bg-white"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="newest">Newest</option>
              <option value="popular">Most Popular</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : threads.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-8 text-center">
            <h3 className="text-lg font-medium text-gray-700">No threads yet</h3>
            <p className="text-gray-500 mt-2">Be the first to start a discussion!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {threads.map((thread) => (
              <div key={thread.id} className="bg-white shadow rounded-lg overflow-hidden">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-semibold mb-2">{thread.title}</h3>
                      <p className="text-sm text-gray-500">
                        Posted by {thread.username} • {formatDate(thread.createdAt)}
                      </p>
                    </div>
                    {currentUser?.uid === thread.userId && (
                      <div>
                        {confirmDelete === thread.id ? (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => deleteThread(thread.id)}
                              className="text-red-600 hover:text-red-800 text-sm font-medium"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={cancelDelete}
                              className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => deleteThread(thread.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-gray-700 mb-4 whitespace-pre-line">{thread.content}</p>
                  
                  {thread.imageUrl && (
                    <div className="mb-4">
                      <ThreadImage 
                        imageUrl={thread.imageUrl}
                        imageId={thread.imageId}
                        shareUrl={thread.shareUrl}
                        webUrl={thread.webUrl}
                      />
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-4 mt-4">
                    <button
                      onClick={() => handleVote(thread.id, 'likes')}
                      className={`flex items-center space-x-1 px-3 py-1 rounded-full ${
                        currentUser ? 'hover:bg-green-100' : ''
                      }`}
                      disabled={!currentUser}
                      title={currentUser ? "Like this thread" : "Sign in to vote"}
                    >
                      <span role="img" aria-label="thumbs up">👍</span>
                      <span className="font-medium">{thread.likes}</span>
                    </button>
                    <button
                      onClick={() => handleVote(thread.id, 'dislikes')}
                      className={`flex items-center space-x-1 px-3 py-1 rounded-full ${
                        currentUser ? 'hover:bg-red-100' : ''
                      }`}
                      disabled={!currentUser}
                      title={currentUser ? "Dislike this thread" : "Sign in to vote"}
                    >
                      <span role="img" aria-label="thumbs down">👎</span>
                      <span className="font-medium">{thread.dislikes}</span>
                    </button>
                    <span className="text-sm text-gray-500">
                      {thread.comments?.length || 0} {thread.comments?.length === 1 ? 'comment' : 'comments'}
                    </span>
                  </div>
                </div>

                <div className="bg-gray-50 p-6 border-t">
                  <h4 className="font-semibold mb-4">Comments</h4>
                  {thread.comments?.length > 0 ? (
                    <div className="space-y-4 mb-4">
                      {thread.comments.map((comment) => (
                        <div key={comment.id} className="bg-white p-3 rounded shadow-sm">
                          <p className="text-gray-800">{comment.content}</p>
                          <div className="flex justify-between items-center mt-2">
                            <p className="text-xs text-gray-500">
                              By {comment.username}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatDate(comment.createdAt)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm mb-4">No comments yet. Be the first to comment!</p>
                  )}
                  
                  {currentUser ? (
                    <div className="mt-4">
                      <textarea
                        placeholder="Share your thoughts on this thread..."
                        className="w-full p-3 border rounded focus:ring-blue-500 focus:border-blue-500"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        disabled={isSubmitting}
                      />
                      <div className="mt-2">
                        <button
                          onClick={() => addComment(thread.id)}
                          className={`px-4 py-2 rounded transition ${
                            newComment.trim() && !isSubmitting
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-gray-400 text-white cursor-not-allowed'
                          }`}
                          disabled={!newComment.trim() || isSubmitting}
                        >
                          {isSubmitting ? 'Posting...' : 'Post Comment'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-blue-50 p-3 rounded text-sm text-blue-700">
                      Please sign in to add a comment.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CommunityForum;