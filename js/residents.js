import { db, auth, secondaryAuth, secondaryApp } from "../firebase-config.js";
import { collection, getDocs, updateDoc, deleteDoc, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged  } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";

// Ensure Firestore is initialized properly
const residentsRef = collection(db, "residents");

// Function to create collection if it doesn't exist
/*
async function ensureResidentsCollectionExists() {
    try {
        const testDocRef = doc(residentsRef, "test");
        await setDoc(testDocRef, { testField: "test" }, { merge: true });
        console.log("Firestore collection 'residents' is ready.");
    } catch (error) {
        console.error("Error ensuring collection exists:", error);
    }
}
*/

// Run this function when the page loads
async function isCaptain(user) {
    if (!user) return false;

    const captainRef = doc(db, "config", "admin");
    const captainSnap = await getDoc(captainRef);

    return captainSnap.exists() && captainSnap.data().email === user.email;
}

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        console.warn("🚫 No user logged in. Redirecting to login.");
        window.location.href = "../index.html";
        return;
    }

    const isUserCaptain = await isCaptain(user);

    if (!isUserCaptain) {
        console.warn("🚫 Unauthorized access. Redirecting...");
        window.location.href = "../index.html";
        return;
    }

    console.log("✅ User verified as Captain.");
});


// DOM Elements
document.addEventListener("DOMContentLoaded", function () {
    const residentBody = document.getElementById("resident-body");
    const addResidentForm = document.getElementById("add-resident-form");

    const openAddResidentModalButton = document.getElementById("openAddResidentModal"); 
    const addResidentModal = document.getElementById("addResidentModal"); 

    const totalResidentsElem = document.getElementById("total-residents");
    const activeResidentsElem = document.getElementById("active-residents");
    const inactiveResidentsElem = document.getElementById("inactive-residents");


    if (!residentBody || !addResidentForm || !openAddResidentModalButton || !addResidentModal) {
        console.error("One or more elements not found! Check HTML IDs.");
        return;
    }

    // Open Add Resident Modalz
    openAddResidentModal.addEventListener("click", function () {
        addResidentModal.style.display = "block";
    });

    // Close Add Resident Modal ONLY when the exit button is clicked
    window.closeAddResidentModal = function () {
        addResidentModal.style.display = "none";

        // Reset all input fields when modal closes
        document.getElementById("add-resident-form").reset();
    };

    // Close Edit Resident Modal
    window.closeEditModal = function () {
        editResidentModal.style.display = "none";
    };

/*     //  Use a single event listener to handle both modals
    window.addEventListener("click", function (event) {
        // Close "Edit Resident" modal when clicking outside
        if (event.target === editResidentModal) {
            closeEditModal();
        }

    //  Prevent "Add Resident" modal from closing when clicking outside
    if (event.target === addResidentModal) {
        return; // Do nothing, prevent closing
    }
}); */

    // Load residents from Firestore
    let allResidents = []; // Store all loaded residents for searching
    let sortOrder = "asc";  // "asc" (▲) or "desc" (▼)
    
    async function loadResidents() {
        residentBody.innerHTML = "<p>Loading residents...</p>";
    
        try {
            const querySnapshot = await getDocs(residentsRef);
            let residents = [];
            let activeCount = 0;
            let inactiveCount = 0;
    
            querySnapshot.forEach((doc) => {
                const data = doc.data();
    
                //  Ensure names exist before adding
                if (!data.firstName || !data.lastName) {
                    console.warn(`Skipping resident with missing name fields: ${doc.id}`);
                    return;
                }
    
                residents.push(data);

                            // Count Active & Inactive Residents
                if (data.status === "Active") {
                    activeCount++;
                } else if (data.status === "Inactive") {
                    inactiveCount++;
                }
            });
            
            allResidents = residents; //  Store the full list for live searching

            // Update Resident Counters
            if (!totalResidentsElem || !activeResidentsElem || !inactiveResidentsElem) {
                console.warn("⚠ Resident counter elements not found in the document.");
                return; // Stop execution if elements are missing
            }

            // update all three counters
            totalResidentsElem.textContent = residents.length;
            activeResidentsElem.textContent = activeCount;
            inactiveResidentsElem.textContent = inactiveCount;
                        
            //  Sort by full name
            residents.sort((a, b) => {
                const fullNameA = `${a.firstName} ${a.middleName ? a.middleName + " " : ""}${a.lastName}`.toLowerCase();
                const fullNameB = `${b.firstName} ${b.middleName ? b.middleName + " " : ""}${b.lastName}`.toLowerCase();
                return sortOrder === "asc" ? fullNameA.localeCompare(fullNameB) : fullNameB.localeCompare(fullNameA);
            });
    
            residentBody.innerHTML = "";
    
            residents.forEach((resident, index) => {
                const rowNumber = sortOrder === "asc" ? index + 1 : residents.length - index;
                const tr = document.createElement("tr");
                tr.setAttribute("data-id", resident.id);
            
                // Display full name properly
                const fullName = `${resident.firstName} ${resident.middleName ? resident.middleName + " " : ""}${resident.lastName}`;
            
                tr.innerHTML = `
                    <td>${rowNumber}.</td>
                    <td>${fullName}</td>            
                    <td>${resident.email}</td>
                    <td>Resident123</td>
                    <td>${resident.age}</td>
                    <td>${resident.birthdate}</td>
                    <td>${resident.gender}</td>
                    <td>${resident.civilStatus}</td>
                    <td>${resident.contactNumber}</td>
                    <td>${resident.address}</td>
                    <td>${resident.occupation}</td>
                    <td>${resident.education}</td>
                    <td>${resident.specialCategories}</td>
                    <td>${resident.voterInfo}</td>
                    <td id="status-${resident.id}">${resident.status}</td>
                    <td>
                        <button onclick="toggleStatus('${resident.id}', '${resident.status}')">Toggle Status</button>
                        <button onclick="openEditModal('${resident.id}')">Edit</button>
                        <button onclick="deleteResident('${resident.id}')">Delete</button>
                    </td>
                `;
                residentBody.appendChild(tr);
            });
    
            if (residentBody.innerHTML === "") {
                residentBody.innerHTML = "<p>No residents found.</p>";
            }
        } catch (error) {
            console.error("Error loading residents:", error);
            residentBody.innerHTML = "<p>Error loading residents.</p>";
        }
    }    
    
    function renderResidentRows(residentsToRender) {
        const residentBody = document.getElementById("resident-body");
        residentBody.innerHTML = "";
    
        residentsToRender.forEach((resident, index) => {
            const rowNumber = sortOrder === "asc" ? index + 1 : residentsToRender.length - index;
            const fullName = `${resident.firstName} ${resident.middleName ? resident.middleName + " " : ""}${resident.lastName}`;
    
            const tr = document.createElement("tr");
            tr.setAttribute("data-id", resident.id);
            tr.innerHTML = `
                <td>${rowNumber}.</td>
                <td>${fullName}</td>
                <td>${resident.email}</td>
                <td>Resident123</td>
                <td>${resident.age}</td>
                <td>${resident.birthdate}</td>
                <td>${resident.gender}</td>
                <td>${resident.civilStatus}</td>
                <td>${resident.contactNumber}</td>
                <td>${resident.address}</td>
                <td>${resident.occupation}</td>
                <td>${resident.education}</td>
                <td>${resident.specialCategories}</td>
                <td>${resident.voterInfo}</td>
                <td id="status-${resident.id}">${resident.status}</td>
                <td>
                    <button onclick="toggleStatus('${resident.id}', '${resident.status}')">Toggle Status</button>
                    <button onclick="openEditModal('${resident.id}')">Edit</button>
                    <button onclick="deleteResident('${resident.id}')">Delete</button>
                </td>
            `;
            residentBody.appendChild(tr);
        });
    
        if (residentBody.innerHTML === "") {
            residentBody.innerHTML = "<p>No matching residents found.</p>";
        }
    }
    
    //  Toggle Sorting Between First Name & Last Name on Click
    window.toggleSorting = function () {
        sortOrder = sortOrder === "asc" ? "desc" : "asc";
        document.getElementById("sortIcon").innerText = sortOrder === "asc" ? "▲" : "▼";
        loadResidents(); //  Reloads sorted list
    };    
    
    
// Open Edit Resident Modal with Resident Data
window.openEditModal = async function (residentId) {
    const residentRef = doc(db, "residents", residentId);
    const residentDoc = await getDoc(residentRef);

    if (!residentDoc.exists()) {
        alert("Resident not found.");
        return;
    }

    const resident = residentDoc.data();

    //  Populate the modal with separate name fields
    document.getElementById("edit-resident-id").value = residentId;
    document.getElementById("edit-first-name").value = resident.firstName || "";
    document.getElementById("edit-middle-name").value = resident.middleName || "";
    document.getElementById("edit-last-name").value = resident.lastName || "";

    document.getElementById("edit-age").value = resident.age || "";
    document.getElementById("edit-birthdate").value = resident.birthdate || "";
    document.getElementById("edit-gender").value = resident.gender || "";
    document.getElementById("edit-civil-status").value = resident.civilStatus || "";
    document.getElementById("edit-contact-number").value = resident.contactNumber || "";
    document.getElementById("edit-address").value = resident.address || "";
    document.getElementById("edit-occupation").value = resident.occupation || "";
    document.getElementById("edit-education").value = resident.education || "";
    document.getElementById("edit-special-categories").value = resident.specialCategories || "";
    document.getElementById("edit-voter-info").value = resident.voterInfo || "";

    //  Show the edit modal
    document.getElementById("editResidentModal").style.display = "block";
};

// Update Resident Info in Firestore
document.getElementById("edit-resident-form").addEventListener("submit", async function (event) {
    event.preventDefault();

    const residentId = document.getElementById("edit-resident-id").value;

    //  Get the updated values
    const updatedData = {
        firstName: document.getElementById("edit-first-name").value.trim(),
        middleName: document.getElementById("edit-middle-name").value.trim(),
        lastName: document.getElementById("edit-last-name").value.trim(),
        age: parseInt(document.getElementById("edit-age").value),
        birthdate: document.getElementById("edit-birthdate").value,
        gender: document.getElementById("edit-gender").value,
        civilStatus: document.getElementById("edit-civil-status").value,
        contactNumber: document.getElementById("edit-contact-number").value,
        address: document.getElementById("edit-address").value,
        occupation: document.getElementById("edit-occupation").value,
        education: document.getElementById("edit-education").value,
        specialCategories: document.getElementById("edit-special-categories").value,
        voterInfo: document.getElementById("edit-voter-info").value
    };

    try {
        //  Save the updated data in Firestore
        await updateDoc(doc(db, "residents", residentId), updatedData);

        alert("Resident updated successfully!");
        closeEditModal();
        loadResidents(); // Refresh the table with updated data
    } catch (error) {
        console.error("Error updating resident:", error);
        alert("Failed to update resident.");
    }
});


// Allow only numbers in Contact Number field
    window.onlyNumbers = function (event) {
        const charCode = event.which ? event.which : event.keyCode;
        if (charCode < 48 || charCode > 57) {
            event.preventDefault();
        }
    };

    // Toggle "Other" gender input field visibility
    window.toggleOtherGender = function () {
        const genderSelect = document.getElementById("gender");
        const otherGenderInput = document.getElementById("other-gender");

        if (genderSelect.value === "Other") {
            otherGenderInput.style.display = "block";
            otherGenderInput.required = true;
        } else {
            otherGenderInput.style.display = "none";
            otherGenderInput.required = false;
        }
    };

//  Delete a resident and move to backup collection
window.deleteResident = async function (id) {
    try {
        // Fetch resident data before deletion
        const residentDocRef = doc(db, "residents", id);
        const residentDoc = await getDoc(residentDocRef);

        if (!residentDoc.exists()) {
            alert("Resident not found.");
            return;
        }

        const residentData = residentDoc.data(); //  Ensure correct data is retrieved

        // Confirm deletion
        const confirmation = confirm(`Are you sure you want to delete ${residentData.firstName} ${residentData.lastName}? This action cannot be undone.`);
        if (!confirmation) return;

        // Move resident data to backup collection
        const backupRef = doc(db, "backupResidents", id);
        await setDoc(backupRef, residentData);

        //  Disable/Delete the resident's Firebase Authentication account
        const user = auth.currentUser;

        if (user && user.email === residentData.email) {
            await user.delete();
            console.log(`Firebase Authentication account for ${residentData.email} has been deleted.`);
        } else {
            console.warn(`User not found in Authentication or already logged out.`);
        }

        // Delete resident from original collection
        await deleteDoc(residentDocRef);

        // Remove row from table without full page refresh
        document.querySelector(`[data-id="${id}"]`).remove();

        alert(`${residentData.firstName} ${residentData.lastName} has been deleted and moved to backup.`);
    } catch (error) {
        console.error("Error deleting resident:", error);
        alert("Failed to delete resident.");
    }
};

// Toggle Active/Inactive status for a resident
window.toggleStatus = async function (id) {
    try {
        const residentDocRef = doc(db, "residents", id);
        const residentDoc = await getDoc(residentDocRef);

        if (!residentDoc.exists()) {
            console.error("Resident not found in Firestore.");
            alert("Resident not found.");
            return;
        }

        const currentStatus = residentDoc.data().status;
        const newStatus = currentStatus === "Active" ? "Inactive" : "Active";

        await updateDoc(residentDocRef, { status: newStatus });

        // Update only the status field in the table
        document.getElementById(`status-${id}`).innerText = newStatus;

        // Get counter elements
        const totalResidentsElem = document.getElementById("total-residents");
        const activeResidentsElem = document.getElementById("active-residents");
        const inactiveResidentsElem = document.getElementById("inactive-residents");

        // Check if elements exist before updating
        if (!totalResidentsElem || !activeResidentsElem || !inactiveResidentsElem) {
            console.warn("⚠ Resident counter elements not found in the document.");
            return;
        }

        // Adjust counters dynamically
        if (newStatus === "Active") {
            activeResidentsElem.textContent = parseInt(activeResidentsElem.textContent) + 1;
            inactiveResidentsElem.textContent = parseInt(inactiveResidentsElem.textContent) - 1;
        } else {
            activeResidentsElem.textContent = parseInt(activeResidentsElem.textContent) - 1;
            inactiveResidentsElem.textContent = parseInt(inactiveResidentsElem.textContent) + 1;
        }

        // console.log(`✅ Status updated: ${id} is now ${newStatus}`);
    } catch (error) {
        console.error("Error updating resident status:", error);
        alert("Failed to update status.");
    }
};
    
    // Search residents
    window.searchResidents = function () {
        const query = document.getElementById("search-bar").value.trim().toLowerCase();
        const filteredResidents = allResidents
            .map(resident => {
                const fullName = `${resident.firstName} ${resident.middleName || ""} ${resident.lastName}`.toLowerCase();
                const index = fullName.indexOf(query);
                return { resident, rank: index === -1 ? Infinity : index };
            })
            .filter(item => item.rank !== Infinity)
            .sort((a, b) => a.rank - b.rank)
            .map(item => item.resident);
    
        const displayList = query ? filteredResidents : allResidents;
    
        renderResidentRows(displayList);
    };     

    document.querySelectorAll(".phone-input").forEach(inputField => {
        inputField.addEventListener("input", function (event) {
            let input = event.target.value.replace(/[^0-9]/g, ""); // Remove non-numeric characters
    
            // Ensure it starts with "63" only once
            if (!input.startsWith("63")) {
                input = "63" + input;
            }
    
            // Remove leading zero after "63 "
            if (input.startsWith("630")) {
                input = "63" + input.substring(3);
            }
    
            // Limit to 12 characters total (including "63")
            if (input.length > 12) {
                input = input.slice(0, 12);
            }
    
            event.target.value = "+" + input.slice(0, 2) + " " + input.slice(2); // Format: "+63 XXXXXXXXXX"
        });
    });    
     
// Add a new resident to Firestore and Authentication
document.getElementById("add-resident-form").addEventListener("submit", async function (event) {
    event.preventDefault();

    const addResidentButton = document.getElementById("submitAddResident");
    const addResidentText = document.getElementById("addResidentText");
    const addResidentLoader = document.getElementById("addResidentLoader");

    // Show loading animation & disable button
    addResidentText.style.display = "none";
    addResidentLoader.style.display = "inline-block";
    addResidentButton.disabled = true;

    const firstName = document.getElementById("first-name").value.trim();
    const lastName = document.getElementById("last-name").value.trim();
    const middleName = document.getElementById("middle-name").value.trim();

    // Ensure names are valid and cleaned
    const cleanedFirstName = firstName.replace(/[^a-zA-Z]/g, "").trim();
    const cleanedLastName = lastName.replace(/[^a-zA-Z]/g, "").trim();
    const cleanedMiddleName = middleName.replace(/[^a-zA-Z\s]/g, "").trim();

    if (!cleanedFirstName || !cleanedLastName || !cleanedMiddleName) {
        alert("First name and Last name are required and must contain only letters.");
        return;
    }

    // Function to generate a unique email
    async function generateUniqueEmail(firstName, lastName) {
        const processedFirstName = firstName.trim().toLowerCase().replace(/\s+/g, '.');
        const processedLastName = lastName.trim().toLowerCase();
        
        let baseEmail = `${processedFirstName}.${processedLastName}`;
        let email = `${baseEmail}@yourdomain.com`;
        let count = 1;
    
        while (true) {
            try {
                // 🔹 Check if email exists in "residents" or "backupResidents"
                const residentRef = doc(db, "residents", email);
                const backupRef = doc(db, "backupResidents", email);
    
                const [residentSnap, backupSnap] = await Promise.all([
                    getDoc(residentRef),
                    getDoc(backupRef)
                ]);
    
                if (!residentSnap.exists() && !backupSnap.exists()) {
                    return email; // Found a unique email, return it!
                }
    
                console.warn(`⚠️ Email ${email} already exists. Generating a new one...`);
                email = `${baseEmail}${count}@yourdomain.com`;
                count++;
            } catch (error) {
                console.error("❌ Error checking email:", error);
                return email; // Prevent infinite loop if an error occurs
            }
        }
    }    

    // Generate a unique email and Firestore document ID
    const email = await generateUniqueEmail(cleanedFirstName, cleanedLastName);
    const password = "Resident123"; // Default password
    const customId = email.toLowerCase(); // Use email as Firestore document ID

    const age = parseInt(document.getElementById("age").value);
    const birthdate = document.getElementById("birthdate").value;
    const gender = document.getElementById("gender").value;
    const civilStatus = document.getElementById("civil-status").value;
    const contactNumber = document.getElementById("contact-number").value.trim();
    const address = document.getElementById("address").value.trim();
    const occupation = document.getElementById("occupation").value.trim();
    const education = document.getElementById("education").value;
    const specialCategories = document.getElementById("special-categories").value;
    const voterInfo = document.getElementById("voter-info").value.trim();

    if (isNaN(age) || !birthdate || !gender || !contactNumber || !address) {
        alert("Please fill in all required fields.");
        return;
    }

    try {

        let userCredential;
        while (true) {
            try {
                console.log("Creating user in Firebase Authentication...");
                userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
                break; // Exit loop if successful
            } catch (error) {
                if (error.code === "auth/email-already-in-use") {
                    console.warn(`⚠️ Email ${email} already in use. Generating a new one...`);
                    email = await generateUniqueEmail(cleanedFirstName, cleanedLastName);
                    continue; // Try again with a new email
                }
                throw error; // If another error occurs, stop execution
            }
        }


        console.log("Saving resident data in Firestore with Custom ID...");
        await setDoc(doc(db, "residents", customId), {
            id: customId,  // 🔹 Store the custom ID inside the document
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            middleName: middleName.trim(),
            email,
            age,
            birthdate,
            gender,
            civilStatus,
            contactNumber,
            address,
            occupation,
            education,
            specialCategories,
            voterInfo,
            status: "Active",
        });

        // alert(`Resident added successfully with ID: ${customId}`);
        closeAddResidentModal();
        loadResidents();
    } catch (error) {
        console.error("❌ Error adding resident:", error);
        alert(`Failed to add resident: ${error.message}`);
    }finally {
        resetLoadingState(); // ✅ Reset loading animation
    }
});

    //  Reset button & hide loading animation after submission
    function resetLoadingState() {
        const addResidentButton = document.getElementById("submitAddResident");
        const addResidentText = document.getElementById("addResidentText");
        const addResidentLoader = document.getElementById("addResidentLoader");

        addResidentText.style.display = "inline";
        addResidentLoader.style.display = "none";
        addResidentButton.disabled = false;
    }

    // Prevent numbers in name fields
document.querySelectorAll("#first-name, #middle-name, #last-name, #edit-first-name, #edit-middle-name, #edit-last-name").forEach(input => {
    input.addEventListener("input", function () {
        this.value = this.value.replace(/[0-9]/g, ""); // Remove digits
    });
});

// Prevent 'e', '+', '-' in number fields like Age
document.querySelectorAll("#age, #edit-age").forEach(input => {
    input.addEventListener("keydown", function (event) {
        if (["e", "E", "+", "-"].includes(event.key)) {
            event.preventDefault();
        }
    });
});

    // Load residents on page load
    loadResidents();
});

