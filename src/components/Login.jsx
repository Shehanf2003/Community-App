import  { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login, userRole } = useAuth();
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();

        try {
            setError('');
            setLoading(true);
            await login(email, password);
            navigate(userRole === 'admin' ? '/admin' : '/user');
        } catch (error) {
            setError('Failed to sign in: ' + error.message);
        }
        setLoading(false);
    }

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full">
                <div className="text-center">
                    <h1 className="text-[#1877f2] text-6xl font-bold mb-4">CommUnity</h1>
                    <p className="text-xl text-gray-700 mb-8">
                        Connect with friends and the world around you on Facebook.
                    </p>
                </div>

                <div className="bg-white p-4 rounded-lg shadow-md">
                    {error && (
                        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <input
                            type="email"
                            required
                            className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500"
                            placeholder="Email or phone number"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        
                        <input
                            type="password"
                            required
                            className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#1877f2] text-white py-3 px-4 rounded-md font-bold hover:bg-[#166fe5] transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Logging in...' : 'Log in'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Login;
