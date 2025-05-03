import { db, auth } from "../firebase-config.js";
import { getAuth, onAuthStateChanged, updatePassword } from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js';
import { getFirestore, doc, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js';
import { EmailAuthProvider, reauthenticateWithCredential } from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js';
import { serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js';


// Function to fetch the user profile data from Firestore
async function loadUserProfile() {
    const user = auth.currentUser;

    if (!user) return;

    const userDocRef = doc(db, "residents", user.email.toLowerCase());
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) return;

    const userData = userDoc.data();


    document.getElementById("edit-middle-name").value = userData.middleName || "";
    document.getElementById("edit-gender").value = userData.gender || "";

    document.getElementById("resident-middle-name").textContent = userData.middleName || "";
    document.getElementById("resident-gender").textContent = userData.gender || "";

    document.getElementById("edit-first-name").value = userData.firstName;
    document.getElementById("edit-last-name").value = userData.lastName;
    document.getElementById("edit-contact-number").value = userData.contactNumber;
    document.getElementById("edit-address").value = userData.address;
    document.getElementById("user-name").textContent = `${userData.firstName} ${userData.lastName}`;
    document.getElementById("resident-first-name").textContent = userData.firstName;
    document.getElementById("resident-last-name").textContent = userData.lastName;
    document.getElementById("resident-email").textContent = userData.email;
    document.getElementById("resident-contact-number").textContent = userData.contactNumber;
    document.getElementById("resident-address").textContent = userData.address;
    document.getElementById("resident-occupation").textContent = userData.occupation;
    document.getElementById("resident-education").textContent = userData.education;
    document.getElementById("resident-special-categories").textContent = userData.specialCategories;

    // Password change logic
    const hasChangedOnce = userData.hasChangedPasswordOnce;
    const lastChange = userData.lastPasswordChange?.toDate(); // if exists, convert from Firestore timestamp

    const shouldForceChange = !hasChangedOnce;
    const isAllowedToday = !lastChange || (Date.now() - lastChange.getTime() > 86400000);

    if (shouldForceChange || isAllowedToday) {
        document.getElementById("change-password-modal").style.display = "block";
  }
}

// Handle password change submission
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
      // Reauthenticate with current password
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPassword);

      // Update Firestore timestamp
      const userRef = doc(db, "residents", user.email.toLowerCase());
      await updateDoc(userRef, {
        lastPasswordChange: serverTimestamp(),  
        hasChangedPasswordOnce: true
    });    

      alert("Password changed successfully!");
      document.getElementById("change-password-modal").style.display = "none";
  } catch (error) {
      console.error("Error changing password:", error);
      alert("Error changing password: " + error.message);
  }
});

// Function to open the Edit Profile modal
document.getElementById("edit-profile-btn").addEventListener("click", function () {
    document.getElementById("edit-profile-modal").style.display = "block";
});

// Function to close the Edit Profile modal
document.getElementById("close-edit-modal").addEventListener("click", function () {
    document.getElementById("edit-profile-modal").style.display = "none";
});

// Function to handle the profile update form submission
document.getElementById("edit-profile-form").addEventListener("submit", async function (event) {
    event.preventDefault();

    const middleName = document.getElementById("edit-middle-name").value;
    const gender = document.getElementById("edit-gender").value;
    
    const firstName = document.getElementById("edit-first-name").value;
    const lastName = document.getElementById("edit-last-name").value;
    const contactNumber = document.getElementById("edit-contact-number").value;
    const address = document.getElementById("edit-address").value;

    const user = auth.currentUser;

    if (user) {
        // Fetch the user's Firestore document and update the fields
        const userRef = doc(db, "residents", user.email.toLowerCase());
        await updateDoc(userRef, {
            firstName: firstName,
            lastName: lastName,
            middleName: middleName,
            gender: gender,
            contactNumber: contactNumber,
            address: address
        });


        alert("Profile updated successfully!");
        loadUserProfile(); // Reload user profile after update
        document.getElementById("edit-profile-modal").style.display = "none";
    }
});

// Check if the user is logged in and load their profile
onAuthStateChanged(auth, (user) => {
    if (user) {
        loadUserProfile(); // Load user profile when logged in
    } else {
        window.location.replace("login.html"); // Redirect to login page if not logged in
    }
});

document.getElementById("back-btn").addEventListener("click", () => {
    window.history.back(); // or replace with your actual dashboard path like:
    // window.location.href = "resident-dashboard.html";
});
