import { auth, db } from "../firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

//  Function to check if the user is the Captain
async function isCaptain(user) {
    if (!user) return false;

    const captainRef = doc(db, "config", "admin");
    const captainSnap = await getDoc(captainRef);

    return captainSnap.exists() && captainSnap.data().email === user.email;
}

//  Handle Authentication & Role-Based Access
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        console.warn("🚫 No user logged in. Redirecting to login.");
        window.location.href = "../index.html";
        return;
    }

    const isUserCaptain = await isCaptain(user);

    if (!isUserCaptain) {
        console.warn("🚫 Unauthorized access. Redirecting...");
        await signOut(auth);
        window.location.href = "../index.html";
        return;
    }

    console.log("✅ User verified as Captain.");

    //  Show the dashboard only after verification
    document.querySelector(".dashboard-container").style.display = "block";

    //  Logout button functionality
    document.getElementById("logout-button").addEventListener("click", async () => {
        await signOut(auth);
        window.location.href = "../index.html";
    });
});
