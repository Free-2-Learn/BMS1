import { db, auth } from "../firebase-config.js";
import { 
    collection, getDocs, query, orderBy, limit, startAfter, onSnapshot, doc, getDoc
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";

// Firestore reference
const announcementsRef = collection(db, "announcements");

// DOM Elements
const announcementList = document.getElementById("announcement-list");
const loadMoreButton = document.getElementById("load-more");


//  Function to check if the user is a resident
async function isResident(user) {
    if (!user) return false;
    const residentRef = doc(db, "residents", user.email);
    const residentSnap = await getDoc(residentRef);
    return residentSnap.exists();
}

//  Handle Authentication & Role-Based Access
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        console.warn("🚫 No user logged in. Redirecting to login.");
        window.location.href = "../index.html";
        return;
    }

    const isUserResident = await isResident(user);

    if (!isUserResident) {
        console.warn("🚫 Unauthorized access. Redirecting...");
        await signOut(auth);
        window.location.href = "../index.html";
        return;
    }

    console.log("✅ User verified as Resident.");
});

let lastVisible = null; // Track last document for pagination
const PAGE_SIZE = 5;
let isLoading = false;

let loadedAnnouncements = new Set();

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "../index.html";
    }
});

//  Format Time Ago
function formatTimeAgo(timestamp) {
    if (!timestamp) return "Unknown time";
    const now = new Date();
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return date.toLocaleDateString();
}

//  Fixes Formatting Issues
function sanitizeText(text) {
    return text.replace(/\n/g, "<br>").replace(
        /(https?:\/\/[^\s]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    ).trim();
}


//  Create Announcement Card
function createAnnouncementElement(doc) {
    if (loadedAnnouncements.has(doc.id)) return null; // Prevent duplicates
    loadedAnnouncements.add(doc.id);

    const announcement = doc.data();
    const container = document.createElement("div");
    container.classList.add("announcement-card");
    container.setAttribute("data-docid", doc.id); // Add doc ID for tracking images    

    let imagesHTML = "";
    if (announcement.images && Array.isArray(announcement.images)) {
        imagesHTML = `<div class="image-container">` + 
            announcement.images.map((image, index) => 
                `<img src="${image}" class="announcement-img" 
                      data-index="${index}" 
                      data-id="${doc.id}" 
                      onclick="openImageModal('${doc.id}', ${index})">`
            ).join("") + 
            `</div>`;
    }
    

    container.innerHTML = `
        <div class="announcement-header">
            <img src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='gray'><circle cx='12' cy='8' r='4'/><path d='M2 20c0-4 4-7 10-7s10 3 10 7'/></svg>" class="profile-pic">
            <div class="announcement-info">
                <strong>Barangay Captain</strong>
                <small>${formatTimeAgo(announcement.date)}</small>
            </div>
        </div>
        <p class="announcement-text">${sanitizeText(announcement.text)}</p>
        ${imagesHTML}
    `;

    return container;
}

document.querySelectorAll(".clickable-image").forEach((img) => {
    img.addEventListener("click", () => {
        const docId = img.getAttribute("data-docid");
        const index = parseInt(img.getAttribute("data-index"));
        openImageModal(docId, index);
    });
});


// Load Announcements with Pagination 
async function loadAnnouncements(initialLoad = false) {
    if (isLoading) return;
    isLoading = true;

    try {
        let q = query(announcementsRef, orderBy("date", "desc"), limit(PAGE_SIZE));
        if (lastVisible && !initialLoad) {
            q = query(announcementsRef, orderBy("date", "desc"), startAfter(lastVisible), limit(PAGE_SIZE));
        }

        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
            
            querySnapshot.forEach((doc) => {
                if (!loadedAnnouncements.has(doc.id)) {
                    const announcementElement = createAnnouncementElement(doc);
                    if (announcementElement) {
                        announcementList.appendChild(announcementElement);
                    }
                }
            });

            loadMoreButton.style.display = querySnapshot.size === PAGE_SIZE ? "block" : "none";
        } else if (initialLoad) {
            announcementList.innerHTML = "<p>No announcements found.</p>";
        }
    } catch (error) {
        console.error("Error loading announcements:", error);
    } finally {
        isLoading = false;
    }
}

//  Fix Real-Time Listener 
onSnapshot(query(announcementsRef, orderBy("date", "desc"), limit(1)), (snapshot) => {
    snapshot.forEach((doc) => {
        if (!loadedAnnouncements.has(doc.id)) {
            const newAnnouncement = createAnnouncementElement(doc);
            if (newAnnouncement) {
                announcementList.prepend(newAnnouncement);
            }
        }
    });
});

// Load More Button Event
loadMoreButton.addEventListener("click", () => {
    loadAnnouncements(false);
});

// Initial Load
loadAnnouncements(true);

let imageList = [];
let currentIndex = 0;

export function openImageModal(announcementId, index) {
    const images = document.querySelectorAll(`img[data-id="${announcementId}"]`);
    imageList = Array.from(images).map(img => img.src);
    currentIndex = index;

    document.getElementById("modal-image").src = imageList[currentIndex];
    document.getElementById("image-modal").style.display = "flex";
}

export function closeImageModal() {
    document.getElementById("image-modal").style.display = "none";
}

export function prevImage() {
    if (currentIndex > 0) {
        currentIndex--;
        document.getElementById("modal-image").src = imageList[currentIndex];
    }
}

export function nextImage() {
    if (currentIndex < imageList.length - 1) {
        currentIndex++;
        document.getElementById("modal-image").src = imageList[currentIndex];
    }
}
