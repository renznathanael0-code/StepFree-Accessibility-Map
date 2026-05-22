const isAdminPage = window.location.pathname.includes("admin.html");

if (isAdminPage) {
    const login = prompt("StepFree Admin-Bereich\nBitte Passwort eingeben:");
    if (btoa(login) !== "ZldpUyE=") { 
        alert("Zugriff verweigert!");
        window.location.href = "index.html"; 
    }
}

const PANTRY_ID = "d9785260-5904-4964-ba0b-8389092f3adb"; 
const BASKET_NAME = "freeway_stuttgart"; // Bleibt wie gewünscht beim alten Namen
const PANTRY_URL = `https://getpantry.cloud/apiv1/pantry/${PANTRY_ID}/basket/${BASKET_NAME}`;

let map, myLocationMarker, reportsData = [], activeMarkers = {};

// Distanzberechnung für den Vor-Ort-Check
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; 
}

async function initApp() {
    const splash = document.getElementById('splash-screen');
    // fadeAnimation aus für schnellere Reaktion beim Scrollen
    map = L.map('map', { fadeAnimation: false }).setView([48.775, 9.182], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    
    map.on('click', e => openSelectionPopup(e.latlng));
    
    // Performance-Trick: Bei Kartenbewegung nur sichtbare Marker zeichnen
    map.on('moveend', () => drawMarkersOnMap());

    setupLocationTracking();

    updateStatus("Lade Community-Daten...", "#3498db");
    try {
        await loadFromCommunity();
        updateStatus("Community Live ✅", "#27AE60");
    } catch (e) {
        updateStatus("Eingeschränkt bereit ⚠️", "#E67E22");
    }

    setTimeout(() => {
        if(splash) {
            splash.style.opacity = '0';
            setTimeout(() => {
                splash.style.display = 'none';
                map.invalidateSize();
            }, 800);
        }
    }, 1000);
}

function setupLocationTracking() {
    const locationIcon = L.divIcon({
        html: `<div style="background:#3498db; width:12px; height:12px; border-radius:50%; border:3px solid white; box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>`,
        className: '',
        iconSize: [18, 18]
    });
    map.locate({watch: true, enableHighAccuracy: true});
    map.on('locationfound', e => {
        if (myLocationMarker) {
            myLocationMarker.setLatLng(e.latlng);
        } else {
            myLocationMarker = L.marker(e.latlng, {icon: locationIcon}).addTo(map);
            myLocationMarker.bindPopup("Du bist hier");
            map.setView(e.latlng, 16);
        }
    });
}

async function loadFromCommunity() {
    try {
        const response = await fetch(PANTRY_URL);
        if (response.ok) {
            const result = await response.json();
            reportsData = result.markers || [];
            drawMarkersOnMap();
        }
    } catch (err) { console.error("Ladefehler:", err); }
}

async function saveToCommunity() {
    updateStatus("Speichere...", "#f39c12");
    try {
        await fetch(PANTRY_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ markers: reportsData })
        });
        updateStatus("Community Live ✅", "#27AE60");
    } catch (err) { updateStatus("Sync-Fehler ❌", "#E74C3C"); }
}

function updateStatus(text, color) {
    const s = document.getElementById('sync-status');
    if(s) {
        s.innerHTML = text;
        s.style.background = color;
    }
}

function drawMarkersOnMap() {
    const bounds = map.getBounds();
    
    // 1. Marker löschen, die aus dem Sichtfeld gewandert sind
    Object.keys(activeMarkers).forEach(id => {
        const m = activeMarkers[id];
        if (!bounds.contains(m.getLatLng())) {
            map.removeLayer(m);
            delete activeMarkers[id];
        }
    });

    // 2. Nur Marker im aktuellen Ausschnitt neu erstellen
    reportsData.forEach((r) => {
        const pos = L.latLng(r.lat, r.lng);
        
        if (bounds.contains(pos) && !activeMarkers[r.id]) {
            let emoji = "📍";
            if (r.typ.includes("Treppe")) emoji = "🪜";
            if (r.typ.includes("defekt") || r.typ.includes("Aufzug")) emoji = "🛗";
            if (r.typ.includes("WC")) emoji = "🚽";
            if (r.typ.includes("Parkplatz")) emoji = "🅿️";
            if (r.typ.includes("Baustelle")) emoji = "🚧";

            let adminStyle = "";
            if (isAdminPage) {
                if (r.votes <= -3) adminStyle = "box-shadow: 0 0 15px 5px red; border: 2px solid red;"; 
                else if (r.status === "new") adminStyle = "box-shadow: 0 0 15px 5px #3498db; border: 2px solid #3498db;"; 
            }

            const icon = L.divIcon({
                html: `<div style="background:${r.farbe}; width:30px; height:30px; display:flex; align-items:center; justify-content:center; border-radius:50%; border:2px solid white; color:white; ${adminStyle}">${emoji}</div>`,
                className: '', 
                iconSize: [30, 30]
            });

            const m = L.marker([r.lat, r.lng], {icon}).addTo(map);
            
            if (isAdminPage && r.status === "new") {
                m.on('click', () => adminReviewDone(r.id));
            }

            const gMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}&travelmode=walking`;
            
            let popupContent = `<div style="font-family:sans-serif; min-width:200px;">`;
            if (isAdminPage) {
                if (r.votes <= -3) popupContent += `<b style="color:red; font-size:10px;">⚠️ KRITISCH</b><br>`;
                if (r.status === "new") popupContent += `<b style="color:#3498db; font-size:10px;">🆕 NEU</b><br>`;
            }

            popupContent += `
                <b style="font-size:1.1em;">${r.typ}</b><br>
                <p style="margin: 5px 0; color:#555;">${r.kommentar}</p>
                <div style="background:#eee; padding:5px; border-radius:5px; text-align:center; margin-bottom:10px; font-size: 0.9em;">
                    Community-Vertrauen: <b>${r.votes || 0}</b>
                </div>`;

            if (isAdminPage && r.verifiedAt) {
                popupContent += `<div style="background:#D4EFDF; color:#1D8348; padding:5px; border-radius:5px; margin-bottom:10px; font-size:0.8em;">✅ Check: ${r.verifiedAt}</div>`;
            }

            popupContent += `
                <div style="display:flex; gap:5px; margin-bottom:10px;">
                    <button onclick="vote('${r.id}', 1)" style="flex:1; background:#27AE60; color:white; border:none; padding:8px; border-radius:5px; cursor:pointer;">✅</button>
                    <button onclick="vote('${r.id}', -1)" style="flex:1; background:#E67E22; color:white; border:none; padding:8px; border-radius:5px; cursor:pointer;">❌</button>
                </div>
                <a href="${gMapsUrl}" target="_blank" style="text-decoration:none;">
                    <button style="background:#4285F4; color:white; border:none; padding:10px; width:100%; border-radius:5px; margin-bottom:10px; cursor:pointer; font-weight:bold;">🗺️ Navigation</button>
                </a>`;

            if (isAdminPage) {
                popupContent += `<button onclick="directDelete('${r.id}')" style="background:#e74c3c; color:white; border:none; padding:8px; width:100%; border-radius:5px; cursor:pointer; margin-bottom:5px;">🗑️ Löschen</button>
                                 <button onclick="askForCheck('${r.id}')" style="background:#3498db; color:white; border:none; padding:8px; width:100%; border-radius:5px; cursor:pointer;">📍 Check anfordern</button>`;
            } else if (r.needsCheck) {
                popupContent += `<button onclick="verifyByLocation('${r.id}')" style="background:#f39c12; color:white; border:none; padding:10px; width:100%; border-radius:5px; cursor:pointer;">📍 Hier einchecken (GPS)</button>`;
            }

            popupContent += `</div>`; 
            m.bindPopup(popupContent);
            activeMarkers[r.id] = m;
        }
    }); 
}

// --- Hilfsfunktionen für Admin & User ---

function directDelete(id) {
    if (confirm("Diesen Punkt wirklich für alle löschen?")) {
        reportsData = reportsData.filter(r => r.id !== id);
        saveToCommunity();
        drawMarkersOnMap();
    }
}

function askForCheck(id) {
    const r = reportsData.find(item => item.id === id);
    if (r) {
        r.needsCheck = true;
        r.status = "active"; 
        saveToCommunity();
        drawMarkersOnMap();
        alert("Vor-Ort-Check angefordert!");
    }
}

function verifyByLocation(id) {
    navigator.geolocation.getCurrentPosition((pos) => {
        const report = reportsData.find(r => r.id === id);
        const dist = getDistance(pos.coords.latitude, pos.coords.longitude, report.lat, report.lng);

        if (dist <= 0.05) { 
            report.needsCheck = false;
            report.verifiedAt = new Date().toLocaleString('de-DE');
            saveToCommunity();
            drawMarkersOnMap();
            alert("Bestätigt! Dein Standort wurde verifiziert.");
        } else {
            alert(`Zu weit entfernt! (${Math.round(dist * 1000)}m). Du musst näher ran.`);
        }
    });
}

function openSelectionPopup(latlng) {
  const content = `
    <div style="width: 280px; font-family: sans-serif; padding: 10px;">
      <b style="display: block; text-align: center; margin-bottom: 15px;">Eintrag hinzufügen</b>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Treppe', '#E74C3C')" style="background:#E74C3C; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer;">🪜 Treppe melden</button>
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Aufzug defekt', '#E67E22')" style="background:#E67E22; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer;">🛗 Aufzug defekt</button>
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Baustelle', '#F1C40F')" style="background:#F1C40F; color:black; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer;">🚧 Baustelle</button>
        <hr style="border: 0; border-top: 1px solid #ccc; margin: 5px 0;">
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Aufzug vorhanden', '#27AE60')" style="background:#27AE60; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer;">🛗 Aufzug vorhanden</button>
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'WC barrierefrei', '#2ECC71')" style="background:#2ECC71; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer;">🚽 WC barrierefrei</button>
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Parkplatz', '#3498DB')" style="background:#3498DB; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer;">🅿️ Parkplatz</button>
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Barrierefreier Ort', '#9B59B6')" style="background:#9B59B6; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer;">📍 Barrierefreier Ort</button>
      </div>
    </div>`;
  L.popup().setLatLng(latlng).setContent(content).openOn(map);
}

function finalizeReport(lat, lng, typ, farbe) {
    const details = prompt(`Zusatzinfos für ${typ}:`, "");
    reportsData.push({
        lat: lat, lng: lng, typ: typ, farbe: farbe, 
        kommentar: details || "", 
        id: "id_" + Date.now(), 
        votes: 0, 
        status: "new" 
    });
    saveToCommunity();
    drawMarkersOnMap();
    map.closePopup();
}

async function vote(id, change) {
    const report = reportsData.find(r => r.id === id);
    if (!report) return;
    let myVotes = JSON.parse(localStorage.getItem('userVotes') || "{}");
    if (myVotes[id]) return alert("Bereits abgestimmt!");
    report.votes += change;
    myVotes[id] = true;
    localStorage.setItem('userVotes', JSON.stringify(myVotes));
    if (report.votes <= -3) report.status = "review";
    saveToCommunity();
    drawMarkersOnMap();
}

function adminReviewDone(id) {
    const r = reportsData.find(item => item.id === id);
    if (r && r.status === "new") {
        r.status = "active";
        saveToCommunity();
        drawMarkersOnMap();
    }
}

window.onload = initApp;