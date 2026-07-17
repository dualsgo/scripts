# Mapeamento - OMS (Página Inicial / Fluxo de Entregas)

## 1. Tecnologia e Estrutura Base
- **Framework:** AngularJS (`ng-controller`, `ng-init`, `ui-view`).
- **Roteamento:** A página utiliza o `ui-view` para injetar componentes da interface (header, main, footer, modais de busca e alertas).
- **Controladores principais observados:**
  - `mainController`: Controle geral, navbar, loja logada.
  - `indexController`: Controle principal do painel.
  - `indexBoxStatusController`: Controlador usado dentro de cada bloco do fluxo para buscar as quantidades de forma independente.

## 2. Fluxo Principal (Painéis e Cards)
Cada etapa do fluxo no monitor original é uma `.step-box` que dispara um redirecionamento ao clicar (`ng-click`) e exibe a quantidade de itens consultando uma `div` atrelada ao `indexBoxStatusController`.

Para o nosso **Monitor de Reforço**, poderemos focar nos seguintes seletores para injetar destaques (cores, ícones pulsantes) caso as quantidades estejam altas, chamando a atenção do operador:

| Etapa | Classe / Seletor CSS | Status Interno (ng-init) | Rota (ng-click) |
|---|---|---|---|
| **Pendentes** | `.pending.step-box` | `waiting` | `/fulfillments` |
| **Separação** | `.picking.step-box` | `pickingOnly` | `main.goToSelectionList('pickingList')` |
| **Faturamento** | `.billing.step-box` | `billingChecking` | `main.goToSelectionList('billingCheckingList')` |
| **Preparar Entrega** | `.preparing.step-box` | `billed` | `main.goToSelectionList('billedList')` |
| **Lista de despacho** | `.shipping.step-box` | `sendReady` | `/fulfillments/shipping` |
| **Recebimento** | `.packing-list.step-box` (coluna dir) | `waitingTransfer` | `/fulfillments/transfer` |
| **Lista de romaneio** | `.packing-list.step-box` (coluna esq) | `packingList` | `/packing-lists` |
| **Lista de retirada** | `.pickup.step-box` | `pickupReady` | `/fulfillments/pickup` |
| **Despachadas** | `.delivered.step-box` | `shipped` | `/fulfillments/shipped` |
| **Finalizadas** | `.delivered.step-box` | N/A | `/fulfillments/delivered` |
| **Tratamento** | `.receive.step-box` (em misc) | `treatmentList` | `/fulfillments/treatment` |

## 3. Estratégia de Injeção para o Monitor
Como a ideia é **não alterar muito a página original** para evitar confusões:
1. **Leitura dos Dados:** Podemos ler o valor dentro da `div` com `ng-if="showMessage()"` que renderiza o número de itens em cada etapa.
2. **Estilização Dinâmica:** Se o número for maior que 0 (ou outro limite a definir, como pedidos muito atrasados), adicionamos classes CSS ao `.step-box` correspondente (ex: `box-shadow` vermelha, animação de *pulse*, alerta sonoro, etc).
3. **Automação de Despacho:** A "Lista de despacho" (`.shipping.step-box`) será um alvo chave para interceptar ou automatizar cliques, já que há menção a "automatizar a criação da lista de despacho".

---
*Aguardando próximas partes do DOM para aprofundar o mapeamento de modais ou telas internas.*
