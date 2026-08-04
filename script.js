const isAdminPage = window.location.pathname.includes("admin.html");

// ==========================================
// 🔐 HELPER: GEMINI-KEY HOLEN ODER PER DIALOG ERFRAGEN
// ==========================================
const GLOBAL_GEMINI_KEY = ""; // Im Code leer lassen für saubere Git-Pushs!

function getValidApiKey() {
    let savedKey = localStorage.getItem("gemini_api_key");

    if (!savedKey || savedKey.trim() === "" || savedKey.includes("DEIN_")) {
        const eingabeKey = prompt("🔑 Gemini API-Key erforderlich:\n\nBitte gib deinen API-Key ein, um die KI-Prüfung zu nutzen:");
        
        if (eingabeKey && eingabeKey.trim() !== "") {
            savedKey = eingabeKey.trim();
            localStorage.setItem("gemini_api_key", savedKey);
            alert("✅ API-Key erfolgreich gespeichert!");
        } else {
            return "";
        }
    }
    
    return savedKey;
}

// ==========================================
// 🤖 STRIKER GEMINI KI-FILTER (SINGLE-CHECK)
// ==========================================
async function pruefeEintragMitKI(typen, kommentar, lat, lng) {
    const aktuellerKey = getValidApiKey();

    if (!aktuellerKey || aktuellerKey.trim() === "") {
        return { plausibel: true, grund: "KI-Check übersprungen (Kein Key hinterlegt)" };
    }

    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + aktuellerKey;

    const prompt = `
Du bist ein strenger Sicherheits-Filter für eine Barrierefreiheits-App. 
Analysiere die Nutzermeldung auf Fake, Spam, Unplausibilität oder Trolling:
- Typ: ${Array.isArray(typen) ? typen.join(", ") : typen}
- Kommentar: "${kommentar || 'Kein Kommentar'}"
- Koord: Lat ${lat}, Lng ${lng}

PRÜFKRITERIEN:
1. Ort im Wasser (See/Meer/Fluss) oder auf Autobahn? -> FAKE!
2. Buchstabensalat/Spam ("asdasd", "qwertz", etc.)? -> FAKE!
3. Beleidigungen oder Trolling? -> FAKE!

Antworte NUR als JSON:
{"plausibel": false, "grund": "Grund auf Deutsch"} oder {"plausibel": true, "grund": "OK"}
`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json", temperature: 0.0 }
            })
        });

        const data = await response.json();
        if (data.error) {
            return { plausibel: true, grund: `API-Fehler: ${data.error.message}` };
        }

        let rawText = data.candidates[0].content.parts[0].text;
        rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
        return JSON.parse(rawText);

    } catch (e) {
        console.error("KI-Prüfung fehlgeschlagen:", e);
        return { plausibel: true, grund: `Fehler: ${e.message}` };
    }
}

// ==========================================
// 🔍 ADMIN-SCAN: HARDCORE-KI-SCAN (TURBO EDITION)
// ==========================================
async function starteAdminKiScan() {
    if (typeof isAdminPage !== 'undefined' && !isAdminPage) {
        alert("Diese Funktion ist nur im Admin-Bereich verfügbar.");
        return;
    }

    const aktuellerKey = getValidApiKey();
    if (!aktuellerKey) {
        alert("Aktion abgebrochen: Kein API-Key vorhanden.");
        return;
    }

    // 1. AUTO-ZOOM: Weltweit herauszoomen & Daten neu laden
    updateStatus("Zoome auf Weltkarte & lade alle Daten...", "#3498db");
    map.setView([20.0, 0.0], 2);
    
    await new Promise(resolve => setTimeout(resolve, 800));
    await loadFromCommunity();

    const totalCount = reportsData.length;
    if (totalCount === 0) {
        alert("Keine Einträge in der Datenbank gefunden.");
        return;
    }

    const bestaetigung = await CustomUI.confirm(
        "⚡ Hardcore-KI-Scan starten",
        `Es wurden ${totalCount} Einträge geladen.\n\nAlle nötigen Punkte werden jetzt geprüft.`,
        "Scan JETZT starten",
        "Abbrechen"
    );

    if (!bestaetigung) return;

    // Ladebalken-Modal anzeigen
    const progressOverlay = document.createElement('div');
    progressOverlay.id = "ki-progress-modal";
    progressOverlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.85); backdrop-filter:blur(6px); z-index:99999; display:flex; align-items:center; justify-content:center; font-family:sans-serif; padding:20px; box-sizing:border-box;";
    progressOverlay.innerHTML = `
        <div style="background:white; padding:25px; border-radius:16px; max-width:420px; width:100%; box-shadow:0 20px 25px -5px rgba(0,0,0,0.4); text-align:center;">
            <div style="font-size:2.5em; margin-bottom:10px;">🕵️‍♂️</div>
            <h3 style="margin:0 0 8px 0; color:#1e293b; font-size:1.3em;">Deep-KI-Scan läuft...</h3>
            <p id="ki-scan-status-text" style="font-size:0.85em; color:#64748b; margin-bottom:15px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Starte System...</p>
            
            <div style="width:100%; background:#e2e8f0; height:20px; border-radius:10px; overflow:hidden; margin-bottom:10px;">
                <div id="ki-progress-bar" style="width:0%; height:100%; background:linear-gradient(90deg, #e74c3c, #8e44ad); transition:width 0.1s ease;"></div>
            </div>
            
            <div style="display:flex; justify-content:space-between; font-size:0.9em; color:#475569; font-weight:bold; margin-bottom:15px;">
                <span id="ki-progress-percent">0%</span>
                <span id="ki-progress-count">0 / ${totalCount}</span>
            </div>

            <div style="background:#fff5f5; padding:12px; border-radius:8px; border:1px solid #feb2b2; font-size:0.9em; color:#c53030; text-align:left;">
                🚨 Erkannte Fakes / Köder: <b id="ki-found-fakes" style="font-size:1.1em;">0</b>
            </div>
        </div>
    `;
    document.body.appendChild(progressOverlay);

    let geprueftZaehler = 0;
    let verdachtZaehler = 0;

    const apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + aktuellerKey;

    for (let i = 0; i < totalCount; i++) {
        const item = reportsData[i];
        geprueftZaehler++;

        const percent = Math.round((geprueftZaehler / totalCount) * 100);
        document.getElementById("ki-progress-bar").style.width = `${percent}%`;
        document.getElementById("ki-progress-percent").innerText = `${percent}%`;
        document.getElementById("ki-progress-count").innerText = `${geprueftZaehler} / ${totalCount}`;

        // 1. Bereits geflaggte Marker überspringen
        if (item.status === "ai_failed") {
            verdachtZaehler++;
            document.getElementById("ki-found-fakes").innerText = verdachtZaehler;
            continue;
        }

        const typenArray = Array.isArray(item.typ) ? item.typ : [item.typ];
        const kurzTyp = typenArray.join(", ");
        const kommentarText = (item.kommentar || "").trim();
        const textLower = kommentarText.toLowerCase();

        document.getElementById("ki-scan-status-text").innerText = `Prüfe #${geprueftZaehler}: "${kurzTyp}"`;

        // 2. LOKALE HARD-CHECKS (0ms local)
        const isBodenseeWasser = (item.lat >= 47.45 && item.lat <= 47.85 && item.lng >= 8.85 && item.lng <= 9.75);
        const verdaechtigeBegriffe = [
            "woederspruch", "asdasd", "qwertz", "dfgklj", "fick", "arsch", "hurensohn", 
            "idiot", "test1234", "köder", "koeder", "fake", "test"
        ];
        const hatSpamText = verdaechtigeBegriffe.some(w => textLower.includes(w));

        if (isBodenseeWasser || hatSpamText) {
            item.status = "ai_failed";
            item.kiWarnung = isBodenseeWasser ? "Ort liegt im Wasser (Wasser-Fake)" : "Köder-/Spam-Text erkannt";
            verdachtZaehler++;
            document.getElementById("ki-found-fakes").innerText = verdachtZaehler;
            await updateSingleMarkerInCommunity(item);
            continue;
        }

        // 3. SCHNELL-CHECK FÜR KURZEN TEXT / BUCHSTABENSALAT (0ms)
        if (kommentarText.length === 0) {
            continue; // Komplett leere Meldungen ohne Kommentar überspringen
        }

        // Erkennt kurzen Müll wie "qwt", "dfg", "123", "aaa" SOFORT ohne KI
        const istKurzerSalat = kommentarText.length < 6 && (
            !/[aeiouäöüy]/i.test(kommentarText) || // Kein einziger Vokal!
            /^[0-9]+$/.test(kommentarText) ||       // Nur Zahlen
            /(.)\1{2,}/.test(kommentarText)         // 3x Buchstabe wiederholt (z.B. zzz)
        );

        if (istKurzerSalat) {
            item.status = "ai_failed";
            item.kiWarnung = "Kurzer Buchstabensalat/Spam lokal erkannt";
            verdachtZaehler++;
            document.getElementById("ki-found-fakes").innerText = verdachtZaehler;
            await updateSingleMarkerInCommunity(item);
            continue;
        }

        // 4. KI-PRÜFUNG FÜR FREITEXTE & UNKLARHEITEN
        const prompt = `Analysiere diesen Eintrag auf Fake/Spam: Typ: ${kurzTyp}, Text: "${kommentarText}", Lat: ${item.lat}, Lng: ${item.lng}. Antworte NUR als JSON: {"plausibel": false, "grund": "Grund"} oder {"plausibel": true, "grund": "OK"}`;

        let erfolg = false;
        let versuche = 0;

        while (!erfolg && versuche < 3) {
            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { responseMimeType: "application/json", temperature: 0.0 }
                    })
                });

                                // 🚨 429 Rate Limit abfangen: Live-Countdown von 8 auf 1 runterzählen!
                if (response.status === 429) {
                    versuche++;
                    
                    for (let sec = 8; sec > 0; sec--) {
                        document.getElementById("ki-scan-status-text").innerText = `⏳ Rate-Limit (429)! Abkühlen in ${sec}s... [Versuch ${versuche}/3]`;
                        await new Promise(r => setTimeout(r, 1000)); // 1 Sekunde warten
                    }
                    
                    continue; // Danach erneut versuchen
                }

                if (response.ok) {
                    const data = await response.json();
                    if (data.candidates?.[0]?.content) {
                        let rawText = data.candidates[0].content.parts[0].text.replace(/```json/g, "").replace(/```/g, "").trim();
                        const kiErgebnis = JSON.parse(rawText);

                        if (kiErgebnis.plausibel === false || kiErgebnis.plausibel === "false") {
                            item.status = "ai_failed";
                            item.kiWarnung = kiErgebnis.grund || "Spam oder verbotener Ort erkannt";
                            verdachtZaehler++;
                            document.getElementById("ki-found-fakes").innerText = verdachtZaehler;
                            await updateSingleMarkerInCommunity(item);
                        }
                    }
                }
                erfolg = true;
            } catch (e) {
                console.error("Fehler beim KI-Check von Item", item.id, e);
                erfolg = true;
            }
        }

        // ⏱️ Schneller 2-Sekunden-Puffer vor dem nächsten KI-Call
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    document.body.removeChild(progressOverlay);

    drawMarkersOnMap();
    updateStatus("Community Live ✅", "#27AE60");

    await CustomUI.confirm(
        "🎉 Hardcore-Scan abgeschlossen!",
        `Es wurden ${geprueftZaehler} Einträge analysiert.\n\n🚨 Gefundene Fakes / Köder: ${verdachtZaehler}`,
        "OK",
        ""
    );
}

// ==========================================
// 🌍 GLOBALE EXPORTE (WICHTIG FÜR HTML-BUTTONS)
// ==========================================
window.getValidApiKey = getValidApiKey;
window.pruefeEintragMitKI = pruefeEintragMitKI;
window.starteAdminKiScan = starteAdminKiScan;

// --- MODERN SERVICE WORKER & PUSH REGISTRATION ---
const PushService = {
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const reg = await navigator.serviceWorker.register('sw.js');
                console.log('Service Worker registriert mit Scope:', reg.scope);
                return reg;
            } catch (error) {
                console.error('Service Worker Registrierung fehlgeschlagen:', error);
            }
        }
        return null;
    },
    async requestPermission() {
        if (!("Notification" in window)) return false;
        if (Notification.permission === "granted") return true;
        if (Notification.permission !== "denied") {
            const permission = await Notification.requestPermission();
            return permission === "granted";
        }
        return false;
    }
};

// --- ZENTRALE MODAL ENGINE ---
const CustomUI = {
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

// --- ADMIN LOGIN ---
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
            await CustomUI.confirm("🔒 Zugriff verweigert", "Das eingegebene Passwort ist falsch.", "Zur Startseite", "");
            window.location.href = "index.html";
        }
    }, 100); 
}

const DATA_URL_BASE = "https://stepfree-7c252-default-rtdb.europe-west1.firebasedatabase.app/mapdata/markers";
let map, myLocationMarker, currentUserPosition = null, reportsData = [], activeMarkers = {};
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

async function initApp() {
    const splash = document.getElementById('splash-screen');
    map = L.map('map').setView([48.775, 9.182], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    
    // SW Registrieren & Rechte einholen
    await PushService.registerServiceWorker();
    await PushService.requestPermission();
    
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

    starteHintergrundGpsWaechter();
    
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
        currentUserPosition = e.latlng;
        if (myLocationMarker) {
            myLocationMarker.setLatLng(e.latlng);
        } else {
            myLocationMarker = L.marker(e.latlng, {icon: locationIcon}).addTo(map);
            myLocationMarker.bindPopup("Du bist hier");
        }
    });
}

let bereitsGefragteMarker = new Set();

function starteHintergrundGpsWaechter() {
    setInterval(() => {
        if (!currentUserPosition || reportsData.length === 0) return;

        reportsData.forEach(marker => {
            if (bereitsGefragteMarker.has(marker.id)) return;

            const userLatLng = L.latLng(currentUserPosition.lat, currentUserPosition.lng);
            const markerLatLng = L.latLng(marker.lat, marker.lng);
            const distanz = userLatLng.distanceTo(markerLatLng);

            if (distanz <= 50) {
                bereitsGefragteMarker.add(marker.id);

                if (navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({
                        type: 'TRIGGER_PROMPT',
                        payload: {
                            markerId: marker.id,
                            typ: Array.isArray(marker.typ) ? marker.typ.join(", ") : marker.typ
                        }
                    });
                }
            }
        });
    }, 15000);
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
                        r.createdAt = Date.now(); 
                    }
                    r.loeschCheckIns = r.loeschCheckIns || 0;
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
        await fetch(`${DATA_URL_BASE}/${neuerPunkt.id}.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(neuerPunkt)
        });
        updateStatus("Community Live ✅", "#27AE60");
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
    
    reportsData.forEach((r) => {
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
                if (filter === "admin_zu_bestaetigen") return (r.status === "ready_for_confirm" || r.votes >= 3) && r.status !== "confirmed";
                if (filter === "admin_kritisch") return r.status === "needs_review" || r.loeschCheckIns >= 3;
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
            else if (singleType.includes("sonstiges")) { emoji = "🪨️"; markerFarbe = "#5F9EA0"; } 
            else if (singleType.includes("Aufzug vorhanden")) { emoji = "🛗"; markerFarbe = "#27AE60"; }
            else if (singleType.includes("Rampe vorhanden")) { emoji = "📐"; markerFarbe = "#16A085"; }
            else if (singleType.includes("WC")) { emoji = "🚽"; markerFarbe = "#2ECC71"; }
            else if (singleType.includes("Parkplatz")) { emoji = "🅿️"; markerFarbe = "#3498DB"; }
            else if (singleType.includes("Barrierefreier Ort")) { emoji = "📍"; markerFarbe = "#9B59B6"; }
            else if (singleType.includes("Höhenunterschied")) { emoji = "⚠️"; markerFarbe = "#D35400"; }
            else if (singleType.includes("Niveaugleicher")) { emoji = "✅"; markerFarbe = "#2980B9"; }
        }
    
        // Violetter Kranz leuchtet bei KI-Verdacht auf Spam/Fake sofort auf!
        let borderStyle = "";
        if (r.status === "ai_failed") {
            borderStyle = "box-shadow: 0 0 0 4px #9b59b6, 0 0 12px #9b59b6; border: 2px solid #9b59b6;"; 
        } else if (isAdminPage) {
            if (r.status === "needs_review" || r.loeschCheckIns >= 3) {
                borderStyle = "box-shadow: 0 0 0 4px #e74c3c, 0 0 12px #e74c3c; border: 2px solid #e74c3c;"; 
            } else if (r.status === "ready_for_confirm" || r.votes >= 3) {
                borderStyle = "box-shadow: 0 0 0 4px #2ecc71, 0 0 12px #2ecc71; border: 2px solid #2ecc71;"; 
            } else if (r.status === "new") {
                borderStyle = "box-shadow: 0 0 15px 5px #3498db; border: 2px solid #3498db;"; 
            }
        } else {
            if (r.status === "confirmed") {
                borderStyle = "box-shadow: 0 0 15px 5px #2ecc71; border: 2px solid #2ecc71;";
            }
        }
        
        const icon = L.divIcon({
            html: `<div style="background:${markerFarbe}; width:30px; height:30px; display:flex; align-items:center; justify-content:center; border-radius:50%; border:2px solid white; color:white; ${borderStyle}">${emoji}</div>`,
            className: '',
            iconSize: [30, 30]
        });
        
        const m = L.marker([r.lat, r.lng], { icon }).addTo(map);
        if (isAdminPage && r.status === "new") m.on('click', () => adminReviewDone(r.id));
        
        let content = `<div style="font-family:sans-serif; min-width:230px;">`;
        
        if (r.status === "ai_failed") {
            content += `<b style="color:#9b59b6;">🤖 KI-WARNUNG: Verdacht auf Fake/Spam</b><br>`;
            if (r.kiWarnung) content += `<span style="font-size:0.85em; color:#9b59b6; display:block; margin-bottom:5px;">Grund: <i>${r.kiWarnung}</i></span>`;
        } else if (isAdminPage) {
            if (r.status === "needs_review" || r.loeschCheckIns >= 3) {
                content += `<b style="color:#e74c3c;">⚠️ PRÜFUNG ERFORDERLICH (3x Falsch gemeldet)</b><br>`;
            } else if (r.status === "confirmed") {
                content += `<b style="color:#2ecc71;">✅ VOM ADMIN BESTÄTIGT</b><br>`;
            } else if (r.status === "ready_for_confirm" || r.votes >= 3) {
                content += `<b style="color:#2ecc71;">🔥 FREIGABE BEREIT (3x Richtig gemeldet)</b><br>`;
            } else if (r.status === "new") {
                content += `<b style="color:#3498db;">🆕 NEUER EINTRAG</b><br>`;
            }
        } else if (r.status === "confirmed") {
            content += `<b style="color:#2ecc71;">🌟 Offiziell Bestätigt</b><br>`;
        }
        
        if (r.createdAt) {
            content += `<span style="font-size:0.85em; color:#7f8c8d; display:block; margin-top:2px; margin-bottom:5px;">📅 Gemeldet am: <b>${formatierenDatum(r.createdAt)}</b></span>`;
        }
        if (r.verifiedAt) {
            content += `<span style="font-size:0.85em; color:#555; display:block; margin-top:2px;">📍 Letztes Feedback: <b>${r.verifiedAt}</b></span>`;
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
  
        const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}&travelmode=walking`;
        content += `<a href="${googleUrl}" target="_blank" style="display:block; background:#4285F4; color:white; text-align:center; padding:10px; border-radius:5px; text-decoration:none; font-weight:bold; margin-bottom:10px;">Route in Google Maps starten</a>`;
        content += `<button onclick="addToFavorites('${r.id}', ${r.lat}, ${r.lng})" style="display:block; width:100%; background:#f1c40f; color:#2c3e50; border:none; padding:10px; border-radius:5px; font-weight:bold; cursor:pointer; margin-bottom:10px;">⭐ Auf Merkliste speichern</button>`;

        if (isAdminPage) {
            content += `<div style="border-top:1px solid #ccc; padding-top:10px; margin-top:5px;">`;
            
            if ((r.votes >= 3 || r.status === "ready_for_confirm" || r.status === "needs_review" || r.status === "ai_failed") && r.status !== "confirmed") {
                content += `<button onclick="confirmByAdmin('${r.id}')" style="background:#2ecc71; color:white; border:none; padding:8px; width:100%; border-radius:5px; cursor:pointer; font-weight:bold; margin-bottom:5px;">👁️ Eintrag verifizieren / freigeben</button>`;
            }
            
            content += `
                    <button onclick="directDelete('${r.id}')" style="background:#e74c3c; color:white; border:none; padding:8px; width:100%; border-radius:5px; cursor:pointer; font-weight:bold; margin-bottom:5px;">🗑️ Löschen</button>
                    <button onclick="askForCheck('${r.id}')" style="background:#4285F4; color:white; border:none; padding:8px; width:100%; border-radius:5px; cursor:pointer; font-weight:bold;">📍 Admin-Check fordern</button>
                </div>`;
        }
        
        content += `</div>`;
        m.bindPopup(content);
        activeMarkers[r.id] = m; 
    });
}

// --- MERKLISTE ---
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
        if (activeMarkers[id]) {
            activeMarkers[id].openPopup();
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

// --- ADMIN CONTROL ---
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
        r.sonderVoting = { ja: 0, nein: 0 }; 
        updateSingleMarkerInCommunity(r);
        drawMarkersOnMap();
    }
}

function openSelectionPopup(latlng) {
  let selectedTypes = [];
  let mainCategory = ""; 

  const overlay = document.createElement('div');
  overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); z-index:100000; display:flex; align-items:center; justify-content:center; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding:16px; box-sizing:border-box;";
  document.body.appendChild(overlay);

  function setModalContent(html) {
    overlay.innerHTML = `
      <div style="background: #ffffff; padding: 24px; border-radius: 20px; max-width: 380px; width: 100%; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15); box-sizing: border-box; position: relative; max-height: 85vh; overflow-y: auto;">
        ${html}
      </div>
    `;
  }

  const categoriesData = {
    hindernis: [
      {
        title: "🏢 Im Gebäude",
        items: [
          { value: "Aufzug defekt", label: "🛗 Aufzug defekt" },
          { value: "Treppe", label: "🪜 Treppe ohne Alternative" },
          { value: "Kein barrierefreier Zugang", label: "🚫 Kein barrierefreier Zugang" }
        ]
      },
      {
        title: "🛣️ Auf der Straße",
        items: [
          { value: "Baustelle", label: "🚧 Baustelle im Weg" },
          { value: "E-Scooter", label: "🛴 E-Scooter blockiert Gehweg" },
          { value: "Mülltonne", label: "🗑️ Mülltonne blockiert" },
          { value: "sonstiges", label: "🪨 Sonstiges Hindernis" }
        ]
      },
      {
        title: "🚉 Am Bahnsteig",
        items: [
          { value: "Höhenunterschied", label: "⚠️ Höhenunterschied am Zug" }
        ]
      }
    ],
    frei: [
      {
        title: "🏢 Im Gebäude",
        items: [
          { value: "Aufzug vorhanden", label: "🛗 Aufzug vorhanden" },
          { value: "Rampe vorhanden", label: "📐 Rampe vorhanden" },
          { value: "WC", label: "🚽 Barrierefreies WC" }
        ]
      },
      {
        title: "🛣️ Auf der Straße / Parken",
        items: [
          { value: "Parkplatz", label: "🅿️ Behindertenparkplatz" },
          { value: "Barrierefreier Ort", label: "📍 Allgemein barrierefrei" }
        ]
      },
      {
        title: "🚉 Am Bahnsteig",
        items: [
          { value: "Niveaugleicher", label: "✅ Niveaugleicher Einstieg" }
        ]
      }
    ]
  };

  function showStep1() {
    setModalContent(`
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="width: 48px; height: 48px; background: #eff6ff; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px auto; font-size: 1.5em;">📍</div>
        <h3 style="margin: 0; color: #1e293b; font-size: 1.25em; font-weight: 700;">Neuen Ort eintragen</h3>
        <p style="color: #64748b; font-size: 0.9em; margin: 6px 0 0 0;">Was möchtest du an dieser Position melden?</p>
      </div>
      <button id="btn-choice-hindernis" style="display:flex; align-items:center; justify-content:center; gap:12px; width:100%; background:#ef4444; color:white; border:none; padding:16px; border-radius:12px; font-weight:bold; font-size:1.05em; cursor:pointer; margin-bottom:12px;">
        <span>⚠️</span> Ein Hindernis melden
      </button>
      <button id="btn-choice-frei" style="display:flex; align-items:center; justify-content:center; gap:12px; width:100%; background:#10b981; color:white; border:none; padding:16px; border-radius:12px; font-weight:bold; font-size:1.05em; cursor:pointer; margin-bottom:20px;">
        <span>✨</span> Barrierefreien Ort melden
      </button>
      <button id="btn-close-modal" style="display:block; width:100%; background:#f1f5f9; color:#64748b; border:none; padding:12px; border-radius:10px; cursor:pointer; font-weight: 500;">Abbrechen</button>
    `);

    overlay.querySelector('#btn-choice-hindernis').onclick = () => { mainCategory = "hindernis"; showStep2(0); };
    overlay.querySelector('#btn-choice-frei').onclick = () => { mainCategory = "frei"; showStep2(0); };
    overlay.querySelector('#btn-close-modal').onclick = () => document.body.removeChild(overlay);
  }

  function showStep2(catIndex) {
    const currentCats = categoriesData[mainCategory];
    const cat = currentCats[catIndex];
    const accentColor = mainCategory === 'hindernis' ? '#ef4444' : '#10b981';

    let checkboxesHtml = cat.items.map(item => {
      const isChecked = selectedTypes.includes(item.value) ? "checked" : "";
      return `
        <label style="display:flex; align-items:center; gap:12px; background:#f8fafc; padding:14px; border-radius:12px; border:2px solid #e2e8f0; cursor:pointer; font-size: 0.95em; color: #334155;">
          <input type="checkbox" name="catItem" value="${item.value}" ${isChecked} style="width: 18px; height: 18px; accent-color: ${accentColor};">
          <span style="font-weight: 500;">${item.label}</span>
        </label>
      `;
    }).join("");

    let dotsHtml = currentCats.map((_, idx) => {
      const isActive = idx === catIndex;
      return `<div class="nav-dot" data-index="${idx}" style="width: ${isActive ? '24px' : '8px'}; height: 8px; background: ${isActive ? accentColor : '#cbd5e1'}; border-radius: 4px; cursor: pointer; transition: all 0.3s ease;"></div>`;
    }).join("");

    setModalContent(`
      <div id="swipe-container" style="text-align:center; margin-bottom: 20px; user-select:none;">
        <h3 style="margin: 0; color: #1e293b; font-size: 1.3em; font-weight: 700;">${cat.title}</h3>
        <p style="font-size: 0.75em; color: #94a3b8; margin: 4px 0 0 0;">Wische nach links/rechts oder nutze Punkte zum Wechseln</p>
      </div>
      <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:24px;">
        ${checkboxesHtml}
      </div>
      <div style="display:flex; flex-direction:column; align-items:center; gap:16px;">
        <div style="display:flex; gap:6px;">
          ${dotsHtml}
        </div>
        <div style="display:flex; width:100%; gap:10px;">
          <button id="btn-back-step1" style="flex:1; background:#f1f5f9; color:#64748b; border:none; padding:12px; border-radius:12px; font-weight:600; cursor:pointer;">Zurück</button>
          <button id="btn-go-finalize" style="flex:2; background:#1e293b; color:white; border:none; padding:12px; border-radius:12px; font-weight:bold; cursor:pointer;">Weiter 🏁</button>
        </div>
      </div>
    `);

    const swipeContainer = overlay.querySelector('#swipe-container').parentNode;
    let startX = 0;

    const handleStart = (e) => startX = e.touches ? e.touches[0].clientX : e.clientX;
    const handleEnd = (e) => {
      let endX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
      let diffX = startX - endX;
      saveCurrentCheckboxes();
      if (diffX > 50 && catIndex < currentCats.length - 1) showStep2(catIndex + 1);
      else if (diffX < -50 && catIndex > 0) showStep2(catIndex - 1);
    };

    swipeContainer.ontouchstart = handleStart;
    swipeContainer.ontouchend = handleEnd;

    overlay.querySelectorAll('.nav-dot').forEach(dot => {
      dot.onclick = () => {
        saveCurrentCheckboxes();
        showStep2(parseInt(dot.getAttribute('data-index')));
      };
    });

    function saveCurrentCheckboxes() {
      overlay.querySelectorAll('input[name="catItem"]').forEach(cb => {
        if (cb.checked && !selectedTypes.includes(cb.value)) {
          selectedTypes.push(cb.value);
        } else if (!cb.checked && selectedTypes.includes(cb.value)) {
          selectedTypes = selectedTypes.filter(val => val !== cb.value);
        }
      });
    }

    overlay.querySelector('#btn-back-step1').onclick = () => {
      saveCurrentCheckboxes();
      showStep1();
    };

    overlay.querySelector('#btn-go-finalize').onclick = () => {
      saveCurrentCheckboxes();
      if (selectedTypes.length === 0) {
        alert("Bitte wähle mindestens eine Eigenschaft aus.");
        return;
      }
      showFinalizeStep();
    };
  }

  function showFinalizeStep() {
    const addMoreText = mainCategory === "frei" ? "⚠️ Hindernis hinzufügen" : "✨ Barrierefreien Ort hinzufügen";
    const benötigtDatum = selectedTypes.some(t => t.includes("Baustelle") || t.includes("Aufzug defekt"));
    const heute = new Date().toISOString().split('T')[0];

    setModalContent(`
      <h3 style="margin-top:0; text-align:center; color:#1e293b; font-weight:700;">Zusammenfassung</h3>
      <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:12px; border-radius:12px; margin-bottom:16px;">
        <span style="font-size:0.8em; color:#64748b; font-weight:bold; display:block; margin-bottom:6px;">Ausgewählt:</span>
        <div style="display:flex; flex-wrap:wrap; gap:6px;">
          ${selectedTypes.map(t => `<span style="background:#e2e8f0; color:#334155; font-size:0.85em; padding:4px 10px; border-radius:20px; font-weight:500;">${t}</span>`).join("")}
        </div>
      </div>
      
      ${benötigtDatum ? `
      <label style="display:block; margin-bottom:16px;">
        <strong style="display:block; margin-bottom:6px; font-size:0.9em; color:#d35400;">📅 Bekanntes Enddatum? (Optional):</strong>
        <input type="date" id="obstacleEndDate" min="${heute}" style="width:100%; padding:12px; border:2px solid #e2e8f0; border-radius:12px; box-sizing:border-box; font-size:1em; outline:none;">
      </label>
      ` : ''}

      <label style="display:block; margin-bottom:16px;">
        <strong style="display:block; margin-bottom:6px; font-size:0.9em; color:#334155;">Zusatzbeschreibung (optional):</strong>
        <input type="text" id="multiDetails" placeholder="z.B. Gleis 3, Nordflügel..." style="width:100%; padding:12px; border:2px solid #e2e8f0; border-radius:12px; box-sizing:border-box; font-size:1em; outline:none;">
      </label>

      <button id="btn-mix-categories" style="display:block; width:100%; background:#f1f5f9; color:#3b82f6; border:2px dashed #3b82f6; padding:12px; border-radius:12px; font-weight:bold; cursor:pointer; font-size:0.9em; margin-bottom:20px; text-align:center;">
        ➕ ${addMoreText}
      </button>

      <div style="display:flex; gap:10px;">
        <button id="btn-submit-final" style="flex:2; background:#27ae60; color:white; border:none; padding:14px; border-radius:12px; font-weight:bold; cursor:pointer; font-size:0.95em;">💾 Speichern</button>
        <button id="btn-back-to-cats" style="flex:1; background:#f1f5f9; color:#64748b; border:none; padding:14px; border-radius:12px; cursor:pointer; font-weight:500;">Zurück</button>
      </div>
    `);

    overlay.querySelector('#btn-mix-categories').onclick = () => {
      mainCategory = mainCategory === "frei" ? "hindernis" : "frei";
      showStep2(0);
    };
    overlay.querySelector('#btn-back-to-cats').onclick = () => showStep2(0);
    overlay.querySelector('#btn-submit-final').onclick = () => {
      const details = overlay.querySelector('#multiDetails').value;
      const dateEl = overlay.querySelector('#obstacleEndDate');
      const gewaehltesEnddatum = dateEl ? dateEl.value : null;

      document.body.removeChild(overlay);
      finalizeMultiReportDirect(selectedTypes, details, latlng.lat, latlng.lng, gewaehltesEnddatum);
    };
  }

  showStep1();
}

// --- INTEGRIERTER KI-CHECK VOR DEM ABSPEICHERN ---
async function finalizeMultiReportDirect(gewaehlteTypen, kommentarText, lat, lng, manuellesEnddatum) {
    if (!gewaehlteTypen || gewaehlteTypen.length === 0) return;
    
    updateStatus("KI prüft Meldung... 🤖", "#9B59B6");
    
    // 🤖 KI-Check durchführen
    const kiErgebnis = await pruefeEintragMitKI(gewaehlteTypen, kommentarText, lat, lng);
    
    const einTag = 24 * 60 * 60 * 1000;
    const siebenTage = 7 * einTag;
    let ablaufZeit = null;

    if (manuellesEnddatum) {
        ablaufZeit = Date.parse(manuellesEnddatum) + einTag;
    } else if (gewaehlteTypen.some(t => t === "E-Scooter" || t === "Mülltonne")) {
        ablaufZeit = Date.now() + einTag; 
    } else if (gewaehlteTypen.some(t => t === "Baustelle" || t === "Aufzug defekt")) {
        ablaufZeit = Date.now() + siebenTage; 
    }
 
    let initialStatus = isAdminPage ? "active" : "new";
    if (!kiErgebnis.plausibel) {
        initialStatus = "ai_failed";
    }

    const neuerPunkt = {
        lat: lat, 
        lng: lng, 
        typ: gewaehlteTypen, 
        farbe: gewaehlteTypen.length > 1 ? "#2c3e50" : "#9B59B6", 
        kommentar: kommentarText || "", 
        id: "id_" + Date.now(), 
        votes: 1, 
        status: initialStatus,
        kiWarnung: kiErgebnis.plausibel ? null : kiErgebnis.grund,
        expiresAt: ablaufZeit,
        baustellenEnddatum: manuellesEnddatum || null,
        checkInRequestedBy: null,
        sonderVoting: { ja: 0, nein: 0 },
        createdAt: Date.now() 
    };

    reportsData.push(neuerPunkt);
    drawMarkersOnMap();
    await saveSingleMarkerToCommunity(neuerPunkt);
    map.closePopup();
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
    if (menu) menu.classList.toggle('open');
    if (overlay) overlay.classList.toggle('show');
}

function toggleLegend() {
    const legend = document.getElementById('map-legend');
    if (legend) {
        legend.classList.toggle('collapsed');
    }
}

function kiKeyEinrichten() {
    const neuerKey = prompt("Bitte füge hier deinen Gemini API-Key ein:");
    if (neuerKey && neuerKey.trim() !== "") {
        localStorage.setItem("gemini_api_key", neuerKey.trim());
        alert("🔑 Key erfolgreich auf diesem Gerät gespeichert! Die App lädt sich jetzt neu.");
        location.reload(); 
    }
}

window.onload = initApp;
