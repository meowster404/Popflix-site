import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { initializeProfile } from './profile.js';
import { setupSearch, updateHeaderProfileIcon, initializeTheme, showAlert, showConfirm } from './ui.js';
import * as db from './db.js';

let currentUser = null;
let userData = null;
let currentContentData = null;
let editingReviewId = null;

document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();

    const auth = getAuth(window.firebaseApp);
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            userData = await db.getUserData(user.uid);
            updateHeaderProfileIcon(userData);
            initializeProfile();
            setupSearch();
            await loadContentDetails();
        } else {
            window.location.href = 'auth.html';
        }
    });
});

async function loadContentDetails() {
    const params = new URLSearchParams(window.location.search);
    const contentType = params.get('type');
    const contentId = params.get('id');

    if (!contentId || !contentType || contentType === 'undefined') {
        return renderError("Could not load content. The link may be invalid.");
    }

    const appendToResponse = contentType === 'movie' ? 'release_dates,videos' : 'content_ratings,videos';
    const detailsUrl = `https://api.themoviedb.org/3/${contentType}/${contentId}?api_key=3b8e66b62b76f7bd72722a5ce290a8a0&append_to_response=${appendToResponse}`;

    try {
        const response = await fetch(detailsUrl);
        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
        const apiData = await response.json();

        if (apiData.adult) {
            return renderError("This content is not available.");
        }

        currentContentData = {
            id: apiData.id,
            type: contentType,
            title: apiData.title || apiData.name,
            poster_path: apiData.poster_path,
            vote_average: apiData.vote_average
        };

        const certification = getCertification(apiData, contentType);
        renderDetailsPage(apiData, certification);
        updateUserActionButtons();
        await renderReviews();
        setupEventListeners();

        window.Android?.contentLoaded();

    } catch (error) {
        console.error('CRITICAL: Error loading content details:', error);
        renderError(`Could not load details. Please check your connection and try again.<br><br><small>Debug Info: ${error.message}</small>`);
    }
}

function getCertification(data, type) {
    let certification = '';
    try {
        if (type === 'movie' && data.release_dates) {
            const usRelease = data.release_dates.results.find(r => r.iso_3166_1 === 'US');
            if (usRelease) {
                const cert = usRelease.release_dates.find(rd => rd.certification && rd.certification !== "");
                if (cert) certification = cert.certification;
            }
        } else if (type === 'tv' && data.content_ratings) {
            const usRating = data.content_ratings.results.find(r => r.iso_3166_1 === 'US');
            if (usRating) certification = usRating.rating;
        }
    } catch (e) {
        console.warn("Could not parse certification info:", e);
    }
    return certification;
}

function renderDetailsPage(data, certification) {
    const mainContainer = document.getElementById('detail-container');
    const posterSkeleton = document.getElementById('details-poster-skeleton');

    mainContainer.style.display = '';
    mainContainer.innerHTML = `
        <img id="details-poster" src="" alt="Poster" class="details-poster hidden">
        <div class="movie-info">
            <h1 id="movie-title"></h1>
            <ul class="movie-meta-top-row">
                <li id="release-year"></li>
                <li id="runtime"></li>
                <li id="certification-badge" class="certification-badge" style="display: none;"></li>
                <li id="movie-rating"></li>
            </ul>
            <p id="genre"></p>
            <p id="plot"></p>
        </div>
        <div class="details-actions">
            <div class="primary-actions">
                <button id="watch-trailer-button" class="watch-now-button">Watch Trailer</button>
                <button id="favorite-btn" class="action-btn-icon icon-only"></button>
            </div>
            <div class="user-actions">
                <button id="watchlist-btn" class="action-btn-icon">Add to Watchlist</button>
                <button id="completed-btn" class="action-btn-icon">Mark as Completed</button>
            </div>
        </div>
    `;

    posterSkeleton.style.display = 'none';

    const isMovie = currentContentData.type === 'movie';
    const title = currentContentData.title;
    document.title = `${title} - Popflix`;

    document.getElementById('details-bg-image').style.backgroundImage = `url('https://image.tmdb.org/t/p/original${data.backdrop_path}')`;

    const poster = document.getElementById('details-poster');
    poster.onload = () => poster.classList.remove('hidden');
    poster.src = data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : '';
    poster.alt = title;

    document.getElementById('movie-title').textContent = title;
    document.getElementById('release-year').textContent = isMovie ? (data.release_date?.substring(0, 4) || 'N/A') : (data.first_air_date?.substring(0, 4) || 'N/A');
    document.getElementById('runtime').textContent = isMovie ? formatRuntime(data.runtime) : (data.episode_run_time?.[0] ? `${data.episode_run_time[0]}m / ep` : 'N/A');

    const certBadge = document.getElementById('certification-badge');
    if (certification) {
        certBadge.textContent = certification;
        certBadge.style.display = 'inline-block';
    }

    document.getElementById('movie-rating').textContent = data.vote_average ? `⭐ ${data.vote_average.toFixed(1)}` : 'N/A';
    document.getElementById('genre').textContent = data.genres?.map(g => g.name).join(', ') || 'N/A';
    document.getElementById('plot').textContent = data.overview || "No plot summary available.";

    const trailer = data.videos?.results.find(v => v.type === 'Trailer' && v.site === 'YouTube');
    const trailerButton = document.getElementById('watch-trailer-button');
    if (trailer) {
        trailerButton.style.display = 'inline-flex';
        trailerButton.onclick = () => openTrailerModal(trailer.key);
    } else {
        trailerButton.style.display = 'none';
    }

    document.getElementById('reviews-section-container').classList.remove('hidden');
}

function renderError(message) {
    const mainContainer = document.getElementById('detail-container');
    const posterSkeleton = document.getElementById('details-poster-skeleton');
    if (mainContainer) {
        posterSkeleton.style.display = 'none';
        mainContainer.style.display = 'block';
        mainContainer.innerHTML = `
             <div style="color: white; text-align: center; padding: 5rem 1rem; background-color: rgba(0,0,0,0.5); border-radius: 12px;">
                 <h2 style="margin-bottom: 1rem;">Something Went Wrong</h2>
                 <p>${message}</p>
             </div>
        `;
    }
}

async function renderReviews() {
    const reviewsList = document.getElementById('reviews-list');
    const addReviewContainer = document.getElementById('add-review-form-container');
    if (!reviewsList || !addReviewContainer) return;
    editingReviewId = null;

    const reviews = await db.getReviewsForContent(currentContentData.id);
    const userHasReviewed = reviews.some(r => r.userId === currentUser.uid);

    const reviewTitle = addReviewContainer.querySelector('h3');
    if (reviewTitle) reviewTitle.textContent = "Add Your Review";

    const reviewText = document.getElementById('review-text');
    if (reviewText) reviewText.value = '';

    document.querySelectorAll('.rating-btn').forEach(btn => btn.classList.remove('selected'));
    addReviewContainer.style.display = userHasReviewed ? 'none' : 'block';

    if (reviews.length > 0) {
        reviewsList.innerHTML = reviews.sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0)).map(createReviewElement).join('');
    } else {
        reviewsList.innerHTML = '<p>Be the first to write a review!</p>';
    }
}

function createReviewElement(review) {
    const isOwnReview = review.userId === currentUser.uid;
    const reviewDate = review.createdAt?.toDate() ? review.createdAt.toDate().toLocaleDateString() : 'Just now';
    return `
        <div class="review-item ${isOwnReview ? 'your-review-item' : ''}">
            <div class="review-header"><h4>${isOwnReview ? "Your Review" : review.username}</h4><span class="review-date">${reviewDate}</span></div>
            <div class="review-rating">⭐ ${review.rating} / 10</div>
            <p class="review-content">${review.text.replace(/\n/g, '<br>')}</p>
            ${isOwnReview ? `<div class="review-actions" data-review-id="${review.id}" data-text="${encodeURIComponent(review.text)}" data-rating="${review.rating}"><button class="action-btn edit-btn">Edit</button><button class="action-btn delete delete-btn">Delete</button></div>` : ''}
        </div>`;
}

function updateUserActionButtons() {
    if (!userData || !currentContentData) return;
    const { id } = currentContentData;
    const isFavorite = userData.favorites?.some(item => item.id == id);
    const isWatchlisted = userData.watchlist?.some(item => item.id == id);
    const isCompleted = userData.completed?.some(item => item.id == id);

    const watchlistBtn = document.getElementById('watchlist-btn');
    if(watchlistBtn){
        watchlistBtn.textContent = isWatchlisted ? '✓ On Watchlist' : 'Add to Watchlist';
        watchlistBtn.classList.toggle('active', isWatchlisted);
    }

    const completedBtn = document.getElementById('completed-btn');
    if(completedBtn){
        completedBtn.textContent = isCompleted ? '✓ Completed' : 'Mark as Completed';
        completedBtn.classList.toggle('active', isCompleted);
    }

    const favoriteBtn = document.getElementById('favorite-btn');
    if(favoriteBtn) favoriteBtn.classList.toggle('active', isFavorite);
}

function setupEventListeners() {
    const mainContent = document.getElementById('details-page-main');
    if (!mainContent) return;

    mainContent.addEventListener('click', async (e) => {
        if (e.target.closest('#favorite-btn')) await toggleList('favorites');
        if (e.target.closest('#watchlist-btn')) await toggleList('watchlist');
        if (e.target.closest('#completed-btn')) await toggleList('completed');
        if (e.target.closest('#submit-review-button')) await handleSubmitReview();

        if (e.target.classList.contains('rating-btn')) {
            document.querySelectorAll('.rating-btn').forEach(btn => btn.classList.remove('selected'));
            e.target.classList.add('selected');
        }
        if (e.target.matches('.edit-btn')) {
            const actionsDiv = e.target.closest('.review-actions');
            handleEditReview({ id: actionsDiv.dataset.reviewId, text: decodeURIComponent(actionsDiv.dataset.text), rating: parseInt(actionsDiv.dataset.rating) });
        }
        if (e.target.matches('.delete-btn')) {
            const reviewId = e.target.closest('.review-actions').dataset.reviewId;
            await handleDeleteReview(reviewId);
        }
    });
}

async function toggleList(listName) {
    if (!currentUser || !currentContentData) return;
    try {
        const list = userData[listName] || [];
        const isAdded = list.some(item => item.id === currentContentData.id);

        if (isAdded) {
            await db[`removeFrom${listName.charAt(0).toUpperCase() + listName.slice(1)}`](currentUser.uid, currentContentData);
        } else {
            await db[`addTo${listName.charAt(0).toUpperCase() + listName.slice(1)}`](currentUser.uid, currentContentData);
            if (listName === 'completed') {
                await db.removeFromWatchlist(currentUser.uid, currentContentData);
            }
        }

        userData = await db.getUserData(currentUser.uid);
        updateUserActionButtons();
    } catch (error) {
        console.error(`Error toggling ${listName}:`, error);
        showAlert('Error', `Could not update your ${listName}. Please try again.`);
    }
}

async function handleSubmitReview() {
    const reviewTextEl = document.getElementById('review-text');
    const reviewText = reviewTextEl ? reviewTextEl.value.trim() : '';
    const ratingBtn = document.querySelector('.rating-btn.selected');
    const rating = ratingBtn ? parseInt(ratingBtn.dataset.value) : 0;
    if (rating === 0) return showAlert('Rating Required', 'Please select a rating from 1 to 10.');
    if (!reviewText) return showAlert('Review Required', 'Please write a review before submitting.');
    try {
        const { id, type, title } = currentContentData;
        if (editingReviewId) {
            await db.updateReview(editingReviewId, reviewText, rating);
        } else {
            await db.addReview(id, type, currentUser.uid, userData.username, reviewText, rating, title);
        }
        await renderReviews();
    } catch (error) {
        console.error("Error submitting review:", error);
        showAlert('Error', 'Could not submit your review. Please try again.');
    }
}

async function handleDeleteReview(reviewId) {
    showConfirm("Delete Review", "Are you sure? This cannot be undone.", async () => {
        try {
            await db.deleteReview(reviewId);
            await renderReviews();
        } catch (error) {
            showAlert('Error', 'Failed to delete review.');
        }
    });
}

function handleEditReview(review) {
    editingReviewId = review.id;
    const form = document.getElementById('add-review-form-container');
    if(!form) return;

    form.style.display = 'block';
    const title = form.querySelector('h3');
    if (title) title.textContent = "Edit Your Review";

    const reviewText = document.getElementById('review-text');
    if (reviewText) reviewText.value = review.text;

    document.querySelectorAll('.rating-btn').forEach(btn => {
        btn.classList.toggle('selected', parseInt(btn.dataset.value) === review.rating);
    });
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function formatRuntime(minutes) { if (!minutes) return 'N/A'; const h = Math.floor(minutes / 60); const m = minutes % 60; return `${h}h ${m}m`; }

function openTrailerModal(youtubeKey) {
    const modal = document.getElementById('trailer-modal');
    const iframe = document.getElementById('trailer-iframe');
    if (!modal || !iframe) return;
    iframe.src = `https://www.youtube.com/embed/${youtubeKey}?autoplay=1`;
    modal.classList.remove('hidden');
    const closeModal = () => { iframe.src = ''; modal.classList.add('hidden'); };
    const closeButton = modal.querySelector('.close-modal-button');
    if(closeButton) closeButton.onclick = closeModal;
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };
}