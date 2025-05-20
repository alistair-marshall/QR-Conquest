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

// Show a toast notification
function showToast(message, type = 'info', duration = 5000) {
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
  messageElem.textContent = message;
  toast.appendChild(messageElem);
  
  // Add close button
  const closeButton = document.createElement('button');
  closeButton.className = 'ml-3 flex-shrink-0 text-white focus:outline-none';
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
  
  // Auto-dismiss after duration
  if (duration > 0) {
    setTimeout(() => removeToast(toast), duration);
  }
  
  return toast;
}

// Remove a toast with animation
function removeToast(toast) {
  toast.classList.add('opacity-0', 'translate-x-full');
  
  toast.addEventListener('transitionend', () => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  });
}

// Function to replace all alert() calls
function showNotification(message, type = 'info') {
  return showToast(message, type);
}

// Export functions for global use
window.showToast = showToast;
window.showNotification = showNotification;
