// db.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs, writeBatch, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { getAuth, deleteUser } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyA1sNorLeQxKLLV2xzW_CeLPfCY9kdbHdU",
    authDomain: "popflix-fa92d.firebaseapp.com",
    projectId: "popflix-fa92d",
    storageBucket: "popflix-fa92d.appspot.com",
    messagingSenderId: "711247539554",
    appId: "1:711247539554:android:032d6028c7d514fbb3103b"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);

// Export services for use in other scripts
export const db = getFirestore(firebaseApp);
export const auth = getAuth(firebaseApp);

// Make the app instance available globally
window.firebaseApp = firebaseApp;

// --- User Data Functions ---
export async function getUserData(userId) {
    if (!userId) return null;
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    return userDoc.exists() ? userDoc.data() : null;
}

// --- List Management Functions (Favorites, Watchlist, Completed) ---
const createListFunctions = (listName) => {
    const capitalizedListName = listName.charAt(0).toUpperCase() + listName.slice(1);
    return {
        [`addTo${capitalizedListName}`]: async (userId, contentData) => {
            const userDocRef = doc(db, 'users', userId);
            await updateDoc(userDocRef, { [listName]: arrayUnion(contentData) });
        },
        [`removeFrom${capitalizedListName}`]: async (userId, contentData) => {
            const userDocRef = doc(db, 'users', userId);
            await updateDoc(userDocRef, { [listName]: arrayRemove(contentData) });
        }
    };
};

export const { addToFavorites, removeFromFavorites } = createListFunctions('favorites');
export const { addToWatchlist, removeFromWatchlist } = createListFunctions('watchlist');
export const { addToCompleted, removeFromCompleted } = createListFunctions('completed');


// --- Review Functions ---
export async function getReviewsForContent(contentId) {
    const reviewsCol = collection(db, 'reviews');
    const q = query(reviewsCol, where("contentId", "==", Number(contentId)));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getReviewsByUser(userId) {
    const reviewsCol = collection(db, 'reviews');
    const q = query(reviewsCol, where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function addReview(contentId, contentType, userId, username, text, rating, contentTitle) {
    const reviewsCol = collection(db, 'reviews');
    const newReviewRef = doc(reviewsCol);
    await setDoc(newReviewRef, {
        contentId: Number(contentId),
        contentType,
        userId,
        username,
        text,
        rating,
        contentTitle,
        createdAt: serverTimestamp()
    });
}

export async function updateReview(reviewId, text, rating) {
    const reviewDocRef = doc(db, 'reviews', reviewId);
    await updateDoc(reviewDocRef, { text, rating });
}

export async function deleteReview(reviewId) {
    const reviewDocRef = doc(db, 'reviews', reviewId);
    await deleteDoc(reviewDocRef);
}


// --- Account Management ---
export async function deleteUserAccount() {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'No user logged in' };

    try {
        // Batch delete user's reviews
        const reviews = await getReviewsByUser(user.uid);
        const batch = writeBatch(db);
        reviews.forEach(review => {
            const reviewDocRef = doc(db, 'reviews', review.id);
            batch.delete(reviewDocRef);
        });
        await batch.commit();

        // Delete user's profile document
        const userDocRef = doc(db, 'users', user.uid);
        await deleteDoc(userDocRef);

        // Delete the user from Authentication
        await deleteUser(user);

        return { success: true };
    } catch (error) {
        console.error("Error deleting user account:", error);
        return { success: false, error: error.code };
    }
}

export default firebaseApp;