// js/accounts/auth-gate.js
// Auth Gate - Modal overlay that appears on first visit requiring login

export class AuthGate {
    constructor() {
        this.authManager = window.authManager;
        this.modal = null;
        this.showEmailForm = false;
        this.isInitialized = false;
        
        if (!this.authManager) {
            console.error('AuthGate: authManager not found on window');
            return;
        }
        
        this.init();
    }
    
    init() {
        // Listen for auth state changes
        this.authManager.onAuthStateChanged((user) => {
            if (!this.isInitialized) {
                // First auth state check - only show if no user
                this.isInitialized = true;
                if (!user) {
                    this.show();
                }
            } else {
                // Subsequent changes
                if (user) {
                    this.hide();
                } else {
                    this.show();
                }
            }
        });
    }
    
    createModal() {
        if (this.modal) return this.modal;
        
        const modalHTML = `
            <div id="auth-gate-overlay" class="auth-gate-overlay">
                <div class="auth-gate-card">
                    <div class="auth-gate-header">
                        <h2 class="auth-gate-title">Welcome to Aether</h2>
                        <p class="auth-gate-subtitle">Sign in or create an account to continue</p>
                    </div>
                    
                    <div class="auth-gate-providers">
                        <button type="button" class="auth-provider-btn google" data-provider="google">
                            <svg class="provider-icon" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            <span>Continue with Google</span>
                        </button>
                        
                        <button type="button" class="auth-provider-btn github" data-provider="github">
                            <svg class="provider-icon" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-1.334-.451-1.143-1.068-1.453-1.068-1.453-.874-.597.066-.586.066-.586.969.068 1.479.996 1.479.996.86 1.473 2.259 1.048 2.804.801.088-.623.338-1.048.614-1.288-2.131-.243-4.369-1.065-4.369-1.065-.355-.896-.54-1.453-.54-1.453-.451-1.143-1.068-1.453-1.068-1.453-.874-.597.066-.586.066-.586.969.068 1.479.996 1.479.996.86 1.473 2.259 1.048 2.804.801.088-.623.338-1.048.614-1.288-2.131-.243-4.369-1.065-4.369-1.065-.355-.896-.54-1.453-.54-1.453-.451-1.143-1.068-1.453-1.068-1.453-.874-.597.066-.586.066-.586.969.068 1.479.996 1.479.996.86 1.473 2.259 1.048 2.804.801.088-.623.338-1.048.614-1.288 2.665-.305 5.467-1.334 5.467-1.334.451-1.143 1.068-1.453 1.068-1.453.874-.597-.066-.586-.066-.586-.969.068-1.479.996-1.479.996-.86-1.473-2.259-1.048-2.804-.801-.088.623-.338 1.048-.614 1.288 2.131.243 4.369 1.065 4.369 1.065.355.896.54 1.453.54 1.453.451 1.143 1.068 1.453 1.068 1.453.874.597-.066-.586-.066-.586-.969-.068-1.479-.996-1.479-.996-.86 1.473-2.259 1.048-2.804.801-.088-.623-.338-1.048-.614-1.288-2.131-.243-4.369-1.065-4.369-1.065-.355-.896-.54-1.453-.54-1.453-.451-1.143-1.068-1.453-1.068-1.453-.874-.597.066-.586.066-.586.969.068 1.479.996 1.479.996.86 1.473 2.259 1.048 2.804.801.088-.623.338-1.048.614-1.288z"/>
                            </svg>
                            <span>Continue with GitHub</span>
                        </button>
                        
                        <button type="button" class="auth-provider-btn discord" data-provider="discord">
                            <svg class="provider-icon" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                            </svg>
                            <span>Continue with Discord</span>
                        </button>
                        
                        <button type="button" class="auth-provider-btn spotify" data-provider="spotify">
                            <svg class="provider-icon" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                            </svg>
                            <span>Continue with Spotify</span>
                        </button>
                        
                        <button type="button" class="auth-provider-btn facebook" data-provider="facebook">
                            <svg class="provider-icon" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                            </svg>
                            <span>Continue with Facebook</span>
                        </button>
                        
                        <button type="button" class="auth-provider-btn email" data-provider="email">
                            <svg class="provider-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="2" y="4" width="20" height="16" rx="2"/>
                                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                            </svg>
                            <span>Continue with Email</span>
                        </button>
                    </div>
                    
                    <div id="auth-gate-email-form" class="auth-gate-email-form" style="display: none;">
                        <div class="email-form-header">
                            <button type="button" class="back-to-providers-btn" id="back-to-providers-btn">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="m15 18-6-6 6-6"/>
                                </svg>
                                Back
                            </button>
                            <h3 id="email-form-title">Sign In</h3>
                        </div>
                        
                        <form id="email-auth-form" class="email-auth-form">
                            <div class="form-group">
                                <label for="auth-email">Email</label>
                                <input type="email" id="auth-email" class="auth-input" placeholder="your@email.com" required />
                            </div>
                            
                            <div class="form-group">
                                <label for="auth-password">Password</label>
                                <input type="password" id="auth-password" class="auth-input" placeholder="••••••••" required />
                            </div>
                            
                            <div class="form-actions">
                                <button type="submit" class="auth-submit-btn" id="auth-submit-btn">Sign In</button>
                            </div>
                            
                            <div class="form-toggle">
                                <span id="form-toggle-text">Don't have an account?</span>
                                <button type="button" class="toggle-form-btn" id="toggle-form-btn">Sign Up</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
        
        const container = document.createElement('div');
        container.innerHTML = modalHTML.trim();
        this.modal = container.firstElementChild;
        
        return this.modal;
    }
    
    show() {
        if (!this.modal) {
            this.createModal();
            document.body.appendChild(this.modal);
            this.attachEventListeners();
        }
        this.modal.classList.add('visible');
        document.body.style.overflow = 'hidden';
    }
    
    hide() {
        if (this.modal) {
            this.modal.classList.remove('visible');
            document.body.style.overflow = '';
        }
    }
    
    attachEventListeners() {
        // Provider buttons
        this.modal.querySelectorAll('.auth-provider-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const provider = btn.dataset.provider;
                this.handleProviderClick(provider);
            });
        });
        
        // Back button
        const backBtn = this.modal.querySelector('#back-to-providers-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.showEmailForm = false;
                this.updateEmailFormVisibility();
            });
        }
        
        // Toggle between sign in and sign up
        const toggleBtn = this.modal.querySelector('#toggle-form-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                this.showEmailForm = !this.showEmailForm;
                this.updateFormMode();
            });
        }
        
        // Form submission
        const form = this.modal.querySelector('#email-auth-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleEmailSubmit();
            });
        }
    }
    
    handleProviderClick(provider) {
        if (!this.authManager) return;
        
        switch (provider) {
            case 'google':
                this.authManager.signInWithGoogle();
                break;
            case 'github':
                this.authManager.signInWithGitHub();
                break;
            case 'discord':
                this.authManager.signInWithDiscord();
                break;
            case 'spotify':
                this.authManager.signInWithSpotify();
                break;
            case 'facebook':
                this.authManager.signInWithFacebook();
                break;
            case 'email':
                this.showEmailForm = true;
                this.updateEmailFormVisibility();
                break;
        }
    }
    
    updateEmailFormVisibility() {
        const providersDiv = this.modal.querySelector('.auth-gate-providers');
        const emailForm = this.modal.querySelector('#auth-gate-email-form');
        
        if (this.showEmailForm) {
            providersDiv.style.display = 'none';
            emailForm.style.display = 'block';
        } else {
            providersDiv.style.display = 'flex';
            emailForm.style.display = 'none';
        }
    }
    
    updateFormMode() {
        const title = this.modal.querySelector('#email-form-title');
        const submitBtn = this.modal.querySelector('#auth-submit-btn');
        const toggleText = this.modal.querySelector('#form-toggle-text');
        const toggleBtn = this.modal.querySelector('#toggle-form-btn');
        
        if (this.showEmailForm) {
            // Sign Up mode
            title.textContent = 'Create Account';
            submitBtn.textContent = 'Sign Up';
            toggleText.textContent = 'Already have an account?';
            toggleBtn.textContent = 'Sign In';
        } else {
            // Sign In mode
            title.textContent = 'Sign In';
            submitBtn.textContent = 'Sign In';
            toggleText.textContent = "Don't have an account?";
            toggleBtn.textContent = 'Sign Up';
        }
    }
    
    async handleEmailSubmit() {
        const emailInput = this.modal.querySelector('#auth-email');
        const passwordInput = this.modal.querySelector('#auth-password');
        const submitBtn = this.modal.querySelector('#auth-submit-btn');
        
        if (!emailInput || !passwordInput || !submitBtn) return;
        
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        
        if (!email || !password) {
            alert('Please fill in all fields');
            return;
        }
        
        // Show loading state
        const originalText = submitBtn.textContent;
        submitBtn.textContent = this.showEmailForm ? 'Creating Account...' : 'Signing In...';
        submitBtn.disabled = true;
        
        try {
            if (this.showEmailForm) {
                await this.authManager.signUpWithEmail(email, password);
            } else {
                await this.authManager.signInWithEmail(email, password);
            }
            // Auth state change will trigger hide() automatically
        } catch (error) {
            console.error('Auth error:', error);
            // Error is handled by authManager
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }
}

// Initialize AuthGate when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Wait a bit for authManager to be available
        setTimeout(() => {
            if (window.authManager) {
                window.__AUTH_GATE__ = new AuthGate();
            }
        }, 100);
    });
} else {
    setTimeout(() => {
        if (window.authManager) {
            window.__AUTH_GATE__ = new AuthGate();
        }
    }, 100);
}
