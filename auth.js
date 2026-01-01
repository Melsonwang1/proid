// Supabase Authentication Module
// Replace these with your actual Supabase project credentials
const SUPABASE_URL = 'https://brttakyichaccndpkotf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJydHRha3lpY2hhY2NuZHBrb3RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyMzU5NzQsImV4cCI6MjA4MjgxMTk3NH0.M9DbGAQAK2SwFl4oXuAoNjvI8c72UfaBol4zT39X_5U';

// Initialize Supabase client
const supabaseAuth = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Sign up a new user
async function signupUser(userData) {
    try {
        // First, check if user already exists
        const { data: existingUser, error: checkError } = await supabaseAuth
            .from('users')
            .select('email')
            .eq('email', userData.email)
            .single();

        if (existingUser) {
            return {
                success: false,
                error: 'An account with this email already exists. Please sign in instead.'
            };
        }

        // Create user account with Supabase Auth
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

        // If auth signup successful, create user record in our custom table
        if (authData.user) {
            const { error: insertError } = await supabaseAuth
                .from('users')
                .insert([
                    {
                        id: authData.user.id,
                        email: userData.email,
                        first_name: userData.firstName,
                        last_name: userData.lastName,
                        password_hash: 'handled_by_supabase_auth' // Supabase handles password hashing
                    }
                ]);

            if (insertError) {
                console.error('Error creating user record:', insertError);
                // Note: Auth user was created but our custom table insert failed
                // You may want to handle this scenario based on your needs
            }
        }

        return {
            success: true,
            user: authData.user
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
            // Check if it's an invalid credentials error
            if (error.message.includes('Invalid login credentials') || 
                error.message.includes('Email not confirmed') ||
                error.message.includes('User not found')) {
                
                // Check if user exists in our database
                const { data: userData, error: userError } = await supabaseAuth
                    .from('users')
                    .select('email')
                    .eq('email', email)
                    .single();

                if (userError && userError.code === 'PGRST116') {
                    // User not found in our database
                    return {
                        success: false,
                        error: 'No account found with this email address. Please create an account first.'
                    };
                }
                
                return {
                    success: false,
                    error: 'Invalid email or password. Please check your credentials and try again.'
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