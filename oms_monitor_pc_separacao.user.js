// ==UserScript==
// @name         Monitor PC Separação - Linx OMNI (Discreto)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Monitor não-invasivo para PC de separação. Alerta de Lista de Despacho e contagem regressiva para Retirada (15 dias) com WhatsApp.
// @author       Antigravity
// @match        *://*.linxoms.com.br/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const DIAS_LIMITE = 15;
    const CHECK_INTERVAL = 30000; // 30 segundos
    let lastSendReadyCount = -1;
    let isModalMinimized = false;

    // --- UTILS ---
    function getDynamicStoreId() {
        const keys = ['currentLocation', 'selectedLocation', 'location', 'store', 'current_location', 'selected_location'];
        
        for (let storage of [localStorage, sessionStorage]) {
            for (const key of keys) {
                const val = storage.getItem(key);
                if (val) {
                    try {
                        const parsed = JSON.parse(val);
                        if (parsed && typeof parsed === 'object') {
                            const storeVal = parsed.id || parsed.code || parsed.locationId || parsed.storeId;
                            if (storeVal) return String(storeVal).trim();
                        }
                    } catch (e) {
                        if (/^\d+$/.test(val.trim())) return val.trim();
                    }
                }
            }
        }
        
        try {
            const pathSegments = window.location.pathname.split('/');
            for (const segment of pathSegments) {
                if (/^\d+$/.test(segment) && segment.length >= 3) return segment;
            }
        } catch (e) { }
        return null;
    }

    function parseDate(dateStr) {
        if (!dateStr) return null;
        const parts = dateStr.trim().split(' ');
        if (parts.length < 2) return null;
        const dateParts = parts[0].split('/');
        const timeParts = parts[1].split(':');
        if (dateParts.length !== 3 || timeParts.length < 2) return null;
        const day = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1;
        let year = parseInt(dateParts[2], 10);
        if (year < 100) year += 2000;
        const hours = parseInt(timeParts[0], 10);
        const minutes = parseInt(timeParts[1], 10);
        return new Date(year, month, day, hours, minutes);
    }

    function getDiffDays(date1, date2) {
        const diffTime = date2 - date1;
        if (diffTime < 0) return 0;
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }

    // --- MÓDULO 1: ALERTA LISTA DE DESPACHO ---
    async function checkListaDespacho() {
        const storeId = getDynamicStoreId();
        if (!storeId) return;

        try {
            const url = `https://instore.linxoms.com.br/api/proxy/order-ms/clients/rihappy/fulfillments?locationId=${storeId}&status[]=SEND_READY&pageSize=1`;
            
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json, text/plain, */*',
                    'Authorization': localStorage.getItem('token') ? 'Bearer ' + localStorage.getItem('token').replace(/"/g, '') : ''
                }
            });

            if (response.ok) {
                const data = await response.json();
                const total = data.totalElements || data.totalCount || (data.items ? data.items.length : 0);
                
                if (total > 0) {
                    showDespachoAlert(total);
                } else {
                    hideDespachoAlert();
                }
            }
        } catch (error) {
            console.error("Erro ao checar Lista de Despacho", error);
        }
    }

    function createModalUI() {
        if (document.getElementById('despacho-alerta-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'despacho-alerta-modal';
        modal.style.position = 'fixed';
        modal.style.top = '20px';
        modal.style.left = '50%';
        modal.style.transform = 'translateX(-50%)';
        modal.style.backgroundColor = '#ffffff';
        modal.style.border = '2px solid #e74c3c';
        modal.style.borderRadius = '8px';
        modal.style.padding = '15px 25px';
        modal.style.boxShadow = '0 4px 15px rgba(231, 76, 60, 0.3)';
        modal.style.zIndex = '999999';
        modal.style.display = 'none';
        modal.style.flexDirection = 'column';
        modal.style.alignItems = 'center';
        modal.style.fontFamily = 'Arial, sans-serif';
        modal.style.transition = 'all 0.3s ease';

        const title = document.createElement('div');
        title.id = 'despacho-alerta-title';
        title.style.color = '#e74c3c';
        title.style.fontSize = '18px';
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '10px';
        title.style.textAlign = 'center';
        
        const btnGroup = document.createElement('div');
        btnGroup.style.display = 'flex';
        btnGroup.style.gap = '10px';
        btnGroup.style.width = '100%';

        const btnAcessar = document.createElement('a');
        btnAcessar.textContent = 'Acessar Lista';
        btnAcessar.style.flex = '1';
        btnAcessar.style.textAlign = 'center';
        btnAcessar.style.backgroundColor = '#e74c3c';
        btnAcessar.style.color = '#fff';
        btnAcessar.style.padding = '8px 0';
        btnAcessar.style.borderRadius = '4px';
        btnAcessar.style.textDecoration = 'none';
        btnAcessar.style.fontWeight = 'bold';
        btnAcessar.style.cursor = 'pointer';
        // Ação para ir para lista de despacho
        btnAcessar.onclick = () => {
            const currentUrl = window.location.href;
            if (currentUrl.includes('/store/fulfillments')) {
                // Tentar clicar na aba de Despacho se já estiver na tela de fulfillments
                const tabs = document.querySelectorAll('a, button');
                for (let t of tabs) {
                    if (t.textContent.trim().toLowerCase() === 'despacho' || t.textContent.trim().toLowerCase().includes('send_ready')) {
                        t.click();
                        break;
                    }
                }
            } else {
                // Redireciona para tela de pedidos
                window.location.href = '/store/fulfillments';
            }
            minimizeAlert();
        };

        const btnMinimizar = document.createElement('button');
        btnMinimizar.textContent = 'Minimizar';
        btnMinimizar.style.flex = '1';
        btnMinimizar.style.backgroundColor = '#f1f1f1';
        btnMinimizar.style.color = '#333';
        btnMinimizar.style.border = '1px solid #ccc';
        btnMinimizar.style.padding = '8px 0';
        btnMinimizar.style.borderRadius = '4px';
        btnMinimizar.style.fontWeight = 'bold';
        btnMinimizar.style.cursor = 'pointer';
        btnMinimizar.onclick = () => minimizeAlert();

        btnGroup.appendChild(btnAcessar);
        btnGroup.appendChild(btnMinimizar);

        modal.appendChild(title);
        modal.appendChild(btnGroup);

        document.body.appendChild(modal);

        // Ícone minimizado
        const icon = document.createElement('div');
        icon.id = 'despacho-alerta-icon';
        icon.style.position = 'fixed';
        icon.style.top = '20px';
        icon.style.right = '20px';
        icon.style.backgroundColor = '#e74c3c';
        icon.style.color = '#fff';
        icon.style.width = '40px';
        icon.style.height = '40px';
        icon.style.borderRadius = '50%';
        icon.style.display = 'none';
        icon.style.alignItems = 'center';
        icon.style.justifyContent = 'center';
        icon.style.fontWeight = 'bold';
        icon.style.fontSize = '16px';
        icon.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
        icon.style.zIndex = '999999';
        icon.style.cursor = 'pointer';
        icon.onclick = () => restoreAlert();

        document.body.appendChild(icon);
    }

    function showDespachoAlert(count) {
        createModalUI();
        const modal = document.getElementById('despacho-alerta-modal');
        const icon = document.getElementById('despacho-alerta-icon');
        const title = document.getElementById('despacho-alerta-title');
        
        lastSendReadyCount = count;
        title.innerHTML = `⚠️ Você tem ${count} item(s) na<br/>Lista de Despacho!`;
        icon.textContent = count;

        if (!isModalMinimized) {
            modal.style.display = 'flex';
            icon.style.display = 'none';
        } else {
            icon.style.display = 'flex';
            // Efeito de pulso para chamar atenção quando novo pedido entra
            icon.style.transform = 'scale(1.2)';
            setTimeout(() => { icon.style.transform = 'scale(1)'; }, 500);
        }
    }

    function hideDespachoAlert() {
        const modal = document.getElementById('despacho-alerta-modal');
        const icon = document.getElementById('despacho-alerta-icon');
        if (modal) modal.style.display = 'none';
        if (icon) icon.style.display = 'none';
    }

    function minimizeAlert() {
        isModalMinimized = true;
        const modal = document.getElementById('despacho-alerta-modal');
        const icon = document.getElementById('despacho-alerta-icon');
        if (modal) modal.style.display = 'none';
        if (icon && lastSendReadyCount > 0) icon.style.display = 'flex';
    }

    function restoreAlert() {
        isModalMinimized = false;
        const modal = document.getElementById('despacho-alerta-modal');
        const icon = document.getElementById('despacho-alerta-icon');
        if (icon) icon.style.display = 'none';
        if (modal && lastSendReadyCount > 0) modal.style.display = 'flex';
    }


    // --- MÓDULO 2: LISTA DE RETIRADA (Dias + WhatsApp) ---
    function checkFulfillmentsList() {
        const table = document.querySelector('table.pickup-fulfillments');
        if (!table) return;

        const rows = table.querySelectorAll('tbody tr');
        const today = new Date();

        rows.forEach(row => {
            if (row.classList.contains('monitor-checked')) return;

            const paymentDateElement = row.querySelector('.payment-date') || row.querySelector('td:nth-child(2)'); // Fallback column
            
            if (paymentDateElement) {
                const dateText = paymentDateElement.textContent;
                const paymentDate = parseDate(dateText);

                if (paymentDate) {
                    const daysPassed = getDiffDays(paymentDate, today);
                    const daysRemaining = DIAS_LIMITE - daysPassed;
                    
                    let color = '#28a745'; 
                    let text = `Faltam ${daysRemaining} dias (No prazo)`;
                    let icon = '✅';
                    let highlight = false;

                    if (daysPassed >= DIAS_LIMITE) {
                        color = '#dc3545';
                        text = `Passaram ${daysPassed} dias (Cancelar/Expirado)`;
                        icon = '🚨';
                        highlight = true;
                        row.style.backgroundColor = 'rgba(220, 53, 69, 0.05)';
                    } else if (daysPassed === 14) {
                        color = '#fd7e14';
                        text = `Falta 1 dia (Vence amanhã)`;
                        icon = '⚠️';
                        highlight = true;
                    } else if (daysPassed === 13) {
                        color = '#ffc107';
                        text = `Faltam 2 dias`;
                        icon = '⚠️';
                        highlight = true;
                    }

                    if (highlight) {
                        row.style.borderLeft = `4px solid ${color}`;
                    }

                    let statusCell = row.querySelector('.order-status') || row.querySelector('td:last-child');
                    if (statusCell) {
                        const badgeContainer = document.createElement('div');
                        badgeContainer.className = 'monitor-badge-container';
                        badgeContainer.style.display = 'flex';
                        badgeContainer.style.alignItems = 'center';
                        badgeContainer.style.gap = '8px';
                        badgeContainer.style.marginTop = '6px';

                        const badge = document.createElement('div');
                        badge.textContent = `${icon} Retirada: ${text}`;
                        badge.style.color = color;
                        badge.style.fontSize = '12px';
                        badge.style.fontWeight = 'bold';

                        // Captura do número de telefone (se existir na tela)
                        // Muitas vezes o telefone está oculto ou precisa entrar no detalhe.
                        let telefone = '';
                        const phoneEl = row.querySelector('.customer-phone, .phone');
                        if (phoneEl) {
                            telefone = phoneEl.textContent.replace(/\D/g, '');
                            if (!telefone.startsWith('55')) telefone = '55' + telefone;
                        }

                        const msgText = encodeURIComponent(`Olá! Seu pedido já está separado e disponível para retirada na loja. Lembramos que o pedido será cancelado caso não seja retirado em até ${daysRemaining} dia(s).`);
                        const btnWpp = document.createElement('a');
                        btnWpp.href = telefone ? `https://web.whatsapp.com/send?phone=${telefone}&text=${msgText}` : `https://web.whatsapp.com/send?text=${msgText}`;
                        btnWpp.target = '_blank';
                        btnWpp.style.backgroundColor = '#25D366';
                        btnWpp.style.color = '#fff';
                        btnWpp.style.padding = '3px 8px';
                        btnWpp.style.borderRadius = '4px';
                        btnWpp.style.textDecoration = 'none';
                        btnWpp.style.fontSize = '11px';
                        btnWpp.style.fontWeight = 'bold';
                        btnWpp.style.display = 'flex';
                        btnWpp.style.alignItems = 'center';
                        btnWpp.style.gap = '4px';
                        btnWpp.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> Entrar em contato`;

                        badgeContainer.appendChild(badge);
                        badgeContainer.appendChild(btnWpp);

                        if (statusCell.parentNode && !row.querySelector('.monitor-badge-container')) {
                            statusCell.parentNode.insertBefore(badgeContainer, statusCell.nextSibling);
                        }
                    }
                }
            }
            row.classList.add('monitor-checked');
        });
    }

    // --- MÓDULO 2.1: TELA DE DETALHE DO PEDIDO ---
    function checkFulfillmentDetails() {
        const detailsContainer = document.querySelector('.order-details');
        if (!detailsContainer) return;
        
        if (detailsContainer.classList.contains('monitor-checked')) return;

        const dts = detailsContainer.querySelectorAll('dt');
        let orderDateText = null;

        for (let dt of dts) {
            if (dt.textContent.trim().toLowerCase().includes('compra:')) {
                const dd = dt.nextElementSibling;
                if (dd && dd.tagName.toLowerCase() === 'dd') {
                    orderDateText = dd.textContent;
                    break;
                }
            }
        }

        if (orderDateText) {
            const orderDate = parseDate(orderDateText);
            const today = new Date();

            if (orderDate) {
                const daysPassed = getDiffDays(orderDate, today);
                const daysRemaining = DIAS_LIMITE - daysPassed;

                let color = '#28a745';
                let text = `Faltam ${daysRemaining} dias (No prazo)`;
                let icon = '✅';

                if (daysPassed >= DIAS_LIMITE) {
                    color = '#dc3545';
                    text = `Passaram ${daysPassed} dias (Cancelar)`;
                    icon = '🚨';
                } else if (daysPassed === 14) {
                    color = '#fd7e14';
                    text = `Falta 1 dia (Vence amanhã)`;
                    icon = '⚠️';
                } else if (daysPassed === 13) {
                    color = '#ffc107';
                    text = `Faltam 2 dias`;
                    icon = '⚠️';
                }

                const titleBlock = document.querySelector('.fulfillment-details-title');
                if (titleBlock && !titleBlock.querySelector('.monitor-badge-details')) {
                    const badge = document.createElement('span');
                    badge.className = 'monitor-badge-details';
                    badge.textContent = `${icon} Retirada: ${text}`;
                    badge.style.display = 'inline-block';
                    badge.style.padding = '4px 8px';
                    badge.style.borderRadius = '6px';
                    badge.style.backgroundColor = color;
                    badge.style.color = '#fff';
                    badge.style.fontSize = '14px';
                    badge.style.fontWeight = 'bold';
                    badge.style.marginLeft = '15px';
                    badge.style.verticalAlign = 'middle';
                    
                    titleBlock.appendChild(badge);

                    // Adicionar Botão de WhatsApp no detalhe também
                    let telefone = '';
                    const dtsAll = detailsContainer.querySelectorAll('dt');
                    for (let dt of dtsAll) {
                        const text = dt.textContent.trim().toLowerCase();
                        if (text.includes('telefone:') || text.includes('cliente:')) {
                            const parentTable = dt.closest('.table-details');
                            const parentH5 = parentTable ? parentTable.querySelector('h5') : null;
                            if (text.includes('cliente:') && (!parentH5 || !parentH5.textContent.toLowerCase().includes('telefone'))) {
                                continue; // Ignora 'cliente:' se não estiver na seção de Telefones
                            }
                            const dd = dt.nextElementSibling;
                            if (dd && dd.tagName.toLowerCase() === 'dd') {
                                telefone = dd.textContent.replace(/\D/g, '');
                                if (!telefone.startsWith('55') && telefone.length > 0) telefone = '55' + telefone;
                                if (telefone.length > 0) break;
                            }
                        }
                    }

                    const msgText = encodeURIComponent(`Olá! Seu pedido já está separado e disponível para retirada na loja. Lembramos que o pedido será cancelado caso não seja retirado em até ${daysRemaining} dia(s).`);
                    const btnWpp = document.createElement('a');
                    btnWpp.href = telefone ? `https://web.whatsapp.com/send?phone=${telefone}&text=${msgText}` : `https://web.whatsapp.com/send?text=${msgText}`;
                    btnWpp.target = '_blank';
                    btnWpp.style.display = 'inline-block';
                    btnWpp.style.backgroundColor = '#25D366';
                    btnWpp.style.color = '#fff';
                    btnWpp.style.padding = '4px 12px';
                    btnWpp.style.borderRadius = '6px';
                    btnWpp.style.textDecoration = 'none';
                    btnWpp.style.fontSize = '14px';
                    btnWpp.style.fontWeight = 'bold';
                    btnWpp.style.marginLeft = '10px';
                    btnWpp.style.verticalAlign = 'middle';
                    btnWpp.innerHTML = `💬 Entrar em contato`;
                    titleBlock.appendChild(btnWpp);
                }
            }
        }
        
        detailsContainer.classList.add('monitor-checked');
    }

    // --- INICIALIZAÇÃO ---
    function init() {
        setInterval(checkListaDespacho, CHECK_INTERVAL);
        setTimeout(checkListaDespacho, 2000); // Primeira checagem rápida

        setInterval(() => {
            checkFulfillmentsList();
            checkFulfillmentDetails();
        }, 1500);
        
        const observer = new MutationObserver(() => {
            checkFulfillmentsList();
            checkFulfillmentDetails();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
