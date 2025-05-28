import { auth, db } from "../firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";

const welcomeText = document.getElementById("welcome-text");
const logoutButton = document.getElementById("logout-button");
const profileButton = document.getElementById("profile-button");
const profileMenu = document.getElementById("profile-menu");

// Fetch Resident Name and Display It
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "../index.html"; // Redirect if not logged in
        return;
    }

    const residentRef = doc(db, "residents", user.email);
    const residentSnap = await getDoc(residentRef);

    if (residentSnap.exists()) {
        const residentData = residentSnap.data();
        welcomeText.innerText = `Welcome, ${residentData.firstName} ${residentData.lastName}!`;
    }
});

// Logout Function
logoutButton.addEventListener("click", async () => {
    await signOut(auth);
    sessionStorage.clear(); // Clear session
    window.location.href = "../index.html";
});
