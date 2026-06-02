const isAdminPage = window.location.pathname.includes("admin.html");

if (isAdminPage) {
    const login = prompt("StepFree Admin-Bereich\nBitte Passwort eingeben:");
    if (btoa(login) !== "ZldpUyE=") { 
        alert("Zugriff verweigert!");
        window.location.href = "index.html"; 
    }
}

const DATA_URL = "https://stepfree-7c252-default-rtdb.europe-west1.firebasedatabase.app/mapdata.json";
let map, myLocationMarker, reportsData = [], activeMarkers = {};

// Distanzberechnung für den Vor-Ort-Check
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Kilometer
}

async function initApp() {
    const splash = document.getElementById('splash-screen');
    
    // Karte initialisieren
    map = L.map('map').setView([48.775, 9.182], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    
    map.on('click', e => openSelectionPopup(e.latlng));
    setupLocationTracking();

// Suchleiste hinzufügen
L.Control.geocoder({
    defaultMarkGeocode: false,
    placeholder: "Stadt oder Straße suchen...",
    errorMessage: "Nichts gefunden."
})
.on('markgeocode', function(e) {
    var bbox = e.geocode.bbox;
    var poly = L.polygon([
        bbox.getSouthEast(),
        bbox.getNorthEast(),
        bbox.getNorthWest(),
        bbox.getSouthWest()
    ]);
    map.fitBounds(poly.getBounds()); // Zoomt zum gefundenen Ort
})
.addTo(map);

    // Daten laden
    await loadFromCommunity();

    // Event-Listener für Kartenbewegung
    map.on('moveend', drawMarkersOnMap);
    map.on('zoomend', drawMarkersOnMap);

    if(splash) {
        setTimeout(() => {
            splash.style.opacity = '0';
            setTimeout(() => {
                splash.style.display = 'none';
                map.invalidateSize();
                drawMarkersOnMap(); 
            }, 800);
        }, 1000);
    }
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
    updateStatus("Lade Daten...", "#3498db");
    try {
        const response = await fetch(DATA_URL);
        if (response.ok) {
            const result = await response.json();
            
            // Firebase gibt 'null' zurück, wenn die Datenbank noch komplett leer ist
            if (result && result.markers) {
                reportsData = result.markers;
            } else {
                reportsData = [];
            }
            
            drawMarkersOnMap();
            updateStatus("Community Live ✅", "#27AE60");
        }
    } catch (err) { 
        console.error("Ladefehler:", err);
        updateStatus("Offline-Modus ⚠️", "#E67E22");
    }
}

async function saveToCommunity() {
    updateStatus("Speichere...", "#f39c12");
    
    // Wir speichern immer das Objekt { markers: [...] }
    const payload = { markers: reportsData };

    try {
        const response = await fetch(DATA_URL, {
            method: 'PUT', // PUT überschreibt den alten Stand sicher mit den neuen 4000+ Punkten
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            updateStatus("Community Live ✅", "#27AE60");
        } else {
            throw new Error("Firebase Fehler");
        }
    } catch (err) { 
        console.error("Speicher-Fehler:", err);
        updateStatus("Sync-Fehler ❌", "#e74c3c");
    }
}

function updateStatus(text, color) {
    const s = document.getElementById('sync-status');
    if(s) {
        s.innerHTML = text;
        s.style.background = color;
    }
}

function drawMarkersOnMap() {
    if (!map) return;

    const isAdminPage = window.location.pathname.includes("admin.html");
    const bounds = map.getBounds();
    const filterValue = document.getElementById('typeFilter').value;

    Object.values(activeMarkers).forEach(m => map.removeLayer(m));
    activeMarkers = {};
    
    reportsData.forEach((r, index) => {
        const latLng = L.latLng(r.lat, r.lng);

        if (filterValue !== "alle" && !r.typ.includes(filterValue)) {
            return;
        }

        if (!bounds.contains(latLng)) return;
// Innerhalb der drawMarkersOnMap Funktion:
let emoji = "📍";
if (r.typ.includes("Treppe")) emoji = "🪜";
if (r.typ.includes("defekt")) emoji = "🛗";
if (r.typ.includes("WC")) emoji = "🚽";
if (r.typ.includes("Parkplatz")) emoji = "🅿️";
if (r.typ.includes("Aufzug")) emoji = "🛗";
if (r.typ.includes("Baustelle")) emoji = "🚧";
// NEUE EMOJIS
if (r.typ.includes("Niveaugleich")) emoji = "✅"; // Grüner Haken für Bahnsteig
if (r.typ.includes("Höhenunterschied")) emoji = "⚠️"; // Warnung für Stufe
if (r.typ.includes("Rampe")) emoji = "📐"; 
if (r.typ.includes("Kein barrierefreier")) emoji = "🚫";
    
        let adminStyle = "";
        if (isAdminPage) {
            if (r.votes <= -3) {
                adminStyle = "box-shadow: 0 0 15px 5px red; border: 2px solid red;"; 
            } else if (r.status === "new") {
                adminStyle = "box-shadow: 0 0 15px 5px #3498db; border: 2px solid #3498db;"; 
            }
        }
        
        const icon = L.divIcon({
            html: `<div style="background:${r.farbe}; width:30px; height:30px; display:flex; align-items:center; justify-content:center; border-radius:50%; border:2px solid white; color:white; ${adminStyle}">${emoji}</div>`,
            className: '',
            iconSize: [30, 30]
        });
        
        const m = L.marker(latLng, { icon }).addTo(map);
        
        if (isAdminPage && r.status === "new") {
            m.on('click', () => adminReviewDone(r.id));
        }
        
        // --- POPUP INHALT ZUSAMMENBAUEN ---
        let content = `<div style="font-family:sans-serif; min-width:200px;">`;
        
        if (isAdminPage) {
            if (r.votes <= -3) content += `<b style="color:red;">⚠️ KRITISCH (Votes)</b><br>`;
            if (r.status === "new") content += `<b style="color:#3498db;">🆕 NEUER EINTRAG</b><br>`;
        }
        
        content += `
                <b style="font-size:1.1em;">${r.typ}</b><br>
                <p style="margin: 5px 0; color:#555;">${r.kommentar || ''}</p>
                <div style="background:#eee; padding:5px; border-radius:5px; text-align:center; margin-bottom:10px; font-size: 0.9em;">
                    Vertrauen: <b>${r.votes || 0}</b>
                </div>`;
        
        if (isAdminPage && r.verifiedAt) {
            content += `<div style="background:#D4EFDF; color:#1D8348; padding:8px; border-radius:5px; margin-bottom:10px; font-size:0.8em;">✅ Check-In: ${r.verifiedAt}</div>`;
        }
        
        content += `
                <div style="display:flex; gap:5px; margin-bottom:10px;">
                    <button onclick="vote('${r.id}', 1)" style="flex:1; background:#27AE60; color:white; border:none; padding:8px; border-radius:5px; cursor:pointer;">✅ Stimmt</button>
                    <button onclick="vote('${r.id}', -1)" style="flex:1; background:#E67E22; color:white; border:none; padding:8px; border-radius:5px; cursor:pointer;">❌ Falsch</button>
                </div>`;
        
        // GOOGLE MAPS NAVIGATION LINK (Korrigiert)
        const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}&travelmode=walking`;
        
        content += `
                <a href="${googleUrl}" target="_blank" style="display:block; background:#4285F4; color:white; text-align:center; padding:10px; border-radius:5px; text-decoration:none; font-weight:bold; margin-bottom:10px;">
                    Route starten
                </a>`;

        if (isAdminPage) {
            content += `
                <div style="border-top:1px solid #ccc; padding-top:10px; margin-top:5px;">
                    <button onclick="directDelete('${r.id}')" style="background:#e74c3c; color:white; border:none; padding:8px; width:100%; border-radius:5px; cursor:pointer; font-weight:bold; margin-bottom:5px;">🗑️ Löschen</button>
                    <button onclick="askForCheck('${r.id}')" style="background:#3498db; color:white; border:none; padding:8px; width:100%; border-radius:5px; cursor:pointer; font-weight:bold;">📍 Check anfordern</button>
                </div>`;
        } else if (r.needsCheck) {
            content += `<button onclick="verifyByLocation('${r.id}')" style="background:#f39c12; color:white; border:none; padding:10px; width:100%; border-radius:5px; cursor:pointer; font-weight:bold;">📍 Hier einchecken</button>`;
        }
        
        content += `</div>`;

        m.bindPopup(content);
        activeMarkers[index] = m;
    });
}

// 3. AUTOMATISIERUNG: Karte aktualisieren, wenn sich das Sichtfeld ändert
// Füge diese zwei Zeilen UNTER deiner Funktion ein (am Ende deines Scripts):
if (map) {
    map.on('moveend', drawMarkersOnMap);
    map.on('zoomend', drawMarkersOnMap);
}

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
        alert("Vor-Ort-Check wurde angefordert!");
    }
}

function verifyByLocation(id) {
    updateStatus("Prüfe Standort...", "#3498db");
    navigator.geolocation.getCurrentPosition((pos) => {
        const report = reportsData.find(r => r.id === id);
        const dist = getDistance(pos.coords.latitude, pos.coords.longitude, report.lat, report.lng);

        // 50 Meter Radius (0.05 km)
        if (dist <= 0.05) { 
            report.needsCheck = false;
            report.verifiedAt = new Date().toLocaleString('de-DE');
            saveToCommunity();
            drawMarkersOnMap();
            alert("Erfolgreich! Dein Standort wurde verifiziert und der Punkt bestätigt.");
        } else {
            alert(`Check-In fehlgeschlagen! Du bist ${Math.round(dist * 1000)}m entfernt. Du musst näher am Hindernis sein (max. 50m).`);
        }
        updateStatus("Community Live ✅", "#27AE60");
    }, () => alert("GPS-Zugriff verweigert! Ohne Standort kein Check-In möglich."));
}

function openSelectionPopup(latlng) {
  const content = `
    <div style="width: 280px; font-family: sans-serif; padding: 10px; max-height: 450px; overflow-y: auto;">
      <b style="display: block; text-align: center; margin-bottom: 15px;">Eintrag hinzufügen</b>
      <strong>Hindernisse</strong><br><br>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Kein barrierefreier Zugang', '#34495E')" style="background:#34495E; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer;">🚫 Kein barrierefreier Zugang</button>
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Treppe', '#E74C3C')" style="background:#E74C3C; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer;">🪜 Treppe melden</button>
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Aufzug defekt', '#E67E22')" style="background:#E67E22; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer;">🛗 Aufzug defekt</button>
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Baustelle', '#F1C40F')" style="background:#F1C40F; color:black; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer;">🚧 Baustelle</button>
        <hr style="margin: 5px 0; border: none; border-top: 1px solid #ccc;">
        <strong>Barrierefreiheit im Alltag</strong><br>
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Aufzug vorhanden', '#27AE60')" style="background:#27AE60; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer;">🛗 Aufzug vorhanden</button>
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Rampe vorhanden', '#16A085')" style="background:#16A085; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer;">📐 Rampe vorhanden</button>
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'WC barrierefrei', '#2ECC71')" style="background:#2ECC71; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer;">🚽 WC barrierefrei</button>
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Parkplatz', '#3498DB')" style="background:#3498DB; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer;">🅿️ Parkplatz</button>
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Barrierefreier Ort', '#9B59B6')" style="background:#9B59B6; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer;">📍 Barrierefreier Ort</button>
        <hr style="margin: 5px 0; border: none; border-top: 1px solid #ccc;">
        <strong>Barrierefreiheit / Hindernisse am Bahnsteig</strong><br>
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Höhenunterschied', '#D35400')" style="background:#D35400; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer;">🚉 ⚠️ Stufe am Zug</button>
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Niveaugleicher Einstieg', '#2980B9')" style="background:#2980B9; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer;">🚉 ✅ Einstieg eben</button>
      </div>
    </div>`;
  L.popup().setLatLng(latlng).setContent(content).openOn(map);
}

function finalizeReport(lat, lng, typ, farbe) {
    const details = prompt(`Zusatzinfos für ${typ}:`, "");
    
    // --- ABBRECHEN-CHECK ---
    // Wenn details exakt null ist, hat der User auf "Abbrechen" geklickt.
    // Mit "return;" brechen wir die Funktion sofort ab.
    if (details === null) {
        map.closePopup(); // Schließt das aktuelle Auswahl-Popup sauber
        return; 
    }
    
    // Wenn er auf OK drückt, läuft der Code ganz normal weiter (auch bei leerem Text)
    reportsData.push({
        lat: lat, 
        lng: lng, 
        typ: typ, 
        farbe: farbe, 
        kommentar: details || "", // Falls OK ohne Text gedrückt wurde
        id: "id_" + Date.now(), 
        votes: 0, 
        status: "new" 
    });
    
    drawMarkersOnMap();
    saveToCommunity();
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

function downloadBackup() {
    if (!isAdmin) return alert("Nur für Admins!");
    
    // Wir nehmen die aktuellen Daten aus deiner App
    const dataStr = JSON.stringify({ markers: reportsData }, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    // Wir erstellen einen unsichtbaren Link zum Herunterladen
    const exportFileDefaultName = 'stepfree_backup_' + new Date().toLocaleDateString() + '.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    updateStatus("Backup erstellt! 💾", "#2ecc71");
}

// Damit der Button im HTML funktioniert
window.downloadBackup = downloadBackup;

function toggleMenu() {
    const menu = document.getElementById('side-menu');
    const overlay = document.getElementById('menu-overlay');
    
    menu.classList.toggle('open');
    overlay.classList.toggle('show');
}

// Funktion zum Auf- und Zuklappen der Legende
function toggleLegend() {
    const legend = document.getElementById('map-legend');
    if (legend) {
        legend.classList.toggle('collapsed');
    }
}


window.onload = initApp;
