import { db, auth } from "../firebase-config.js";
import { collection, addDoc, getDocs, query, where, doc, getDoc, Timestamp, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";
import { onAuthStateChanged, signOut} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";

// Firestore Reference
const requestCollection = collection(db, "documentRequests");

// DOM Elements
const requestModal = document.getElementById("request-modal");
const openModalButton = document.getElementById("open-modal-btn");
const closeModalButton = document.getElementById("close-modal-btn");
const requestForm = document.getElementById("request-form");
const documentTypeSelect = document.getElementById("document-type");
const otherDocumentInput = document.getElementById("custom-document-type");
const requestNoteInput = document.getElementById("request-note");
const pendingRequestBody = document.getElementById("pending-requests-body");
const completedRequestBody = document.getElementById("completed-requests-body");
const residentNameDisplay = document.getElementById("resident-name");

// Function to check if the user is a resident
async function getResidentData(user) {
    if (!user) return null;

    try {
        const residentRef = doc(db, "residents", user.email);
        const residentSnap = await getDoc(residentRef);

        if (residentSnap.exists()) {
            return residentSnap.data();
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error fetching resident data:", error);
        return null;
    }
}

// Handle Authentication & Role-Based Access
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        console.warn("No user logged in. Redirecting to login.");
        window.location.href = "../index.html";
        return;
    }

    const residentData = await getResidentData(user);

    if (!residentData) {
        console.warn("Unauthorized access. Redirecting...");
        await signOut(auth);
        window.location.href = "../index.html";
        return;
    }

    console.log("User verified as Resident:", residentData);

    // Store resident data in sessionStorage
    sessionStorage.setItem("residentData", JSON.stringify(residentData));

    // Update UI
    updateResidentName(residentData);
    loadRequests();
});

// Update Resident Name Display
function updateResidentName(residentData) {
    if (!residentData || !residentData.firstName || !residentData.lastName) {
        residentNameDisplay.innerText = "Logged in as: Unknown Resident";
        return;
    }

    const fullName = `${residentData.firstName} ${residentData.lastName}`;
    residentNameDisplay.innerText = `Logged in as: ${fullName}`;
}

// Open Modal
openModalButton.addEventListener("click", () => {
    requestModal.showModal();
});

// Close Modal
closeModalButton.addEventListener("click", () => {
    requestModal.close();
});

// Show/Hide "Other Document" Input Based on Selection
document.addEventListener("DOMContentLoaded", function () {
    // Select elements
    const documentTypeSelect = document.getElementById("document-type");
    const customDocumentContainer = document.getElementById("custom-document-type-container");
    const otherDocumentInput = document.getElementById("custom-document-type");

    // Listen for changes in the dropdown
    documentTypeSelect.addEventListener("change", () => {
        console.log("Selected value:", documentTypeSelect.value); // Debugging log

        if (documentTypeSelect.value === "Others") {
            customDocumentContainer.style.display = "block"; // Show input field
            otherDocumentInput.setAttribute("required", "true");
        } else {
            customDocumentContainer.style.display = "none"; // Hide input field
            otherDocumentInput.removeAttribute("required");
            otherDocumentInput.value = ""; // Clear input
        }
    });
});

// Submit Document Request
async function submitRequest(event) {
    event.preventDefault();

    const documentTypeSelect = document.getElementById("document-type");
    const otherDocumentInput = document.getElementById("custom-document-type");
    const requestNoteInput = document.getElementById("request-note");
    const requestForm = document.getElementById("request-form");
    const requestModal = document.getElementById("request-modal");
    const requestCollection = collection(db, "documentRequests");

    const documentType = documentTypeSelect.value;
    const otherDocument = otherDocumentInput.value.trim();
    const requestNote = requestNoteInput.value.trim();
    const residentData = JSON.parse(sessionStorage.getItem("residentData"));

    if (!documentType || !requestNote || (documentType === "Others" && !otherDocument)) {
        alert("Please complete all fields.");
        return;
    }

    if (!residentData) {
        alert("Error: Could not retrieve resident data. Please log in again.");
        return;
    }

    const fullName = `${residentData.firstName} ${residentData.lastName}`;

    const newRequest = {
        userId: residentData.email,
        residentName: fullName,
        type: documentType === "Others" ? otherDocument : documentType,
        note: requestNote,
        status: "Pending",
        date: Timestamp.now(),  // Store Firestore Timestamp instead of a string
    };

    try {
        await addDoc(requestCollection, newRequest);
        alert("Your request has been submitted.");
        requestForm.reset();
        document.getElementById("custom-document-type-container").style.display = "none";
        requestModal.close();
        loadRequests();
    } catch (error) {
        console.error("Error submitting request:", error);
        alert("Failed to submit request.");
    }
}

// Function to format Firestore Timestamp into "March 31, 2025, 4:41 PM"
function formatDate(date) {
    return date.toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }
  
let pendingRequests = [];

// Load Requests for Logged-in Resident
async function loadRequests() {
    const residentData = JSON.parse(sessionStorage.getItem("residentData"));
    if (!residentData) return;
    const userId = residentData.email;

    pendingRequestBody.innerHTML = "<tr><td colspan='6'>Loading...</td></tr>";
    completedRequestBody.innerHTML = "<tr><td colspan='6'>Loading...</td></tr>";

    try {
        const q = query(requestCollection, where("userId", "==", userId));
        const querySnapshot = await getDocs(q);

        // Use the global pendingRequests
        pendingRequests = [];
        let completedRequests = [];

        querySnapshot.forEach((doc) => {
            const request = { id: doc.id, ...doc.data() };

            // Convert Firestore Timestamp to JavaScript Date
            if (request.date && request.date.seconds) {
                request.date = new Date(request.date.seconds * 1000);
            } else {
                request.date = new Date(request.date);
            }

            if (request.status === "Pending") {
                pendingRequests.push(request);
            } else {
                completedRequests.push(request);
            }
        });

        // Sort by most recent first
        pendingRequests.sort((a, b) => b.date - a.date);
        completedRequests.sort((a, b) => b.date - a.date);

        pendingRequestBody.innerHTML = "";
        completedRequestBody.innerHTML = "";

        pendingRequests.forEach((request) => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${request.residentName || "Unknown"}</td>
                <td>${request.type}</td>
                <td>${request.note}</td>
                <td>${request.status}</td>
                <td>${formatDate(request.date)}</td>
                <td>
                    <button class="edit-btn" data-id="${request.id}">Edit</button>
                    <button class="cancel-btn" data-id="${request.id}">Cancel</button>
                </td>
            `;
            pendingRequestBody.appendChild(row);
        });

        // Attach event listeners after table is populated
        document.querySelectorAll(".edit-btn").forEach(button => {
            button.addEventListener("click", openEditModal);
        });
        document.querySelectorAll(".cancel-btn").forEach(button => {
            button.addEventListener("click", cancelRequest);
        });

        completedRequests.forEach((request) => {
            const tr = document.createElement("tr");
        
            let actionTimeText = "N/A";
            if (
                request.actedAt &&
                !isNaN(new Date(request.actedAt)) &&
                new Date(request.actedAt).getTime() > 0
            ) {
                const actedDate = new Date(request.actedAt);
                actionTimeText = `${request.status} at ${formatDate(actedDate)}`;
            }
        
            const comment = request.actionReason ? request.actionReason : "No comment";
        
            tr.innerHTML = `
                <td>${request.residentName || "Unknown"}</td>
                <td>${request.type || "-"}</td>
                <td>${request.note || "-"}</td>
                <td>${request.status || "-"}</td>
                <td>${formatDate(
                    request.date?.seconds
                        ? new Date(request.date.seconds * 1000)
                        : new Date(request.date)
                )}</td>
                <td>${actionTimeText}</td>
                <td>${comment}</td>
            `;
            completedRequestBody.appendChild(tr);
        });
        
        if (pendingRequestBody.innerHTML === "") {
            pendingRequestBody.innerHTML = "<tr><td colspan='6'>No pending requests.</td></tr>";
        }
        if (completedRequestBody.innerHTML === "") {
            completedRequestBody.innerHTML = "<tr><td colspan='6'>No completed requests.</td></tr>";
        }
    } catch (error) {
        console.error("Error loading requests:", error);
        pendingRequestBody.innerHTML = "<tr><td colspan='6'>Failed to load requests.</td></tr>";
        completedRequestBody.innerHTML = "<tr><td colspan='6'>Failed to load requests.</td></tr>";
    }
}

// Event Listener for Form Submission
requestForm.addEventListener("submit", submitRequest);

// Show "Others" input field when selected
document.getElementById("edit-document-type").addEventListener("change", function () {
    const otherInputContainer = document.getElementById("edit-custom-document-type-container");
    if (this.value === "Others") {
        otherInputContainer.style.display = "block";
    } else {
        otherInputContainer.style.display = "none";
        document.getElementById("edit-custom-document-type").value = ""; // Clear input if not needed
    }
});

// Open Edit Modal and Pre-fill Data
function openEditModal(event) {
    const requestId = event.target.dataset.id;
    const request = pendingRequests.find(req => req.id === requestId); // Ensure access to pendingRequests

    if (!request) {
        console.error("Request not found.");
        return;
    }

    document.getElementById("edit-request-id").value = requestId;
    document.getElementById("edit-document-type").value = request.type;
    document.getElementById("edit-request-note").value = request.note;

    // Check if request type is a predefined type or a custom one
    const predefinedTypes = ["Barangay Clearance", "Certificate of Residency", "Indigency Certificate", "Barangay ID"];
    if (!predefinedTypes.includes(request.type)) {
        document.getElementById("edit-document-type").value = "Others";
        document.getElementById("edit-custom-document-type-container").style.display = "block";
        document.getElementById("edit-custom-document-type").value = request.type;
    } else {
        document.getElementById("edit-custom-document-type-container").style.display = "none";
        document.getElementById("edit-custom-document-type").value = "";
    }

    document.getElementById("edit-request-modal").showModal();
}

// Save Edited Request to Firestore
async function saveEditedRequest(event) {
    event.preventDefault();

    const requestId = document.getElementById("edit-request-id").value;
    const documentType = document.getElementById("edit-document-type").value;
    const otherDocument = document.getElementById("edit-custom-document-type").value.trim();
    const requestNote = document.getElementById("edit-request-note").value.trim();

    // Validate input
    if (!documentType || !requestNote || (documentType === "Others" && !otherDocument)) {
        alert("Please complete all fields.");
        return;
    }

    const updatedRequest = {
        type: documentType === "Others" ? otherDocument : documentType,
        note: requestNote,
        date: Timestamp.fromDate(new Date()) // Correct timestamp for Firestore sorting
    };

    try {
        const requestRef = doc(db, "documentRequests", requestId);
        await updateDoc(requestRef, updatedRequest);
        alert("Request updated successfully.");
        document.getElementById("edit-request-modal").close();
        loadRequests(); // Refresh table
    } catch (error) {
        console.error("Error updating request:", error);
        alert("Failed to update request.");
    }
}

// Cancel Request and Delete from Firestore
async function cancelRequest(event) {
    const requestId = event.target.dataset.id;
    const confirmDelete = confirm("Are you sure you want to cancel this request?");
    if (!confirmDelete) return;

    try {
        const requestRef = doc(db, "documentRequests", requestId);
        await deleteDoc(requestRef);
        alert("Request canceled successfully.");
        loadRequests(); // Refresh table
    } catch (error) {
        console.error("Error canceling request:", error);
        alert("Failed to cancel request.");
    }
}

// Attach Event Listeners
document.getElementById("edit-request-form").addEventListener("submit", saveEditedRequest);
document.getElementById("close-edit-modal-btn").addEventListener("click", () => {
    document.getElementById("edit-request-modal").close();
});
