# Mapeamento - OMS (Página de Seleção - Múltiplas Etapas)

## 1. Estrutura da Página e Controladores
- **Controlador Base:** `selectionController` (O controller que orquestra as três abas simultâneas).
- A página concentra os três fluxos pós-pendente:
  1. **Separação (`pickingList`)**
  2. **Faturamento (`billingCheckingList`)**
  3. **Preparar Entrega (`billedList`)**

## 2. Seletores e Elementos Chave

### A. Tabela e Prazo (Para Contadores)
| Elemento | Seletor CSS / Atributo | Ação / Utilidade para Automação |
|---|---|---|
| **Data/Prazo (Expira em)** | `td.expiring-fulfillment` ou `td.expired-fulfillment` | Usado para ler a data limite (`07/07/26 22:00`). Ótimo para aplicar o contador que mostra o tempo restante para estourar o prazo (visual). |
| **Data de Compra** | `td` logo após o de expiração | Serve para compor o histórico e mostrar o SLA percorrido. |

### B. Etapas e Botões (Onde a mágica da Lista de Despacho acontecerá)

| Etapa | Checkbox para selecionar (Todos) | Botão de Ação Massiva | Função AngularJS Engatilhada |
|---|---|---|---|
| **Separação** | `input[ng-model="$ctrl.allSelected"]` dentro de `#pickingList` | `#pickingList button.btn-primary` | `printFulfillmentsTag(fulfillmentPickingList)` |
| **Faturamento** | `input[ng-model="$ctrl.allSelected"]` dentro de `#billingCheckingList` | `#billingCheckingList button.btn-primary` | `billingFulfillments(...)` |
| **Preparar Entrega** | `input[ng-model="$ctrl.allSelected"]` dentro de `#billedList` | `#billedList button.btn-primary` | `showVolumesCheckingModal(fulfillmentBilled)` |

## 3. Planejamento da Automação de Despacho (Preparar Entrega)

O gargalo apontado onde **"muitos colaboradores acabam esquecendo e isso é responsável por mais de 25% dos atrasos"** fica na etapa final: **Preparar Entrega**.
Após o pedido ser faturado (confirmado no Faturamento/SEFAZ), ele cai na aba "Preparar Entrega". Se a loja não clicar em "Preparar", ele não vai para a "Lista de Despacho".

**Estratégia de Automação:**
Um script que roda em segundo plano na tela (ou via Monitor) fará:
1. Avaliar se existem itens na aba "Preparar Entrega" verificando se `fulfillmentBilled.length > 0` (via DOM na badge ou `angular.element` escopo).
2. Localizar o botão de "Selecionar Todos" (`#selectedAll` da respectiva grid).
3. Acionar o clique nesse checkbox (`.click()`).
4. Acionar o clique no botão "Preparar" (`button[ng-click="showVolumesCheckingModal(fulfillmentBilled)"]`).
5. (Se o sistema abrir uma modal pedindo confirmação adicional como sugere o nome `showVolumesCheckingModal`, o script precisará clicar no botão de confirmar dentro dessa modal).

Assim, os pedidos faturados saltarão sozinhos para a Lista de Despacho, acabando com o gargalo de esquecimento dos 25%!
