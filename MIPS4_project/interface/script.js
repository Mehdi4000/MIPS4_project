const translations = {
    fr: {
        'hero.title': 'ExamOnline',
        'hero.subtitle': 'Rejoignez la révolution des examens en ligne, partout dans le monde',
        'hero.cta': 'Découvrir maintenant',
        'description.title': 'Une plateforme pour l’avenir de l’éducation',
        'description.intro': 'ExamOnline est votre partenaire pour des évaluations modernes et sécurisées. Conçue pour un public mondial, notre plateforme combine technologie de pointe et simplicité, avec des fonctionnalités comme :',
        'features.accessibility.title': 'Accessibilité mondiale',
        'features.accessibility.text': 'Disponible en plusieurs langues et sur tous les appareils, partout dans le monde.',
        'features.ai.title': 'Surveillance IA',
        'features.ai.text': 'Détection intelligente des comportements pour garantir l’intégrité des examens.',
        'features.security.title': 'Sécurité avancée',
        'features.security.text': 'Cryptage AES-256 et conformité RGPD pour protéger vos données.',
        'features.results.title': 'Résultats instantanés',
        'features.results.text': 'Feedback détaillé et analyses visuelles pour étudiants et enseignants.',
        'signup.title': 'Commencez votre aventure',
        'signup.form.title': 'Inscription',
        'signup.userType.label': 'Type d\'utilisateur',
        'signup.userType.student': 'Étudiant',
        'signup.userType.teacher': 'Enseignant',
        'signup.firstName.label': 'Prénom',
        'signup.lastName.label': 'Nom',
        'signup.email.label': 'Email',
        'signup.password.label': 'Mot de passe',
        'signup.birthDate.label': 'Date de naissance',
        'signup.gender.label': 'Sexe',
        'signup.gender.male': 'Homme',
        'signup.gender.female': 'Femme',
        'signup.gender.other': 'Autre',
        'signup.institution.label': 'Établissement',
        'signup.fieldOfStudy.label': 'Filière',
        'signup.submit': 'S\'inscrire',
        'footer.text': '© 2025 ExamOnline. Connectons l’éducation mondiale.',
        'footer.contact': 'Contact',
        'footer.support': 'Support 24/7',
        'footer.privacy': 'Confidentialité',
        'footer.terms': 'Conditions',
        'validation.nameShort': 'Le nom doit contenir au moins 3 caractères.',
        'validation.emailInvalid': 'Veuillez entrer un email valide.',
        'validation.passwordShort': 'Le mot de passe doit contenir au moins 6 caractères.',
        'validation.institutionShort': 'L\'établissement doit contenir au moins 2 caractères.',
        'validation.fieldOfStudyShort': 'La filière doit contenir au moins 2 caractères.',
        'validation.birthDateRequired': 'La date de naissance est requise.',
        'validation.genderRequired': 'Le sexe est requis.',
        'validation.userTypeRequired': 'Le type d\'utilisateur est requis.',
        'validation.success': 'Inscription réussie !'
    },
    en: {
        'hero.title': 'ExamOnline',
        'hero.subtitle': 'Join the revolution of online exams, worldwide',
        'hero.cta': 'Discover Now',
        'description.title': 'A platform for the future of education',
        'description.intro': 'ExamOnline is your partner for modern and secure assessments. Designed for a global audience, our platform combines cutting-edge technology and simplicity, with features like:',
        'features.accessibility.title': 'Global Accessibility',
        'features.accessibility.text': 'Available in multiple languages and on all devices, anywhere in the world.',
        'features.ai.title': 'AI Monitoring',
        'features.ai.text': 'Intelligent behavior detection to ensure exam integrity.',
        'features.security.title': 'Advanced Security',
        'features.security.text': 'AES-256 encryption and GDPR compliance to protect your data.',
        'features.results.title': 'Instant Results',
        'features.results.text': 'Detailed feedback and visual analytics for students and teachers.',
        'signup.title': 'Start Your Journey',
        'signup.form.title': 'Registration',
        'signup.userType.label': 'User Type',
        'signup.userType.student': 'Student',
        'signup.userType.teacher': 'Teacher',
        'signup.firstName.label': 'First Name',
        'signup.lastName.label': 'Last Name',
        'signup.email.label': 'Email',
        'signup.password.label': 'Password',
        'signup.birthDate.label': 'Date of Birth',
        'signup.gender.label': 'Gender',
        'signup.gender.male': 'Male',
        'signup.gender.female': 'Female',
        'signup.gender.other': 'Other',
        'signup.institution.label': 'Institution',
        'signup.fieldOfStudy.label': 'Field of Study',
        'signup.submit': 'Sign Up',
        'footer.text': '© 2025 ExamOnline. Connecting global education.',
        'footer.contact': 'Contact',
        'footer.support': '24/7 Support',
        'footer.privacy': 'Privacy',
        'footer.terms': 'Terms',
        'validation.nameShort': 'The name must be at least 3 characters.',
        'validation.emailInvalid': 'Please enter a valid email.',
        'validation.passwordShort': 'The password must be at least 6 characters.',
        'validation.institutionShort': 'The institution must be at least 2 characters.',
        'validation.fieldOfStudyShort': 'The field of study must be at least 2 characters.',
        'validation.birthDateRequired': 'Date of birth is required.',
        'validation.genderRequired': 'Gender is required.',
        'validation.userTypeRequired': 'User type is required.',
        'validation.success': 'Registration successful!'
    }
};

const languages = ['fr', 'en', 'es'];
let currentLangIndex = languages.indexOf(localStorage.getItem('language') || 'fr');

function updateLanguage() {
    try {
        const lang = languages[currentLangIndex];
        localStorage.setItem('language', lang);
        console.log('Updating language to:', lang);

        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            if (translations[lang][key]) {
                element.textContent = translations[lang][key];
            } else {
                console.warn(`Translation missing for key: ${key} in language: ${lang}`);
            }
        });

        const placeholders = {
            '#firstName': 'signup.firstName.label',
            '#lastName': 'signup.lastName.label',
            '#email': 'signup.email.label',
            '#password': 'signup.password.label',
            '#institution': 'signup.institution.label',
            '#fieldOfStudy': 'signup.fieldOfStudy.label'
        };
        Object.entries(placeholders).forEach(([selector, key]) => {
            const element = document.querySelector(selector);
            if (element && translations[lang][key]) {
                element.placeholder = translations[lang][key];
            }
        });

        // Update language
        const toggle = document.querySelector('#languageToggle');
        if (toggle) {
            toggle.setAttribute('data-lang', lang.toUpperCase());
        }

        // Update document title
        const title = document.querySelector('title');
        if (title && translations[lang]['hero.title']) {
            title.textContent = translations[lang]['hero.title'];
        }
    } catch (error) {
        console.error('Error updating language:', error);
    }
}

function changeLanguage() {
    currentLangIndex = (currentLangIndex + 1) % languages.length;
    console.log('Language toggle clicked, new index:', currentLangIndex);
    updateLanguage();
}

function registerUser(event) {
    event.preventDefault();
    const lang = languages[currentLangIndex];
    console.log('Register user called, language:', lang);

    const form = document.getElementById('signupForm');
    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const birthDate = document.getElementById('birthDate').value;
    const gender = document.querySelector('input[name="gender"]:checked')?.value;
    const institution = document.getElementById('institution').value;
    const fieldOfStudy = document.getElementById('fieldOfStudy').value;
    const userType = document.querySelector('input[name="userType"]:checked')?.value;

    // Validation
    if (!userType) {
        alert(translations[lang]['validation.userTypeRequired']);
        return;
    }
    if (firstName.length < 3 || lastName.length < 3) {
        alert(translations[lang]['validation.nameShort']);
        return;
    }
    if (!email.includes('@') || !email.includes('.')) {
        alert(translations[lang]['validation.emailInvalid']);
        return;
    }
    if (password.length < 6) {
        alert(translations[lang]['validation.passwordShort']);
        return;
    }
    if (!birthDate) {
        alert(translations[lang]['validation.birthDateRequired']);
        return;
    }
    if (!gender) {
        alert(translations[lang]['validation.genderRequired']);
        return;
    }
    if (institution.length < 2) {
        alert(translations[lang]['validation.institutionShort']);
        return;
    }
    if (fieldOfStudy.length < 2) {
        alert(translations[lang]['validation.fieldOfStudyShort']);
        return;
    }
    const user = {
        firstName,
        lastName,
        email,
        password,
        birthDate,
        gender,
        institution,
        fieldOfStudy,
        role: userType
    };
    const storageKey = userType === 'student' ? 'students' : 'teachers';
    let users = JSON.parse(localStorage.getItem(storageKey)) || [];
    users.push(user);
    localStorage.setItem(storageKey, JSON.stringify(users));

    //  message de succes::
    alert(translations[lang]['validation.success']);
    form.reset();
}

// Initialiser le language :
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing language');
    updateLanguage();
    const toggle = document.querySelector('#languageToggle');
    if (toggle) {
        toggle.addEventListener('click', changeLanguage);
        console.log('Language toggle event listener attached');
    } else {
        console.error('Language toggle element not found');
    }
});