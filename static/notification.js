// Toast Notification System

// Create notification container if it doesn't exist
function createNotificationContainer() {
  let container = document.getElementById('notification-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notification-container';
    container.className = 'fixed top-0 right-0 p-4 z-50 space-y-2 max-w-md';
    document.body.appendChild(container);
  }
  return container;
}

// Standardised notification durations
const NOTIFICATION_DURATIONS = {
  'success': 4000,   // Success messages - shorter duration
  'info': 5000,      // Info messages - standard duration
  'warning': 7000,   // Warnings - longer duration
  'error': 8000      // Errors - longest duration
};

// Show a toast notification with standardised behaviour
function showToast(message, type = 'info', customDuration = null) {
  // Validate notification type
  const validTypes = ['success', 'error', 'warning', 'info'];
  if (!validTypes.includes(type)) {
    console.warn(`Invalid notification type '${type}', defaulting to 'info'`);
    type = 'info';
  }

  // Use standardised duration unless custom duration provided
  const duration = customDuration !== null ? customDuration : NOTIFICATION_DURATIONS[type];

  const container = createNotificationContainer();
  
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `transform transition-all duration-300 ease-out translate-x-full opacity-0 flex items-center p-4 rounded-lg shadow-lg max-w-sm`;
  
  // Set background color based on type
  switch (type) {
    case 'success':
      toast.classList.add('bg-green-600', 'text-white');
      break;
    case 'error':
      toast.classList.add('bg-red-600', 'text-white');
      break;
    case 'warning':
      toast.classList.add('bg-amber-500', 'text-white');
      break;
    case 'info':
    default:
      toast.classList.add('bg-blue-600', 'text-white');
      break;
  }
  
  // Add icon based on type
  const icon = document.createElement('i');
  
  switch (type) {
    case 'success':
      icon.setAttribute('data-lucide', 'check-circle');
      break;
    case 'error':
      icon.setAttribute('data-lucide', 'alert-circle');
      break;
    case 'warning':
      icon.setAttribute('data-lucide', 'alert-triangle');
      break;
    case 'info':
    default:
      icon.setAttribute('data-lucide', 'info');
      break;
  }
  
  icon.className = 'mr-3 flex-shrink-0';
  toast.appendChild(icon);
  
  // Add message
  const messageElem = document.createElement('div');
  messageElem.className = 'flex-grow text-sm';
  // Handle both plain text and simple HTML formatting
  if (message.includes('\n')) {
    // Convert line breaks to HTML breaks for better formatting
    messageElem.innerHTML = message.replace(/\n/g, '<br>');
  } else {
    messageElem.textContent = message;
  }
  toast.appendChild(messageElem);
  
  // Add close button
  const closeButton = document.createElement('button');
  closeButton.className = 'ml-3 flex-shrink-0 text-white focus:outline-none hover:opacity-70 transition-opacity';
  closeButton.setAttribute('aria-label', 'Close notification');
  closeButton.addEventListener('click', () => removeToast(toast));
  
  const closeIcon = document.createElement('i');
  closeIcon.setAttribute('data-lucide', 'x');
  closeIcon.className = 'h-4 w-4';
  closeButton.appendChild(closeIcon);
  
  toast.appendChild(closeButton);
  
  // Add toast to container
  container.appendChild(toast);
  
  // Initialize Lucide icons if available
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
  
  // Trigger entrance animation (after a small delay to ensure DOM update)
  setTimeout(() => {
    toast.classList.remove('translate-x-full', 'opacity-0');
  }, 10);
  
  // Auto-dismiss after duration (if duration > 0)
  if (duration > 0) {
    setTimeout(() => removeToast(toast), duration);
  }
  
  return toast;
}

// Remove a toast with animation
function removeToast(toast) {
  // Prevent double removal
  if (toast.dataset.removing === 'true') {
    return;
  }
  toast.dataset.removing = 'true';
  
  toast.classList.add('opacity-0', 'translate-x-full');
  
  // Clean up after transition completes
  const handleTransitionEnd = () => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
    toast.removeEventListener('transitionend', handleTransitionEnd);
  };
  
  toast.addEventListener('transitionend', handleTransitionEnd);
  
  // Fallback cleanup in case transition event doesn't fire
  setTimeout(() => {
    if (toast.parentNode && toast.dataset.removing === 'true') {
      toast.parentNode.removeChild(toast);
    }
  }, 1000);
}

// Standardised notification function - primary interface
function showNotification(message, type = 'info', duration = null) {
  // Input validation
  if (!message || typeof message !== 'string') {
    console.warn('showNotification requires a valid message string');
    return null;
  }
  
  // Clean up the message - remove excessive whitespace
  const cleanMessage = message.trim().replace(/\s+/g, ' ');
  
  // Log notification for debugging (except in production)
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    console.log(`Notification [${type.toUpperCase()}]: ${cleanMessage}`);
  }
  
  return showToast(cleanMessage, type, duration);
}

// Clear all notifications
function clearAllNotifications() {
  const container = document.getElementById('notification-container');
  if (container) {
    // Remove all toast elements
    const toasts = container.querySelectorAll('div[class*="transform"]');
    toasts.forEach(toast => removeToast(toast));
  }
}

// Utility function to show loading notification that can be manually dismissed
function showLoadingNotification(message = 'Loading...') {
  return showNotification(message, 'info', 0); // Duration 0 = manual dismiss only
}

// Utility function to show persistent notification (manual dismiss only)
function showPersistentNotification(message, type = 'info') {
  return showNotification(message, type, 0); // Duration 0 = manual dismiss only
}

// Error logging with notification (for development/debugging)
function logAndNotifyError(error, userMessage = null) {
  // Log the full error for debugging
  console.error('Application error:', error);
  
  // Show user-friendly message
  const displayMessage = userMessage || 'An unexpected error occurred. Please try again.';
  showNotification(displayMessage, 'error');
}

// Legacy compatibility - keep for backwards compatibility but mark as deprecated
function showAlert(message) {
  console.warn('showAlert is deprecated. Use showNotification instead.');
  return showNotification(message, 'info');
}

// Export functions for global use
window.showToast = showToast;
window.showNotification = showNotification;
window.clearAllNotifications = clearAllNotifications;
window.showLoadingNotification = showLoadingNotification;
window.showPersistentNotification = showPersistentNotification;
window.logAndNotifyError = logAndNotifyError;

// Legacy exports (deprecated but maintained for compatibility)
window.showAlert = showAlert;