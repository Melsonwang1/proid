// Dark Mode Toggle Functionality
(function() {
    'use strict';
    
    // Initialize dark mode based on saved preference or system preference
    function initDarkMode() {
        const savedTheme = localStorage.getItem('ease-theme');
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
        }
        
        // Update navbar background based on theme
        updateNavbarForTheme();
    }
    
    // Update navbar background based on current theme
    function updateNavbarForTheme() {
        const navbar = document.querySelector('.navbar');
        if (!navbar) return;
        
        const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
        
        if (isDarkMode) {
            navbar.style.background = '#1a1a2e';
            navbar.style.boxShadow = window.scrollY > 50 ? '0 2px 20px rgba(0, 0, 0, 0.3)' : 'none';
        } else {
            navbar.style.background = window.scrollY > 50 ? 'rgba(255, 255, 255, 0.98)' : 'rgba(255, 255, 255, 0.95)';
            navbar.style.boxShadow = window.scrollY > 50 ? '0 2px 20px rgba(177, 156, 217, 0.1)' : 'none';
        }
    }
    
    // Toggle dark mode
    function toggleDarkMode() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('ease-theme', newTheme);
        
        // Update navbar background immediately
        updateNavbarForTheme();
        
        // Update toggle button aria-label for accessibility
        const toggleBtn = document.getElementById('darkModeToggle');
        if (toggleBtn) {
            toggleBtn.setAttribute('aria-label', 
                newTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
            );
        }
    }
    
    // Listen for system theme changes
    function listenForSystemThemeChanges() {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            // Only auto-switch if user hasn't manually set a preference
            if (!localStorage.getItem('ease-theme')) {
                document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
                updateNavbarForTheme();
            }
        });
    }
    
    // Initialize on page load
    initDarkMode();
    listenForSystemThemeChanges();
    
    // Set up toggle button when DOM is ready
    document.addEventListener('DOMContentLoaded', function() {
        const toggleBtn = document.getElementById('darkModeToggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', toggleDarkMode);
            
            // Set initial aria-label
            const currentTheme = document.documentElement.getAttribute('data-theme');
            toggleBtn.setAttribute('aria-label', 
                currentTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
            );
        }
        
        // Re-apply navbar styles after DOM is ready
        updateNavbarForTheme();
    });
    
    // Expose functions globally for manual triggering if needed
    window.toggleDarkMode = toggleDarkMode;
    window.updateNavbarForTheme = updateNavbarForTheme;
})();
