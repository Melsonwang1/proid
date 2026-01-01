// Custom Authentication Module using Users Table
// Replace these with your actual Supabase project credentials
const SUPABASE_URL = 'https://brttakyichaccndpkotf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJydHRha3lpY2hhY2NuZHBrb3RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyMzU5NzQsImV4cCI6MjA4MjgxMTk3NH0.M9DbGAQAK2SwFl4oXuAoNjvI8c72UfaBol4zT39X_5U';

// Initialize Supabase client (for database access only, not auth)
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Session storage key
const SESSION_KEY = 'ease_user_session';

// Auth state change listeners
const authStateListeners = [];

// Simple hash function for password (for demo purposes - in production use proper hashing on backend)
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Sign up a new user
async function signupUser(userData) {
    try {
        console.log('Starting signup process for:', userData.email);
        
        // Check if user already exists
        const { data: existingUser, error: checkError } = await supabaseClient
            .from('users')
            .select('id')
            .eq('email', userData.email.toLowerCase())
            .single();

        if (existingUser) {
            return {
                success: false,
                error: 'An account with this email already exists. Please sign in instead.'
            };
        }

        // Hash the password
        const passwordHash = await hashPassword(userData.password);

        // Create user in custom users table
        const { data: newUser, error: insertError } = await supabaseClient
            .from('users')
            .insert([
                {
                    email: userData.email.toLowerCase(),
                    first_name: userData.firstName || '',
                    last_name: userData.lastName || '',
                    password_hash: passwordHash
                }
            ])
            .select()
            .single();

        if (insertError) {
            console.error('Insert error details:', insertError);
            return {
                success: false,
                error: 'Failed to create account. Please try again.'
            };
        }

        console.log('User created successfully:', newUser.id);

        // Create session
        const user = {
            id: newUser.id,
            email: newUser.email,
            first_name: newUser.first_name,
            last_name: newUser.last_name,
            created_at: newUser.created_at
        };
        
        setSession(user);
        notifyAuthStateChange('SIGNED_IN', user);

        return {
            success: true,
            user: user
        };

    } catch (error) {
        console.error('Signup error:', error);
        return {
            success: false,
            error: 'An unexpected error occurred. Please try again.'
        };
    }
}

// Sign in an existing user
async function signinUser(email, password) {
    try {
        // Hash the password
        const passwordHash = await hashPassword(password);

        // Find user by email and password
        const { data: user, error } = await supabaseClient
            .from('users')
            .select('id, email, first_name, last_name, created_at')
            .eq('email', email.toLowerCase())
            .eq('password_hash', passwordHash)
            .single();

        if (error || !user) {
            return {
                success: false,
                error: 'Invalid email or password. Please check your credentials.'
            };
        }

        // Create session
        setSession(user);
        notifyAuthStateChange('SIGNED_IN', user);

        return {
            success: true,
            user: user
        };

    } catch (error) {
        console.error('Signin error:', error);
        return {
            success: false,
            error: 'An unexpected error occurred. Please try again.'
        };
    }
}

// Sign out current user
async function signoutUser() {
    try {
        clearSession();
        notifyAuthStateChange('SIGNED_OUT', null);
        return { success: true };
    } catch (error) {
        console.error('Signout error:', error);
        return { success: false, error: 'Error signing out' };
    }
}

// Get current user from session
async function getCurrentUser() {
    try {
        const session = getSession();
        return session?.user || null;
    } catch (error) {
        console.error('Get user error:', error);
        return null;
    }
}

// Check authentication status
async function checkAuthStatus() {
    try {
        const session = getSession();
        return {
            authenticated: !!session?.user,
            user: session?.user || null
        };
    } catch (error) {
        console.error('Auth check error:', error);
        return { authenticated: false, user: null };
    }
}

// Session management functions
function setSession(user) {
    const session = {
        user: user,
        created_at: new Date().toISOString()
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function getSession() {
    try {
        const sessionStr = localStorage.getItem(SESSION_KEY);
        if (!sessionStr) return null;
        return JSON.parse(sessionStr);
    } catch (error) {
        console.error('Error reading session:', error);
        return null;
    }
}

function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}

// Listen for authentication state changes
function onAuthStateChange(callback) {
    authStateListeners.push(callback);
}

// Notify all listeners of auth state change
function notifyAuthStateChange(event, user) {
    const session = user ? { user } : null;
    authStateListeners.forEach(callback => {
        try {
            callback(event, session);
        } catch (error) {
            console.error('Error in auth state listener:', error);
        }
    });
}

// Helper function to format error messages
function getErrorMessage(error) {
    switch (error.message) {
        case 'User already registered':
            return 'An account with this email already exists. Please sign in instead.';
        case 'Invalid login credentials':
            return 'Invalid email or password. Please check your credentials.';
        case 'Email not confirmed':
            return 'Please check your email and click the confirmation link before signing in.';
        case 'Password should be at least 6 characters':
            return 'Password must be at least 6 characters long.';
        default:
            return error.message || 'An error occurred. Please try again.';
    }
}

// Initialize auth state monitoring when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Monitor authentication state changes
    onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN') {
            console.log('User signed in:', session.user);
        } else if (event === 'SIGNED_OUT') {
            console.log('User signed out');
            // Redirect to login if on protected page
            if (window.location.pathname.includes('dashboard')) {
                window.location.href = 'login.html';
            }
        }
    });
});

// Utility function to show notifications
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;

    // Add to page
    document.body.appendChild(notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Export supabase client for database access in other scripts
window.supabaseClient = supabaseClient;

// Export functions for use in other scripts
window.authUtils = {
    signupUser,
    signinUser,
    signoutUser,
    getCurrentUser,
    checkAuthStatus,
    onAuthStateChange,
    showNotification,
    supabaseClient
};