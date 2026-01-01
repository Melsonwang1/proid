# EASE Platform - Supabase Authentication Setup

## Step 1: Set up Supabase Project

1. Go to [supabase.com](https://supabase.com) and create an account
2. Click "New Project"
3. Choose your organization and enter project details:
   - Name: EASE Platform
   - Database Password: (create a secure password)
   - Region: Choose the closest to your users
4. Click "Create new project" and wait for setup to complete

## Step 2: Create the Users Table

1. In your Supabase dashboard, go to "SQL Editor"
2. Copy and paste the SQL from `users_table.sql`
3. Click "Run" to create the table

## Step 3: Configure Authentication Settings

1. Go to Authentication → Settings in your Supabase dashboard
2. Configure the following:
   - **Site URL**: Add your Vercel domain (e.g., `https://proid.vercel.app`)
   - **Redirect URLs**: Add:
     - `https://proid.vercel.app/login.html`
     - `https://proid.vercel.app/signup.html`
     - `https://proid.vercel.app/index.html`
   - **Email Templates**: Customize if needed
   - **Email Confirmation**: Enable this for security

## Step 4: Get Your Supabase Credentials

1. Go to Settings → API in your Supabase dashboard
2. Copy the following values:
   - **Project URL** (looks like: `https://yourproject.supabase.co`)
   - **Public anon key** (long string starting with `eyJ`)

## Step 5: Update Your Code

1. Open `auth.js` file
2. Replace the placeholder values:
   ```javascript
   const SUPABASE_URL = 'https://yourproject.supabase.co';
   const SUPABASE_ANON_KEY = 'your_public_anon_key_here';
   ```

## Step 6: Test the Authentication

1. Deploy your updated code to Vercel:
   ```bash
   vercel --prod
   ```
2. Go to your website and test:
   - Create a new account on `signup.html`
   - Try logging in with wrong credentials (should show "need to create account")
   - Try logging in with correct credentials
   - Check your Supabase dashboard → Authentication → Users to see created users

## Step 7: Row Level Security (RLS)

The SQL script automatically enables RLS with these policies:
- Users can only view/update their own profile data
- New users can insert their profile data
- Authentication is handled by Supabase's built-in auth

## Troubleshooting

### Common Issues:

1. **CORS Errors**: Make sure your site URL is correctly configured in Supabase
2. **Authentication Errors**: Check that your credentials are correctly set in `auth.js`
3. **User Not Found**: The script checks both Supabase auth and your custom users table

### Testing Tips:

1. Open browser dev tools → Console to see any error messages
2. Check Supabase dashboard → Logs for server-side errors
3. Verify email confirmation is working if enabled

## Security Notes

- The public anon key is safe to expose in frontend code
- Never expose your service role key in frontend code
- RLS policies protect user data even with the anon key
- Always use HTTPS in production

## Next Steps

Once authentication is working:
1. Create user dashboard/profile pages
2. Add password reset functionality
3. Implement user preferences
4. Add support group membership features
5. Create therapy session booking

## Files Modified

- `login.html` - Updated with Supabase authentication
- `signup.html` - New user registration page
- `auth.js` - Supabase authentication functions
- `styles.css` - Added notification and form styles
- `users_table.sql` - Database schema for users