// Funktion öffnet das barrierefreie Melde-Overlay
function openBlindReportForm() {
    // 1. GPS-Standort für die neue Meldung ermitteln
    announceStatus("Ermittle aktuellen Standort für die Meldung. Bitte warten...");
    
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        announceStatus("Standort erfasst. Melde-Formular geöffnet.");

        // 2. Barrierefreies HTML-Overlay erstellen
        const modal = document.createElement('div');
        modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:#121212; z-index:100000; padding:20px; box-sizing:border-box; overflow-y:auto; font-family:sans-serif;";
        
        modal.innerHTML = `
            <main role="dialog" aria-labelledby="form-title">
                <h2 id="form-title" style="color:#00FF66; text-align:center;">⚠️ Neues Hindernis melden</h2>
                <p class="hidden-accessible">Du befindest dich im Meldeformular. Nutze die Wischgesten, um die Art des Hindernisses auszuwählen.</p>
                
                <form id="blindReportForm" onsubmit="saveBlindReport(event, ${lat}, ${lng}, this)">
                    
                    <fieldset style="border:3px solid #333; border-radius:8px; padding:15px; margin-bottom:20px;">
                        <legend style="color:#00FF66; padding:0 10px; font-weight:bold;">Art des Hindernisses</legend>
                        
                        <label style="display:block; margin-bottom:15px; cursor:pointer;">
                            <input type="radio" name="blindTyp" value="Blindenleitsystem blockiert" checked style="transform:scale(1.5); margin-right:10px;"> 
                            ⚠️ Blindenleitsystem blockiert
                        </label>
                        
                        <label style="display:block; margin-bottom:15px; cursor:pointer;">
                            <input type="radio" name="blindTyp" value="Akustische Ampel defekt" style="transform:scale(1.5); margin-right:10px;"> 
                            🔊 Akustische Ampel defekt
                        </label>
                        
                        <label style="display:block; margin-bottom:15px; cursor:pointer;">
                            <input type="radio" name="blindTyp" value="Tiefhängendes Hindernis" style="transform:scale(1.5); margin-right:10px;"> 
                            🚧 Gefahr auf Kopfhöhe (Äste/Schilder)
                        </label>
                        
                        <label style="display:block; margin-bottom:5px; cursor:pointer;">
                            <input type="radio" name="blindTyp" value="Querstehender E-Scooter/Fahrrad" style="transform:scale(1.5); margin-right:10px;"> 
                            🚲 E-Scooter / Fahrrad im Weg
                        </label>
                    </fieldset>

                    <label style="display:block; margin-bottom:20px;">
                        <span style="display:block; margin-bottom:5px; font-weight:bold;">Zusatzbeschreibung (optional, gerne diktieren):</span>
                        <input type="text" id="blindDetails" placeholder="z.B. Vor der Bäckerei, Baustellenschild ragt rein..." 
                               style="width:100%; padding:15px; background:#222; color:white; border:2px solid #555; border-radius:6px; font-size:1.1rem; box-sizing:border-box;">
                    </label>

                    <button type="submit" class="btn-blind" style="background:#00FF66; color:black; margin-bottom:10px;">💾 Hindernis absenden</button>
                    <button type="button" id="btn-form-cancel" class="btn-blind" style="background:#222; color:#FF3333; border:2px solid #FF3333;">Abbrechen</button>
                </form>
            </main>
        `;
        document.body.appendChild(modal);

        // Fokus direkt auf die Überschrift legen, damit der Screenreader sofort losliest
        modal.querySelector('#form-title').focus();

        // Schließen-Logik
        modal.querySelector('#btn-form-cancel').onclick = () => {
            document.body.removeChild(modal);
            announceStatus("Melden abgebrochen.");
        };

    }, () => {
        announceStatus("Fehler: Standort konnte nicht ermittelt werden. Meldung nicht möglich.");
    });
}
