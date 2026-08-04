// ===== Theme Toggle Functionality =====
const themeToggle = document.getElementById('themeToggle');
const body = document.body;

// Check for saved theme preference or default to light mode
const currentTheme = localStorage.getItem('theme') || 'light';
if (currentTheme === 'dark') {
    body.classList.add('dark-theme');
    updateThemeIcon();
}

themeToggle.addEventListener('click', () => {
    body.classList.toggle('dark-theme');
    
    // Save theme preference
    const theme = body.classList.contains('dark-theme') ? 'dark' : 'light';
    localStorage.setItem('theme', theme);
    
    updateThemeIcon();
});

function updateThemeIcon() {
    const icon = themeToggle.querySelector('i');
    if (body.classList.contains('dark-theme')) {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    } else {
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
    }
}

// ===== Mobile Menu Toggle =====
const mobileMenuToggle = document.getElementById('mobileMenuToggle');
const nav = document.getElementById('nav');

mobileMenuToggle.addEventListener('click', () => {
    nav.classList.toggle('active');
    
    // Update icon
    const icon = mobileMenuToggle.querySelector('i');
    if (nav.classList.contains('active')) {
        icon.classList.remove('fa-bars');
        icon.classList.add('fa-times');
    } else {
        icon.classList.remove('fa-times');
        icon.classList.add('fa-bars');
    }
});

// Close mobile menu when clicking on a nav link
const navLinks = document.querySelectorAll('.nav-link');
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        nav.classList.remove('active');
        const icon = mobileMenuToggle.querySelector('i');
        icon.classList.remove('fa-times');
        icon.classList.add('fa-bars');
    });
});

// Close mobile menu when clicking outside
document.addEventListener('click', (e) => {
    if (!nav.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
        nav.classList.remove('active');
        const icon = mobileMenuToggle.querySelector('i');
        icon.classList.remove('fa-times');
        icon.classList.add('fa-bars');
    }
});

// ===== Track Order Functionality =====
const trackInput = document.getElementById('trackInput');
const trackBtn = document.getElementById('trackBtn');

trackBtn.addEventListener('click', handleTracking);
trackInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleTracking();
    }
});

function handleTracking() {
    const orderId = trackInput.value.trim();
    
    if (!orderId) {
        showNotification('Please enter an Order ID', 'error');
        return;
    }
    
    // Validate order ID format (NZ-XXXX)
    const orderIdPattern = /^NZ-\d{4}$/i;
    if (!orderIdPattern.test(orderId)) {
        showNotification('Invalid Order ID format. Use format: NZ-8402', 'error');
        return;
    }
    
    // TODO: Replace with actual API call to backend
    showNotification(`Tracking Order: ${orderId.toUpperCase()}...`, 'info');
    
    // Placeholder for API integration
    // fetch(`/api/track/${orderId}`)
    //     .then(response => response.json())
    //     .then(data => {
    //         showNotification(`Order Status: ${data.status}`, 'success');
    //     })
    //     .catch(error => {
    //         showNotification('Unable to track order. Please try again.', 'error');
    //     });
}

// ===== Notification System =====
function showNotification(message, type = 'info') {
    // Remove existing notification if any
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Add to body
    document.body.appendChild(notification);
    
    // Trigger animation
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Remove after 4 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 4000);
}

// ===== Smooth Scroll for Navigation Links =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        
        // Skip if href is just "#"
        if (href === '#') {
            e.preventDefault();
            return;
        }
        
        const target = document.querySelector(href);
        if (target) {
            e.preventDefault();
            const headerOffset = 80;
            const elementPosition = target.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
            
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    });
});

// ===== Header Scroll Effect =====
const header = document.getElementById('header');
let lastScroll = 0;

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 100) {
        header.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    } else {
        header.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
    }
    
    lastScroll = currentScroll;
});

// ===== Active Navigation Link Based on Scroll =====
const sections = document.querySelectorAll('section[id]');

function updateActiveNavLink() {
    const scrollPosition = window.pageYOffset + 150;
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.offsetHeight;
        const sectionId = section.getAttribute('id');
        
        if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
            navLinks.forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === `#${sectionId}`) {
                    link.classList.add('active');
                }
            });
        }
    });
}

window.addEventListener('scroll', updateActiveNavLink);

// ===== Animate Elements on Scroll =====
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe service cards and stat cards
document.querySelectorAll('.service-card, .stat-card').forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(30px)';
    card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(card);
});

// ===== Book Delivery Button Actions =====
const bookDeliveryButtons = document.querySelectorAll('.btn-danger, .btn-primary');

bookDeliveryButtons.forEach(button => {
    if (button.textContent.includes('Book')) {
        button.addEventListener('click', () => {
            // TODO: Replace with actual booking form or redirect to booking page
            showNotification('Redirecting to booking page...', 'info');
            // window.location.href = '/booking';
        });
    }
});

// ===== Service Link Actions =====
const serviceLinks = document.querySelectorAll('.service-link');

serviceLinks.forEach(link => {
    link.addEventListener('click', () => {
        const serviceName = link.closest('.service-card').querySelector('.service-title').textContent;
        // TODO: Replace with actual service page navigation
        showNotification(`Loading ${serviceName}...`, 'info');
        // window.location.href = `/services/${serviceName.toLowerCase().replace(/\s+/g, '-')}`;
    });
});

// ===== Floating WhatsApp Button Tooltip =====
const floatingWhatsapp = document.querySelector('.floating-whatsapp');

floatingWhatsapp.addEventListener('mouseenter', () => {
    floatingWhatsapp.setAttribute('data-tooltip', 'visible');
});

floatingWhatsapp.addEventListener('mouseleave', () => {
    floatingWhatsapp.removeAttribute('data-tooltip');
});

// ===== Page Load Animation =====
window.addEventListener('load', () => {
    document.body.style.opacity = '0';
    setTimeout(() => {
        document.body.style.transition = 'opacity 0.5s ease';
        document.body.style.opacity = '1';
    }, 100);
});
