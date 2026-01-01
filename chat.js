// Chat JavaScript Module for EASE Platform
class BuddyChat {
    constructor() {
        this.supabase = null;
        this.currentUser = null;
        this.currentConversation = null;
        this.conversations = [];
        this.userProfiles = {};
        this.messages = [];
        this.messageSubscription = null;
        this.conversationSubscription = null;
        this.isEditingExistingProfile = false;
        
        this.init();
    }

    async init() {
        // Wait for auth utilities and supabase to be available
        await this.waitForDependencies();
        
        // Check authentication
        await this.checkAuthAndRedirect();
        
        // Initialize UI event listeners
        this.initEventListeners();
        
        // Load user profile and conversations
        await this.loadUserProfile();
        await this.loadConversations();
        
        // Setup real-time subscriptions
        this.setupRealtimeSubscriptions();
        
        console.log('🤝 Buddy Chat initialized successfully!');
    }

    async waitForDependencies() {
        let attempts = 0;
        const maxAttempts = 50;
        
        while ((!window.authUtils || !window.supabase) && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (window.authUtils && window.supabase) {
            // Use the supabase client for database access
            this.supabase = window.supabaseClient || window.supabase.createClient(
                'https://brttakyichaccndpkotf.supabase.co',
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJydHRha3lpY2hhY2NuZHBrb3RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyMzU5NzQsImV4cCI6MjA4MjgxMTk3NH0.M9DbGAQAK2SwFl4oXuAoNjvI8c72UfaBol4zT39X_5U'
            );
        } else {
            console.error('Failed to load required dependencies');
        }
    }

    async checkAuthAndRedirect() {
        try {
            // Use custom auth system from authUtils
            const user = await window.authUtils.getCurrentUser();
            
            if (!user) {
                console.log('User not authenticated, redirecting to login');
                window.location.href = 'login.html';
                return;
            }
            
            this.currentUser = user;
            console.log('User authenticated:', user.email);
        } catch (error) {
            console.error('Auth check error:', error);
            window.location.href = 'login.html';
        }
    }

    initEventListeners() {
        // Find buddy button
        const findBuddyBtn = document.getElementById('findBuddyBtn');
        findBuddyBtn?.addEventListener('click', () => this.handleFindBuddy());

        // Setup profile button
        const setupProfileBtn = document.getElementById('setupProfileBtn');
        setupProfileBtn?.addEventListener('click', () => this.showProfileModal());

        // Profile modal events
        const profileModalOverlay = document.getElementById('profileModalOverlay');
        const closeProfileModal = document.getElementById('closeProfileModal');
        const cancelProfileBtn = document.getElementById('cancelProfileBtn');
        const buddyProfileForm = document.getElementById('buddyProfileForm');

        closeProfileModal?.addEventListener('click', () => this.hideProfileModal());
        cancelProfileBtn?.addEventListener('click', () => this.hideProfileModal());
        profileModalOverlay?.addEventListener('click', (e) => {
            if (e.target === profileModalOverlay) {
                this.hideProfileModal();
            }
        });

        buddyProfileForm?.addEventListener('submit', (e) => this.handleProfileSubmit(e));

        // Add edit profile button listener if exists
        const editProfileBtn = document.getElementById('editProfileBtn');
        editProfileBtn?.addEventListener('click', () => this.editExistingProfile());

        // Message input events
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');

        if (!messageInput) {
            console.error('❌ Message input element not found!');
            return;
        }

        if (!sendBtn) {
            console.error('❌ Send button element not found!');
            return;
        }

        console.log('🎯 Message input element found:', messageInput);
        console.log('🎯 Message input properties:', {
            disabled: messageInput.disabled,
            readOnly: messageInput.readOnly,
            value: messageInput.value,
            placeholder: messageInput.placeholder
        });

        messageInput?.addEventListener('input', (e) => {
            // Handle input changes and button state
            this.handleMessageInputChange();
            
            // Auto-resize textarea
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
        });
        messageInput?.addEventListener('keydown', (e) => this.handleMessageKeydown(e));
        sendBtn?.addEventListener('click', () => this.sendMessage());
        
        // Ensure input is enabled and focusable
        if (messageInput) {
            messageInput.disabled = false;
            messageInput.readOnly = false;
            messageInput.focus();
            console.log('✅ Message input initialized and enabled');
        }
    }

    async loadUserProfile() {
        try {
            // Check if user profile already exists
            const { data: profile, error } = await this.supabase
                .from('user_profiles')
                .select('*')
                .eq('user_id', this.currentUser.id)
                .single();

            if (error && error.code !== 'PGRST116') { // Real error, not "not found"
                console.error('Error loading profile:', error);
                return null;
            }

            if (!profile || error?.code === 'PGRST116') {
                // No profile exists - show setup card so user can fill out the buddy profile form
                document.getElementById('buddySetupCard').style.display = 'block';
                document.getElementById('profileManagementCard').style.display = 'none';
                // Don't auto-create profile - let user fill out the form first
                return null;
            } else {
                // Profile exists - show profile management card
                document.getElementById('buddySetupCard').style.display = 'none';
                document.getElementById('profileManagementCard').style.display = 'block';
                return profile;
            }

        } catch (error) {
            console.error('Profile load error:', error);
            return null;
        }
    }

    async createBasicProfile() {
        try {
            // First check if user already has a profile (enforce one profile per user)
            const { data: existingProfile } = await this.supabase
                .from('user_profiles')
                .select('user_id')
                .eq('user_id', this.currentUser.id)
                .single();
                
            if (existingProfile) {
                console.log('User already has a profile, skipping creation');
                return; // User already has their one allowed profile
            }
            
            // Get user information from our custom users table (not auth)
            const { data: user, error: userError } = await this.supabase
                .from('users')
                .select('first_name, last_name, email')
                .eq('id', this.currentUser.id)
                .single();

            if (userError) {
                console.error('Error fetching user data from users table:', userError);
                
                // If user doesn't exist in users table, create them first
                if (userError.code === 'PGRST116') {
                    console.log('User not found in users table, creating user record first...');
                    await this.createUserRecord();
                    
                    // Try to get user data again
                    const { data: newUser, error: retryError } = await this.supabase
                        .from('users')
                        .select('first_name, last_name, email')
                        .eq('id', this.currentUser.id)
                        .single();
                        
                    if (retryError) {
                        console.error('Failed to create/fetch user record:', retryError);
                        return;
                    }
                    
                    // Use the newly created user data
                    const { error: profileError } = await this.supabase
                        .from('user_profiles')
                        .insert({
                            user_id: this.currentUser.id,
                            display_name: `${newUser.first_name || 'User'} ${newUser.last_name || ''}`.trim(),
                            is_active: true
                        });
                        
                    if (profileError && !profileError.message.includes('duplicate key value violates unique constraint')) {
                        console.error('Error creating basic profile:', profileError);
                    } else {
                        console.log('Created user record and basic profile successfully');
                    }
                }
                return;
            }

            // Create basic profile with user_id link (user's one and only profile)
            const { error } = await this.supabase
                .from('user_profiles')
                .insert({
                    user_id: this.currentUser.id,
                    display_name: `${user.first_name || 'User'} ${user.last_name || ''}`.trim(),
                    is_active: true
                });

            if (error) {
                if (error.message.includes('duplicate key value violates unique constraint') || 
                    error.message.includes('unique_user_profile')) {
                    console.log('User already has a profile (constraint enforced)');
                } else {
                    console.error('Error creating basic profile:', error);
                }
            } else {
                console.log('Created user\'s first and only profile');
            }

        } catch (error) {
            console.error('Basic profile creation error:', error);
        }
    }

    // Helper function to create user record if it doesn't exist
    async createUserRecord() {
        try {
            // User data comes from custom users table, not Supabase auth
            const user = this.currentUser;
            
            // User should already exist in users table from signup
            // This is just a fallback check
            const { data: existingUser } = await this.supabase
                .from('users')
                .select('id')
                .eq('id', user.id)
                .single();
                
            if (existingUser) {
                console.log('User already exists in users table');
                return;
            }
            
            const { error } = await this.supabase
                .from('users')
                .insert({
                    id: user.id,
                    email: user.email,
                    first_name: user.first_name || user.email.split('@')[0],
                    last_name: user.last_name || '',
                    password_hash: 'custom_auth'
                });
                
            if (error && !error.message.includes('duplicate key value violates unique constraint')) {
                console.error('Error creating user record:', error);
                throw error;
            } else {
                console.log('User record created successfully');
            }
        } catch (error) {
            console.error('Create user record error:', error);
            throw error;
        }
    }

    async loadConversations() {
        try {
            console.log('🔍 Loading conversations for user:', this.currentUser.id);
            
            const { data: conversations, error } = await this.supabase
                .from('conversations')
                .select(`
                    *,
                    buddy_pairs (
                        id,
                        user1_id,
                        user2_id,
                        status
                    )
                `)
                .or(`participant1_id.eq.${this.currentUser.id},participant2_id.eq.${this.currentUser.id}`)
                .order('last_activity', { ascending: false });

            console.log('🔍 Conversations query result:', { conversations, error });

            if (error) {
                console.error('Error loading conversations:', error);
                this.showEmptyConversations();
                return;
            }

            this.conversations = conversations || [];
            
            // Fetch user profiles for display names
            if (this.conversations.length > 0) {
                const userIds = this.conversations.map(conv => {
                    return conv.participant1_id === this.currentUser.id 
                        ? conv.participant2_id 
                        : conv.participant1_id;
                });
                
                const { data: profiles, error: profileError } = await this.supabase
                    .from('user_profiles')
                    .select('user_id, display_name')
                    .in('user_id', userIds);
                
                if (!profileError && profiles) {
                    this.userProfiles = {};
                    profiles.forEach(profile => {
                        this.userProfiles[profile.user_id] = profile.display_name || 'Unknown User';
                    });
                }
            }
            
            console.log('🔍 Loaded conversations:', this.conversations);
            console.log('🔍 Loaded user profiles:', this.userProfiles);
            this.renderConversations();
            
        } catch (error) {
            console.error('Conversations load error:', error);
            this.showEmptyConversations();
        }
    }

    renderConversations() {
        const conversationsList = document.getElementById('conversationsList');
        
        if (this.conversations.length === 0) {
            this.showEmptyConversations();
            return;
        }

        conversationsList.innerHTML = '';

        this.conversations.forEach(conversation => {
            const otherUserId = conversation.participant1_id === this.currentUser.id 
                ? conversation.participant2_id 
                : conversation.participant1_id;
            
            const conversationElement = this.createConversationElement(conversation, otherUserId);
            conversationsList.appendChild(conversationElement);
        });
    }

    createConversationElement(conversation, otherUserId) {
        const div = document.createElement('div');
        div.className = 'conversation-item';
        div.dataset.conversationId = conversation.id;
        div.dataset.otherUserId = otherUserId;

        // Get buddy name (you could fetch this from auth.users or user_profiles)
        const buddyName = this.getBuddyDisplayName(otherUserId);
        const lastMessage = conversation.messages?.content || 'No messages yet';
        const lastTime = conversation.last_activity ? this.formatTime(conversation.last_activity) : '';

        div.innerHTML = `
            <div class="conversation-avatar">
                <i class="fa-solid fa-user"></i>
            </div>
            <div class="conversation-details">
                <div class="conversation-name">${buddyName}</div>
                <div class="conversation-preview">${lastMessage}</div>
            </div>
            <div class="conversation-meta">
                <div class="conversation-time">${lastTime}</div>
            </div>
        `;

        div.addEventListener('click', () => {
            console.log('🖱️ Conversation clicked:', { conversationId: conversation.id, otherUserId, buddyName });
            this.selectConversation(conversation, otherUserId, buddyName);
        });
        
        return div;
    }

    getBuddyDisplayName(userId) {
        // Return cached display name or fallback
        return this.userProfiles?.[userId] || `Buddy ${userId.slice(0, 8)}`;
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 24 * 60 * 60 * 1000) { // Less than 24 hours
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diff < 7 * 24 * 60 * 60 * 1000) { // Less than 7 days
            return date.toLocaleDateString([], { weekday: 'short' });
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
    }

    showEmptyConversations() {
        const conversationsList = document.getElementById('conversationsList');
        conversationsList.innerHTML = `
            <div class="empty-conversations">
                <div style="text-align: center; padding: 40px 20px; color: var(--neutral-charcoal);">
                    <i class="fa-solid fa-comments" style="font-size: 48px; opacity: 0.3; margin-bottom: 15px; display: block;"></i>
                    <h3 style="margin: 0 0 10px 0; font-size: 16px;">No conversations yet</h3>
                    <p style="margin: 0; font-size: 14px; opacity: 0.7; line-height: 1.4;">Click "Find Buddy" to get matched with someone who shares your interests and support goals.</p>
                </div>
            </div>
        `;
    }

    async selectConversation(conversation, otherUserId, buddyName) {
        console.log('🎯 Selecting conversation:', conversation.id);
        
        try {
            // Update active conversation styling
            document.querySelectorAll('.conversation-item').forEach(item => {
                item.classList.remove('active');
            });
            document.querySelector(`[data-conversation-id="${conversation.id}"]`)?.classList.add('active');

            // Set current conversation
            this.currentConversation = {
                id: conversation.id,
                otherUserId: otherUserId,
                buddyName: buddyName
            };

            // Force show chat area
            this.forceEnableChatInput();

            // Update chat header
            const chatUserName = document.getElementById('chatUserName');
            const chatUserStatus = document.getElementById('chatUserStatus');
            
            if (chatUserName) chatUserName.textContent = buddyName;
            if (chatUserStatus) chatUserStatus.textContent = 'Online';

            // Load messages for this conversation
            await this.loadMessages(conversation.id);
            
        } catch (error) {
            console.error('❌ Error in selectConversation:', error);
        }
    }

    forceEnableChatInput() {
        console.log('🔧 Force enabling chat input...');
        
        // Show chat area
        const chatWelcome = document.getElementById('chatWelcome');
        const chatActive = document.getElementById('chatActive');
        
        console.log('🔧 Elements found:', { 
            chatWelcome: !!chatWelcome, 
            chatActive: !!chatActive 
        });
        
        if (chatWelcome) {
            chatWelcome.style.display = 'none';
            console.log('🔧 Hidden chat welcome');
        }
        
        if (chatActive) {
            chatActive.style.display = 'flex';
            chatActive.style.visibility = 'visible';
            console.log('🔧 Showed chat active area');
        }
        
        // Completely recreate the message input to bypass any interference
        this.recreateMessageInput();
        
        console.log('✅ Chat input should now be enabled');
    }

    recreateMessageInput() {
        console.log('🔄 Recreating message input element...');
        
        const oldInput = document.getElementById('messageInput');
        if (oldInput) {
            const parent = oldInput.parentNode;
            
            // Create new textarea
            const newInput = document.createElement('textarea');
            newInput.id = 'messageInput';
            newInput.placeholder = 'Type a supportive message...';
            newInput.rows = 1;
            newInput.maxLength = 1000;
            newInput.style.cssText = `
                width: 100%;
                border: none;
                outline: none;
                resize: none;
                background: transparent;
                font-family: inherit;
                font-size: 15px;
                line-height: 1.4;
                padding: 12px 0;
                color: var(--neutral-charcoal, #333);
                min-height: 24px;
                max-height: 120px;
            `;
            
            // Replace old input with new one
            parent.replaceChild(newInput, oldInput);
            
            // Add event listeners to new input
            newInput.addEventListener('input', (e) => {
                this.handleMessageInputChange();
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            });
            
            newInput.addEventListener('keydown', (e) => this.handleMessageKeydown(e));
            
            // Focus the new input
            newInput.focus();
            
            console.log('✅ Message input recreated and focused');
            
            // Update send button state
            this.handleMessageInputChange();
        }
    }

    async loadMessages(conversationId) {
        const messagesContainer = document.getElementById('chatMessages');
        messagesContainer.innerHTML = '<div class="message-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading messages...</div>';

        try {
            // Load all messages for this conversation
            const otherUserId = this.currentConversation.otherUserId;
            const { data: messages, error } = await this.supabase
                .from('messages')
                .select('*')
                .or(`and(sender_id.eq.${this.currentUser.id},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${this.currentUser.id})`)
                .order('sent_at', { ascending: true }); // Chronological order for conversation flow

            if (error) {
                console.error('Error loading messages:', error);
                messagesContainer.innerHTML = '<div class="message-loading">Error loading messages</div>';
                return;
            }

            this.messages = messages || [];
            this.renderMessages();
            this.scrollToBottom();

        } catch (error) {
            console.error('Messages load error:', error);
            messagesContainer.innerHTML = '<div class="message-loading">Error loading messages</div>';
        }
    }

    renderMessages() {
        const messagesContainer = document.getElementById('chatMessages');
        
        if (this.messages.length === 0) {
            messagesContainer.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--neutral-charcoal);">
                    <i class="fa-solid fa-message" style="font-size: 32px; opacity: 0.3; margin-bottom: 15px; display: block;"></i>
                    <p style="margin: 0; opacity: 0.7;">Start the conversation! Send a supportive message to your buddy.</p>
                </div>
            `;
            return;
        }

        messagesContainer.innerHTML = '';

        this.messages.forEach(message => {
            const messageElement = this.createMessageElement(message);
            messagesContainer.appendChild(messageElement);
        });
    }

    createMessageElement(message) {
        const div = document.createElement('div');
        const isSent = message.sender_id === this.currentUser.id;
        div.className = `message ${isSent ? 'sent' : 'received'}`;
        div.setAttribute('data-message-id', message.id);

        const time = new Date(message.sent_at).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        div.innerHTML = `
            <div class="message-content">
                <p class="message-text">${this.escapeHtml(message.content)}</p>
                <div class="message-time">${time}</div>
            </div>
        `;

        return div;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('chatMessages');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    handleMessageInputChange() {
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        
        const hasContent = messageInput.value.trim().length > 0;
        sendBtn.disabled = !hasContent || !this.currentConversation;
    }

    handleMessageKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.sendMessage();
        }
    }

    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const content = messageInput.value.trim();
        
        if (!content || !this.currentConversation) return;

        // Create temporary message for immediate display (optimistic UI)
        const tempMessageId = 'temp-' + Date.now();
        const tempMessage = {
            id: tempMessageId,
            sender_id: this.currentUser.id,
            recipient_id: this.currentConversation.otherUserId,
            content: content,
            sent_at: new Date().toISOString(),
            is_temp: true
        };

        // Add message immediately to UI
        this.messages.push(tempMessage);
        const messageElement = this.createMessageElement(tempMessage);
        document.getElementById('chatMessages').appendChild(messageElement);
        this.scrollToBottom();

        // Clear input immediately for better UX
        messageInput.value = '';
        messageInput.style.height = 'auto';

        // Disable send button temporarily
        const sendBtn = document.getElementById('sendBtn');
        sendBtn.disabled = true;

        try {
            console.log('📤 Sending message to:', this.currentConversation.otherUserId);
            
            const { data, error } = await this.supabase.rpc('send_message', {
                sender_uuid: this.currentUser.id,
                recipient_uuid: this.currentConversation.otherUserId,
                message_content: content,
                msg_type: 'text'
            });

            if (error) {
                console.error('Error sending message:', error);
                // Remove temp message on error
                this.messages = this.messages.filter(m => m.id !== tempMessageId);
                messageElement.remove();
                window.authUtils?.showNotification('Failed to send message', 'error');
                // Restore message to input on error
                messageInput.value = content;
                return;
            }

            console.log('✅ Message sent successfully, ID:', data);
            
            // Convert temp message to permanent one with real ID
            const realMessage = {
                ...tempMessage,
                id: data,
                is_temp: false
            };
            
            // Replace temp message with real one in the array
            this.messages = this.messages.map(m => 
                m.id === tempMessageId ? realMessage : m
            );
            
            // Update the DOM element
            const tempElement = document.querySelector(`[data-message-id="${tempMessageId}"]`);
            if (tempElement) {
                const newMessageElement = this.createMessageElement(realMessage);
                tempElement.replaceWith(newMessageElement);
            }
            
            this.scrollToBottom();
            
            // Focus back to input for better UX
            messageInput.focus();

        } catch (error) {
            console.error('Send message error:', error);
            // Remove temp message on error
            this.messages = this.messages.filter(m => m.id !== tempMessageId);
            messageElement.remove();
            window.authUtils?.showNotification('Failed to send message', 'error');
            messageInput.value = content;
        } finally {
            sendBtn.disabled = false;
            this.handleMessageInputChange(); // Re-check input state
        }
    }

    async handleFindBuddy() {
        try {
            // Direct database check to see if user has a profile
            const { data: existingProfile, error } = await this.supabase
                .from('user_profiles')
                .select('*')
                .eq('user_id', this.currentUser.id)
                .single();

            if (error && error.code !== 'PGRST116') {
                // Real error occurred
                console.error('Error checking for existing profile:', error);
                window.authUtils?.showNotification('Error checking profile. Please try again.', 'error');
                return;
            }

            if (!existingProfile || error?.code === 'PGRST116') {
                // No profile exists - user needs to create their one profile
                window.authUtils?.showNotification('Please create your profile first to find buddies.', 'info');
                this.isEditingExistingProfile = false;
                this.showProfileModal();
                return;
            }

            // Profile exists - proceed to find buddies
            console.log('Profile found, proceeding to find buddies...');
            await this.findAndMatchBuddy();
            
        } catch (error) {
            console.error('Handle find buddy error:', error);
            window.authUtils?.showNotification('Error checking profile. Please try again.', 'error');
        }
    }

    async findAndMatchBuddy() {
        const findBuddyBtn = document.getElementById('findBuddyBtn');
        const originalText = findBuddyBtn.innerHTML;
        
        findBuddyBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Finding Buddy...';
        findBuddyBtn.disabled = true;

        try {
            console.log('🔍 Searching for potential buddies for user:', this.currentUser.id);
            
            // First, let's test if the function exists
            const { data: testResult, error: testError } = await this.supabase
                .rpc('find_potential_buddies', { user_uuid: this.currentUser.id });

            console.log('🔍 Function test result:', { testResult, testError });

            if (testError) {
                console.error('❌ Function error:', testError);
                
                // If function doesn't exist, let's try a simple query instead
                console.log('🔍 Function failed, trying manual query...');
                
                const { data: manualResults, error: manualError } = await this.supabase
                    .from('user_profiles')
                    .select('user_id, interests, support_goals, is_available_as_buddy')
                    .neq('user_id', this.currentUser.id)
                    .eq('is_available_as_buddy', true);
                
                console.log('🔍 Manual query results:', manualResults);
                
                if (manualResults && manualResults.length > 0) {
                    // Simple matching - just pick the first available user
                    const buddy = manualResults[0];
                    console.log('🎯 Found buddy manually:', buddy);
                    await this.createBuddyPair(buddy.user_id);
                    return;
                } else {
                    window.authUtils?.showNotification('Database function error. Check console for details.', 'error');
                    return;
                }
            }

            if (!testResult || testResult.length === 0) {
                console.log('🔍 No results from function. Let\'s debug manually...');
                
                // Debug: Check all profiles and current user
                const { data: allProfiles, error: profileError } = await this.supabase
                    .from('user_profiles')
                    .select('user_id, interests, support_goals, is_available_as_buddy');
                
                console.log('🔍 All user profiles in database:', allProfiles);
                console.log('🔍 Current user ID:', this.currentUser.id);
                
                const { data: currentUserProfile, error: currentError } = await this.supabase
                    .from('user_profiles')
                    .select('user_id, interests, support_goals, is_available_as_buddy')
                    .eq('user_id', this.currentUser.id)
                    .single();
                
                console.log('🔍 Current user profile lookup:', { currentUserProfile, currentError });
                
                if (!currentUserProfile) {
                    window.authUtils?.showNotification('You need to create your profile first! Your user ID doesn\'t match any profile in the database.', 'error');
                    return;
                }
                
                // Manual fallback - find any available buddy
                const availableBuddies = allProfiles.filter(profile => 
                    profile.user_id !== this.currentUser.id && 
                    profile.is_available_as_buddy === true
                );
                
                console.log('🔍 Available buddies (manual search):', availableBuddies);
                
                if (availableBuddies.length > 0) {
                    console.log('🎯 Using manual matching - found buddy:', availableBuddies[0]);
                    await this.createBuddyPair(availableBuddies[0].user_id);
                    return;
                }
                
                window.authUtils?.showNotification('No available buddies found. Database function may need fixing.', 'info');
                return;
            }

            console.log('🎯 Found potential buddies:', testResult);

            // Auto-match with the best compatibility buddy
            const bestMatch = testResult[0];
            await this.createBuddyPair(bestMatch.potential_buddy_id);

        } catch (error) {
            console.error('Find buddy error:', error);
            window.authUtils?.showNotification('Error finding buddies: ' + error.message, 'error');
        } finally {
            findBuddyBtn.innerHTML = originalText;
            findBuddyBtn.disabled = false;
        }
    }

    async createBuddyPair(otherUserId) {
        try {
            // First, ensure both users exist in the users table (needed for foreign key constraint)
            console.log('🔍 Checking if users exist in users table...');
            
            const { data: currentUserExists, error: currentCheckError } = await this.supabase
                .from('users')
                .select('id')
                .eq('id', this.currentUser.id)
                .single();
            
            const { data: otherUserExists, error: otherCheckError } = await this.supabase
                .from('users')
                .select('id')
                .eq('id', otherUserId)
                .single();
                
            console.log('🔍 User existence check:', { 
                currentUser: currentUserExists, 
                otherUser: otherUserExists,
                currentError: currentCheckError,
                otherError: otherCheckError
            });
            
            // If users don't exist in users table, create them
            if (!currentUserExists && currentCheckError?.code === 'PGRST116') {
                console.log('🔧 Creating current user in users table...');
                await this.ensureUserExistsInUsersTable(this.currentUser.id);
            }
            
            if (!otherUserExists && otherCheckError?.code === 'PGRST116') {
                console.log('🔧 Creating other user in users table...');
                await this.ensureUserExistsInUsersTable(otherUserId);
            }
            
            console.log('🤝 Creating buddy pair...');
            const { data: pairId, error } = await this.supabase
                .rpc('create_buddy_pair', {
                    user1_uuid: this.currentUser.id,
                    user2_uuid: otherUserId
                });

            if (error) {
                console.error('Error creating buddy pair:', error);
                window.authUtils?.showNotification('Error creating buddy connection: ' + error.message, 'error');
                return;
            }

            window.authUtils?.showNotification('🎉 Great! You\'ve been matched with a new buddy!', 'success');
            
            // Reload conversations to show the new buddy
            await this.loadConversations();

        } catch (error) {
            console.error('Create buddy pair error:', error);
            window.authUtils?.showNotification('Error creating buddy connection: ' + error.message, 'error');
        }
    }

    async ensureUserExistsInUsersTable(userId) {
        try {
            // Get user info from auth system or create a basic entry
            const userEmail = userId === this.currentUser.id ? this.currentUser.email : `user-${userId}@temp.com`;
            
            const { error } = await this.supabase
                .from('users')
                .insert({
                    id: userId,
                    email: userEmail,
                    first_name: 'User',
                    last_name: 'Name',
                    password_hash: 'placeholder'
                });
                
            if (error && !error.message.includes('duplicate key')) {
                console.error('Error creating user in users table:', error);
                throw error;
            }
            
            console.log('✅ User created in users table:', userId);
        } catch (error) {
            console.error('Error ensuring user exists:', error);
            throw error;
        }
    }

    showProfileModal() {
        const modal = document.getElementById('profileModalOverlay');
        const modalTitle = modal.querySelector('.modal-header h2');
        
        // Update modal title based on whether this is first profile creation or editing
        if (this.isEditingExistingProfile) {
            modalTitle.innerHTML = '<i class="fa-solid fa-user-edit"></i> Update Your Profile';
        } else {
            modalTitle.innerHTML = '<i class="fa-solid fa-user-plus"></i> Create Your Profile (One Per Account)';
        }
        
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    async handleProfileSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        
        submitBtn.textContent = 'Saving...';
        submitBtn.disabled = true;

        try {
            // Check if profile already exists for this user (enforce one profile per user)
            const { data: existingProfile, error: checkError } = await this.supabase
                .from('user_profiles')
                .select('user_id, bio, interests, support_goals')
                .eq('user_id', this.currentUser.id)
                .single();

            if (checkError && checkError.code !== 'PGRST116') {
                console.error('Error checking existing profile:', checkError);
                window.authUtils?.showNotification('Error checking profile', 'error');
                return;
            }
            
            // If attempting to create a new profile when one already exists, prevent it
            if (existingProfile && !this.isEditingExistingProfile) {
                window.authUtils?.showNotification('You already have a profile! You can only update your existing profile.', 'error');
                this.hideProfileModal();
                return;
            }

            // Get form values
            const profileData = {
                user_id: this.currentUser.id, // Ensure user_id is set
                bio: formData.get('bio'),
                age_range: formData.get('ageRange'),
                timezone: formData.get('timezone'),
                preferred_communication: formData.get('preferredCommunication'),
                is_seeking_buddy: document.getElementById('isSeekingBuddy')?.checked || false,
                is_available_as_buddy: document.getElementById('isAvailableBuddy')?.checked || false,
                interests: this.getCheckedValues('interestsGroup'),
                support_goals: this.getCheckedValues('supportGoalsGroup'),
                updated_at: new Date().toISOString()
            };

            // Use update if profile exists, insert if it doesn't (enforce one profile per user)
            let result;
            if (existingProfile) {
                // Update existing profile - user can only have one profile
                result = await this.supabase
                    .from('user_profiles')
                    .update(profileData)
                    .eq('user_id', this.currentUser.id);
                    
                console.log('Updated existing profile for user:', this.currentUser.id);
            } else {
                // Insert new profile - ensure this is the user's first and only profile
                result = await this.supabase
                    .from('user_profiles')
                    .insert(profileData);
                    
                console.log('Created first profile for user:', this.currentUser.id);
            }

            if (result.error) {
                console.error('Error saving profile:', result.error);
                
                // Handle unique constraint violation - this enforces one profile per user
                if (result.error.message.includes('duplicate key value violates unique constraint') || 
                    result.error.message.includes('unique_user_profile')) {
                    window.authUtils?.showNotification('You can only have one profile! Please update your existing profile instead.', 'error');
                } else {
                    window.authUtils?.showNotification('Error saving profile', 'error');
                }
                return;
            }

            window.authUtils?.showNotification(
                existingProfile ? 'Profile updated successfully!' : 'Profile created successfully! This is your one and only profile.', 
                'success'
            );
            this.hideProfileModal();
            
            // Update UI to show profile management instead of setup
            if (!existingProfile) {
                document.getElementById('buddySetupCard').style.display = 'none';
                document.getElementById('profileManagementCard').style.display = 'block';
            }

            // Auto-find buddy if seeking
            if (profileData.is_seeking_buddy) {
                setTimeout(() => this.findAndMatchBuddy(), 1000);
            }

        } catch (error) {
            console.error('Profile submit error:', error);
            window.authUtils?.showNotification('Error saving profile', 'error');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    getCheckedValues(groupId) {
        const checkboxes = document.querySelectorAll(`#${groupId} input[type="checkbox"]:checked`);
        return Array.from(checkboxes).map(cb => cb.value);
    }

    async editExistingProfile() {
        try {
            // Load existing profile data
            const { data: profile, error } = await this.supabase
                .from('user_profiles')
                .select('*')
                .eq('user_id', this.currentUser.id)
                .single();

            if (error) {
                console.error('Error loading profile for editing:', error);
                window.authUtils?.showNotification('Error loading profile', 'error');
                return;
            }

            if (!profile) {
                window.authUtils?.showNotification('No profile found to edit', 'error');
                return;
            }

            // Set flag to indicate we're editing existing profile
            this.isEditingExistingProfile = true;

            // Populate form fields with existing data
            this.populateProfileForm(profile);

            // Show the modal
            this.showProfileModal();

        } catch (error) {
            console.error('Edit profile error:', error);
            window.authUtils?.showNotification('Error loading profile for editing', 'error');
        }
    }

    populateProfileForm(profile) {
        // Populate basic fields
        document.getElementById('bio').value = profile.bio || '';
        document.getElementById('ageRange').value = profile.age_range || '';
        document.getElementById('timezone').value = profile.timezone || '';
        document.getElementById('preferredCommunication').value = profile.preferred_communication || '';

        // Set checkboxes
        const seekingBuddy = document.getElementById('isSeekingBuddy');
        const availableBuddy = document.getElementById('isAvailableBuddy');
        if (seekingBuddy) seekingBuddy.checked = profile.is_seeking_buddy || false;
        if (availableBuddy) availableBuddy.checked = profile.is_available_as_buddy || false;

        // Set interests checkboxes
        if (profile.interests && Array.isArray(profile.interests)) {
            profile.interests.forEach(interest => {
                const checkbox = document.querySelector(`#interestsGroup input[value="${interest}"]`);
                if (checkbox) checkbox.checked = true;
            });
        }

        // Set support goals checkboxes
        if (profile.support_goals && Array.isArray(profile.support_goals)) {
            profile.support_goals.forEach(goal => {
                const checkbox = document.querySelector(`#supportGoalsGroup input[value="${goal}"]`);
                if (checkbox) checkbox.checked = true;
            });
        }
    }

    hideProfileModal() {
        document.getElementById('profileModalOverlay').style.display = 'none';
        document.body.style.overflow = '';
        
        // Reset form and editing flag
        document.getElementById('buddyProfileForm').reset();
        this.isEditingExistingProfile = false;
    }

    setupRealtimeSubscriptions() {
        if (!this.currentUser?.id) {
            console.error('❌ Cannot setup subscriptions: No current user');
            return;
        }
        
        console.log('🔗 Setting up real-time subscriptions for user:', this.currentUser.id);
        
        try {
            // Subscribe to messages where user is either sender or recipient
            this.messageSubscription = this.supabase
                .channel(`messages-${this.currentUser.id}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `sender_id=eq.${this.currentUser.id}`
                }, (payload) => {
                    console.log('📤 Real-time: Message sent by me:', payload.new);
                    this.handleNewMessage(payload.new);
                })
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `recipient_id=eq.${this.currentUser.id}`
                }, (payload) => {
                    console.log('📥 Real-time: Message received:', payload.new);
                    this.handleNewMessage(payload.new);
                })
                .subscribe((status, err) => {
                    if (err) {
                        console.error('❌ Message subscription error:', err);
                    } else {
                        console.log('📡 Message subscription status:', status);
                    }
                });

            // Subscribe to conversation updates
            this.conversationSubscription = this.supabase
                .channel(`conversations-${this.currentUser.id}`)
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'conversations',
                    filter: `participant1_id=eq.${this.currentUser.id}`
                }, (payload) => {
                    console.log('💬 Real-time: Conversation updated (participant1):', payload);
                    this.handleConversationUpdate(payload);
                })
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'conversations',
                    filter: `participant2_id=eq.${this.currentUser.id}`
                }, (payload) => {
                    console.log('💬 Real-time: Conversation updated (participant2):', payload);
                    this.handleConversationUpdate(payload);
                })
                .subscribe((status, err) => {
                    if (err) {
                        console.error('❌ Conversation subscription error:', err);
                    } else {
                        console.log('📡 Conversation subscription status:', status);
                    }
                });
                
        } catch (error) {
            console.error('❌ Error setting up real-time subscriptions:', error);
        }
    }

    handleNewMessage(message) {
        console.log('📨 New message received:', message);
        
        // Add message to current conversation if it matches
        if (this.currentConversation) {
            const isCurrentConversation = 
                (message.sender_id === this.currentUser.id && message.recipient_id === this.currentConversation.otherUserId) ||
                (message.sender_id === this.currentConversation.otherUserId && message.recipient_id === this.currentUser.id);
                
            if (isCurrentConversation) {
                // Avoid duplicate messages if already in our list
                const existingMessage = this.messages.find(m => m.id === message.id);
                if (!existingMessage) {
                    this.messages.push(message);
                    const messageElement = this.createMessageElement(message);
                    document.getElementById('chatMessages').appendChild(messageElement);
                    this.scrollToBottom();
                }
            }
        }

        // Update conversation list (refresh to show latest message)
        this.loadConversations();

        // Show notification if message is from someone else and not in current conversation
        if (message.sender_id !== this.currentUser.id && 
            (!this.currentConversation || 
             message.sender_id !== this.currentConversation.otherUserId)) {
            const senderName = this.userProfiles?.[message.sender_id] || 'Someone';
            window.authUtils?.showNotification(`New message from ${senderName}`, 'info');
        }
    }

    handleConversationUpdate(payload) {
        console.log('Conversation updated:', payload);
        // Refresh conversations list
        this.loadConversations();
    }

    destroy() {
        // Clean up subscriptions
        if (this.messageSubscription) {
            this.supabase.removeChannel(this.messageSubscription);
        }
        if (this.conversationSubscription) {
            this.supabase.removeChannel(this.conversationSubscription);
        }
    }
}

// Initialize chat when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.buddyChat = new BuddyChat();
    
    // Add global test function for debugging
    window.testChatInput = function() {
        console.log('🧪 Testing chat input...');
        if (window.buddyChat) {
            window.buddyChat.forceEnableChatInput();
        } else {
            console.error('❌ BuddyChat not initialized');
        }
    };
    
    console.log('💡 You can test chat input by calling: testChatInput()');
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (window.buddyChat) {
        window.buddyChat.destroy();
    }
});