import { db, auth } from "../firebase-config.js";
import {
    onAuthStateChanged,
    updatePassword,
    EmailAuthProvider,
    reauthenticateWithCredential
} from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js';
import {
    doc,
    getDoc,
    updateDoc,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js';

// Function to fetch the user profile data from Firestore
async function loadUserProfile() {
    const user = auth.currentUser;
    if (!user) return;

    const userDocRef = doc(db, "residents", user.email.toLowerCase());
    const userDoc = await getDoc(userDocRef);
    if (!userDoc.exists()) return;

    const userData = userDoc.data();

    // Fill edit fields
    document.getElementById("edit-first-name").value = userData.firstName || "";
    document.getElementById("edit-middle-name").value = userData.middleName || "";
    document.getElementById("edit-last-name").value = userData.lastName || "";
    document.getElementById("edit-contact-number").value = userData.contactNumber || "";
    document.getElementById("edit-gender").value = userData.gender || "";
    document.getElementById("edit-address").value = userData.address || "";
    document.getElementById("edit-occupation").value = userData.occupation || "";
    document.getElementById("edit-education").value = userData.education || "";
    document.getElementById("edit-special-categories").value = userData.specialCategories || "None";
    // Display-only values
    document.getElementById("user-name").textContent = `${userData.firstName} ${userData.lastName}`;
    document.getElementById("resident-first-name").textContent = userData.firstName;
    document.getElementById("resident-middle-name").textContent = userData.middleName || "";
    document.getElementById("resident-last-name").textContent = userData.lastName;
    document.getElementById("resident-email").textContent = userData.email;
    document.getElementById("resident-contact-number").textContent = userData.contactNumber;
    document.getElementById("resident-gender").textContent = userData.gender || "";
    document.getElementById("resident-address").textContent = userData.address;
    document.getElementById("resident-occupation").textContent = userData.occupation;
    document.getElementById("resident-education").textContent = userData.education;
    document.getElementById("resident-special-categories").textContent = userData.specialCategories || "None";


    // Force password change check
    const hasChangedOnce = userData.hasChangedPasswordOnce;
    const lastChange = userData.lastPasswordChange?.toDate();
    const shouldForceChange = !hasChangedOnce;
    const isAllowedToday = !lastChange || (Date.now() - lastChange.getTime() > 86400000);

    if (shouldForceChange || isAllowedToday) {
        document.getElementById("change-password-modal").style.display = "block";
    }
}

// Password Change Submit
document.getElementById("change-password-form").addEventListener("submit", async function (event) {
    event.preventDefault();

    const currentPassword = document.getElementById("current-password").value;
    const newPassword = document.getElementById("new-password").value;
    const confirmPassword = document.getElementById("confirm-password").value;

    if (newPassword !== confirmPassword) {
        alert("New passwords do not match.");
        return;
    }

    const user = auth.currentUser;
    try {
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPassword);

        await updateDoc(doc(db, "residents", user.email.toLowerCase()), {
            lastPasswordChange: serverTimestamp(),
            hasChangedPasswordOnce: true
        });

        alert("Password changed successfully!");
        document.getElementById("change-password-modal").style.display = "none";
    } catch (error) {
        console.error("Password change error:", error);
        alert("Error: " + error.message);
    }
});

// Close Password Modal
document.getElementById("close-change-password-modal").addEventListener("click", () => {
    document.getElementById("change-password-modal").style.display = "none";
});

// Open Edit Modal
document.getElementById("edit-profile-btn").addEventListener("click", () => {
    document.getElementById("edit-profile-modal").style.display = "block";
});

// Close Edit Modal
document.getElementById("close-edit-modal").addEventListener("click", () => {
    document.getElementById("edit-profile-modal").style.display = "none";
});

// Close modals on outside click
window.addEventListener("click", function (event) {
    const passwordModal = document.getElementById("change-password-modal");
    const editModal = document.getElementById("edit-profile-modal");

    if (event.target === passwordModal) {
        passwordModal.style.display = "none";
    }
    if (event.target === editModal) {
        editModal.style.display = "none";
    }
});


// Save Edit Profile
document.getElementById("edit-profile-form").addEventListener("submit", async function (event) {
    event.preventDefault();

    const nameRegex = /^[A-Za-z\s]+$/;
    const phoneRegex = /^\+63\d{10}$/;

    const firstName = document.getElementById("edit-first-name").value.trim();
    const middleName = document.getElementById("edit-middle-name").value.trim();
    const lastName = document.getElementById("edit-last-name").value.trim();
    const rawContact = document.getElementById("edit-contact-number").value.replace(/\s+/g, '');
    const gender = document.getElementById("edit-gender").value;
    const address = document.getElementById("edit-address").value.trim();
    const occupation = document.getElementById("edit-occupation").value.trim();
    const education = document.getElementById("edit-education").value.trim();

    const specialCategories = document.getElementById("edit-special-categories").value;

    if (!nameRegex.test(firstName) || !nameRegex.test(middleName) || !nameRegex.test(lastName)) {
        alert("Names must only contain letters and spaces.");
        return;
    }

    if (!phoneRegex.test(rawContact)) {
        alert("Contact number must be in the format +63 followed by 10 digits.");
        return;
    }

    const user = auth.currentUser;
    if (user) {
        await updateDoc(doc(db, "residents", user.email.toLowerCase()), {
            firstName,
            middleName,
            lastName,
            contactNumber: rawContact,
            gender,
            address,
            occupation,
            education,
            specialCategories
        });

        alert("Profile updated successfully!");
        loadUserProfile();
        document.getElementById("edit-profile-modal").style.display = "none";
    }
});

// Auto-format contact input on typing
const contactInput = document.getElementById("edit-contact-number");

contactInput.addEventListener("input", function () {
    // Remove all non-digit characters
    let digits = this.value.replace(/\D/g, "");

    // Allow full deletion without re-adding anything
    if (digits === "") {
        this.value = "";
        return;
    }

    // Ensure it starts with "63"
    if (!digits.startsWith("63")) {
        digits = "63" + digits.replace(/^6*/, "");
    }

    // Limit to "63" + 10 numbers
    digits = digits.slice(0, 12);

    // Format as "+63 XXXXXXXXXX"
    const formatted = `+${digits.slice(0, 2)} ${digits.slice(2)}`;
    this.value = formatted;
});

contactInput.addEventListener("keydown", function (e) {
    if (["e", "E", "+", "-"].includes(e.key)) {
        e.preventDefault();
    }
});

// Prevent numbers in occupation field
document.getElementById("edit-occupation").addEventListener("input", function () {
  this.value = this.value.replace(/[0-9]/g, "");
});

// Prevent numbers in name fields
document.querySelectorAll("#edit-first-name, #edit-middle-name, #edit-last-name").forEach(input => {
    input.addEventListener("input", function () {
        this.value = this.value.replace(/[0-9]/g, "");
    });
});

// Auth check
onAuthStateChanged(auth, (user) => {
    if (user) {
        loadUserProfile();
    } else {
        window.location.replace("login.html");
    }
});

