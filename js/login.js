import { auth, db } from "../firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", function () {
    const loginForm = document.getElementById("login-form");

    if (loginForm) {
        loginForm.addEventListener("submit", async function (event) {
            event.preventDefault();
            const email = document.getElementById("username").value.trim().toLowerCase();
            const password = document.getElementById("password").value;
            const errorMessage = document.getElementById("error-message");

            try {
                // 🔹 Sign in user with Firebase Authentication
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                console.log("✅ User logged in:", email);

                // 🔎 First, check if the user is a resident
                const residentRef = doc(db, "residents", email);
                const residentSnap = await getDoc(residentRef);

                if (residentSnap.exists()) {
                    console.log("✅ Redirecting to Resident Dashboard...");
                    window.location.href = "pages/dashboard-resident.html"; // Resident Page
                    return;
                }

                console.warn("❌ Not found in residents. Checking if it's a captain...");

                // If not found, check if the email belongs to the captain
                const captainRef = doc(db, "config", "admin");
                const captainSnap = await getDoc(captainRef);

                if (captainSnap.exists() && captainSnap.data().email === email) {
                    console.log("✅ Redirecting to Captain Dashboard...");
                    window.location.href = "pages/dashboard-captain.html"; // Captain Page
                    return;
                }

                // If not found in both collections, log out and show error
                console.warn("❌ Unauthorized access. Logging out...");
                auth.signOut(); // Logs out user instead of deleting them
                errorMessage.innerText = "Your account is not recognized. Contact the Barangay Office.";
            } catch (error) {
                console.error("❌ Login Error:", error.message);
                errorMessage.innerText = "Invalid email or password.";
            }
        });
    }
});


// captain@example.com
// resident1@example.com
// resident2@example.com
// 123456
// npx http-server