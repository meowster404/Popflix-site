import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import * as db from "./db.js";
import { showConfirm, showAlert, toggleTheme, updateThemeToggleButton } from "./ui.js";

const auth = getAuth(window.firebaseApp);

export function initializeProfile() {
    const profileIcon = document.querySelector('.profile-icon');
    if (profileIcon) {
        profileIcon.addEventListener('click', () => openProfileModal(true));
    }
}

async function openProfileModal(showMainMenu = true) {
    const user = auth.currentUser;
    if (!user) {
        showAlert("Error", "You are not signed in.");
        return;
    }
    const currentUserData = await db.getUserData(user.uid);

    if (!currentUserData) {
        showAlert("Error", "Could not load user profile data.");
        return;
    }

    const modal = document.getElementById('profile-modal');
    const drawer = modal.querySelector('.profile-drawer');
    if (!drawer) return;

    if (showMainMenu) {
        const profilePicUrl = auth.currentUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUserData.username || 'User')}&background=E50914&color=fff&size=128`;
        drawer.innerHTML = `
            <div class="profile-page-header">
                 <button class="close-profile-btn">&times;</button>
                 <h3>My Profile</h3>
            </div>
            <div class="profile-user-info">
                 <img src="${profilePicUrl}" alt="Profile Picture" class="profile-pic-large">
                 <h4 class="profile-username">${currentUserData.username || 'User'}</h4>
                 <p class="profile-email">${auth.currentUser.email}</p>
            </div>
            <ul class="profile-menu">
                <li><button class="profile-menu-item" data-action="favorites"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg><span>Favorites</span></button></li>
                <li><button class="profile-menu-item" data-action="watchlist"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg><span>Watch List</span></button></li>
                <li><button class="profile-menu-item" data-action="completed"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg><span>Completed</span></button></li>
                <li><button class="profile-menu-item" data-action="reviews"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg><span>My Reviews</span></button></li>
                <li><button class="profile-menu-item" data-action="theme"></button></li>
                <li><button class="profile-menu-item" data-action="logout"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg><span>Logout</span></button></li>
                <li><button class="profile-menu-item delete-account" data-action="delete"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg><span>Delete Account</span></button></li>
            </ul>
        `;
        updateThemeToggleButton();
    }

    modal.classList.remove('hidden');
    setupModalEventListeners(modal, currentUserData);
}

function setupModalEventListeners(modal, currentUserData) {
    const clickHandler = e => {
        if (e.target.matches('.close-profile-btn') || e.target.id === 'profile-modal') {
            closeProfileModal();
            modal.removeEventListener('click', clickHandler);
            return;
        }
        const targetElement = e.target.closest('.profile-menu-item, .back-to-menu');
        if (targetElement) {
            if (targetElement.classList.contains('back-to-menu')) {
                openProfileModal(true);
            } else {
                handleMenuAction(targetElement.dataset.action, currentUserData);
            }
        }
    };
    modal.addEventListener('click', clickHandler);
}

function closeProfileModal() {
    const modal = document.getElementById('profile-modal');
    if (modal) modal.classList.add('hidden');
}

function handleMenuAction(action, currentUserData) {
    switch (action) {
        case 'favorites':
        case 'watchlist':
        case 'completed':
            displayContentList(action, currentUserData);
            break;
        case 'reviews':
            displayUserReviews();
            break;
        case 'theme':
            toggleTheme();
            break;
        case 'logout':
            signOut(auth).then(() => window.location.href = 'auth.html');
            break;
        case 'delete':
            handleDeleteAccount();
            break;
    }
}

function renderSubPage(title, contentHTML) {
    const drawer = document.querySelector('#profile-modal .profile-drawer');
    drawer.innerHTML = `
        <div class="profile-page-header">
             <button class="back-to-menu">&larr;</button>
             <h3>${title}</h3>
        </div>
        <div class="profile-content-container">${contentHTML}</div>
    `;
}

function displayContentList(listName, currentUserData) {
    const list = currentUserData?.[listName] || [];
    let contentHTML;
    const title = listName.charAt(0).toUpperCase() + listName.slice(1);

    if (list.length > 0) {
        contentHTML = `<div class="profile-list">
            ${list.map(item => `
                <div class="profile-list-item" onclick="location.href='details.html?type=${item.type}&id=${item.id}'">
                    <img src="https://image.tmdb.org/t/p/w92${item.poster_path}" alt="${item.title}" loading="lazy">
                    <div class="profile-list-item-info">
                        <span class="item-title">${item.title}</span>
                        <span class="item-rating">⭐ ${item.vote_average ? item.vote_average.toFixed(1) : 'N/A'}</span>
                    </div>
                </div>`).join('')}
        </div>`;
    } else {
        contentHTML = `<p class="profile-empty-message">Your ${listName} list is empty.</p>`;
    }
    renderSubPage(title, contentHTML);
}

async function displayUserReviews() {
    const user = auth.currentUser;
    if (!user) return;
    const reviews = await db.getReviewsByUser(user.uid);
    let contentHTML;
    if (reviews.length > 0) {
        contentHTML = `<div class="profile-review-list">
            ${reviews.map(review => `
                <div class="review-item" onclick="location.href='details.html?type=${review.contentType}&id=${review.contentId}'">
                    <div class="review-header">
                        <h4>${review.contentTitle}</h4>
                        <div class="review-rating">⭐ ${review.rating} / 10</div>
                    </div>
                    <p class="review-content">"${review.text}"</p>
                </div>`).join('')}
        </div>`;
    } else {
        contentHTML = `<p class="profile-empty-message">You haven't written any reviews yet.</p>`;
    }
    renderSubPage("My Reviews", contentHTML);
}

function handleDeleteAccount() {
    showConfirm("Delete Account", "This will permanently erase all your data. This action cannot be undone.",
        async () => {
            const result = await db.deleteUserAccount();
            if (result.success) {
                showAlert('Account Deleted', 'Your account has been successfully deleted.');
                setTimeout(() => { window.location.href = 'auth.html'; }, 2000);
            } else {
                let message = 'Could not delete account. Please try again.';
                // *** FIX: Provide a clear, actionable error message to the user. ***
                if (result.error === 'auth/requires-recent-login') {
                    message = 'This is a sensitive security operation. To continue, please sign out and sign back in before trying to delete your account again.';
                }
                showAlert('Error', message);
            }
        }
    );
}