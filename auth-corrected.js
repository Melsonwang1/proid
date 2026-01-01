// Corrected Supabase Authentication Module (No Password Hash in Custom Table)
const SUPABASE_URL = 'https://brttakyichaccndpkotf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJydHRha3lpY2hhY2NuZHBrb3RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyMzU5NzQsImV4cCI6MjA4MjgxMTk3NH0.M9DbGAQAK2SwFl4oXuAoNjvI8c72UfaBol4zT39X_5U';

// Initialize Supabase client
const supabaseAuth = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Sign up a new user
async function signupUser(userData) {
    try {
        // Create user account with Supabase Auth (this handles password hashing internally)
        const { data: authData, error: authError } = await supabaseAuth.auth.signUp({
            email: userData.email,
            password: userData.password,
            options: {
                data: {
                    first_name: userData.firstName,
                    last_name: userData.lastName
                }
            }
        });

        if (authError) {
            return {
                success: false,
                error: getErrorMessage(authError)
            };
        }

        // If auth signup successful, add profile info to custom users table
        if (authData.user) {
            setTimeout(async () => {
                try {
                    const { error: insertError } = await supabaseAuth
                        .from('users')
                        .insert([
                            {
                                id: authData.user.id, // Same ID as Supabase Auth
                                email: userData.email,
                                first_name: userData.firstName,
                                last_name: userData.lastName
                                // No password_hash - Supabase Auth handles this in auth.users table
                            }
                        ]);

                    if (insertError) {
                        console.error('Error creating user profile record:', insertError);
                    } else {
                        console.log('User profile created successfully in custom table');
                    }
                } catch (tableError) {
                    console.error('Custom table insert failed:', tableError);
                }
            }, 1000);
        }

        return {
            success: true,
            user: authData.user,
            needsConfirmation: !authData.session
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
        const { data, error } = await supabaseAuth.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            if (error.message.includes('Invalid login credentials') || 
                error.message.includes('Email not confirmed')) {
                return {
                    success: false,
                    error: 'Invalid email or password, or email not confirmed. Please check your credentials and email confirmation.'
                };
            }
            
            return {
                success: false,
                error: getErrorMessage(error)
            };
        }

        return {
            success: true,
            user: data.user
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
        const { error } = await supabaseAuth.auth.signOut();
        if (error) {
            console.error('Signout error:', error);
            return { success: false, error: 'Error signing out' };
        }
        return { success: true };
    } catch (error) {
        console.error('Signout error:', error);
        return { success: false, error: 'Error signing out' };
    }
}

// Get current user
async function getCurrentUser() {
    try {
        const { data: { user }, error } = await supabaseAuth.auth.getUser();
        
        if (error) {
            console.error('Get user error:', error);
            return null;
        }
        
        return user;
    } catch (error) {
        console.error('Get user error:', error);
        return null;
    }
}

// Check authentication status
async function checkAuthStatus() {
    try {
        const { data: { session }, error } = await supabaseAuth.auth.getSession();
        
        if (error) {
            console.error('Session error:', error);
            return { authenticated: false, user: null };
        }
        
        return {
            authenticated: !!session,
            user: session?.user || null
        };
    } catch (error) {
        console.error('Auth check error:', error);
        return { authenticated: false, user: null };
    }
}

// Listen for authentication state changes
function onAuthStateChange(callback) {
    supabaseAuth.auth.onAuthStateChange((event, session) => {
        callback(event, session);
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
        case 'Signup requires a valid password':
            return 'Please enter a valid password.';
        default:
            return error.message || 'An error occurred. Please try again.';
    }
}

// Initialize auth state monitoring when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN') {
            console.log('User signed in:', session.user);
        } else if (event === 'SIGNED_OUT') {
            console.log('User signed out');
            if (window.location.pathname.includes('dashboard')) {
                window.location.href = 'login.html';
            }
        }
    });
});

// Utility function to show notifications
function showNotification(message, type = 'info') {
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Export functions for use in other scripts
window.authUtils = {
    signupUser,
    signinUser,
    signoutUser,
    getCurrentUser,
    checkAuthStatus,
    onAuthStateChange,
    showNotification
};