// --- SERVICE WORKER FOR INTERACTIVE PUSH NOTIFICATIONS ---

const DATA_URL_BASE = "https://stepfree-7c252-default-rtdb.europe-west1.firebasedatabase.app/mapdata/markers";

// 1. Empfangen der Push-Nachricht (Simuliert oder über echten Push-Server)
self.addEventListener('push', function(event) {
    let data = { titel: "Hindernis-Check", nachricht: "Stehst du gerade vor dem Hindernis?", markerId: "unknown", typ: "Hindernis" };
    
    if (event.data) {
        try {
            data = event.data.json();
        } catch(e) {
            data.nachricht = event.data.text();
        }
    }

    // Wir bauen interaktive Action-Buttons direkt in die Android/iOS-Benachrichtigung
    const options = {
        body: data.nachricht,
        icon: 'favicon.ico',
        badge: 'favicon.ico',
        tag: data.markerId, // Wichtig: Die ID des Markers als Tag speichern
        data: { markerId: data.markerId, typ: data.typ },
        actions: [
            { action: 'still_there', title: '🔄 Existiert noch', icon: '' },
            { action: 'resolved', title: '🗑️ Ist behoben', icon: '' }
        ],
        requireInteraction: true // Benachrichtigung verschwindet nicht von alleine
    };

    event.waitUntil(
        self.registration.showNotification(data.titel, options)
    );
});

// 2. Klick-Handler für die Buttons in der Push-Benachrichtigung
self.addEventListener('notificationclick', function(event) {
    const notification = event.notification;
    const action = event.action;
    const markerId = notification.data.markerId;
    const markerTyp = notification.data.typ;
    
    notification.close(); // Benachrichtigung sofort schließen

    // Wenn der User nur auf die Nachricht klickt statt auf einen Button
    if (!action) {
        // Optional: App öffnen
        event.waitUntil(clients.openWindow("index.html"));
        return;
    }

    // Hintergrund-Aktion starten: Daten direkt an Firebase senden, ohne die App zu öffnen!
    event.waitUntil(
        fetch(`${DATA_URL_BASE}/${markerId}.json`)
        .then(response => response.json())
        .then(async (report) => {
            if (!report) return;

            const einTag = 24 * 60 * 60 * 1000;
            const siebenTage = 7 * einTag;
            const basisZeit = report.expiresAt && report.expiresAt > Date.now() ? report.expiresAt : Date.now();

            if (action === 'still_there') {
                // Ablaufdatum verlängern
                const istFluechtig = markerTyp.includes("Scooter") || markerTyp.includes("Müll");
                report.expiresAt = basisZeit + (istFluechtig ? einTag : siebenTage);
                report.baustellenEnddatum = null;
                report.votes = (report.votes || 0) + 1;
                report.needsCheck = false;
                report.checkInRequestedBy = null;
                report.verifiedAt = new Date().toLocaleString('de-DE') + " (via Push)";

            } else if (action === 'resolved') {
                // Lösch-Zähler hochsetzen
                report.loeschCheckIns = (report.loeschCheckIns || 0) + 1;
                report.votes = (report.votes || 0) - 1;
                report.needsCheck = false;
                report.checkInRequestedBy = null;
                report.verifiedAt = new Date().toLocaleString('de-DE') + " (via Push)";

                if (report.loeschCheckIns >= 3) {
                    // Direkt in Firebase löschen
                    return fetch(`${DATA_URL_BASE}/${markerId}.json`, { method: 'DELETE' });
                }
            }

            // Aktualisierten Report zurück an Firebase senden
            return fetch(`${DATA_URL_BASE}/${markerId}.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(report)
            });
        })
        .catch(err => console.error("Hintergrund-Sync fehlgeschlagen:", err))
    );
});
