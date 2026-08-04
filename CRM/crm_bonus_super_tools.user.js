// ==UserScript==
// @name         CRM Bônus - Super Tools (WhatsApp + Saldos)
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Adiciona botão de WhatsApp no modal e um botão para revelar todos os saldos da tabela sem precisar abrir um por um.
// @author       Antigravity
// @match        https://www.crmbonus.com/loja/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // ============================================================
    //  CONFIGURAÇÕES DO WHATSAPP
    // ============================================================

    const MSG_BONUS_ATIVO = 
`🎉 *Seu cashback já está disponível!*

Olá, {nome}! Seu benefício de cashback de *{valor}* da compra realizada aqui na Ri Happy Carioca Shop já foi liberado e pode ser utilizado em sua próxima compra.

⚠️ *Importante:*
• O cashback é válido por 30 dias após a compra;
• O benefício deve ser utilizado em produtos não promocionais aqui na Loja da Ri Happy Carioca Shop.

Aproveite seu saldo e venha nos visitar! 💛`;

    const MSG_BONUS_EXPIRANDO = 
`⏰ *Seu cashback está prestes a expirar!*

Olá, {nome}! Identificamos que seu benefício de cashback de *{valor}* da compra realizada aqui na Ri Happy Carioca Shop expira nos próximos dias.

Aproveite seu saldo antes do prazo finalizar e utilize em sua próxima compra.

⚠️ *Importante:*
• O cashback deve ser utilizado em produtos não promocionados aqui na Loja da Ri Happy Carioca Shop;
• Após o vencimento, o benefício será expirado automaticamente.

Esperamos sua visita! ☀️`;

    const DIAS_ALERTA_EXPIR = 7;

    // ============================================================
    //  UTILITÁRIOS GERAIS
    // ============================================================

    function parseDate(str) {
        const p = str.trim().split('/');
        if (p.length === 3) return new Date(+p[2], +p[1] - 1, +p[0]);
        return null;
    }

    function daysUntil(date) {
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
    //  FUNCIONALIDADE 1: BOTÃO DO WHATSAPP NO MODAL
    // ============================================================

    function createWhatsAppButton(phone, msg, type) {
        const a = document.createElement('a');
        a.href = `https://wa.me/${cleanPhone(phone)}?text=${encodeURIComponent(msg)}`;
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

        return a;
    }

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
        const template = type === 'ativo' ? MSG_BONUS_ATIVO : MSG_BONUS_EXPIRANDO;

        const formattedBalance = `R$ ${balance}`;
        let msg = template
            .replace('{nome}', name)
            .replace('{valor}', formattedBalance)
            .replace('{validade}', validDateStr);
            
        msg = msg.replace(/\r\n/g, '\n');

        const btn = createWhatsAppButton(phone, msg, type);

        const modalBody = document.querySelector('.modal-body.text-center');
        if (modalBody) modalBody.appendChild(btn);
    }

    // ============================================================
    //  FUNCIONALIDADE 2: ANALISADOR DE SALDOS NA TABELA
    // ============================================================

    function injectAnalisarButton() {
        if (document.getElementById('btn_analisar_saldos')) return;

        const boxSearch = document.querySelector('.box-search');
        if (!boxSearch) return;

        const container = document.createElement('div');
        container.style.display = 'inline-flex';
        container.style.alignItems = 'center';
        container.style.marginLeft = '15px';
        container.style.verticalAlign = 'top';

        const btn = document.createElement('button');
        btn.id = 'btn_analisar_saldos';
        btn.innerHTML = '🔍 Revelar Saldos da Página';
        Object.assign(btn.style, {
            padding: '10px 16px',
            backgroundColor: '#B9A078', // Cor que combina com o CRM
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            transition: 'opacity 0.2s, background-color 0.2s',
            height: '42px' // Mesma altura aproximada do campo de busca
        });
        
        btn.onmouseover = () => btn.style.opacity = '0.8';
        btn.onmouseout = () => btn.style.opacity = '1';

        container.appendChild(btn);
        boxSearch.insertAdjacentElement('afterend', container);

        btn.addEventListener('click', async () => {
            const rows = document.querySelectorAll('#tableClientes tbody tr');
            if (rows.length === 0 || (rows.length === 1 && rows[0].innerText.includes('Nenhum'))) {
                alert('Nenhum cliente na tabela atual.');
                return;
            }

            btn.innerHTML = '⏳ Analisando...';
            btn.disabled = true;
            btn.style.backgroundColor = '#FF9800'; // Cor de carregamento

            for (const row of rows) {
                const onclick = row.getAttribute('onclick');
                if (!onclick) continue;
                
                // Extrai nome, celular e CPF do onclick="modal_consumidor(...)"
                const match = onclick.match(/modal_consumidor\('([^']+)','([^']+)','([^']+)'\)/);
                if (match) {
                    const name = match[1];
                    const tel = match[2];
                    const cpf = match[3];

                    let badge = row.querySelector('.saldo-badge');
                    if (!badge) {
                        badge = document.createElement('span');
                        badge.className = 'saldo-badge';
                        badge.style.display = 'inline-block';
                        badge.style.marginLeft = '10px';
                        badge.style.padding = '4px 8px';
                        badge.style.borderRadius = '12px';
                        badge.style.fontSize = '12px';
                        badge.style.fontWeight = 'bold';
                        
                        const tdName = row.querySelector('td:first-child');
                        if (tdName) {
                            tdName.style.display = 'flex';
                            tdName.style.alignItems = 'center';
                            tdName.appendChild(badge);
                        }
                    }

                    badge.innerHTML = '⏳';
                    badge.style.backgroundColor = '#eee';
                    badge.style.color = '#333';
                    badge.style.border = 'none';

                    try {
                        const params = new URLSearchParams();
                        params.append('name', name);
                        params.append('tel', tel);
                        params.append('cpf', cpf);
                        
                        // Faz a requisição invisível no fundo imitando o clique no cliente
                        const resp = await fetch('/Pages/modal_consumidor', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                            body: params.toString()
                        });
                        
                        const data = await resp.json();
                        const saldo = parseFloat(data.saldo_bonus || 0);

                        if (saldo > 0) {
                            badge.innerHTML = `💰 R$ ${saldo.toFixed(2).replace('.', ',')} (Até ${data.validade})`;
                            badge.style.backgroundColor = '#d4edda';
                            badge.style.color = '#155724';
                            badge.style.border = '1px solid #c3e6cb';
                            row.style.backgroundColor = '#f4fbf5';
                        } else {
                            badge.innerHTML = `R$ 0,00`;
                            badge.style.backgroundColor = '#f8d7da';
                            badge.style.color = '#721c24';
                            badge.style.border = '1px solid #f5c6cb';
                            row.style.backgroundColor = '';
                        }

                    } catch(e) {
                        console.error(e);
                        badge.innerHTML = `Erro`;
                    }
                    
                    // Pequeno delay (300ms) para não sobrecarregar o servidor do CRM e tomar block
                    await new Promise(r => setTimeout(r, 300));
                }
            }
            
            btn.innerHTML = '✅ Saldos Revelados!';
            btn.style.backgroundColor = '#25D366';
            setTimeout(() => {
                btn.innerHTML = '🔍 Revelar Saldos da Página';
                btn.style.backgroundColor = '#B9A078';
                btn.disabled = false;
            }, 5000);
        });
    }

    // ============================================================
    //  OBSERVER COM DEBOUNCE
    // ============================================================

    let debounceTimer = null;

    function onMutation() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            if (document.getElementById('name_cli_modal')) {
                processModal();
            }
            
            if (document.querySelector('.box-search')) {
                injectAnalisarButton();
            }
        }, 300);
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
