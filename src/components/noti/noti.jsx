src/components/noti/noti.jsxconst AdminDashboard = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('user');
    const [users, setUsers] = useState([]);
    const [announcements, setAnnouncements] = useState([]);
    const [maintenanceRequests, setMaintenanceRequests] = useState([]);
    const [newAnnouncement, setNewAnnouncement] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');