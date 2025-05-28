import { db, auth } from "../firebase-config.js";
import { collection, getDocs, updateDoc, doc, getDoc
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";

// Firestore reference
const requestCollection = collection(db, "documentRequests");

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
  loadRequests(); // Load once user is authenticated and verified
});

let requests = [];

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

async function loadRequests() {
  const pendingRequestsBody = document.getElementById("pending-requests");
  const processedRequestsBody = document.getElementById("processed-requests");

  pendingRequestsBody.innerHTML = "<tr><td colspan='6'>Loading...</td></tr>";
  processedRequestsBody.innerHTML = "<tr><td colspan='6'>Loading...</td></tr>";

  try {
    const querySnapshot = await getDocs(requestCollection);
    requests = [];

    for (const docSnap of querySnapshot.docs) {
      const request = docSnap.data();
      const requestId = docSnap.id;
      let residentName = request.residentName || "Unknown";

      if ((!request.residentName || residentName === "Unknown") && request.userId) {
        const residentRef = doc(db, "residents", request.userId);
        const residentDoc = await getDoc(residentRef);

        if (residentDoc.exists()) {
          const data = residentDoc.data();
          const { firstName = "", middleName = "", lastName = "" } = data;
          residentName = `${firstName} ${middleName} ${lastName}`.trim();
        }
      }

      if (request.date && request.date.seconds) {
        request.date = new Date(request.date.seconds * 1000);
      } else {
        request.date = new Date(request.date);
      }

      requests.push({ ...request, id: requestId, residentName });
    }

    renderRequests(); // Sort + display the loaded data
  } catch (error) {
    console.error("Error loading document requests:", error);
    pendingRequestsBody.innerHTML = "<tr><td colspan='6'>Failed to load pending requests.</td></tr>";
    processedRequestsBody.innerHTML = "<tr><td colspan='6'>Failed to load processed requests.</td></tr>";
  }
}

let pendingSortOrder = 'desc';
let processedSortOrder = 'desc';

function renderRequests() {
    const pendingRequestsBody = document.getElementById("pending-requests");
    const processedRequestsBody = document.getElementById("processed-requests");
  
    pendingRequestsBody.innerHTML = "";
    processedRequestsBody.innerHTML = "";
  
    // Sort and filter requests
    const pendingRequests = requests
      .filter((req) => req.status === "Pending")
      .sort((a, b) => {
        return pendingSortOrder === 'asc' ? a.date - b.date : b.date - a.date;
      });
  
    const processedRequests = requests
      .filter((req) => req.status !== "Pending")
      .sort((a, b) => {
        return processedSortOrder === 'asc' ? a.date - b.date : b.date - a.date;
      });
  
    // Render pending
    if (pendingRequests.length === 0) {
      pendingRequestsBody.innerHTML = "<tr><td colspan='6'>No pending requests.</td></tr>";
    } else {
        pendingRequests.forEach((request) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
              <td>${request.residentName}</td>
              <td>${request.type}</td>
              <td>${request.note}</td>
              <td id="status-${request.id}">${request.status}</td>
              <td>${formatDate(request.date)}</td>
              <td>
                <div class="action-buttons">
                  <button class="request-btn" style="background: #4CAF50;" onclick="openReasonModal('${request.id}', 'Approved', '${request.residentName}')">Approve</button>
                  <button class="request-btn" style="background: #d32f2f;" onclick="openReasonModal('${request.id}', 'Rejected', '${request.residentName}')">Reject</button>
                </div>
              </td>
            `;
            pendingRequestsBody.appendChild(tr);
          });          
    }
  
    // Render processed
    if (processedRequests.length === 0) {
      processedRequestsBody.innerHTML = "<tr><td colspan='6'>No processed requests.</td></tr>";
    } else {
        processedRequests.forEach((request) => {
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
              <td>${request.residentName}</td>
              <td>${request.type}</td>
              <td>${request.note}</td>
              <td id="status-${request.id}">${request.status}</td>
              <td>${formatDate(request.date)}</td>
              <td>${actionTimeText}</td>
              <td>${comment}</td>
            `;
            processedRequestsBody.appendChild(tr);
          });                 
    }
  }
  

// Toggle button functionality
window.toggleSortPending = function () {
    pendingSortOrder = pendingSortOrder === "asc" ? "desc" : "asc";
    const icon = pendingSortOrder === "asc" ? "🔼" : "🔽";
    document.getElementById("sortToggleBtn").innerText = icon;
    renderRequests();
  };
  
  window.toggleSortProcessed = function () {
    processedSortOrder = processedSortOrder === "asc" ? "desc" : "asc";
    const icon = processedSortOrder === "asc" ? "🔼" : "🔽";
    document.getElementById("sortToggleBtn1").innerText = icon;
    renderRequests();
  };
  

  let currentAction = "";
  let currentRequestId = "";
  let currentResidentName = "";
  
  window.openReasonModal = function (requestId, action, residentName) {
    currentAction = action;
    currentRequestId = requestId;
    currentResidentName = residentName;
  
    document.getElementById("modal-title").innerText = `${action} Request for ${residentName}`;
    document.getElementById("action-type").innerText = action.toLowerCase();
    document.getElementById("action-reason").value = "";
    document.getElementById("reason-modal").style.display = "block";
  };
  
  window.closeReasonModal = function () {
    document.getElementById("reason-modal").style.display = "none";
  };
  
  window.confirmAction = async function () {
    const reason = document.getElementById("action-reason").value;
  
    try {
      // Update the status of the request
      await updateRequestStatus(currentRequestId, currentAction, reason);
  
      // Close the modal
      closeReasonModal();
  
      // Reload the requests list to reflect the updated status
      loadRequests();
    } catch (error) {
      console.error("Error updating request:", error);
    }
  };
  
  // Function to update request status in Firestore
  async function updateRequestStatus(requestId, status, reason = "") {
    const requestRef = doc(db, "documentRequests", requestId);
    await updateDoc(requestRef, {
      status: status,
      actionReason: reason,
      actedAt: new Date().toISOString(),
    });
  
    // Optionally, you can update the status immediately in the DOM without reloading
    document.getElementById(`status-${requestId}`).innerText = status;
  }
  
  
