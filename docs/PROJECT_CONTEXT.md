# Memória de Contexto & Arquitetura do Projeto

> **Última Atualização:** 04 de Agosto de 2026  
> **Escopo:** Automação de Loja, Monitores de Pedidos, Integradores de Delivery e Ferramentas Operacionais (Ri Happy / PBKIDS)

---

## 🎯 Objetivo Geral
O projeto **Scripts Linx OMS** tem como finalidade maximizar a eficiência operacional em lojas físicas de varejo. Ele integra o **Linx OMS (Order Management System)** com os canais de venda externos (ex: **iFood**, **CRM Bonus**, **WhatsApp**) e otimiza a visualização em tempo real das etapas de picking, separação, conferência, faturamento e despacho de pedidos.

---

## 📂 Visão Detalhada dos Componentes

```
scripts/
├── .agents/
│   └── AGENTS.md                         # Memória de contexto e diretrizes para os agentes IA
├── docs/
│   ├── PROJECT_CONTEXT.md                # Este documento de arquitetura
│   └── oms-mapping/                      # Mapeamento detalhado de 14 telas do Linx OMS
├── ATUPRECO/                             # Webapp Vite para atualização e leitura de relatórios de preços
├── CRM/                                  # Scripts e planilhas de automação CRM Bonus / WhatsApp
├── Dash de ações/                        # Dashboard HTML/JS para planos de ação e metas de loja
├── Defeitos/                             # Ferramenta auditora e relatórios de defeito (defect-auditor)
├── Flash/                                # Interface leve para controle de campanhas flash
│
├── MASTER_MONITOR_OMNI.user.js          # Suíte completa e unificada de Monitoramento OMNI (Tampermonkey)
├── MASTER_SCRIPT.user.js                 # Script consolidado sincronizado para Tampermonkey
├── build_monitor_omni.js                 # Script Node.js que compila a suíte MASTER_MONITOR_OMNI
├── build_master.js                       # Script Node.js de build utilitário
│
├── oms_monitor.js                        # Script principal de monitoramento visual do OMS
├── oms_monitor_apoio_chrome.user.js      # Userscript de apoio ao OMS para Google Chrome
├── oms_monitor_apoio_firefox.user.js     # Userscript de apoio ao OMS para Mozilla Firefox
├── oms-automation.user.js                # Automação de etapas operacionais do OMS
├── whatsapp_linx.user.js                 # Integração WhatsApp + Gerador de Declaração de Entrega
├── ifood_monitor.user.js                 # Monitor do portal iFood integrado ao OMS via Tampermonkey GM Storage
├── crm_bonus_whatsapp.user.js            # Automação de mensagens CRM Bonus via WhatsApp Web
├── rihappy_monitor_separacao.user.js     # Monitor de separação dedicado para Ri Happy
├── oms_monitor_pc_separacao.user.js      # Layout de apoio para PCs de separação
├── oms_monitor_mobile.user.js            # Layout adaptado para dispositivos móveis
└── package.json                          # Configuração Node.js do ambiente
```

---

## 🔄 Fluxos de Integração e Comunicação

### 1. Comunicação Cross-Domain (iFood Portal ↔ OMS Panel)
- **`ifood_monitor.user.js`** roda nas URLs `*.ifood.com.br`.
- Periodicamente inspeciona a contagem de pedidos pendentes de aceite.
- Salva o estado via `GM_setValue('ifoodPendingOrders', count)` e `GM_setValue('ifoodLastUpdate', Date.now())`.
- **`oms_monitor.js`** lê os valores via `GM_getValue('ifoodPendingOrders')`.
- Se houver pedidos pendentes no iFood com mais de 60 segundos sem aceite, o painel do OMS dispara um **Alerta Vermelho Neon Pulsante** com efeito sonoro.

### 2. Compilação de Scripts Master
- Módulos individuais: `oms-automation.user.js` e `whatsapp_linx.user.js`.
- Executar no terminal:
  ```bash
  node build_master.js
  ```
- O script extrai os headers dos userscripts, encapsula as funções e gera o arquivo `MASTER_SCRIPT.user.js` pronto para uso em produção no Tampermonkey.

### 3. Emissão de Declaração de Entrega & WhatsApp
- No `whatsapp_linx.user.js`, os botões de ação são injetados nas telas de faturamento/despacho do OMS.
- Permite abrir a conversa no WhatsApp Web com mensagem pré-formatada.
- Gera modal com a **Declaração de Entrega** contendo nome do comprador, endereço, código do pedido e campo para assinatura digital/física.

---

## 💡 Guia de Manutenção e Desenvolvimento Future

1. **Alteração no OMS**: Como o Linx OMS pode sofrer atualizações de interface, valide se os seletores em `docs/oms-mapping/` correspondem à versão mais recente.
2. **Novas Automações**: Ao criar uma funcionalidade no OMS, adicione no arquivo modular correspondente e execute `node build_master.js` para atualizar a versão consolidada.
3. **Persistência de Regras**: Sempre mantenha as especificações operacionais atualizadas no arquivo `.agents/AGENTS.md`.
