// ==UserScript==
// @name         Monitor de Separação - Rihappy
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Monitor discreto para o PC de separação. Realça pedidos na lista de retirada que estão perto de expirar (15 dias). Funciona na lista e no detalhe.
// @author       Antigravity
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const DIAS_ALERTA = 13; // Começa a alertar a partir de 13 dias (2 dias antes do vencimento)
    const DIAS_LIMITE = 15; // Limite para cancelamento

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
        if (diffTime < 0) return 0; // Se estiver no futuro
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }

    // MÓDULO 1: LISTA DE RETIRADA
    function checkFulfillmentsList() {
        const table = document.querySelector('table.pickup-fulfillments');
        if (!table) return;

        const rows = table.querySelectorAll('tbody tr');
        const today = new Date();

        rows.forEach(row => {
            if (row.classList.contains('monitor-checked')) return;

            const paymentDateElement = row.querySelector('.payment-date');
            
            if (paymentDateElement) {
                const dateText = paymentDateElement.textContent;
                const paymentDate = parseDate(dateText);

                if (paymentDate) {
                    const daysPassed = getDiffDays(paymentDate, today);
                    
                    let color = '#28a745'; // Verde por padrão (no prazo)
                    let text = `${daysPassed} dias (No prazo)`;
                    let icon = '✅';
                    let highlight = false;

                    if (daysPassed >= DIAS_LIMITE) {
                        color = '#dc3545'; // Vermelho
                        text = `${daysPassed} dias (Cancelar)`;
                        icon = '🚨';
                        highlight = true;
                        row.style.backgroundColor = 'rgba(220, 53, 69, 0.05)';
                    } else if (daysPassed === 14) {
                        color = '#fd7e14'; // Laranja
                        text = `14 dias (Vence amanhã)`;
                        icon = '⚠️';
                        highlight = true;
                    } else if (daysPassed === 13) {
                        color = '#ffc107'; // Amarelo
                        text = `13 dias`;
                        icon = '⚠️';
                        highlight = true;
                    }

                    if (highlight) {
                        row.style.borderLeft = `4px solid ${color}`;
                    }

                    // Adiciona uma tag discreta abaixo do status do pedido
                    let statusCell = row.querySelector('.order-status');
                    if (statusCell) {
                        const badge = document.createElement('div');
                        badge.textContent = `${icon} Retirada: ${text}`;
                        badge.style.color = color;
                        badge.style.fontSize = '12px';
                        badge.style.fontWeight = 'bold';
                        badge.style.marginTop = '4px';
                        badge.className = 'monitor-badge';

                        if (statusCell.parentNode && !row.querySelector('.monitor-badge')) {
                            statusCell.parentNode.insertBefore(badge, statusCell.nextSibling);
                        }
                    }
                }
            }
            row.classList.add('monitor-checked');
        });
    }

    // MÓDULO 2: TELA DE DETALHES DO PEDIDO
    function checkFulfillmentDetails() {
        const detailsContainer = document.querySelector('.order-details');
        if (!detailsContainer) return;
        
        if (detailsContainer.classList.contains('monitor-checked')) return;

        // Encontra a "Data de Compra" nos <dt> e <dd>
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

                let color = '#28a745';
                let text = `${daysPassed} dias (No prazo)`;
                let icon = '✅';

                if (daysPassed >= DIAS_LIMITE) {
                    color = '#dc3545';
                    text = `${daysPassed} dias (Cancelar)`;
                    icon = '🚨';
                } else if (daysPassed === 14) {
                    color = '#fd7e14';
                    text = `14 dias (Vence amanhã)`;
                    icon = '⚠️';
                } else if (daysPassed === 13) {
                    color = '#ffc107';
                    text = `13 dias`;
                    icon = '⚠️';
                }

                // Inserir badge no título principal da página de detalhes
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
                }
            }
        }
        
        detailsContainer.classList.add('monitor-checked');
    }

    function runMonitor() {
        checkFulfillmentsList();
        checkFulfillmentDetails();
    }

    // Fallback robusto para SPA (AngularJS) que garante que a renderização não passe despercebida
    setInterval(runMonitor, 1500);

    // MutationObserver extra
    const observer = new MutationObserver(() => {
        runMonitor();
    });
    observer.observe(document.body, { childList: true, subtree: true });

})();
