// ==UserScript==
// @name         CRM Bônus - Super Tools (WhatsApp + Saldos + Dashboard)
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  Adiciona botão de WhatsApp e classificação de saldos nas tabelas de Clientes e Dashboard do CRM.
// @author       Antigravity
// @match        https://www.crmbonus.com/loja/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // ============================================================
    //  CONFIGURAÇÕES GERAIS
    // ============================================================

    const DIAS_ALERTA_EXPIR = 7;

    function parseDate(str) {
        if (!str || str.indexOf('/') === -1) return null;
        const p = str.trim().split('/');
        if (p.length === 3) return new Date(+p[2], +p[1] - 1, +p[0]);
        return null;
    }

    function daysUntil(date) {
        if (!date) return 30;
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        return Math.floor((date - now) / 86400000);
    }

    function cleanPhone(raw) {
        let n = raw.replace(/\D/g, '');
        if (!n.startsWith('55') && n.length >= 10) n = '55' + n;
        return n;
    }

    // ============================================================
    //  MOTOR DE CLASSIFICAÇÃO E MENSAGENS
    // ============================================================

    function classifyAndFormatMessage(name, balanceStr, expireDateStr, type) {
        // Extrai o valor matemático do saldo
        let balanceVal = 0;
        if (typeof balanceStr === 'string') {
            balanceVal = parseFloat(balanceStr.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));
        } else {
            balanceVal = parseFloat(balanceStr);
        }
        if (isNaN(balanceVal)) balanceVal = 0;

        // Regra Ri Happy: Desconto máximo de 20%. Logo, compra mínima é saldo * 5
        let ticketMinimo = balanceVal * 5;
        let formattedMinimo = `R$ ${ticketMinimo.toFixed(2).replace('.', ',')}`;
        let formattedBalance = `R$ ${balanceVal.toFixed(2).replace('.', ',')}`;

        // Classificação visual com base nos cortes da loja
        let badgeHtml = '';
        let bgColor = '';
        let textColor = '';
        let borderColor = '';

        if (balanceVal < 18.50) {
            badgeHtml = `Frio 🔴: ${formattedBalance}`;
            bgColor = 'rgba(255, 60, 60, 0.15)';
            textColor = '#ff6b6b';
            borderColor = '#ef4444';
        } else if (balanceVal < 35) {
            badgeHtml = `Bom 🟡: ${formattedBalance}`;
            bgColor = 'rgba(255, 152, 0, 0.15)';
            textColor = '#ff9800';
            borderColor = '#f97316';
        } else if (balanceVal <= 50) {
            badgeHtml = `Excelente 🔥: ${formattedBalance}`;
            bgColor = 'rgba(37, 211, 102, 0.15)';
            textColor = '#4ade80';
            borderColor = '#22c55e';
        } else if (balanceVal <= 100) {
            badgeHtml = `Muito Top 💎: ${formattedBalance}`;
            bgColor = 'rgba(59, 130, 246, 0.15)';
            textColor = '#60a5fa';
            borderColor = '#3b82f6';
        } else {
            badgeHtml = `Acumulando 👑: ${formattedBalance}`;
            bgColor = 'rgba(168, 85, 247, 0.15)';
            textColor = '#c084fc';
            borderColor = '#a855f7';
        }

        // Templates unificados com explicação da mecânica
        let msgTemplate = '';
        if (type === 'expirando') {
            msgTemplate = 
`⏰ *Seu cashback está prestes a expirar!*

Olá, {nome}! Identificamos que você tem um benefício de cashback de *{valor}* disponível aqui na Ri Happy Carioca Shop. 

Lembrando que o seu bônus pode cobrir até 20% do valor do seu próximo brinquedo! Ou seja, para usar todo o seu saldo e garantir o desconto máximo, sua compra deve ser de no mínimo *{valor_minimo}*.

Aproveite seu saldo antes do prazo finalizar dia {validade}!
Esperamos sua visita! ☀️`;
        } else {
            msgTemplate = 
`🎉 *Seu cashback já está disponível!*

Olá, {nome}! Identificamos que você tem um benefício de cashback de *{valor}* disponível aqui na Ri Happy Carioca Shop. 

Lembrando que o seu bônus pode cobrir até 20% do valor do seu próximo brinquedo! Ou seja, para usar todo o seu saldo e garantir o desconto máximo, sua compra deve ser de no mínimo *{valor_minimo}*.

Aproveite seu saldo antes do prazo finalizar dia {validade}!
Esperamos sua visita! 💛`;
        }

        let msg = msgTemplate
            .replace('{nome}', name)
            .replace('{valor}', formattedBalance)
            .replace('{valor_minimo}', formattedMinimo)
            .replace('{validade}', expireDateStr || 'breve');

        msg = msg.replace(/\r\n/g, '\n');

        return { badgeHtml, bgColor, textColor, borderColor, msg, balanceVal, type };
    }

    // ============================================================
    //  FUNCIONALIDADE: DASHBOARD E SUAS TABELAS
    // ============================================================

    function createWhatsAppButtonFast(phone, msg, type) {
        const a = document.createElement('a');
        a.href = `https://wa.me/${cleanPhone(phone)}?text=${encodeURIComponent(msg)}`;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        
        // Impede que clicar no wpp abra o modal da linha (que tem o evento onclick nativo do CRM)
        a.addEventListener('click', (e) => e.stopPropagation());

        Object.assign(a.style, {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: '6px',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: '700',
            fontFamily: 'sans-serif',
            color: '#fff',
            textDecoration: 'none',
            cursor: 'pointer',
            backgroundColor: type === 'ativo' ? '#25D366' : '#FF9800',
            border: 'none',
        });

        a.innerHTML = type === 'ativo' ? '📲 Enviar WPP' : '⚠️ Enviar WPP (Expirando)';

        a.addEventListener('mouseenter', () => a.style.opacity = '0.8');
        a.addEventListener('mouseleave', () => a.style.opacity = '1');

        return a;
    }

    function processDashboardTables() {
        // --- Tabela: Bônus a Vencer ---
        const tableVencer = document.querySelectorAll('#tableBonusVencer tbody tr');
        tableVencer.forEach(row => {
            if (row.dataset.processed || row.cells.length < 4) return;
            row.dataset.processed = "true";

            const onclick = row.getAttribute('onclick');
            if (!onclick) return;
            const match = onclick.match(/modal_consumidor\('([^']+)','([^']+)'.*\)/);
            if (!match) return;

            const name = match[1];
            const phone = match[2];

            const expireDateStr = row.cells[0].innerText.trim();
            const balanceStr = row.cells[2].innerText.trim();

            const expireDate = parseDate(expireDateStr);
            const daysLeft = expireDate ? daysUntil(expireDate) : 30;
            const type = daysLeft <= DIAS_ALERTA_EXPIR ? 'expirando' : 'ativo';

            const info = classifyAndFormatMessage(name, balanceStr, expireDateStr, type);

            // Injeta a Badge na Coluna 2 (Bônus a Vencer)
            let badge = document.createElement('span');
            badge.style.display = 'block';
            badge.style.marginTop = '4px';
            badge.style.padding = '4px 8px';
            badge.style.borderRadius = '12px';
            badge.style.fontSize = '11px';
            badge.style.fontWeight = 'bold';
            badge.style.backgroundColor = info.bgColor;
            badge.style.color = info.textColor;
            badge.style.border = `1px solid ${info.borderColor}`;
            badge.innerHTML = info.badgeHtml;
            row.cells[2].appendChild(badge);

            // Injeta botão de WhatsApp na Coluna 1 (Cliente)
            let btn = createWhatsAppButtonFast(phone, info.msg, type);
            row.cells[1].appendChild(btn);
        });

        // --- Tabela: Bônus Gerado ---
        const tableGerado = document.querySelectorAll('#tableBonusGerado tbody tr');
        tableGerado.forEach(row => {
            if (row.dataset.processed || row.cells.length < 4) return;
            row.dataset.processed = "true";

            const onclick = row.getAttribute('onclick');
            if (!onclick) return;
            const match = onclick.match(/modal_consumidor\('([^']+)','([^']+)'.*\)/);
            if (!match) return;

            const name = match[1];
            const phone = match[2];

            // Colunas: 0: Data, 1: Cliente, 2: Venda, 3: Bônus gerado, 4: Ticket
            const dataGeradoStr = row.cells[0].innerText.trim();
            const balanceStr = row.cells[3].innerText.trim();

            let expireDateStr = "?";
            const dtGerado = parseDate(dataGeradoStr);
            if (dtGerado) {
                // Expira 33 dias após a compra (3 de ativação + 30 de validade)
                dtGerado.setDate(dtGerado.getDate() + 33);
                const dd = String(dtGerado.getDate()).padStart(2, '0');
                const mm = String(dtGerado.getMonth() + 1).padStart(2, '0');
                const yy = dtGerado.getFullYear();
                expireDateStr = `${dd}/${mm}/${yy}`;
            }

            const info = classifyAndFormatMessage(name, balanceStr, expireDateStr, 'ativo');

            let badge = document.createElement('span');
            badge.style.display = 'block';
            badge.style.marginTop = '4px';
            badge.style.padding = '4px 8px';
            badge.style.borderRadius = '12px';
            badge.style.fontSize = '11px';
            badge.style.fontWeight = 'bold';
            badge.style.backgroundColor = info.bgColor;
            badge.style.color = info.textColor;
            badge.style.border = `1px solid ${info.borderColor}`;
            badge.innerHTML = info.badgeHtml;
            row.cells[3].appendChild(badge);

            let btn = createWhatsAppButtonFast(phone, info.msg, 'ativo');
            row.cells[1].appendChild(btn);
        });
    }

    // ============================================================
    //  FUNCIONALIDADE: MODAL CLÁSSICO DO CLIENTE
    // ============================================================

    let lastPhone = null;

    function processModal() {
        const nameEl = document.getElementById('name_cli_modal');
        const phoneEl = document.getElementById('cel_cli_modal');
        const balanceEl = document.getElementById('saldo_cli_modal');
        const validEl = document.getElementById('validade_cli_modal');

        if (!nameEl || !phoneEl || !balanceEl || !validEl) return;

        const name = nameEl.innerText.trim();
        const phone = phoneEl.innerText.trim();
        const balance = balanceEl.innerText.trim();
        const validDateStr = validEl.innerText.trim();

        if (!name || !phone || !balance || !validDateStr) return;

        if (phone === lastPhone && document.getElementById('wa_modal_btn')) return;
        lastPhone = phone;

        const existing = document.getElementById('wa_modal_btn');
        if (existing) existing.remove();

        const expireDate = parseDate(validDateStr);
        if (!expireDate) return;

        const daysLeft = daysUntil(expireDate);
        if (daysLeft < 0) return;

        const type = daysLeft <= DIAS_ALERTA_EXPIR ? 'expirando' : 'ativo';
        const info = classifyAndFormatMessage(name, balance, validDateStr, type);

        const a = document.createElement('a');
        a.href = `https://wa.me/${cleanPhone(phone)}?text=${encodeURIComponent(info.msg)}`;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.id = 'wa_modal_btn';

        Object.assign(a.style, {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '10px 20px',
            margin: '16px auto 4px auto',
            maxWidth: '240px',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '700',
            fontFamily: 'sans-serif',
            color: '#fff',
            textDecoration: 'none',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            transition: 'opacity 0.2s',
            backgroundColor: type === 'ativo' ? '#25D366' : '#FF9800',
        });

        a.innerHTML = type === 'ativo'
            ? '📲 Enviar WhatsApp — Bônus Ativo'
            : '⚠️ Enviar WhatsApp — A Expirar';

        a.addEventListener('mouseenter', () => a.style.opacity = '0.85');
        a.addEventListener('mouseleave', () => a.style.opacity = '1');

        const modalBody = document.querySelector('.modal-body.text-center');
        if (modalBody) modalBody.appendChild(a);
    }

    // ============================================================
    //  FUNCIONALIDADE: ANALISADOR DE SALDOS (Página /loja/clientes)
    // ============================================================

    function injectAnalisarButton() {
        if (document.getElementById('btn_analisar_saldos')) return;

        const table = document.getElementById('tableClientes');
        if (!table) return;

        const container = document.createElement('div');
        container.style.width = '100%';
        container.style.marginBottom = '15px';
        container.style.display = 'flex';
        container.style.justifyContent = 'flex-end';

        const btn = document.createElement('button');
        btn.id = 'btn_analisar_saldos';
        btn.innerHTML = '🔍 Revelar Saldos da Página';
        Object.assign(btn.style, {
            padding: '10px 20px',
            backgroundColor: '#B9A078',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 'bold',
            fontSize: '14px',
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            transition: 'opacity 0.2s, background-color 0.2s',
        });
        
        btn.onmouseover = () => btn.style.opacity = '0.85';
        btn.onmouseout = () => btn.style.opacity = '1';

        container.appendChild(btn);
        table.parentNode.insertBefore(container, table);

        btn.addEventListener('click', async () => {
            const rows = document.querySelectorAll('#tableClientes tbody tr');
            if (rows.length === 0 || (rows.length === 1 && rows[0].innerText.includes('Nenhum'))) {
                alert('Nenhum cliente na tabela atual.');
                return;
            }

            btn.innerHTML = '⏳ Analisando...';
            btn.disabled = true;
            btn.style.backgroundColor = '#FF9800';

            for (const row of rows) {
                const onclick = row.getAttribute('onclick');
                if (!onclick) continue;
                
                const match = onclick.match(/modal_consumidor\('([^']+)','([^']+)','([^']+)'\)/);
                if (match) {
                    const name = match[1];
                    const tel = match[2];
                    const cpf = match[3];

                    let badgeWrapper = row.querySelector('.badge-wrapper');
                    if (!badgeWrapper) {
                        badgeWrapper = document.createElement('div');
                        badgeWrapper.className = 'badge-wrapper';
                        badgeWrapper.style.display = 'inline-flex';
                        badgeWrapper.style.flexDirection = 'column';
                        badgeWrapper.style.marginLeft = '12px';
                        badgeWrapper.style.verticalAlign = 'middle';
                        
                        const tdName = row.querySelector('td:first-child');
                        if (tdName) {
                            tdName.appendChild(badgeWrapper);
                        }
                    }

                    badgeWrapper.innerHTML = `<span style="color:#ccc; font-size:12px;">⏳</span>`;

                    try {
                        const params = new URLSearchParams();
                        params.append('name', name);
                        params.append('tel', tel);
                        params.append('cpf', cpf);
                        
                        const resp = await fetch('/Pages/modal_consumidor', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                            body: params.toString()
                        });
                        
                        const data = await resp.json();
                        const balanceStr = data.saldo_bonus || "0";
                        const validDateStr = data.validade;

                        const expireDate = parseDate(validDateStr);
                        const daysLeft = expireDate ? daysUntil(expireDate) : 30;
                        const type = daysLeft <= DIAS_ALERTA_EXPIR ? 'expirando' : 'ativo';

                        const info = classifyAndFormatMessage(name, balanceStr, validDateStr, type);

                        // Cria a badge do saldo
                        const badgeSaldo = document.createElement('span');
                        badgeSaldo.style.padding = '4px 8px';
                        badgeSaldo.style.borderRadius = '12px';
                        badgeSaldo.style.fontSize = '11px';
                        badgeSaldo.style.fontWeight = 'bold';
                        badgeSaldo.style.backgroundColor = info.bgColor;
                        badgeSaldo.style.color = info.textColor;
                        badgeSaldo.style.border = `1px solid ${info.borderColor}`;
                        badgeSaldo.innerHTML = info.badgeHtml;

                        // Cria botão WPP rápido para a lista geral
                        const btnWpp = createWhatsAppButtonFast(tel, info.msg, type);

                        badgeWrapper.innerHTML = '';
                        badgeWrapper.appendChild(badgeSaldo);
                        badgeWrapper.appendChild(btnWpp);

                    } catch(e) {
                        console.error(e);
                        badgeWrapper.innerHTML = `<span style="color:#ef4444; font-size:12px;">Erro</span>`;
                    }
                    
                    // Delay para não sobrecarregar
                    await new Promise(r => setTimeout(r, 200));
                }
            }
            
            btn.innerHTML = '✅ Saldos Revelados!';
            btn.style.backgroundColor = '#25D366';
            setTimeout(() => {
                btn.innerHTML = '🔍 Revelar Saldos da Página';
                btn.style.backgroundColor = '#B9A078';
                btn.disabled = false;
            }, 4000);
        });
    }

    // ============================================================
    //  OBSERVER COM DEBOUNCE
    // ============================================================

    let debounceTimer = null;

    function onMutation() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            // Verifica o modal
            if (document.getElementById('name_cli_modal')) {
                processModal();
            }
            
            // Verifica a tabela geral de clientes (AJAX necessário)
            if (document.getElementById('tableClientes')) {
                injectAnalisarButton();
            }

            // Verifica tabelas do Dashboard (Dados já estão no DOM)
            if (document.getElementById('tableBonusVencer') || document.getElementById('tableBonusGerado')) {
                processDashboardTables();
            }

        }, 400);
    }

    function init() {
        const body = document.body || document.querySelector('body');
        if (!body) return;

        const observer = new MutationObserver(onMutation);
        observer.observe(body, { childList: true, subtree: true });
        onMutation();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 500);
    }

})();
