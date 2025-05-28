import { db , auth} from "../firebase-config.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";
import { doc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";
import { createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import { secondaryAuth } from "../firebase-config.js"; // Import secondary auth

const backupRef = collection(db, "backupResidents");
let allArchivedResidents = [];

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

document.addEventListener("DOMContentLoaded", async () => {
    const historyBody = document.getElementById("history-body");
    const searchInput = document.getElementById("search-history");

    try {
        const snapshot = await getDocs(backupRef);
        snapshot.forEach(doc => {
            allArchivedResidents.push(doc.data());
        });

        renderHistoryRows(allArchivedResidents);

        // Search functionality
        searchInput.addEventListener("input", () => {
            const query = searchInput.value.trim().toLowerCase();
            const filtered = allArchivedResidents.filter(r => {
                const fullName = `${r.firstName} ${r.middleName || ""} ${r.lastName}`.toLowerCase();
                return fullName.includes(query);
            });

            renderHistoryRows(filtered);
        });

    } catch (error) {
        console.error("Error loading archived residents:", error);
        historyBody.innerHTML = "<p>Error loading history.</p>";
    }
});

function renderHistoryRows(residents) {
  const historyBody = document.getElementById("history-body");
  historyBody.innerHTML = "";

  residents.forEach((resident, index) => {
      const fullName = `${resident.firstName} ${resident.middleName || ""} ${resident.lastName}`;
      const tr = document.createElement("tr");
      tr.innerHTML = `
      <td>${index + 1}.</td>
      <td>${fullName}</td>
      <td>${resident.email || "-"}</td>
      <td>${resident.age || "-"}</td>
      <td>${resident.birthdate || "-"}</td>
      <td>${resident.gender || "-"}</td>
      <td>${resident.civilStatus || "-"}</td>
      <td>${resident.contactNumber || "-"}</td>
      <td>${resident.address || "-"}</td>
      <td>${resident.occupation || "-"}</td>
      <td>${resident.education || "-"}</td>
      <td>${resident.specialCategories || "-"}</td>
      <td>${resident.voterInfo || "-"}</td>
      <td>
          <button onclick="restoreResident('${resident.id}')">Restore</button>
      </td>
  `;  
      historyBody.appendChild(tr);
  });

  if (residents.length === 0) {
      historyBody.innerHTML = "<tr><td colspan='13'>No archived residents found.</td></tr>";
  }
}

window.restoreResident = async function (id) {
  try {
      const backupDocRef = doc(db, "backupResidents", id);
      const backupSnap = await getDoc(backupDocRef);

      if (!backupSnap.exists()) {
          alert("Backup data not found.");
          return;
      }

      const data = backupSnap.data();

      // Confirm restore action
      const confirmRestore = confirm(`Restore ${data.firstName} ${data.lastName}?`);
      if (!confirmRestore) return;

      // Recreate Firebase Auth account
      try {
          await createUserWithEmailAndPassword(secondaryAuth, data.email, "Resident123");
          console.log("✅ Auth account restored.");
      } catch (authErr) {
          console.warn("⚠ Auth restore failed:", authErr.message);
          // Proceed anyway if email already exists
      }

      // Move data to 'residents'
      await setDoc(doc(db, "residents", id), data);

      // Remove from backup
      await deleteDoc(backupDocRef);

      alert(`${data.firstName} has been restored.`);

      // Remove from UI
      allArchivedResidents = allArchivedResidents.filter(r => r.id !== id);
      renderHistoryRows(allArchivedResidents);

  } catch (err) {
      console.error("❌ Error restoring resident:", err);
      alert("Failed to restore resident.");
  }
};