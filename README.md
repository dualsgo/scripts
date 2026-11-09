# ⚡ Scripts Linx OMS & Automação Operacional de Loja (`scripts`)

Conjunto integrado de **Userscripts (Tampermonkey/Greasemonkey)**, **Compiladores Node.js** e **Aplicações Web Utilitárias** projetados para automatizar e monitorar em tempo real as operações omnichannel de loja (**Ri Happy / PBKIDS**) integradas ao **Linx OMS**, **iFood**, **Rappi**, **CRM Bonus** e **WhatsApp Web**.

---

## 🚀 Principais Módulos

### 1. 🖥️ Suíte Master Monitor OMNI (`MASTER_MONITOR_OMNI.user.js` & `MASTER_SCRIPT.user.js`)
- **Painel TV Fullscreen Hands-Free (`oms_monitor.js`)**:
  - Interface de alto contraste com alertas sonoros e visuais para pedidos pendentes de separação, faturamento e despacho no Linx OMS.
- **Integração Cross-Domain com Delivery (`ifood_monitor.user.js` & `rappi_monitor.user.js`)**:
  - Monitora os portais do **iFood** e **Rappi** em segundo plano via `GM_setValue` / `GM_getValue` e dispara alertas imediatos no painel OMS quando há pedidos aguardando aceite.
- **Automação Operacional & WhatsApp (`oms-automation.user.js` & `whatsapp_linx.user.js`)**:
  - Atalhos de bipagem e separação, controle de SLA de 7 dias para Retirada em Loja, abertura direta de conversa no WhatsApp Web com o cliente e emissão automática de **Declaração de Entrega** para assinatura.
- **Versões Dedicadas por Dispositivo**:
  - Suporte otimizado para Chrome (`oms_monitor_apoio_chrome.user.js`), Firefox (`oms_monitor_apoio_firefox.user.js`), Mobile (`oms_monitor_mobile.user.js`) e Terminal de Separação (`rihappy_monitor_separacao.user.js`).

### 2. 💬 Automação CRM Bonus (`crm_bonus_whatsapp.user.js` & `CRM/`)
- Ferramentas de produtividade (`crm_bonus_super_tools.user.js`) para consulta e envio rápido de bônus/cashback aos clientes via WhatsApp.

### 3. 🛠️ Mini-Apps Operacionais
- **`Defeitos/defect-auditor/`**: Aplicação web em **React + Vite** para auditoria, classificação e controle de mercadorias com defeito em loja.
- **`Dash de ações/`**: Dashboard em HTML/CSS/JS para acompanhamento visual de metas e planos de ação semanais.
- **`Flash/`**: Painel rápido em HTML/CSS para acompanhamento de campanhas flash.
- **`docs/oms-mapping/`**: Mapeamento técnico completo do DOM das 14 telas operacionais do sistema Linx OMS.

---

## 📂 Estrutura do Repositório

```text
scripts/
├── .agents/
│   └── AGENTS.md                         # Diretrizes técnicas e regras de negócio
├── docs/
│   ├── PROJECT_CONTEXT.md                # Arquitetura detalhada dos fluxos de integração
│   └── oms-mapping/                      # Mapeamento DOM das 14 telas do Linx OMS
├── CRM/                                  # Userscripts de automação CRM Bonus
├── Dash de ações/                        # Dashboard web de planos de ação
├── Defeitos/defect-auditor/              # App React + Vite para auditoria de defeitos
├── Flash/                                # Interface de acompanhamento Flash
├── build_monitor_omni.js                 # Compilador Node.js da suíte MASTER_MONITOR_OMNI
├── build_master.js                       # Compilador Node.js do MASTER_SCRIPT
├── MASTER_MONITOR_OMNI.user.js           # Userscript consolidado OMNI
├── MASTER_SCRIPT.user.js                 # Userscript consolidado Automação + WhatsApp
└── package.json
```

---

## 💻 Como Compilar e Utilizar

### Compilar os Userscripts Consolidados
```bash
# Instalar dependências
npm install

# Gerar MASTER_SCRIPT.user.js
node build_master.js

# Gerar MASTER_MONITOR_OMNI.user.js
node build_monitor_omni.js
```

### Executar o Auditor de Defeitos (`Defeitos/defect-auditor`)
```bash
cd Defeitos/defect-auditor
npm install
npm run dev
```

---

## 🔒 Privacidade e Segurança (LGPD)
Planilhas brutas de treinamento e relatórios operacionais contendo dados de clientes ou loja (`.xls`, `.xlsx`, `.json_label` e `.txt` de testes) foram removidos do repositório.
