const fs = require('fs');

const filesToMerge = [
    { file: 'oms-automation.user.js', id: 'omsAutomation', desc: 'Linx OMS - Automação Rihappy', urlCheck: "window.location.hostname.includes('linxoms.com.br')" },
    { file: 'whatsapp_linx.user.js', id: 'omsWhatsapp', desc: 'Linx OMS - Automação WhatsApp & Declaração de Entrega', urlCheck: "window.location.hostname.includes('linxoms.com.br')" }
];

let masterHeader = `// ==UserScript==
// @name         Super Master Script - Automação + WhatsApp
// @namespace    http://tampermonkey.net/
// @version      2.0.0
// @description  Apenas Automação e Botão WhatsApp/Declaração
// @author       Antigravity AI
// @match        *://*/*
// @connect      linxoms.com.br
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';
`;

let functionsCode = '';

let bootCode = `
    // Lógica de Boot
    let isLinxOms = window.location.hostname.includes('linxoms.com.br') || window.location.hostname.includes('rihappy.com.br');
    
    if (isLinxOms) {
        run_omsAutomation();
        run_omsWhatsapp();
    }
})();
`;

for (let item of filesToMerge) {
    if (!fs.existsSync(item.file)) {
        console.warn('File not found:', item.file);
        continue;
    }
    
    let content = fs.readFileSync(item.file, 'utf8');
    
    // Remover o UserScript header
    let body = content.replace(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/, '');
    
    // Remover o IIFE principal se houver
    body = body.replace(/^\s*\(\s*function\s*\(\)\s*\{\s*'use strict';/m, '');
    body = body.replace(/\}\)\(\);\s*$/m, '');

    functionsCode += `
// =========================================================================
// SCRIPT: ${item.desc} (${item.file})
// =========================================================================
function run_${item.id}() {
    console.log("Iniciando Módulo: ${item.desc}");
    try {
        ${body}
    } catch(e) {
        console.error("Erro no módulo ${item.id}:", e);
    }
}
`;
}

fs.writeFileSync('MASTER_SCRIPT.user.js', masterHeader + functionsCode + bootCode);
console.log('MASTER_SCRIPT.user.js atualizado com apenas automação e whatsapp!');
