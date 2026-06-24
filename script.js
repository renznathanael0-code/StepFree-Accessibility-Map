const isAdminPage = window.location.pathname.includes("admin.html");

// --- ZENTRALE MODAL ENGINE (Ersetzt prompt & confirm) ---
const CustomUI = {
    // Ersetzt confirm()
    async confirm(titel, text, jaText = "Ja", neinText = "Abbrechen") {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:99999; display:flex; align-items:center; justify-content:center; font-family:sans-serif; padding:20px; box-sizing:border-box;";
            overlay.innerHTML = `
                <div style="background:white; padding:20px; border-radius:12px; max-width:340px; width:100%; box-shadow:0 4px 20px rgba(0,0,0,0.3); text-align:center;">
                    <h3 style="margin-top:0; color:#2c3e50; font-size:1.2em;">${titel}</h3>
                    <p style="font-size:0.95em; color:#7f8c8d; margin-bottom:20px; line-height:1.4;">${text}</p>
                    <div style="display:flex; gap:10px;">
                        ${neinText ? `<button id="modal-nein" style="flex:1; background:#eef2f3; color:#7f8c8d; border:1px solid #d5dbdb; padding:10px; border-radius:6px; cursor:pointer; font-weight:bold;">${neinText}</button>` : ''}
                        <button id="modal-ja" style="flex:1; background:#e74c3c; color:white; border:none; padding:10px; border-radius:6px; cursor:pointer; font-weight:bold;">${jaText}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
            if (neinText) {
                overlay.querySelector('#modal-nein').onclick = () => { document.body.removeChild(overlay); resolve(false); };
            }
            overlay.querySelector('#modal-ja').onclick = () => { document.body.removeChild(overlay); resolve(true); };
        });
    },

    // Ersetzt prompt()
    async prompt(titel, text, placeholder = "", inputType = "text") {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:99999; display:flex; align-items:center; justify-content:center; font-family:sans-serif; padding:20px; box-sizing:border-box;";
            overlay.innerHTML = `
                <div style="background:white; padding:20px; border-radius:12px; max-width:340px; width:100%; box-shadow:0 4px 20px rgba(0,0,0,0.3);">
                    <h3 style="margin-top:0; color:#2c3e50; font-size:1.2em; text-align:center;">${titel}</h3>
                    <p style="font-size:0.95em; color:#7f8c8d; margin-bottom:12px; text-align:center;">${text}</p>
                    <input id="modal-input" type="${inputType}" placeholder="${placeholder}" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:6px; margin-bottom:15px; box-sizing:border-box; font-size:1em;">
                    <div style="display:flex; gap:10px;">
                        <button id="modal-cancel" style="flex:1; background:#eef2f3; color:#7f8c8d; border:1px solid #d5dbdb; padding:10px; border-radius:6px; cursor:pointer;">Abbrechen</button>
                        <button id="modal-submit" style="flex:1; background:#27AE60; color:white; border:none; padding:10px; border-radius:6px; cursor:pointer; font-weight:bold;">Bestätigen</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
            const input = overlay.querySelector('#modal-input');
            input.focus();
            
            overlay.querySelector('#modal-cancel').onclick = () => { document.body.removeChild(overlay); resolve(null); };
            overlay.querySelector('#modal-submit').onclick = () => {
                const val = input.value.trim();
                document.body.removeChild(overlay);
                resolve(val || null);
            };
            input.onkeydown = (e) => {
                if (e.key === "Enter") overlay.querySelector('#modal-submit').click();
            };
        });
    }
};

// --- HILFSFUNKTION FÜR VERIFIZIERUNGS-FEEDBACK OVERLAYS ---
function showVerificationStatus(erfolgreich, nachricht) {
    const overlay = document.createElement('div');
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:99999; display:flex; align-items:center; justify-content:center; font-family:sans-serif; padding:20px; box-sizing:border-box;";
    
    const farbe = erfolgreich ? "#27AE60" : "#E74C3C";
    const titel = erfolgreich ? "✅ Check-In erfolgreich" : "❌ Check-In fehlgeschlagen";
    
    overlay.innerHTML = `
        <div style="background:white; padding:25px; border-radius:12px; max-width:320px; width:100%; box-shadow:0 4px 20px rgba(0,0,0,0.3); text-align:center;">
            <div style="font-size:3em; margin-bottom:10px;">${erfolgreich ? '🎉' : '📍'}</div>
            <h3 style="margin-top:0; color:${farbe}; font-size:1.25em;">${titel}</h3>
            <p style="font-size:0.95em; color:#555; margin-bottom:20px; line-height:1.4;">${nachricht}</p>
            <button id="status-close" style="width:100%; background:${farbe}; color:white; border:none; padding:12px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:1em;">OK</button>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#status-close').onclick = () => {
        document.body.removeChild(overlay);
    };
}

// --- ADMIN LOGIN MIT CUSTOM PROMPT (KORRIGIERT) ---
if (isAdminPage) {
    setTimeout(async () => {
        const login = await CustomUI.prompt("🔒 Admin-Bereich", "Bitte Passwort eingeben:", "Passwort...", "password");
        if (!login) {
            window.location.href = "index.html";
            return;
        }
        const msgBuffer = new TextEncoder().encode(login);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        if (hashHex === "b6e97cdceff5afead6676708d2261e8a915078ff0f2fa77856aae786ad6ac78c") {
            console.log("Admin erfolgreich eingeloggt.");
        } else {
            // Ersetzt das alte native alert() durch ein CustomUI HTML-Fenster
            await CustomUI.confirm("🔒 Zugriff verweigert", "Das eingegebene Passwort ist falsch.", "Zur Startseite", "");
            window.location.href = "index.html";
        }
    }, 100); 
}

const DATA_URL_BASE = "https://stepfree-7c252-default-rtdb.europe-west1.firebasedatabase.app/mapdata/markers";
let map, myLocationMarker, reportsData = [], activeMarkers = {};
let activeSelectedFilters = [];

function formatierenDatum(timestamp) {
    if (!timestamp) return "Unbekannt";
    const date = new Date(timestamp);
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) + 
           " um " + 
           date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + " Uhr";
}

function updateStatus(text, color) {
    const s = document.getElementById('sync-status');
    if (s) {
        s.innerHTML = text;
        s.style.background = color;
    }
}

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

async function initApp() {
    const splash = document.getElementById('splash-screen');
    map = L.map('map').setView([48.775, 9.182], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    
    map.on('click', e => openSelectionPopup(e.latlng));
    setupLocationTracking();
    
    L.Control.geocoder({
            position: 'topleft',
            defaultMarkGeocode: false,
            placeholder: "Stadt oder Straße suchen...",
            errorMessage: "Nichts gefunden."
        })
        .on('markgeocode', function(e) {
            var bbox = e.geocode.bbox;
            var poly = L.polygon([bbox.getSouthEast(), bbox.getNorthEast(), bbox.getNorthWest(), bbox.getSouthWest()]);
            map.fitBounds(poly.getBounds());
        })
        .addTo(map);
    
    map.on('moveend', loadFromCommunity);
    map.on('zoomend', loadFromCommunity);
    
    await loadFromCommunity();
    renderFavoritesList(); 
    
    if (splash) {
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
    if (!map) return;
    updateStatus("Lade sichtbare Daten...", "#3498db");
    try {
        const bounds = map.getBounds();
        const southWest = bounds.getSouthWest();
        const northEast = bounds.getNorthEast();
        const url = `${DATA_URL_BASE}.json?orderBy="lat"&startAt=${southWest.lat}&endAt=${northEast.lat}`;

        const response = await fetch(url);
        if (response.ok) {
            const result = await response.json();
            let geladeneMarker = [];
            
            if (result) {
                geladeneMarker = Object.entries(result).map(([k, r]) => {
                    if (!r) return null;
                    r.id = k; 
                    
                    if (!r.hasOwnProperty('sonderVoting') || r.sonderVoting === null) {
                        r.sonderVoting = { ja: 0, nein: 0 };
                    }
                    if (!r.hasOwnProperty('checkInRequestedBy')) {
                        r.checkInRequestedBy = null;
                    }
                    if (!r.hasOwnProperty('createdAt')) {
                        r.createdAt = 1767222000000; 
                    }
                    
                    return r;
                }).filter(r => r !== null && r.lng >= southWest.lng && r.lng <= northEast.lng);
            }
            
            const jetzt = Date.now();
            reportsData = geladeneMarker.filter(r => !r.expiresAt || r.expiresAt > jetzt);
            drawMarkersOnMap();
            updateStatus("Community Live ✅", "#27AE60");
        }
    } catch (err) { 
        console.error("Ladefehler:", err);
        updateStatus("Offline-Modus ⚠️", "#E67E22");
    }
}

async function saveSingleMarkerToCommunity(neuerPunkt) {
    updateStatus("Speichere...", "#f39c12");
    try {
        const response = await fetch(`${DATA_URL_BASE}/${neuerPunkt.id}.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(neuerPunkt)
        });
        if (response.ok) updateStatus("Community Live ✅", "#27AE60");
    } catch (err) { 
        updateStatus("Sync-Fehler ❌", "#e74c3c");
    }
}

async function updateSingleMarkerInCommunity(punkt) {
    try {
        await fetch(`${DATA_URL_BASE}/${punkt.id}.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(punkt)
        });
    } catch (err) {
        console.error("Update-Fehler:", err);
    }
}

function toggleFilterBadge(button) {
    const value = button.getAttribute('data-value');
    if (activeSelectedFilters.includes(value)) {
        activeSelectedFilters = activeSelectedFilters.filter(f => f !== value);
        button.style.background = "#f0f3f4"; button.style.color = "#2c3e50"; button.style.borderColor = "#d5dbdb";
    } else {
        activeSelectedFilters.push(value);
        button.style.background = "#3498db"; button.style.color = "white"; button.style.borderColor = "#2980b9";
    }
    drawMarkersOnMap();
}

function resetAllFilters() {
    activeSelectedFilters = [];
    document.querySelectorAll('.filter-badge').forEach(b => {
        b.style.background = "#f0f3f4"; b.style.color = "#2c3e50"; b.style.borderColor = "#d5dbdb";
    });
    drawMarkersOnMap();
}

function drawMarkersOnMap() {
    if (!map) return;
    const isAdminPage = window.location.pathname.includes("admin.html");
    const jetzt = Date.now();

    Object.values(activeMarkers).forEach(m => map.removeLayer(m));
    activeMarkers = {};
    
    reportsData.forEach((r, index) => {
        if (r.expiresAt && r.expiresAt < jetzt) return;

        let markerTypes = Array.isArray(r.typ) ? r.typ : [r.typ];
        markerTypes = markerTypes.map(t => t === "WC barrierefrei" ? "WC" : t);

        if (activeSelectedFilters.length > 0) {
            const zweiTageInMs = 2 * 24 * 60 * 60 * 1000;
            
            const passtZuFiltern = activeSelectedFilters.some(filter => {
                if (filter === "status_neu") return (Date.now() - (r.createdAt || 0)) <= zweiTageInMs;
                if (filter === "status_bestaetigt") return r.status === "confirmed";
                if (filter === "status_check_aktiv") return (r.needsCheck === true || r.checkInRequestedBy !== null);
                
                if (filter === "admin_neu") return r.status === "new";
                if (filter === "admin_zu_bestaetigen") return (r.votes >= 3 && r.status !== "confirmed");
                if (filter === "admin_kritisch") return r.votes <= -3;
                
                return markerTypes.some(t => t.includes(filter) || filter.includes(t));
            });

            if (!passtZuFiltern) return; 
        }

        let emoji = "📍";
        let markerFarbe = r.farbe || "#9B59B6"; 

        if (markerTypes.length > 1) { emoji = "🏢"; markerFarbe = "#2c3e50"; } 
        else if (markerTypes.length === 1) {
            const singleType = markerTypes[0];
            if (singleType.includes("Kein barrierefreier")) { emoji = "🚫"; markerFarbe = "#34495E"; }
            else if (singleType.includes("Treppe")) { emoji = "🪜"; markerFarbe = "#E74C3C"; }
            else if (singleType.includes("defekt")) { emoji = "🛗"; markerFarbe = "#E67E22"; }
            else if (singleType.includes("Baustelle")) { emoji = "🚧"; markerFarbe = "#F1C40F"; }
            else if (singleType.includes("E-Scooter")) { emoji = "🛴"; markerFarbe = "#D35400"; } 
            else if (singleType.includes("Mülltonne")) { emoji = "🗑️"; markerFarbe = "#7F8C8D"; } 
            else if (singleType.includes("Aufzug vorhanden")) { emoji = "🛗"; markerFarbe = "#27AE60"; }
            else if (singleType.includes("Rampe vorhanden")) { emoji = "📐"; markerFarbe = "#16A085"; }
            else if (singleType.includes("WC")) { emoji = "🚽"; markerFarbe = "#2ECC71"; }
            else if (singleType.includes("Parkplatz")) { emoji = "🅿️"; markerFarbe = "#3498DB"; }
            else if (singleType.includes("Barrierefreier Ort")) { emoji = "📍"; markerFarbe = "#9B59B6"; }
            else if (singleType.includes("Höhenunterschied")) { emoji = "⚠️"; markerFarbe = "#D35400"; }
            else if (singleType.includes("Niveaugleicher")) { emoji = "✅"; markerFarbe = "#2980B9"; }
        }
    
        let borderStyle = "";
        if (r.needsCheck || r.checkInRequestedBy) {
            borderStyle = "box-shadow: 0 0 0 4px #ffcc00, 0 0 12px #ffcc00; border: 2px solid #ffcc00;";
        } else if (r.status === "confirmed") {
            borderStyle = "box-shadow: 0 0 15px 5px #2ecc71; border: 2px solid #2ecc71;";
        } else if (isAdminPage) {
            if (r.votes <= -3) borderStyle = "box-shadow: 0 0 15px 5px red; border: 2px solid red;"; 
            else if (r.votes >= 3) borderStyle = "box-shadow: 0 0 15px 5px #2ecc71; border: 2px solid #2ecc71;"; 
            else if (r.status === "new") borderStyle = "box-shadow: 0 0 15px 5px #3498db; border: 2px solid #3498db;"; 
        }
        
        const icon = L.divIcon({
            html: `<div style="background:${markerFarbe}; width:30px; height:30px; display:flex; align-items:center; justify-content:center; border-radius:50%; border:2px solid white; color:white; ${borderStyle}">${emoji}</div>`,
            className: '',
            iconSize: [30, 30]
        });
        
        const m = L.marker([r.lat, r.lng], { icon }).addTo(map);
        
        if (isAdminPage && r.status === "new") m.on('click', () => adminReviewDone(r.id));
        
        let content = `<div style="font-family:sans-serif; min-width:230px;">`;
        
        if (isAdminPage) {
            if (r.votes <= -3) content += `<b style="color:red;">⚠️ KRITISCH (Votes)</b><br>`;
            else if (r.status === "confirmed") content += `<b style="color:#2ecc71;">✅ VOM ADMIN BESTÄTIGT</b><br>`;
            else if (r.votes >= 3) content += `<b style="color:#2ecc71;">🔥 FREIGABE BEREIT</b><br>`;
            else if (r.status === "new") content += `<b style="color:#3498db;">🆕 NEUER EINTRAG</b><br>`;
        } else if (r.status === "confirmed") {
            content += `<b style="color:#2ecc71;">🌟 Offiziell Bestätigt</b><br>`;
        }
        
        if (r.createdAt) {
            content += `<span style="font-size:0.85em; color:#7f8c8d; display:block; margin-top:2px; margin-bottom:5px;">📅 Gemeldet am: <b>${formatierenDatum(r.createdAt)}</b></span>`;
        }

        if (isAdminPage && r.verifiedAt) {
            content += `<span style="font-size:0.85em; color:#555; display:block; margin-top:2px;">📍 Letzter Check-In: <b>${r.verifiedAt}</b></span>`;
        }
        
        content += `<div style="margin-top:5px; margin-bottom:5px;">`;
        markerTypes.forEach(t => {
            content += `<span style="display:inline-block; background:#f0f4f8; padding:3px 8px; border-radius:12px; font-size:0.9em; font-weight:bold; margin:2px 2px 2px 0; color:#2c3e50;"># ${t}</span>`;
        });
        content += `</div>`;

        if (r.baustellenEnddatum) {
            content += `<p style="margin: 2px 0; font-size: 0.85em; color: #d35400;">📅 Geplantes Ende: <b>${new Date(r.baustellenEnddatum).toLocaleDateString('de-DE')}</b></p>`;
        } else if (r.expiresAt) {
            const restStunden = Math.round((r.expiresAt - jetzt) / (1000 * 60 * 60));
            content += `<p style="margin: 2px 0; font-size: 0.85em; color: #e67e22;">⏱️ Automatisch weg in ca. <b>${restStunden} Std.</b></p>`;
        }

        content += `<p style="margin: 8px 0; color:#555; font-style:italic;">"${r.kommentar || 'Keine Zusatzinfos'}"</p>`;
        
        content += `<div style="background:#eee; padding:5px; border-radius:5px; text-align:center; margin-bottom:10px; font-size: 0.9em;">`;
        content += `Vertrauen: <b>${r.votes || 0}</b>`;
        if (isAdminPage && r.sonderVoting) {
            content += `<br><span style="color:#9b59b6; font-weight:bold;">Sonder-Voting: 👍${r.sonderVoting.ja || 0} / 👎${r.sonderVoting.nein || 0}</span>`;
        }
        content += `</div>`;

        let hatEingeecheckt = localStorage.getItem(`checkedIn_${r.id}`) === "true";
        let disabledAttr = "";
        let buttonStyleModifier = "cursor:pointer;";
        
        if ((r.checkInRequestedBy === "admin" || r.needsCheck === true) && !hatEingeecheckt) {
            disabledAttr = "disabled";
            buttonStyleModifier = "background:#cccccc; color:#888888; opacity:0.6; cursor:not-allowed;";
        }

        content += `
            <div style="display:flex; gap:5px; margin-bottom:10px;">
                <button ${disabledAttr} onclick="vote('${r.id}', 1)" style="flex:1; background:#27AE60; color:white; border:none; padding:8px; border-radius:5px; ${disabledAttr ? buttonStyleModifier : 'cursor:pointer;'}">✅ Stimmt</button>
                <button ${disabledAttr} onclick="vote('${r.id}', -1)" style="flex:1; background:#E67E22; color:white; border:none; padding:8px; border-radius:5px; ${disabledAttr ? buttonStyleModifier : 'cursor:pointer;'}">❌ Falsch</button>
            </div>`;
        
        const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}&travelmode=walking`;
        content += `<a href="${googleUrl}" target="_blank" style="display:block; background:#4285F4; color:white; text-align:center; padding:10px; border-radius:5px; text-decoration:none; font-weight:bold; margin-bottom:10px;">Route in Google Maps starten</a>`;

        content += `<button onclick="addToFavorites('${r.id}', ${r.lat}, ${r.lng})" style="display:block; width:100%; background:#f1c40f; color:#2c3e50; border:none; padding:10px; border-radius:5px; font-weight:bold; cursor:pointer; margin-bottom:10px;">⭐ Auf Merkliste speichern</button>`;

        if (isAdminPage) {
            content += `<div style="border-top:1px solid #ccc; padding-top:10px; margin-top:5px;">`;
            
            // ADMIN OVERLAY BYPASS BUTTON
            const istSonderTyp = markerTypes.some(t => t.includes("Baustelle") || t.includes("Aufzug defekt"));
            if (istSonderTyp) {
                content += `<button onclick="openManagementOverlay(reportsData.find(item => item.id === '${r.id}'))" style="background:#9b59b6; color:white; border:none; padding:10px; width:100%; border-radius:5px; cursor:pointer; font-weight:bold; margin-bottom:5px;">⚙️ Status & Enddatum verwalten</button>`;
            }

            if (r.votes >= 3 && r.status !== "confirmed") {
                content += `<button onclick="confirmByAdmin('${r.id}')" style="background:#2ecc71; color:white; border:none; padding:8px; width:100%; border-radius:5px; cursor:pointer; font-weight:bold; margin-bottom:5px;">👁️ Für User freigeben</button>`;
            }
            content += `
                    <button onclick="directDelete('${r.id}')" style="background:#e74c3c; color:white; border:none; padding:8px; width:100%; border-radius:5px; cursor:pointer; font-weight:bold; margin-bottom:5px;">🗑️ Löschen</button>
                    <button onclick="askForCheck('${r.id}')" style="background:#4285F4; color:white; border:none; padding:8px; width:100%; border-radius:5px; cursor:pointer; font-weight:bold;">📍 Admin-Check fordern</button>
                </div>`;
        } else {
            // ERGÄNZUNG: Auch "Aufzug defekt" schaltet jetzt für den normalen User das Standort-Check-In frei
            const isTempType = markerTypes.some(t => t.includes("E-Scooter") || t.includes("Mülltonne") || t.includes("Baustelle") || t.includes("Aufzug defekt"));
            if (r.needsCheck || r.checkInRequestedBy || isTempType) {
                content += `<button onclick="verifyByLocation('${r.id}')" style="background:#f39c12; color:white; border:none; padding:10px; width:100%; border-radius:5px; cursor:pointer; font-weight:bold;">📍 Hier einchecken & verifizieren</button>`;
            }
        }
        
        content += `</div>`;
        m.bindPopup(content);
        activeMarkers[index] = m;
    });
}

// --- MERKLISTE MIT CUSTOM PROMPT ---
async function addToFavorites(id, lat, lng) {
    const customTitle = await CustomUI.prompt("⭐ Merkliste", "Unter welchem Namen möchtest du diesen Ort speichern?", "z.B. Mein Stammbäcker...");
    if (!customTitle) return; 

    let favorites = JSON.parse(localStorage.getItem('stepfree_favorites') || "[]");
    
    if (favorites.some(f => f.id === id)) {
        await CustomUI.confirm("Hinweis", "Dieser Ort befindet sich bereits auf deiner Merkliste!", "Ok", "");
        return;
    }

    favorites.push({ id, title: customTitle, lat, lng });
    localStorage.setItem('stepfree_favorites', JSON.stringify(favorites));
    renderFavoritesList();
}

function renderFavoritesList() {
    const listContainer = document.getElementById('favorites-list');
    if (!listContainer) return;

    let favorites = JSON.parse(localStorage.getItem('stepfree_favorites') || "[]");
    listContainer.innerHTML = "";

    if (favorites.length === 0) {
        listContainer.innerHTML = `<p style="color:#7f8c8d; font-style:italic; padding: 0 15px;">Noch keine Orte gemerkt.</p>`;
        return;
    }

    favorites.forEach(f => {
        const item = document.createElement('div');
        item.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:10px 15px; border-bottom:1px solid #eee; gap:10px;";
        
        item.innerHTML = `
            <span onclick="jumpToFavorite('${f.id}', ${f.lat}, ${f.lng})" style="cursor:pointer; font-weight:bold; color:#2980b9; flex:1; font-size:0.95em;">📍 ${f.title}</span>
            <button id="del-fav-${f.id}" style="background:none; border:none; color:#e74c3c; cursor:pointer; font-size:1.1em;">🗑️</button>
        `;
        listContainer.appendChild(item);
        item.querySelector(`#del-fav-${f.id}`).onclick = () => removeFromFavorites(f.id);
    });
}

async function jumpToFavorite(id, lat, lng) {
    const menu = document.getElementById('side-menu');
    if (menu && menu.classList.contains('open')) {
        toggleMenu();
    }

    map.setView([lat, lng], 17);
    await loadFromCommunity();

    setTimeout(() => {
        const markerKey = Object.keys(reportsData).find(key => reportsData[key].id === id);
        if (markerKey && activeMarkers[markerKey]) {
            activeMarkers[markerKey].openPopup();
        } else {
            CustomUI.confirm("Fehler", "Der Punkt befindet sich außerhalb des aktuellen Ausschnitts oder wurde entfernt.", "Ok", "");
        }
    }, 400);
}

function removeFromFavorites(id) {
    let favorites = JSON.parse(localStorage.getItem('stepfree_favorites') || "[]");
    favorites = favorites.filter(f => f.id !== id);
    localStorage.setItem('stepfree_favorites', JSON.stringify(favorites));
    renderFavoritesList();
}

// --- ADMIN LÖSCHEN MIT CUSTOM CONFIRM ---
async function directDelete(id) {
    const sicher = await CustomUI.confirm("🗑️ Eintrag löschen", "Möchtest du diesen Punkt wirklich unwiderruflich für alle User löschen?");
    if (sicher) {
        reportsData = reportsData.filter(r => r.id !== id);
        try {
            await fetch(`${DATA_URL_BASE}/${id}.json`, { method: 'DELETE' });
            updateStatus("Community Live ✅", "#27AE60");
        } catch(err) { console.error(err); }
        drawMarkersOnMap();
    }
}

function confirmByAdmin(id) {
    const report = reportsData.find(r => r.id === id);
    if (report) {
        report.status = "confirmed"; 
        drawMarkersOnMap();
        updateSingleMarkerInCommunity(report);
    }
}

function askForCheck(id) {
    const r = reportsData.find(item => item.id === id);
    if (r) {
        r.checkInRequestedBy = "admin";
        r.needsCheck = true;
        updateSingleMarkerInCommunity(r);
        drawMarkersOnMap();
    }
}

// --- VERIFIZIERUNG & MANAGEMENT MIT ADMIN-BYPASS & 3-STIMMEN-LÖSCHUNG ---
function verifyByLocation(id) {
    const report = reportsData.find(r => r.id === id);
    if (!report) return;

    let markerTypes = Array.isArray(report.typ) ? report.typ : [report.typ];
    const isSpecialType = markerTypes.some(t => t.includes("Baustelle") || t.includes("Aufzug defekt"));

    // FEATURE 2: Wenn es ein Admin auf admin.html ist, direkt in das Management-Overlay springen (Bypass)
    if (isAdminPage && isSpecialType) {
        openManagementOverlay(report);
        return;
    }

    // Für normale User folgt die GPS-Standortprüfung
    updateStatus("Prüfe Standort...", "#3498db");
    navigator.geolocation.getCurrentPosition((pos) => {
        const dist = getDistance(pos.coords.latitude, pos.coords.longitude, report.lat, report.lng);

        if (dist <= 0.05) { 
            if (isSpecialType) {
                openManagementOverlay(report);
            } else if (markerTypes.some(t => t.includes("E-Scooter") || t.includes("Mülltonne"))) {
                const einTag = 24 * 60 * 60 * 1000;
                const basisZeit = report.expiresAt && report.expiresAt > Date.now() ? report.expiresAt : Date.now();
                report.expiresAt = basisZeit + einTag;
                finalizeVerificationProcess(report);
            }
        } else {
            showVerificationStatus(false, "Du bist zu weit von diesem Hindernis entfernt (mehr als 50m). Ein Check-In ist nur direkt vor Ort möglich.");
            updateStatus("Community Live ✅", "#27AE60");
        }
    }, () => {
        showVerificationStatus(false, "Dein Standort konnte nicht ermittelt werden. Bitte aktiviere GPS auf deinem Gerät.");
    });
}

// Hilfsfunktion zum Öffnen des Status-Overlays (Baustelle & Aufzug)
function openManagementOverlay(report) {
    let markerTypes = Array.isArray(report.typ) ? report.typ : [report.typ];
    const einTag = 24 * 60 * 60 * 1000;
    const siebenTage = 7 * einTag;
    const basisZeit = report.expiresAt && report.expiresAt > Date.now() ? report.expiresAt : Date.now();

    // Setze den Löschzähler auf 0, falls er noch nie existiert hat
    if (typeof report.loeschCheckIns === "undefined") {
        report.loeschCheckIns = 0;
    }

    const modalOverlay = document.createElement('div');
    modalOverlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:99999; display:flex; align-items:center; justify-content:center; font-family:sans-serif; padding:20px; box-sizing:border-box;";
    
    // Dynamischer Titel je nach Typ
    const overlayTitel = markerTypes.some(t => t.includes("Aufzug")) ? "🛗 Aufzugs-Management" : "🚧 Baustellen-Management";
    
    // FEATURE 3: Text auf dem Lösch-Button zeigt den aktuellen Counter (z.B. 0/3 oder als Admin ein direktes Löschen)
    const loeschButtonText = isAdminPage ? "🗑️ Komplett aufgelöst (Sofort)" : `🗑️ Komplett aufgelöst (${report.loeschCheckIns}/3)`;

    modalOverlay.innerHTML = `
        <div style="background:white; padding:20px; border-radius:12px; max-width:320px; width:100%; box-shadow:0 4px 15px rgba(0,0,0,0.3); box-sizing:border-box;">
            <h3 style="margin-top:0; color:#2c3e50; font-size:1.15em; text-align:center;">${overlayTitel}</h3>
            <p style="font-size:0.9em; color:#7f8c8d; text-align:center; margin-bottom:15px;">Bitte wähle den aktuellen Status vor Ort:</p>
            <button id="btn-extend" style="display:block; width:100%; background:#3498db; color:white; border:none; padding:12px; border-radius:6px; font-weight:bold; cursor:pointer; margin-bottom:8px; font-size:0.95em;">🔄 Existiert noch (+7 Tage)</button>
            <button id="btn-date" style="display:block; width:100%; background:#f1c40f; color:#2c3e50; border:none; padding:12px; border-radius:6px; font-weight:bold; cursor:pointer; margin-bottom:8px; font-size:0.95em;">📅 Enddatum ändern</button>
            <button id="btn-delete" style="display:block; width:100%; background:#e74c3c; color:white; border:none; padding:12px; border-radius:6px; font-weight:bold; cursor:pointer; margin-bottom:12px; font-size:0.95em;">${loeschButtonText}</button>
            <button id="btn-cancel" style="display:block; width:100%; background:#eef2f3; color:#7f8c8d; border:1px solid #d5dbdb; padding:8px; border-radius:6px; cursor:pointer; font-size:0.9em;">Abbrechen</button>
        </div>
    `;
    document.body.appendChild(modalOverlay);
    
    // Option 1: Verlängerung um 7 Tage (1 Check-In reicht aus)
    modalOverlay.querySelector('#btn-extend').onclick = () => {
        report.expiresAt = basisZeit + siebenTage;
        report.baustellenEnddatum = null;
        document.body.removeChild(modalOverlay);
        finalizeVerificationProcess(report);
    };
    
    // Option 2: Enddatum ändern (1 Check-In reicht aus)
    modalOverlay.querySelector('#btn-date').onclick = async () => {
        document.body.removeChild(modalOverlay);
        const datumInput = await CustomUI.prompt("📅 Enddatum festlegen", "Bitte neues Enddatum im Format JJJJ-MM-TT eingeben:", "2026-12-31");
        if (datumInput && !isNaN(Date.parse(datumInput))) {
            report.baustellenEnddatum = datumInput;
            report.expiresAt = Date.parse(datumInput) + einTag;
            finalizeVerificationProcess(report);
        }
    };
    
    // Option 3: Komplett aufgelöst (FEATURE 2 & 3: Zähl-Logik & Admin-Bypass)
    modalOverlay.querySelector('#btn-delete').onclick = () => {
        document.body.removeChild(modalOverlay);
        
        if (isAdminPage) {
            // Admin löscht sofort
            report.expiresAt = Date.now() - 1000;
            finalizeVerificationProcess(report);
        } else {
            // Normaler User erhöht Stimmenanzahl
            report.loeschCheckIns += 1;
            
            if (report.loeschCheckIns >= 3) {
                report.expiresAt = Date.now() - 1000; // Marker abgelaufen -> wird gelöscht
                finalizeVerificationProcess(report, "Meldung wurde durch 3 Check-Ins erfolgreich aufgelöst!");
            } else {
                // Noch nicht genug Stimmen: Aktualisiere den Marker, behalte ihn aber auf der Karte
                const benoetigt = 3 - report.loeschCheckIns;
                finalizeVerificationProcess(report, `Bestätigt! Es werden noch ${benoetigt} weitere Check-Ins benötigt, um diese Meldung komplett aufzuheben.`);
            }
        }
    };
    
    modalOverlay.querySelector('#btn-cancel').onclick = () => { document.body.removeChild(modalOverlay); };
}

function finalizeVerificationProcess(report, benutzerNachricht = null) {
    report.needsCheck = false;
    report.verifiedAt = new Date().toLocaleString('de-DE'); 

    // Sofort im lokalen Speicher sichern, damit die Buttons für diesen User AKTIV werden
    localStorage.setItem(`checkedIn_${report.id}`, "true");

    if (report.checkInRequestedBy === "admin") {
        if (!report.sonderVoting) {
            report.sonderVoting = { ja: 0, nein: 0 };
        }
        // WICHTIG: Flag entfernen, da der geforderte Check-In hiermit ERLEDIGT ist!
        report.checkInRequestedBy = null; 
    }
    
    if (report.checkInRequestedBy === "system") {
        report.checkInRequestedBy = null;
    }

    // Daten synchronisieren und Karte neu zeichnen
    updateSingleMarkerInCommunity(report);
    drawMarkersOnMap();
    updateStatus("Community Live ✅", "#27AE60");
    
    // Popup wieder öffnen und Inhalt updaten, damit die Buttons sofort aktiv sichtbar sind
    setTimeout(() => {
        const markerKey = Object.keys(reportsData).find(key => reportsData[key].id === report.id);
        if (markerKey && activeMarkers[markerKey] && (!report.expiresAt || report.expiresAt > Date.now())) {
            activeMarkers[markerKey].openPopup();
        }
    }, 150);

    // Visuelles HTML-Feedback-Overlay mit dynamischem Text anzeigen
    const standardText = "Vielen Dank! Deine Verifizierung vor Ort wurde erfolgreich im System gespeichert und die Live-Daten aktualisiert.";
    const anzuzeigenderText = benutzerNachricht ? benutzerNachricht : standardText;
    
    showVerificationStatus(true, anzuzeigenderText);
}

function openSelectionPopup(latlng) {
  const content = `
    <div style="width: 280px; font-family: sans-serif; padding: 5px; max-height: 420px; overflow-y: auto;">
      <b style="display: block; text-align: center; margin-bottom: 10px; font-size:1.1em;">Eigenschaften auswählen</b>
      <form id="multiReportForm" onsubmit="finalizeMultiReport(event, ${latlng.lat}, ${latlng.lng})">
        <div style="display: flex; flex-direction: column; gap: 6px; font-size: 0.95em;">
          <strong>⚠️ Hindernisse</strong>
          <label><input type="checkbox" name="typ" value="Kein barrierefreier Zugang"> 🚫 Kein Zugang</label>
          <label><input type="checkbox" name="typ" value="Treppe"> 🪜 Treppe melden</label>
          <label><input type="checkbox" name="typ" value="Aufzug defekt"> 🛗 Aufzug defekt</label>
          <label><input type="checkbox" name="typ" value="Baustelle"> 🚧 Baustelle</label>
          <label><input type="checkbox" name="typ" value="E-Scooter"> 🛴 E-Scooter im Weg</label>
          <label><input type="checkbox" name="typ" value="Mülltonne"> 🗑️ Mülltonne blockiert</label>
          
          <hr style="margin: 5px 0; border: none; border-top: 1px solid #ccc;">
          <strong>✨ Barrierefreiheit im Alltag</strong>
          <label><input type="checkbox" name="typ" value="Aufzug vorhanden"> 🛗 Aufzug vorhanden</label>
          <label><input type="checkbox" name="typ" value="Rampe vorhanden"> 📐 Rampe vorhanden</label>
          <label><input type="checkbox" name="typ" value="WC"> 🚽 WC vorhanden</label>
          <label><input type="checkbox" name="typ" value="Parkplatz"> 🅿️ Parkplatz</label>
          <label><input type="checkbox" name="typ" value="Barrierefreier Ort"> 📍 Barrierefreier Ort</label>
          
          <hr style="margin: 5px 0; border: none; border-top: 1px solid #ccc;">
          <strong>🚉 Am Bahnsteig / Einstieg zum Zug</strong>
          <label><input type="checkbox" name="typ" value="Höhenunterschied am Zug"> ⚠️ Stufe am Zug (Kritisch)</label>
          <label><input type="checkbox" name="typ" value="Niveaugleicher Einstieg"> ✅ Einstieg eben (Stufenlos)</label>
          
          <hr style="margin: 5px 0; border: none; border-top: 1px solid #ccc;">
          <strong>Zusatzinformationen:</strong>
          <input type="text" id="multiDetails" placeholder="z.B. Gleis 3, Rampe im 1. OG..." style="padding: 8px; border: 1px solid #ccc; border-radius: 6px; width: 93%;">
          <button type="submit" style="background:#27AE60; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer; margin-top:10px; font-size:1em;">💾 Eintrag speichern</button>
        </div>
      </form>
    </div>`;
  L.popup().setLatLng(latlng).setContent(content).openOn(map);
}

function finalizeMultiReport(event, lat, lng) {
    event.preventDefault();
    const checkboxes = document.querySelectorAll('#multiReportForm input[name="typ"]:checked');
    const gewaehlteTypen = Array.from(checkboxes).map(cb => cb.value);
    
    if (gewaehlteTypen.length === 0) return;
    
        const kommentarText = document.getElementById('multiDetails').value;
    const einTag = 24 * 60 * 60 * 1000;
    const siebenTage = 7 * einTag;
    let ablaufZeit = null;

    // FEATURE 1: Auch "Aufzug defekt" bekommt ein Basis-Limit von 7 Tagen
    if (gewaehlteTypen.some(t => t === "E-Scooter" || t === "Mülltonne")) {
        ablaufZeit = Date.now() + einTag;
    } else if (gewaehlteTypen.some(t => t === "Baustelle" || t === "Aufzug defekt")) {
        ablaufZeit = Date.now() + siebenTage;
    }
 
    // Änderung: Wenn der Admin den Punkt erstellt, wird der Status direkt 'active' (Kein blauer Ring!)
    const initialStatus = isAdminPage ? "active" : "new";
    
    const neuerPunkt = {
        lat: lat, 
        lng: lng, 
        typ: gewaehlteTypen, 
        farbe: gewaehlteTypen.length > 1 ? "#2c3e50" : "#9B59B6", 
        kommentar: kommentarText || "", 
        id: "id_" + Date.now(), 
        votes: 0, 
        status: initialStatus,
        expiresAt: ablaufZeit,
        checkInRequestedBy: null,
        sonderVoting: { ja: 0, nein: 0 },
        createdAt: Date.now() 
    };

    reportsData.push(neuerPunkt);
    drawMarkersOnMap();
    saveSingleMarkerToCommunity(neuerPunkt);
    map.closePopup();
}

async function vote(id, change) {
    const report = reportsData.find(r => r.id === id);
    if (!report) return;
    
    let myVotes = JSON.parse(localStorage.getItem('userVotes') || "{}");
    if (myVotes[id]) return;
    
    let hatEingeecheckt = localStorage.getItem(`checkedIn_${id}`) === "true";

    if (report.checkInRequestedBy === "admin" && hatEingeecheckt) {
        if (!report.sonderVoting) report.sonderVoting = { ja: 0, nein: 0 };
        if (change === 1) report.sonderVoting.ja += 1;
        if (change === -1) report.sonderVoting.nein += 1;
        localStorage.removeItem(`checkedIn_${id}`);
        report.checkInRequestedBy = null; 
    } else {
        report.votes += change;
        if (report.votes <= -3) report.status = "review";
    }
    
    myVotes[id] = true;
    localStorage.setItem('userVotes', JSON.stringify(myVotes));
    updateSingleMarkerInCommunity(report);
    drawMarkersOnMap();
}

function adminReviewDone(id) {
    const r = reportsData.find(item => item.id === id);
    if (r && r.status === "new") {
        r.status = "active";
        updateSingleMarkerInCommunity(r);
        drawMarkersOnMap();
    }
}

function downloadBackup() {
    if (typeof updateStatus === 'function') updateStatus("Erstelle Backup... ⏳", "#3498db");
    try {
        const datenQuelle = typeof reportsData !== 'undefined' ? reportsData : null;
        if (!datenQuelle) return;
        const dataStr = JSON.stringify(datenQuelle, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8' });
        const dataUri = URL.createObjectURL(blob);
        const dateStr = new Date().toISOString().split('T')[0];
        const linkElement = document.createElement('a');
        linkElement.href = dataUri;
        linkElement.download = 'stepfree_backup_' + dateStr + '.json';
        linkElement.style.display = 'none';
        document.body.appendChild(linkElement);
        linkElement.click();
        setTimeout(() => {
            document.body.removeChild(linkElement);
            URL.revokeObjectURL(dataUri);
        }, 100);
        if (typeof updateStatus === 'function') updateStatus("Backup erfolgreich erstellt! 💾", "#2ecc71");
    } catch (fehler) {}
}
window.downloadBackup = downloadBackup;

function toggleMenu() {
    const menu = document.getElementById('side-menu');
    const overlay = document.getElementById('menu-overlay');
    menu.classList.toggle('open');
    overlay.classList.toggle('show');
}

function toggleLegend() {
    const legend = document.getElementById('map-legend');
    if (legend) legend.classList.toggle('collapsed');
}

window.onload = initApp;