const fs = require('fs');

function updateFile(file) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Fix CSS
    content = content.replace(
        /.tv-integrations-status\s*\{[\s\S]*?z-index:\s*\d+;/m,
        `.tv-integrations-status {
            position: fixed;
            bottom: 30px;
            right: 230px;
            display: flex;
            gap: 12px;
            z-index: 250000;`
    );

    // Fix updateIntegrationsStatus logic
    const oldLogic = `if(currentViewMode === 'NATIVE') {
                integrationsUI.style.display = 'none';
                return;
            }`;
    const newLogic = `if(currentViewMode !== 'TV') {
                integrationsUI.style.display = 'none';
                return;
            }`;
    content = content.replace(oldLogic, newLogic);
    
    // Add Linx to UI
    const oldUI = `integrationsUI.innerHTML = \\\`
                <div class="integration-pill">
                    <div class="status-dot \\\${ifoodDot}"></div>
                    <div>\\\${ifoodText}</div>
                </div>
                <div class="integration-pill">
                    <div class="status-dot \\\${rappiDot}"></div>
                    <div>\\\${rappiText}</div>
                </div>
            \\\`;`;
            
    const newUI = `integrationsUI.innerHTML = \\\`
                <div class="integration-pill">
                    <div class="status-dot dot-green"></div>
                    <div>Linx: Online</div>
                </div>
                <div class="integration-pill">
                    <div class="status-dot \\\${ifoodDot}"></div>
                    <div>\\\${ifoodText}</div>
                </div>
                <div class="integration-pill">
                    <div class="status-dot \\\${rappiDot}"></div>
                    <div>\\\${rappiText}</div>
                </div>
            \\\`;`;
    content = content.replace(oldUI, newUI);
    
    fs.writeFileSync(file, content, 'utf8');
    console.log('Updated ' + file);
}

updateFile('oms_monitor_apoio_firefox.user.js');
updateFile('oms_monitor_apoio_chrome.user.js');
