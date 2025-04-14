import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, LogIn, AlertTriangle } from 'lucide-react';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    const { login, userRole } = useAuth();
    const navigate = useNavigate();

    // Try to restore saved email from localStorage
    const [currentSlide, setCurrentSlide] = useState(0);
    const totalSlides = 5;
    
    useEffect(() => {
        const savedEmail = localStorage.getItem('commUnityEmail');
        if (savedEmail) {
            setEmail(savedEmail);
            setRememberMe(true);
        }
        
        // Auto slider for the CSS carousel
        const interval = setInterval(() => {
            setCurrentSlide(prevSlide => (prevSlide + 1) % totalSlides);
        }, 5000);
        
        return () => {
            clearInterval(interval);
        };
    }, []);
    
    const goToSlide = (slideIndex) => {
        setCurrentSlide(slideIndex);
    };
    
    const prevSlide = () => {
        setCurrentSlide(prev => (prev === 0 ? totalSlides - 1 : prev - 1));
    };
    
    const nextSlide = () => {
        setCurrentSlide(prev => (prev + 1) % totalSlides);
    };

    async function handleSubmit(e) {
        e.preventDefault();

        // Form validation
        if (!email.trim() || !password) {
            setError('Please enter both email and password');
            return;
        }

        try {
            setError('');
            setLoading(true);
            
            // Save email to localStorage if rememberMe is checked
            if (rememberMe) {
                localStorage.setItem('commUnityEmail', email);
            } else {
                localStorage.removeItem('commUnityEmail');
            }
            
            await login(email, password);
            navigate(userRole === 'admin' ? '/admin' : '/user');
        } catch (error) {
            let errorMessage = 'Failed to sign in';
            
            // Handle common auth errors with user-friendly messages
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                errorMessage = 'Invalid email or password';
            } else if (error.code === 'auth/too-many-requests') {
                errorMessage = 'Too many failed login attempts. Please try again later or reset your password';
            } else if (error.code === 'auth/network-request-failed') {
                errorMessage = 'Network error. Please check your internet connection';
            } else if (error.message) {
                errorMessage += ': ' + error.message;
            }
            
            setError(errorMessage);
        }
        setLoading(false);
    }

    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    return (
        <>
            {/* Custom Google Fonts */}
            <link 
                href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" 
                rel="stylesheet" 
            />
            
            {/* Custom CSS for modern slider effect */}
            <style dangerouslySetInnerHTML={{ __html: `
                .slider-container {
                    position: relative;
                    width: 100%;
                    height: 480px;
                    overflow: hidden;
                    border-radius: 12px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.15);
                }
                
                .slider-wrapper {
                    display: flex;
                    position: relative;
                    transition: transform 0.6s ease-in-out;
                    height: 100%;
                }
                
                .slide {
                    min-width: 100%;
                    background: white;
                    border-radius: 12px;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                    position: relative;
                    overflow: hidden;
                    transition: all 0.3s ease;
                }
                
                .slide.active {
                    z-index: 2;
                    transform: scale(1);
                }
                
                .slide:not(.active) {
                    opacity: 0.7;
                    transform: scale(0.9);
                }
                
                .slider-controls {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    z-index: 10;
                    pointer-events: none;
                }
                
                .slider-arrow {
                    width: 40px;
                    height: 40px;
                    background: white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    margin: 0 15px;
                    pointer-events: auto;
                    transition: all 0.3s ease;
                    color: #1877f2;
                }
                
                .slider-arrow:hover {
                    background: #f0f0f0;
                    transform: scale(1.1);
                }
                
                .slider-dots {
                    position: absolute;
                    bottom: 15px;
                    left: 0;
                    right: 0;
                    display: flex;
                    justify-content: center;
                    gap: 8px;
                    z-index: 10;
                }
                
                .slider-dot {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.5);
                    cursor: pointer;
                    transition: all 0.3s ease;
                }
                
                .slider-dot.active {
                    background: #1877f2;
                    transform: scale(1.2);
                }
                
                .avatar-circle {
                    width: 100px;
                    height: 100px;
                    border-radius: 50%;
                    overflow: hidden;
                    margin-bottom: 15px;
                    background: #f0f0f0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 3px solid #fff;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.1);
                }
                
                .avatar-circle img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                
                .apartment-title {
                    color: #1877f2;
                    font-size: 1.5rem;
                    font-weight: bold;
                    margin-bottom: 5px;
                    text-align: center;
                }
                
                .apartment-subtitle {
                    color: #5C5470;
                    font-size: 1rem;
                    font-weight: 500;
                    margin-bottom: 15px;
                    text-align: center;
                }
                
                .apartment-description {
                    text-align: center;
                    max-width: 80%;
                    color: #666;
                    font-size: 0.9rem;
                    line-height: 1.5;
                }
                
                .card-3d {
                    transition: all 0.3s ease;
                    box-shadow: 0 10px 20px rgba(0,0,0,0.1);
                }
                
                .card-3d:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 15px 30px rgba(0,0,0,0.2);
                }
            `}} />

            <div className="min-h-screen bg-gradient-to-b from-[#1877f2] to-blue-100 flex flex-col items-center justify-center p-4" style={{ fontFamily: "'Poppins', sans-serif" }}>
                <div className="max-w-6xl w-full">
                    {/* Community Title Above Login */}
                    <div className="text-center mb-8">
                        <div className="flex justify-center mb-4">
                            <img 
                                src="/cu1.png" 
                                alt="CommUnity Logo" 
                                className="h-16 w-16"
                            />
                        </div>
                        <h1 className="text-[#1877f2] text-5xl font-bold mb-4">CommUnity</h1>
                        <p className="text-xl text-gray-700">
                            "Connecting Neighbors, Building Community, Simplifying Living—Together, We Thrive!"
                        </p>
                    </div>
                    
                    <div className="flex flex-col md:flex-row gap-6">
                        {/* Left Section - CSS-only Modern Carousel */}
                        <div className="w-full md:w-1/2">
                            <div className="slider-container">
                                <div className="slider-wrapper" style={{ transform: `translateX(-${currentSlide * 100}%)` }}>
                                    {/* Slide 1 */}
                                    <div className={`slide ${currentSlide === 0 ? 'active' : ''}`}>
                                        
                                            <img src="/apartment2.jpg" alt="Sunset Apartments" />
                                       
                                        <h3 className="apartment-title">Sunshine Heights</h3>
                                        <h4 className="apartment-subtitle">Luxury Living</h4>
                                       
                                    </div>
                                    
                                    {/* Slide 2 */}
                                    <div className={`slide ${currentSlide === 1 ? 'active' : ''}`}>
                                        
                                            <img src="/apartment6.jpg" alt="Lakeside Condos" />
                                        
                                        <h3 className="apartment-title">Sunshine Heights</h3>
                                        <h4 className="apartment-subtitle">Waterfront Living</h4>
                                        
                                    </div>
                                    
                                    {/* Slide 3 */}
                                    <div className={`slide ${currentSlide === 2 ? 'active' : ''}`}>
                                        
                                            <img src="/apartment5.jpg" alt="Urban Lofts" />
                                        
                                        <h3 className="apartment-title">Urban Lofts</h3>
                                        <h4 className="apartment-subtitle">Downtown Living</h4>
                                      
                                    </div>
                                    
                                    {/* Slide 4 */}
                                    <div className={`slide ${currentSlide === 3 ? 'active' : ''}`}>
                                        
                                            <img src="/apartment7.jpg" alt="Green Valley Residences" />
                                        
                                        <h3 className="apartment-title">Sunshine Heights</h3>
                                        <h4 className="apartment-subtitle">Eco-Friendly Living</h4>
                                       
                                    </div>
                                    
                                    {/* Slide 5 */}
                                    <div className={`slide ${currentSlide === 4 ? 'active' : ''}`}>
                                        
                                            <img src="/apartment3.jpg" alt="Skyline Towers" />
                                        
                                        <h3 className="apartment-title">Sunshine Heights</h3>
                                        <h4 className="apartment-subtitle">High-Rise Living</h4>
                                        
                                    </div>
                                </div>
                                
                                <div className="slider-controls">
                                    <div className="slider-arrow" onClick={prevSlide}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                    </div>
                                    <div className="slider-arrow" onClick={nextSlide}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                    </div>
                                </div>
                                
                                <div className="slider-dots">
                                    {[...Array(totalSlides)].map((_, index) => (
                                        <div 
                                            key={index} 
                                            className={`slider-dot ${currentSlide === index ? 'active' : ''}`}
                                            onClick={() => goToSlide(index)}
                                        ></div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Right Login Section */}
                        <div className="w-full md:w-1/2">
                            <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200 card-3d">
                                <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">Sign In</h2>
                                
                                {error && (
                                    <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded flex items-start">
                                        <AlertTriangle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
                                        <span className="text-red-700">{error}</span>
                                    </div>
                                )}

                                <form onSubmit={handleSubmit} className="space-y-5">
                                    <div>
                                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                                            Email Address
                                        </label>
                                        <input
                                            id="email"
                                            type="email"
                                            required
                                            className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                            placeholder="Enter your email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            autoComplete="email"
                                        />
                                    </div>
                                    
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                                Password
                                            </label>
                                            <Link 
                                                to="/forgot-password" 
                                                className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
                                            >
                                                Forgot password?
                                            </Link>
                                        </div>
                                        <div className="relative">
                                            <input
                                                id="password"
                                                type={showPassword ? "text" : "password"}
                                                required
                                                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                                placeholder="Enter your password"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                autoComplete="current-password"
                                            />
                                            <button
                                                type="button"
                                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-600 hover:text-gray-800"
                                                onClick={togglePasswordVisibility}
                                                aria-label={showPassword ? "Hide password" : "Show password"}
                                            >
                                                {showPassword ? (
                                                    <EyeOff className="h-5 w-5" />
                                                ) : (
                                                    <Eye className="h-5 w-5" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center">
                                        <input
                                            id="remember-me"
                                            type="checkbox"
                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                            checked={rememberMe}
                                            onChange={(e) => setRememberMe(e.target.checked)}
                                        />
                                        <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                                            Remember me
                                        </label>
                                    </div>
                                    
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full bg-[#1877f2] text-white py-3 px-4 rounded-md font-bold hover:bg-[#166fe5] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 flex items-center justify-center"
                                    >
                                        {loading ? (
                                            <>
                                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Signing in...
                                            </>
                                        ) : (
                                            <>
                                                <LogIn className="h-5 w-5 mr-2" />
                                                Sign In
                                            </>
                                        )}
                                    </button>
                                </form>
                                
                               
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="mt-8 text-center text-sm text-gray-500">
                    <p>© {new Date().getFullYear()} CommUnity. All rights reserved.</p>
                    <div className="mt-2 space-x-4">
                        <Link to="/terms" className="text-gray-600 hover:text-gray-900">Terms of Service</Link>
                        <Link to="/privacy" className="text-gray-600 hover:text-gray-900">Privacy Policy</Link>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Login;