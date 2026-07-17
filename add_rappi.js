const fs = require('fs');

function updateFile(file) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Add Rappi matches
    if (!content.includes('*.rappi.com/*')) {
        content = content.replace('// @match        https://separador.ifood.com.br/*', '// @match        https://separador.ifood.com.br/*\n// @match        https://*.rappi.com/*\n// @match        https://*.rappi.com.br/*');
    }

    // Replace iFood integration block
    const ifoodBlock = `if (window.location.hostname.includes('ifood.com.br')) {
            setInterval(() => {
                let newOrdersCount = 0;
                let isLoggedIn = true;
                if (document.querySelector('input[type="password"]') || document.body.innerText.toLowerCase().includes('entrar')) {
                    isLoggedIn = false;
                }
                const outputByAria = document.querySelector('output[aria-label*="pedidos"]');
                if (outputByAria && outputByAria.textContent) {
                    const val = parseInt(outputByAria.textContent.trim(), 10);
                    if (!isNaN(val)) newOrdersCount = val;
                } else {
                    const pElements = Array.from(document.querySelectorAll('p'));
                    const pedidosP = pElements.find(p => p.textContent.trim().toLowerCase() === 'pedidos');
                    if (pedidosP && pedidosP.parentElement) {
                        const outputEl = pedidosP.parentElement.querySelector('output');
                        if (outputEl && outputEl.textContent) {
                            const val = parseInt(outputEl.textContent.trim(), 10);
                            if (!isNaN(val)) newOrdersCount = val;
                        }
                    }
                }
                GM_setValue('ifoodPendingOrders', newOrdersCount);
                GM_setValue('ifoodLastUpdate', Date.now());
                GM_setValue('ifoodLoggedIn', isLoggedIn);
            }, 3000);
            console.log("Monitor iFood rodando silenciosamente para alimentar o Painel TV OMS...");
            return; // Impede execução do código OMS na aba do iFood
        }

        // --- INTEGRAÇÃO DIRETA COM PORTAL RAPPI ---
        if (window.location.hostname.includes('rappi.com')) {
            setInterval(() => {
                let isLoggedIn = true;
                if (document.querySelector('input[type="password"]') || document.body.innerText.toLowerCase().includes('iniciar sesión') || document.body.innerText.toLowerCase().includes('login') || document.body.innerText.toLowerCase().includes('entrar')) {
                    isLoggedIn = false;
                }
                GM_setValue('rappiLastUpdate', Date.now());
                GM_setValue('rappiLoggedIn', isLoggedIn);
            }, 3000);
            console.log("Monitor Rappi rodando silenciosamente para alimentar o Painel TV OMS...");
            return; // Impede execução do código OMS na aba do Rappi
        }`;
        
    const startIdx = content.indexOf('if (window.location.hostname.includes(\'ifood.com.br\')) {');
    if (startIdx !== -1) {
        const endIdx = content.indexOf('return; // Impede execução do código OMS na aba do iFood', startIdx);
        if (endIdx !== -1) {
            const blockEnd = endIdx + 'return; // Impede execução do código OMS na aba do iFood'.length + 10;
            const originalBlock = content.substring(startIdx, blockEnd);
            if (!originalBlock.includes('rappi')) {
                content = content.replace(originalBlock, ifoodBlock + '\n\n');
            }
        }
    }

    const cssToInject = `
        /* Status das Integrações */
        .tv-integrations-status {
            position: fixed;
            top: 25px;
            right: 30px;
            display: flex;
            gap: 12px;
            z-index: 100000;
        }
        .integration-pill {
            display: flex;
            align-items: center;
            gap: 8px;
            background: rgba(10, 15, 30, 0.8);
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 8px 16px;
            border-radius: 30px;
            font-size: 14px;
            font-weight: 900;
            color: #fff;
            letter-spacing: 1px;
            backdrop-filter: blur(5px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            transition: all 0.3s ease;
        }
        .status-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
        }
        .dot-green { background: #00ff88; box-shadow: 0 0 10px #00ff88; }
        .dot-red { background: #ff3e3e; box-shadow: 0 0 10px #ff3e3e; animation: heartbeat 1s infinite; }
        .dot-gray { background: #555; }
    `;
    if (!content.includes('.tv-integrations-status {')) {
        content = content.replace('const toggleStyle = document.createElement(\'style\');\n        toggleStyle.innerHTML = `', 'const toggleStyle = document.createElement(\'style\');\n        toggleStyle.innerHTML = `' + cssToInject);
    }
    
    const jsToInject = `
        const integrationsUI = document.createElement('div');
        integrationsUI.className = 'tv-integrations-status';
        document.body.appendChild(integrationsUI);

        function updateIntegrationsStatus() {
            if(currentViewMode === 'NATIVE') {
                integrationsUI.style.display = 'none';
                return;
            }
            integrationsUI.style.display = 'flex';
            
            const ifoodLast = parseInt(GM_getValue('ifoodLastUpdate', 0), 10);
            const ifoodLogged = GM_getValue('ifoodLoggedIn', false);
            const ifoodActive = (Date.now() - ifoodLast) < 60000;
            
            const rappiLast = parseInt(GM_getValue('rappiLastUpdate', 0), 10);
            const rappiLogged = GM_getValue('rappiLoggedIn', false);
            const rappiActive = (Date.now() - rappiLast) < 60000;
            
            let ifoodDot = 'dot-gray'; let ifoodText = 'iFood: Inativo';
            if (ifoodActive) {
                if (ifoodLogged) { ifoodDot = 'dot-green'; ifoodText = 'iFood: Online'; }
                else { ifoodDot = 'dot-red'; ifoodText = 'iFood: Deslogado'; }
            }
            
            let rappiDot = 'dot-gray'; let rappiText = 'Rappi: Inativo';
            if (rappiActive) {
                if (rappiLogged) { rappiDot = 'dot-green'; rappiText = 'Rappi: Online'; }
                else { rappiDot = 'dot-red'; rappiText = 'Rappi: Deslogado'; }
            }
            
            integrationsUI.innerHTML = \`
                <div class="integration-pill">
                    <div class="status-dot \${ifoodDot}"></div>
                    <div>\${ifoodText}</div>
                </div>
                <div class="integration-pill">
                    <div class="status-dot \${rappiDot}"></div>
                    <div>\${rappiText}</div>
                </div>
            \`;
        }
        setInterval(updateIntegrationsStatus, 3000);
        updateIntegrationsStatus();
    `;
    if (!content.includes('updateIntegrationsStatus()')) {
        content = content.replace('document.body.appendChild(toggleBtn);', 'document.body.appendChild(toggleBtn);\n' + jsToInject);
    }

    fs.writeFileSync(file, content, 'utf8');
    console.log('Updated ' + file);
}

updateFile('oms_monitor_apoio_firefox.user.js');
updateFile('oms_monitor_apoio_chrome.user.js');
