// auth.js
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    onAuthStateChanged,
    sendSignInLinkToEmail,
    isSignInWithEmailLink,
    signInWithEmailLink
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// Import auth & db exported from db.js
import { auth, db } from './db.js';
import { showAlert } from './ui.js';

const tmdbApiKey = "3b8e66b62b76f7bd72722a5ce290a8a0";

// === CONFIG: replace this with the URL you'll host for finishing sign-in ===
const EMAIL_LINK_REDIRECT_URL = 'https://popflix-fa92d.firebaseapp.com/__/auth/action';

document.addEventListener('DOMContentLoaded', () => {
    // If Android bridge exists
    window.Android?.setCurrentPage?.('auth');

    const provider = new GoogleAuthProvider();

    const authStep1 = document.getElementById('auth-step-1');
    const authStep2 = document.getElementById('auth-step-2');
    const formTitle = document.getElementById('form-title');
    const confirmPasswordFieldGroup = document.getElementById('confirm-password-field-group');
    const submitBtn = document.getElementById('form-submit-btn');
    const toggleBtn = document.getElementById('toggle-btn');
    const authForm = document.getElementById('auth-form');
    const googleSignInBtn = document.getElementById('google-signin-btn');
    const profileForm = document.getElementById('profile-form');
    const magicLinkBtn = document.getElementById('magic-link-btn');

    let isLogin = true;
    let newUser = null;

    // Genres (unchanged)
    const genres = [
        { id: 28, name: 'Action' }, { id: 12, name: 'Adventure' }, { id: 16, name: 'Animation' },
        { id: 35, name: 'Comedy' }, { id: 80, name: 'Crime' }, { id: 99, name: 'Documentary' },
        { id: 18, name: 'Drama' }, { id: 10751, name: 'Family' }, { id: 14, name: 'Fantasy' },
        { id: 36, name: 'History' }, { id: 27, name: 'Horror' }, { id: 10402, name: 'Music' },
        { id: 9648, name: 'Mystery' }, { id: 10749, name: 'Romance' }, { id: 878, name: 'Sci-Fi' },
        { id: 10770, name: 'TV Movie' }, { id: 53, name: 'Thriller' }, { id: 10752, name: 'War' },
        { id: 37, name: 'Western' }
    ];
    const genrePillsContainer = document.getElementById('genre-pills');
    genres.forEach(genre => {
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'genre-pill';
        pill.textContent = genre.name;
        pill.dataset.id = genre.id;
        pill.onclick = () => pill.classList.toggle('selected');
        genrePillsContainer.appendChild(pill);
    });

    // If the page is loaded with an email link, try completing sign-in
    (async function handleIncomingEmailLink() {
        if (isSignInWithEmailLink(auth, window.location.href)) {
            let emailForSignIn = window.localStorage.getItem('emailForSignIn');
            if (!emailForSignIn) {
                emailForSignIn = window.prompt('Please confirm your email for sign-in:');
            }
            if (!emailForSignIn) {
                showAlert('Sign-in Error', 'Email required to complete sign-in.');
                return;
            }
            try {
                const result = await signInWithEmailLink(auth, emailForSignIn, window.location.href);
                window.localStorage.removeItem('emailForSignIn');
                const user = result.user;
                const userDocRef = doc(db, "users", user.uid);
                const userDoc = await getDoc(userDocRef);
                if (!userDoc.exists()) {
                    newUser = user;
                    authStep1.classList.add('hidden');
                    authStep2.classList.remove('hidden');
                } else {
                    window.location.href = 'home.html';
                }
            } catch (err) {
                console.error('Error completing sign-in with email link', err);
                showAlert('Sign-in Error', err.message || 'Could not complete sign-in.');
            }
        }
    })();

    // Auth state change: only redirect to home if user exists and has profile doc
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
                window.location.href = 'home.html';
            }
        }
    });

    const toggleMode = () => {
        isLogin = !isLogin;
        formTitle.textContent = isLogin ? 'Login' : 'Sign Up';
        confirmPasswordFieldGroup.style.display = isLogin ? 'none' : 'block';
        submitBtn.textContent = isLogin ? 'Login' : 'Sign Up';
        document.getElementById('toggle-text').textContent = isLogin ? "Don't have an account?" : "Already have an account?";
        toggleBtn.textContent = isLogin ? 'Sign up' : 'Login';
        authForm.reset();
    };

    toggleBtn.addEventListener('click', toggleMode);

    authForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        if (isLogin) {
            signInWithEmailAndPassword(auth, email, password)
                .catch((error) => showFriendlyAuthError(error, 'Login Failed'));
        } else {
            const confirmPassword = document.getElementById('confirm-password').value;
            if (password !== confirmPassword) {
                showAlert("Error", "Passwords do not match.");
                return;
            }
            createUserWithEmailAndPassword(auth, email, password)
                .then((userCredential) => {
                    newUser = userCredential.user;
                    authStep1.classList.add('hidden');
                    authStep2.classList.remove('hidden');
                })
                .catch((error) => {
                    showFriendlyAuthError(error, 'Sign Up Failed');
                });
        }
    });

    magicLinkBtn?.addEventListener('click', async () => {
        const email = document.getElementById('email').value.trim();
        if (!email) return showAlert('Error', 'Please enter your email first.');
        await sendMagicLink(email);
    });

    googleSignInBtn.addEventListener('click', () => {
        signInWithPopup(auth, provider)
            .then(async (result) => {
                const user = result.user;
                const userDocRef = doc(db, "users", user.uid);
                const userDoc = await getDoc(userDocRef);
                if (!userDoc.exists()) {
                    newUser = user;
                    document.getElementById('username').value = user.displayName || '';
                    authStep1.classList.add('hidden');
                    authStep2.classList.remove('hidden');
                } else {
                     window.location.href = 'home.html';
                }
            })
            .catch((error) => {
                showFriendlyAuthError(error, 'Google Sign-in Failed');
            });
    });

    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        const selectedGenres = Array.from(document.querySelectorAll('.genre-pill.selected')).map(pill => ({ id: pill.dataset.id, name: pill.textContent }));
        const selectedMoviesList = Array.from(document.querySelectorAll('#selected-movies .selected-item')).map(item => JSON.parse(item.dataset.movie));

        if (selectedGenres.length < 1) {
            return showAlert("Profile Setup", "Please select at least one favorite genre.");
        }
        if (!username) {
            return showAlert("Profile Setup", "Please enter a username.");
        }

        try {
            await saveUserProfile(newUser.uid, username, selectedGenres, selectedMoviesList);
            newUser = null;
            window.location.href = 'home.html';
        } catch (error) {
            console.error("Profile save error:", error);
            showFriendlyAuthError(error, 'Failed to save profile');
        }
    });

    async function saveUserProfile(userId, username, genres, movies) {
        const userDocRef = doc(db, "users", userId);
        const email = newUser.email;
        await setDoc(userDocRef, {
            username,
            email,
            favoriteGenres: genres,
            completed: movies,
            favorites: [],
            watchlist: []
        });
    }

    const movieSearchInput = document.getElementById('movie-search');
    const searchResultsContainer = document.getElementById('movie-search-results');
    const selectedMoviesContainer = document.getElementById('selected-movies');
    let selectedMovieIds = new Set();

    movieSearchInput?.addEventListener('input', debounce(async (e) => {
        const query = e.target.value.trim();
        if (query.length < 3) { searchResultsContainer.innerHTML = ''; return; }
        const response = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${tmdbApiKey}&query=${encodeURIComponent(query)}&include_adult=false`);
        const data = await response.json();
        searchResultsContainer.innerHTML = '';
        (data.results || []).slice(0, 5).forEach(movie => {
            if (!selectedMovieIds.has(movie.id.toString()) && movie.poster_path) {
                const resultItem = document.createElement('div');
                resultItem.className = 'search-result-item';
                resultItem.textContent = movie.title;
                resultItem.onclick = () => addMovieToSelected(movie);
                searchResultsContainer.appendChild(resultItem);
            }
        });
    }, 500));

    function addMovieToSelected(movie) {
        selectedMovieIds.add(movie.id.toString());
        const selectedItem = document.createElement('div');
        selectedItem.className = 'selected-item';

        const movieDataForStorage = {
            id: movie.id,
            title: movie.title,
            poster_path: movie.poster_path,
            type: 'movie',
            vote_average: movie.vote_average
        };
        selectedItem.dataset.movie = JSON.stringify(movieDataForStorage);

        selectedItem.innerHTML = `<span>${movie.title}</span><button type="button" class="remove-btn">&times;</button>`;
        selectedItem.querySelector('.remove-btn').onclick = () => {
            selectedMovieIds.delete(movie.id.toString());
            selectedItem.remove();
        };
        selectedMoviesContainer.appendChild(selectedItem);
        movieSearchInput.value = '';
        searchResultsContainer.innerHTML = '';
    }

    function debounce(func, delay) { let timeout; return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), delay); }; }

    function showFriendlyAuthError(error, title) {
        let message = 'An unexpected error occurred. Please try again.';
        switch (error?.code) {
            case 'auth/user-not-found':
            case 'auth/wrong-password':
                message = 'Incorrect email or password. Please try again.';
                break;
            case 'auth/email-already-in-use':
                message = 'An account with this email address already exists.';
                break;
            case 'auth/invalid-email':
                message = 'Please enter a valid email address.';
                break;
            case 'auth/weak-password':
                message = 'The password is too weak. Please choose a stronger one.';
                break;
        }
        showAlert(title, message);
    }

    async function sendMagicLink(email) {
      const actionCodeSettings = {
        url: window.location.href, // Redirect back to the auth page itself
        handleCodeInApp: true
      };
      try {
        await sendSignInLinkToEmail(auth, email, actionCodeSettings);
        window.localStorage.setItem('emailForSignIn', email);
        showAlert('Email Sent', 'A sign-in link has been sent to your email. Open it on this device to complete sign-in.');
      } catch (err) {
        console.error('sendMagicLink error', err);
        showFriendlyAuthError(err, 'Send Sign-in Link Failed');
      }
    }

});