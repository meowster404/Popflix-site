import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { initializeProfile } from './profile.js';
import { setupSearch, updateHeaderProfileIcon, initializeTheme } from '../js/ui.js';
import * as db from '../js/db.js';

let currentUser = null;
let userData = null;
const tmdbApiKey = "3b8e66b62b76f7bd72722a5ce290a8a0";

document.addEventListener('DOMContentLoaded', () => {
    // Notify the Android app that the home page is loading
    window.Android?.setCurrentPage('home');
    initializeTheme();
    const auth = getAuth(window.firebaseApp);
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            userData = await db.getUserData(user.uid);

            // If user data doesn't exist, they likely haven't completed signup
            if (!userData) {
                window.location.href = 'auth.html';
                return;
            }

            // Initialize all UI components now that we have a user
            updateHeaderProfileIcon(userData);
            initializeProfile();
            setupSearch();
            displayAllSkeletons();
            await fetchAllContent();

            // Notify the Android app that the content is loaded
            window.Android?.contentLoaded();
        } else {
            // No user is signed in, redirect to login page
            window.location.href = 'auth.html';
        }
    });
});

// Added include_adult=false to all endpoints to filter content
const API_ENDPOINTS = {
    slider: `https://api.themoviedb.org/3/movie/popular?api_key=${tmdbApiKey}&language=en-US&page=1&include_adult=false`,
    todaysFeature: `https://api.themoviedb.org/3/movie/now_playing?api_key=${tmdbApiKey}&language=en-US&page=1&include_adult=false`,
    latestReleases: `https://api.themoviedb.org/3/movie/upcoming?api_key=${tmdbApiKey}&language=en-US&page=1&include_adult=false`,
    popular: `https://api.themoviedb.org/3/movie/popular?api_key=${tmdbApiKey}&language=en-US&page=2&include_adult=false`,
    kids: `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbApiKey}&certification_country=US&certification.lte=G&with_genres=16,10751&include_adult=false`,
    anime: `https://api.themoviedb.org/3/discover/tv?api_key=${tmdbApiKey}&with_genres=16&with_keywords=210024&without_keywords=30214,292476&include_adult=false`,
    webSeries: `https://api.themoviedb.org/3/tv/popular?api_key=${tmdbApiKey}&language=en-US&page=1&include_adult=false`
};


function displayAllSkeletons() {
    const sections = ['todays-feature', 'latest-releases', 'popular-movies', 'kids-movies', 'anime-movies', 'web-series'];
    sections.forEach(id => {
        const container = document.getElementById(id);
        if (container) {
            container.innerHTML = Array(10).fill('<div class="skeleton-card"></div>').join('');
        }
    });
    // Add skeleton for slider
    const slider = document.querySelector('.slider');
    if (slider) {
        slider.innerHTML = '<li class="item skeleton-slider-item"></li>';
    }
}

async function fetchAllContent() {
    // Render user lists from Firestore first
    await renderUserLists();

    // Fetch general content from TMDB API
    fetch(API_ENDPOINTS.slider).then(res => res.json()).then(data => populateMainSlider(data.results)).catch(console.error);
    await Promise.all([
        fetchAndDisplayCarousel(API_ENDPOINTS.todaysFeature, 'todays-feature', 'movie'),
        fetchAndDisplayCarousel(API_ENDPOINTS.latestReleases, 'latest-releases', 'movie'),
        fetchAndDisplayCarousel(API_ENDPOINTS.popular, 'popular-movies', 'movie'),
        fetchAndDisplayCarousel(API_ENDPOINTS.kids, 'kids-movies', 'movie'),
        fetchAndDisplayCarousel(API_ENDPOINTS.anime, 'anime-movies', 'tv'),
        fetchAndDisplayCarousel(API_ENDPOINTS.webSeries, 'web-series', 'tv')
    ]);
}

async function renderUserLists() {
    if (!userData) {
        document.getElementById('user-watchlist-container').style.display = 'none';
        document.getElementById('user-favorites-container').style.display = 'none';
        document.getElementById('user-completed-container').style.display = 'none';
        return;
    }

    renderCarouselFromList(userData.watchlist, 'user-watchlist-container', 'Your Watchlist');
    renderCarouselFromList(userData.favorites, 'user-favorites-container', 'Your Favorites');
    renderCarouselFromList(userData.completed, 'user-completed-container', 'Your Completed List');
}

function renderCarouselFromList(list, containerId, title) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const validList = list?.filter(item => item && item.poster_path);
    if (validList && validList.length > 0) {
        container.innerHTML = `<h2>${title}</h2><div class="carousel-wrapper"><div class="movie-carousel">${validList.map(item => createMovieCard(item)).join('')}</div></div>`;
        container.style.display = 'block';
    } else {
        container.style.display = 'none';
    }
}

async function fetchAndDisplayCarousel(url, containerId, type) {
    try {
        const response = await fetch(url);
        if (!response.ok) return;
        const data = await response.json();
        const container = document.getElementById(containerId);
        if (!container) return;
        const validItems = data.results.filter(item => item.poster_path && !item.adult);
        if (validItems.length > 0) {
            container.innerHTML = validItems.map(item => createMovieCard(item, type)).join('');
        } else {
            const section = container.closest('.section-container');
            if (section) section.style.display = 'none';
        }
    } catch (error) {
        console.error(`Failed to load ${containerId}:`, error);
    }
}

function createMovieCard(item, type = null) {
    const itemType = type || item.type;
    const title = item.title || item.name;
    return `<div class="movie-card" data-id="${item.id}" data-type="${itemType}"><img src="https://image.tmdb.org/t/p/w300${item.poster_path}" alt="${title}" loading="lazy"></div>`;
}

document.getElementById('home-sections').addEventListener('click', e => {
    const card = e.target.closest('.movie-card');
    if (card) {
        window.location.href = `details.html?type=${card.dataset.type}&id=${card.dataset.id}`;
    }
});

function populateMainSlider(movies) {
    const slider = document.querySelector('.slider');
    const sliderMovies = movies.filter(m => m.backdrop_path && !m.adult).slice(0, 5);
    if (sliderMovies.length > 0) {
        slider.innerHTML = sliderMovies.map(movie => `<li class="item" style="background-image: url('https://image.tmdb.org/t/p/original${movie.backdrop_path}')"><div class="content"><h2 class="title">${movie.title}</h2><button onclick="location.href='details.html?type=movie&id=${movie.id}'" class="watch-now-button">More Info</button></div></li>`).join('');
        startAutoSlider();
    }
}

function startAutoSlider() {
    const slider = document.querySelector('.slider');
    if (!slider) return;
    let currentSlide = 0;
    const items = slider.querySelectorAll('.item');
    if (items.length <= 1) return;
    items.forEach((item, index) => item.style.opacity = index === 0 ? 1 : 0);
    setInterval(() => {
        items[currentSlide].style.opacity = 0;
        currentSlide = (currentSlide + 1) % items.length;
        items[currentSlide].style.opacity = 1;
    }, 5000);
}