// ui.js
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
const tmdbApiKey = "3b8e66b62b76f7bd72722a5ce290a8a0";

// --- HEADER ---
export function updateHeaderProfileIcon(userData) {
    const usernameEl = document.getElementById('header-username');
    const profileIconEl = document.querySelector('.profile-icon');

    if (usernameEl) {
        usernameEl.textContent = userData?.username || 'User';
    }

    if (profileIconEl) {
        const auth = getAuth();
        const user = auth.currentUser;
        if (user && user.photoURL) {
            profileIconEl.innerHTML = `<img src="${user.photoURL}" alt="Profile Picture" style="width:100%; height:100%; object-fit:cover; border-radius: 50%;">`;
        } else if (userData?.username) {
            const profilePicUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.username)}&background=E50914&color=fff&size=40`;
            profileIconEl.innerHTML = `<img src="${profilePicUrl}" alt="Profile Picture" style="width:100%; height:100%; object-fit:cover; border-radius: 50%;">`;
        } else {
             profileIconEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
        }
    }
}

// --- THEME MANAGEMENT ---
export function initializeTheme() {
    const savedTheme = localStorage.getItem('popflix-theme') || 'dark';
    document.documentElement.classList.toggle('dark-mode', savedTheme === 'dark');
}

export function toggleTheme() {
    document.documentElement.classList.toggle('dark-mode');
    const isDarkMode = document.documentElement.classList.contains('dark-mode');
    localStorage.setItem('popflix-theme', isDarkMode ? 'dark' : 'light');
    updateThemeToggleButton();
}

export function updateThemeToggleButton() {
    const themeButton = document.querySelector('.profile-menu-item[data-action="theme"]');
    if (!themeButton) return;
    const isDarkMode = document.documentElement.classList.contains('dark-mode');
    themeButton.innerHTML = isDarkMode ? `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
        <span>Light Mode</span>` : `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
        <span>Dark Mode</span>`;
}

// --- MODAL MANAGEMENT ---
export function showAlert(title, message) {
    showModal({
        title,
        content: `<p>${message}</p>`,
        actions: `<button class="modal-btn primary" id="modal-ok-btn">OK</button>`
    });
    document.getElementById('modal-ok-btn').onclick = closeModal;
}

export function showConfirm(title, message, onConfirm) {
    showModal({
        title,
        content: `<p>${message}</p>`,
        actions: `
            <button class="modal-btn secondary" id="modal-cancel-btn">Cancel</button>
            <button class="modal-btn primary" id="modal-confirm-btn">Confirm</button>`
    });
    document.getElementById('modal-confirm-btn').onclick = () => {
        closeModal();
        onConfirm();
    };
    document.getElementById('modal-cancel-btn').onclick = closeModal;
}

function showModal({ title, content, actions }) {
    let modal = document.getElementById('generic-modal');
    if (!modal) return;
    modal.innerHTML = `
        <div class="modal-box">
            <h3>${title}</h3>
            <div id="modal-content">${content}</div>
            <div id="modal-actions">${actions}</div>
        </div>
    `;
    modal.classList.remove('hidden');
    modal.onclick = (e) => {
        if (e.target.id === 'generic-modal') closeModal();
    };
}

function closeModal() {
    const modal = document.getElementById('generic-modal');
    if (modal) modal.classList.add('hidden');
}

// --- SEARCH MANAGEMENT ---
export function setupSearch() {
    const searchIcon = document.getElementById('search-icon');
    const searchOverlay = document.getElementById('search-overlay');
    if (!searchIcon || !searchOverlay) return;
    searchIcon.addEventListener('click', () => {
        searchOverlay.innerHTML = `<div class="search-popup"><button class="close-btn">&times;</button><input type="text" id="search-input-popup" placeholder="Search for movies or TV shows..." autocomplete="off"><div id="search-results-grid"></div></div>`;
        searchOverlay.classList.remove('hidden');
        const input = searchOverlay.querySelector('#search-input-popup');
        input.focus();
        searchOverlay.querySelector('.close-btn').onclick = () => searchOverlay.classList.add('hidden');
        input.addEventListener('input', debounce(e => {
            const query = e.target.value.trim();
            if (query.length > 2) performSearch(query);
            else { document.getElementById('search-results-grid').innerHTML = ''; }
        }, 400));
        searchOverlay.onclick = e => { if (e.target.id === 'search-overlay') searchOverlay.classList.add('hidden'); };
    });
}

async function performSearch(query) {
    const resultsGrid = document.getElementById('search-results-grid');
    if (!resultsGrid) return;
    resultsGrid.innerHTML = `<p style="text-align:center;">Searching...</p>`;
    try {
        // ### FIX IS HERE ### Added "&include_adult=false" to the URL
        const response = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${tmdbApiKey}&query=${encodeURIComponent(query)}&include_adult=false`);
        if (!response.ok) throw new Error("Search request failed");
        const data = await response.json();
        resultsGrid.innerHTML = '';

        const validResults = data.results.filter(item => item.poster_path && (item.media_type === 'movie' || item.media_type === 'tv'));

        if (validResults.length === 0) { resultsGrid.innerHTML = `<p style="text-align:center;">No results found for "${query}".</p>`; return; }

        validResults.slice(0, 10).forEach(item => {
            const resultItem = document.createElement('div');
            resultItem.className = 'search-result-item';
            resultItem.innerHTML = `<img src="https://image.tmdb.org/t/p/w92${item.poster_path}" alt="${item.title || item.name}" loading="lazy"><div class="search-result-info"><h3>${item.title || item.name}</h3><p>${item.release_date?.substring(0,4) || item.first_air_date?.substring(0,4) || ''} &bull; ${item.media_type === 'movie' ? 'Movie' : 'TV Show'}</p></div>`;
            resultItem.addEventListener('click', () => { window.location.href = `details.html?type=${item.media_type}&id=${item.id}`; });
            resultsGrid.appendChild(resultItem);
        });
    } catch (error) { resultsGrid.innerHTML = `<p style="text-align:center;">Search failed. Please try again.</p>`; }
}

function debounce(func, delay) { let timeout; return function(...args) { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), delay); }; }