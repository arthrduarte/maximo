import { supabase } from './supabase.js';
import { initParticlesBackground } from './particles-background.js';

// Initialize particles background with a slight delay to ensure the script is loaded
setTimeout(initParticlesBackground, 100);

// DOM Elements
const phoneForm = document.getElementById('phoneForm');
const verificationForm = document.getElementById('verificationForm');
const successMessage = document.getElementById('successMessage');
const phone = document.getElementById('phone');
const countryCode = document.getElementById('countryCode');
const firstName = document.getElementById('first_name');
const lastName = document.getElementById('last_name');
const email = document.getElementById('email');
const sendCode = document.getElementById('sendCode');
const verifyCode = document.getElementById('verifyCode');
const resendCode = document.getElementById('resendCode');
const verificationInput = document.getElementById('verificationInput');

let formattedPhone = '';
let userFirstName = '';
let userLastName = '';
let userEmail = '';
let loading = false;

// Initialize phone mask with dynamic pattern based on country
let phoneMask;

// Country code mapping for common countries
const countryCodeMap = {
    // North America
    'US': '+1',   // United States
    'CA': '+1',   // Canada
    'MX': '+52',  // Mexico
    
    // Europe
    'GB': '+44',  // United Kingdom
    'FR': '+33',  // France
    'DE': '+49',  // Germany
    'IT': '+39',  // Italy
    'ES': '+34',  // Spain
    'NL': '+31',  // Netherlands
    'BE': '+32',  // Belgium
    'CH': '+41',  // Switzerland
    'AT': '+43',  // Austria
    'SE': '+46',  // Sweden
    'NO': '+47',  // Norway
    'DK': '+45',  // Denmark
    'FI': '+358', // Finland
    'PT': '+351', // Portugal
    'IE': '+353', // Ireland
    'GR': '+30',  // Greece
    'PL': '+48',  // Poland
    'RO': '+40',  // Romania
    'HU': '+36',  // Hungary
    'CZ': '+420', // Czech Republic
    'BG': '+359', // Bulgaria
    'HR': '+385', // Croatia
    'SK': '+421', // Slovakia
    'LT': '+370', // Lithuania
    'LV': '+371', // Latvia
    'EE': '+372', // Estonia
    'IS': '+354', // Iceland
    'LU': '+352', // Luxembourg
    'MT': '+356', // Malta
    'CY': '+357', // Cyprus
    'RS': '+381', // Serbia
    'SI': '+386', // Slovenia
    'UA': '+380', // Ukraine
    'RU': '+7',   // Russia
    
    // Asia
    'CN': '+86',  // China
    'JP': '+81',  // Japan
    'IN': '+91',  // India
    'KR': '+82',  // South Korea
    'SG': '+65',  // Singapore
    'MY': '+60',  // Malaysia
    'ID': '+62',  // Indonesia
    'TH': '+66',  // Thailand
    'VN': '+84',  // Vietnam
    'PH': '+63',  // Philippines
    'PK': '+92',  // Pakistan
    'BD': '+880', // Bangladesh
    'HK': '+852', // Hong Kong
    'TW': '+886', // Taiwan
    'IL': '+972', // Israel
    'AE': '+971', // United Arab Emirates
    'SA': '+966', // Saudi Arabia
    'QA': '+974', // Qatar
    'KW': '+965', // Kuwait
    'BH': '+973', // Bahrain
    'JO': '+962', // Jordan
    'LB': '+961', // Lebanon
    'KZ': '+7',   // Kazakhstan
    'UZ': '+998', // Uzbekistan
    
    // South America
    'BR': '+55',  // Brazil
    'AR': '+54',  // Argentina
    'CL': '+56',  // Chile
    'CO': '+57',  // Colombia
    'PE': '+51',  // Peru
    'VE': '+58',  // Venezuela
    'EC': '+593', // Ecuador
    'UY': '+598', // Uruguay
    'PY': '+595', // Paraguay
    'BO': '+591', // Bolivia
    
    // Oceania
    'AU': '+61',  // Australia
    'NZ': '+64',  // New Zealand
    'FJ': '+679', // Fiji
    'PG': '+675', // Papua New Guinea
    
    // Africa
    'ZA': '+27',  // South Africa
    'EG': '+20',  // Egypt
    'MA': '+212', // Morocco
    'NG': '+234', // Nigeria
    'KE': '+254', // Kenya
    'GH': '+233', // Ghana
    'TZ': '+255', // Tanzania
    'ET': '+251', // Ethiopia
    'DZ': '+213', // Algeria
    'TN': '+216', // Tunisia
    'SN': '+221', // Senegal
    'CI': '+225', // Côte d'Ivoire
    'CM': '+237', // Cameroon
    'ZW': '+263', // Zimbabwe
    'UG': '+256', // Uganda
    'MU': '+230', // Mauritius
    
    // Central America & Caribbean
    'MX': '+52',  // Mexico (already listed in North America)
    'CR': '+506', // Costa Rica
    'PA': '+507', // Panama
    'DO': '+1',   // Dominican Republic
    'JM': '+1',   // Jamaica
    'TT': '+1',   // Trinidad and Tobago
    'BS': '+1',   // Bahamas
    'GT': '+502', // Guatemala
    'HN': '+504', // Honduras
    'SV': '+503', // El Salvador
    'NI': '+505', // Nicaragua
    'BB': '+1',   // Barbados
    'PR': '+1',   // Puerto Rico
    
    // Other regions
    'TR': '+90',  // Turkey
    'GE': '+995', // Georgia
    'AM': '+374', // Armenia
    'AZ': '+994', // Azerbaijan
    'BY': '+375', // Belarus
    'MD': '+373'  // Moldova
};

// Helper function to capitalize the first letter of a string
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

// Function to detect user's country and set the appropriate country code
async function detectUserCountry() {
    try {
        // Use geojs.io for IP geolocation
        const response = await fetch('https://get.geojs.io/v1/ip/geo.json');
        const data = await response.json();
        
        console.log('GeoJS response:', data); // Debug log
        
        if (data && data.country_code) {
            const detectedCountryCode = data.country_code;
            console.log('Detected country code:', detectedCountryCode);
            
            // Get the phone code from our mapping
            const phoneCode = countryCodeMap[detectedCountryCode];
            console.log('Mapped to phone code:', phoneCode);
            
            // If we have a phone code for this country and the dropdown exists
            if (phoneCode && countryCode) {
                // Find the option with the matching data-country attribute
                const options = countryCode.querySelectorAll('option');
                let found = false;
                
                for (let i = 0; i < options.length; i++) {
                    if (options[i].getAttribute('data-country') === detectedCountryCode) {
                        console.log('Found matching option at index:', i);
                        countryCode.selectedIndex = i;
                        found = true;
                        break;
                    }
                }
                
                // If no exact match was found, fall back to setting by value
                if (!found) {
                    console.log('No exact match found, setting by value');
                    countryCode.value = phoneCode;
                }
                
                console.log('Selected country code:', countryCode.value);
                console.log('Selected index:', countryCode.selectedIndex);
                
                // Update the phone mask based on the detected country
                updatePhoneMask(phoneCode);
            } else {
                console.log('No phone code mapping found for country:', detectedCountryCode);
                fallbackToLanguageDetection();
            }
        } else {
            console.log('No country code detected from IP, falling back to language detection');
            // Fallback to browser language if IP geolocation fails
            fallbackToLanguageDetection();
        }
    } catch (error) {
        console.error('Error detecting country:', error);
        // Fall back to browser language detection
        fallbackToLanguageDetection();
    }
}

// Fallback function to detect country based on browser language
function fallbackToLanguageDetection() {
    try {
        // Get browser language (e.g., 'en-US', 'fr-FR')
        const language = navigator.language || navigator.userLanguage;
        console.log('Browser language:', language);
        
        if (language && language.includes('-')) {
            // Extract country code from language (e.g., 'US' from 'en-US')
            const country = language.split('-')[1];
            console.log('Extracted country from language:', country);
            
            // Get the phone country code from our mapping
            const detectedCountryCode = countryCodeMap[country];
            console.log('Mapped to country code:', detectedCountryCode);
            
            // If we have a country code for this country, select it in the dropdown
            if (detectedCountryCode && countryCode) {
                // Find the option with the matching data-country attribute
                const options = countryCode.querySelectorAll('option');
                let found = false;
                
                for (let i = 0; i < options.length; i++) {
                    if (options[i].getAttribute('data-country') === country) {
                        console.log('Found matching option at index:', i);
                        countryCode.selectedIndex = i;
                        found = true;
                        break;
                    }
                }
                
                // If no exact match was found, fall back to setting by value
                if (!found) {
                    console.log('No exact match found, setting by value');
                    countryCode.value = detectedCountryCode;
                }
                
                console.log('Selected country code (from language):', countryCode.value);
                console.log('Selected index (from language):', countryCode.selectedIndex);
                
                // Update the phone mask based on the detected country
                updatePhoneMask(detectedCountryCode);
            } else {
                console.log('No matching country code found for', country);
            }
        } else {
            console.log('Could not extract country from language');
        }
    } catch (error) {
        console.error('Error in language-based detection:', error);
        // Keep the default country code (already set in the HTML)
    }
}

function updatePhoneMask(countryCodeValue) {
    // Remove existing mask if it exists
    if (phoneMask) {
        phoneMask.destroy();
    }
    
    // Set appropriate mask based on country code
    let maskPattern;
    let placeholder;
    
    // Check if we need to distinguish between countries that share the same code
    const selectedOption = countryCode ? countryCode.options[countryCode.selectedIndex] : null;
    const selectedCountry = selectedOption ? selectedOption.getAttribute('data-country') : null;
    
    // Define masks based on country code or specific country
    switch(countryCodeValue) {
        case '+1': // North America
            if (selectedCountry === 'CA') {
                maskPattern = '(000) 000-0000';
                placeholder = '(416) 555-0123';
            } else {
                // US and other +1 countries
                maskPattern = '(000) 000-0000';
                placeholder = '(234) 567-8900';
            }
            break;
        case '+44': // UK
            maskPattern = '00 0000 0000';
            placeholder = '20 1234 5678';
            break;
        case '+91': // India
            maskPattern = '00000 00000';
            placeholder = '98765 43210';
            break;
        case '+86': // China
            maskPattern = '000 0000 0000';
            placeholder = '138 1234 5678';
            break;
        case '+52': // Mexico
            maskPattern = '00 0000 0000';
            placeholder = '55 1234 5678';
            break;
        case '+33': // France
            maskPattern = '0 00 00 00 00';
            placeholder = '6 12 34 56 78';
            break;
        case '+49': // Germany
            maskPattern = '000 00000000';
            placeholder = '151 12345678';
            break;
        case '+61': // Australia
            maskPattern = '000 000 000';
            placeholder = '412 345 678';
            break;
        case '+55': // Brazil
            maskPattern = '00 00000 0000';
            placeholder = '11 98765 4321';
            break;
        case '+81': // Japan
            maskPattern = '00 0000 0000';
            placeholder = '90 1234 5678';
            break;
        case '+7': // Russia/Kazakhstan
            if (selectedCountry === 'KZ') {
                maskPattern = '000 000 0000';
                placeholder = '701 234 5678';
            } else {
                maskPattern = '000 000-00-00';
                placeholder = '912 345-67-89';
            }
            break;
        case '+34': // Spain
            maskPattern = '000 00 00 00';
            placeholder = '612 34 56 78';
            break;
        case '+39': // Italy
            maskPattern = '000 000 0000';
            placeholder = '312 345 6789';
            break;
        case '+82': // South Korea
            maskPattern = '00-0000-0000';
            placeholder = '10-1234-5678';
            break;
        case '+31': // Netherlands
            maskPattern = '0 00 00 00 00';
            placeholder = '6 12 34 56 78';
            break;
        case '+27': // South Africa
            maskPattern = '00 000 0000';
            placeholder = '82 123 4567';
            break;
        case '+30': // Greece
            maskPattern = '000 000 0000';
            placeholder = '697 123 4567';
            break;
        case '+48': // Poland
            maskPattern = '000 000 000';
            placeholder = '512 345 678';
            break;
        case '+40': // Romania
            maskPattern = '000 000 000';
            placeholder = '712 345 678';
            break;
        case '+46': // Sweden
            maskPattern = '00 000 00 00';
            placeholder = '70 123 45 67';
            break;
        case '+47': // Norway
            maskPattern = '000 00 000';
            placeholder = '406 12 345';
            break;
        case '+507': // Panama
            maskPattern = '0000 0000';
            placeholder = '6123 4567';
            break;
        case '+351': // Portugal
            maskPattern = '000 000 000';
            placeholder = '912 345 678';
            break;
        case '+595': // Paraguay
            maskPattern = '0 000 000000';
            placeholder = '9 812 345678';
            break;
        case '+971': // UAE
            maskPattern = '00 000 0000';
            placeholder = '50 123 4567';
            break;
        case '+966': // Saudi Arabia
            maskPattern = '00 000 0000';
            placeholder = '50 123 4567';
            break;
        case '+65': // Singapore
            maskPattern = '0000 0000';
            placeholder = '8123 4567';
            break;
        case '+60': // Malaysia
            maskPattern = '00 000 0000';
            placeholder = '12 345 6789';
            break;
        case '+63': // Philippines
            maskPattern = '000 000 0000';
            placeholder = '917 123 4567';
            break;
        case '+64': // New Zealand
            maskPattern = '00 000 0000';
            placeholder = '21 123 4567';
            break;
        case '+66': // Thailand
            maskPattern = '0 0000 0000';
            placeholder = '8 1234 5678';
            break;
        case '+90': // Turkey
            maskPattern = '000 000 0000';
            placeholder = '532 123 4567';
            break;
        case '+20': // Egypt
            maskPattern = '00 0000 0000';
            placeholder = '10 1234 5678';
            break;
        case '+234': // Nigeria
            maskPattern = '000 000 0000';
            placeholder = '803 123 4567';
            break;
        case '+254': // Kenya
            maskPattern = '000 000000';
            placeholder = '712 345678';
            break;
        case '+972': // Israel
            maskPattern = '00 000 0000';
            placeholder = '50 123 4567';
            break;
        default:
            // Generic international format for other countries
            if (countryCodeValue.length <= 3) {
                maskPattern = '000 000 0000';
            } else if (countryCodeValue.length === 4) {
                maskPattern = '00 000 0000';
            } else {
                maskPattern = '00000000000';
            }
            placeholder = 'Phone number';
            break;
    }
    
    // Create new mask
    phoneMask = IMask(phone, {
        mask: maskPattern
    });
    
    // Update placeholder
    phone.placeholder = placeholder;
    
    // Enable/disable send button based on complete phone number
    phoneMask.on('accept', () => {
        if (sendCode) {
            sendCode.disabled = !phoneMask.masked.isComplete || loading;
        }
    });
}

// Initialize mask with default country code
document.addEventListener('DOMContentLoaded', () => {
    if (countryCode && phone) {
        // First initialize with the default country code
        updatePhoneMask(countryCode.value);
        
        // Then try to detect the user's country and update if successful
        detectUserCountry();
        
        // Update mask when country code changes
        countryCode.addEventListener('change', () => {
            updatePhoneMask(countryCode.value);
            phone.value = '';
            phone.focus();
        });
    }
});

// Helper Functions
function parsePhoneNumberForApi(phone) {
    // Remove all non-digits from the phone number
    const digits = phone.replace(/\D/g, '');
    
    // Get the selected country code (already includes the + symbol)
    const selectedCountryCode = countryCode ? countryCode.value : '+1';
    
    // Log the formatting process
    console.log('Formatting phone number:', {
        originalPhone: phone,
        digits: digits,
        countryCode: selectedCountryCode
    });
    
    // Validate the phone number length based on country code
    const minLength = 8; // Minimum length for any phone number
    const maxLength = 15; // Maximum length according to E.164
    
    if (digits.length < minLength || digits.length > maxLength) {
        throw new Error(`Phone number must be between ${minLength} and ${maxLength} digits`);
    }
    
    // Return the E.164 formatted number and ensure it starts with +
    const formattedNumber = selectedCountryCode.startsWith('+') ? 
        `${selectedCountryCode}${digits}` : 
        `+${selectedCountryCode}${digits}`;
    
    // Validate the final E.164 format
    if (!/^\+[1-9]\d{1,14}$/.test(formattedNumber)) {
        throw new Error('Invalid phone number format');
    }
    
    console.log('Final formatted number:', formattedNumber);
    return formattedNumber;
}

function showMessage(message, isError = false) {
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 p-4 rounded-lg ${isError ? 'bg-red-500' : 'bg-green-500'} text-white shadow-lg z-50`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function setLoading(isLoading) {
    loading = isLoading;
    const buttons = [sendCode, verifyCode, resendCode];
    const spinners = document.querySelectorAll('.spinner-border');
    
    buttons.forEach(button => {
        if (button) {
            button.disabled = isLoading;
            const spinner = button.querySelector('.spinner-border');
            if (spinner) {
                spinner.classList.toggle('hidden', !isLoading);
            }
        }
    });
    
    if (phone) phone.disabled = isLoading;
    if (firstName) firstName.disabled = isLoading;
    if (lastName) lastName.disabled = isLoading;
    if (email) email.disabled = isLoading;
    if (verificationInput) verificationInput.disabled = isLoading;
}

function showVerificationForm() {
    if (phoneForm) phoneForm.classList.add('hidden');
    if (verificationForm) verificationForm.classList.remove('hidden');
    if (successMessage) successMessage.classList.add('hidden');
    
    // Focus on verification input with a small delay to ensure the DOM has updated
    setTimeout(() => {
        if (verificationInput) {
            verificationInput.value = '';
            verificationInput.focus();
        }
    }, 50);
}

function showPhoneForm() {
    if (phoneForm) phoneForm.classList.remove('hidden');
    if (verificationForm) verificationForm.classList.add('hidden');
    if (successMessage) successMessage.classList.add('hidden');
    if (phone) {
        phone.value = '';
        // Reset the phone mask based on the current country code
        // but don't change the country code selection
        if (countryCode) {
            updatePhoneMask(countryCode.value);
        }
        phone.focus();
    }
    if (firstName) firstName.value = '';
    if (lastName) lastName.value = '';
    if (email) email.value = '';
    if (verificationInput) verificationInput.value = '';
    formattedPhone = '';
    userFirstName = '';
    userLastName = '';
    userEmail = '';
}

function showSuccessMessage() {
    if (phoneForm) phoneForm.classList.add('hidden');
    if (verificationForm) verificationForm.classList.add('hidden');
    if (successMessage) successMessage.classList.remove('hidden');
}

// Handle verification input
if (verificationInput) {
    verificationInput.addEventListener('input', (e) => {
        // Only allow numbers
        e.target.value = e.target.value.replace(/\D/g, '');
        
        // If we have 6 digits, trigger verification
        if (e.target.value.length === 6 && !verifyCode.disabled) {
            setTimeout(() => {
                verifyCode.click();
            }, 100);
        }
    });

    // Handle paste event
    verificationInput.addEventListener('paste', (e) => {
        e.preventDefault();
        const pastedText = (e.clipboardData || window.clipboardData).getData('text');
        const digits = pastedText.replace(/\D/g, '').slice(0, 6);
        
        if (digits.length > 0) {
            verificationInput.value = digits;
            
            // If we have 6 digits, trigger verification
            if (digits.length === 6 && !verifyCode.disabled) {
                setTimeout(() => {
                    verifyCode.click();
                }, 300);
            }
        }
    });
}

if (verifyCode) {
    verifyCode.addEventListener('click', async (e) => {
        e.preventDefault();
        
        try {
            setLoading(true);
            const code = verificationInput.value;
            
            if (code.length !== 6) {
                throw new Error('Please enter all 6 digits of the verification code.');
            }
            
            // Ensure phone number is in E.164 format
            if (!formattedPhone.startsWith('+')) {
                formattedPhone = `+${formattedPhone}`;
            }
            
            const { data, error } = await supabase.auth.verifyOtp({
                phone: formattedPhone,
                token: code,
                type: 'sms'
            });

            if (error) {
                if (error.message.includes("Token has expired")) {
                    throw new Error("Verification code has expired. Please request a new code.");
                } else if (error.message.includes("Token is invalid")) {
                    throw new Error("Invalid verification code. Please try again or request a new code.");
                }
                throw error;
            }

            // Create profile after successful verification
            await createProfile(data.user.id);

            // Send welcome text message
            try {
                console.log('Sending welcome message to:', formattedPhone);
                const response = await fetch('/api/sms/welcome', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        phone: formattedPhone,
                        firstName: userFirstName
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: response.statusText }));
                    throw new Error(`Failed to send welcome message: ${errorData.error || response.statusText}`);
                }

                const result = await response.json();
                console.log('Welcome message sent successfully:', result);
            } catch (smsError) {
                console.error('Failed to send welcome message:', smsError);
                // Continue with success flow even if welcome message fails
            }

            showMessage('Phone number verified successfully!');
            successMessage.classList.remove('hidden');
            setTimeout(showSuccessMessage, 1500);
        } catch (error) {
            console.error('Verification error:', error);
            showMessage(error.message || 'Failed to verify code', true);
            if (verificationInput) {
                verificationInput.value = '';
                verificationInput.focus();
            }
        } finally {
            setLoading(false);
        }
    });
}

if (resendCode) {
    resendCode.addEventListener('click', () => {
        if (verificationInput) verificationInput.value = '';
        if (sendCode) {
            sendCode.click();
        }
    });
}

// Check for existing session
async function checkSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (session) {
        showSuccessMessage();
    }
}

// Event Listeners
if (sendCode) {
    sendCode.addEventListener('click', async (e) => {
        e.preventDefault();
        
        try {
            if (!firstName.value.trim()) {
                throw new Error('Please enter your first name');
            }
            
            if (!lastName.value.trim()) {
                throw new Error('Please enter your last name');
            }
            
            if (!email.value.trim()) {
                throw new Error('Please enter your email address');
            }
            
            // Basic email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email.value.trim())) {
                throw new Error('Please enter a valid email address');
            }
            
            // Validate phone number format
            if (!phoneMask.masked.isComplete) {
                throw new Error('Please enter a complete phone number');
            }
            
            setLoading(true);
            formattedPhone = parsePhoneNumberForApi(phoneMask.unmaskedValue);
            
            // Double-check E.164 format before proceeding
            if (!formattedPhone.startsWith('+')) {
                formattedPhone = `+${formattedPhone}`;
            }
            
            // Validate the final format
            if (!/^\+[1-9]\d{1,14}$/.test(formattedPhone)) {
                throw new Error('Invalid phone number format. Please try again.');
            }
            
            userFirstName = capitalizeFirstLetter(firstName.value.trim());
            userLastName = capitalizeFirstLetter(lastName.value.trim());
            userEmail = email.value.trim();

            // Check if the phone number already exists in the database
            const { data: existingProfile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('phone', formattedPhone)
                .single();
            
            if (existingProfile) {
                throw new Error('You already have an account with us. Please text Maximo to continue.');
            }

            const { error } = await supabase.auth.signInWithOtp({
                phone: formattedPhone,
            });

            if (error) {
                if (error.message.includes("phone_provider_disabled")) {
                    throw new Error("Phone authentication is not enabled. Please contact support.");
                }
                if (error.message.includes("Messaging Service contains no phone numbers")) {
                    throw new Error("SMS service is not properly configured. Please contact support.");
                }
                throw error;
            }

            showMessage('Verification code sent! Please check your phone.');
            showVerificationForm();
        } catch (error) {
            console.error('Phone sign-in error:', error);
            showMessage(error.message || 'Failed to send verification code', true);
            if (phone) phoneMask.value = '';
        } finally {
            setLoading(false);
        }
    });
}

async function createProfile(userId) {
    try {
        // Get user's timezone
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        // Create profile with location data
        const { error } = await supabase
            .from('profiles')
            .insert([
                {
                    user_id: userId,
                    phone: formattedPhone, // Store the full phone number including country code
                    first_name: userFirstName,
                    last_name: userLastName,
                    email: userEmail,
                    is_active: true,
                    role: 'user',
                    timezone: timezone
                }
            ]);

        if (error) throw error;
    } catch (error) {
        console.error('Error creating profile:', error);
        throw new Error('Failed to create profile');
    }
}

// Call checkSession when the page loads
checkSession();

// Listen for auth state changes
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
        showSuccessMessage();
    }
});

// Remove the complex form submission handlers
if (phoneForm) {
    phoneForm.addEventListener('submit', (e) => {
        e.preventDefault();
    });
}

if (verificationForm) {
    verificationForm.addEventListener('submit', (e) => {
        e.preventDefault();
    });
}

// Simple Enter key handler for the entire document
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        // If phone form is visible and not hidden
        if (phoneForm && !phoneForm.classList.contains('hidden')) {
            // Check if all required fields are filled
            if (firstName.value.trim() && 
                lastName.value.trim() && 
                email.value.trim() && 
                phoneMask.masked.isComplete && 
                !sendCode.disabled) {
                e.preventDefault();
                sendCode.click();
            }
        }
        
        // If verification form is visible and not hidden
        if (verificationForm && !verificationForm.classList.contains('hidden')) {
            // Check if all 6 digits are entered
            const code = verificationInput.value;
            if (code.length === 6 && !verifyCode.disabled) {
                e.preventDefault();
                verifyCode.click();
            }
        }
    }
});