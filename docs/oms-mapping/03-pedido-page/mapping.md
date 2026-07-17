# Mapeamento - OMS (Página de Detalhes do Pedido - Pendente)

## 1. Estrutura da Página e Controladores
- **Controlador Base:** `fulfillmentViewController`
- **Contêiner Principal:** `.container.order-content`
- A página exibe os dados detalhados de uma entrega e permite realizar o manuseio (iniciar separação, informar quebra, etc.).

## 2. Seletores e Elementos Chave para o Monitor

| Elemento | Seletor CSS / Atributo | Ação / Utilidade para Automação |
|---|---|---|
| **Número do Pedido** | `h2.ng-binding` | Extrair a string do pedido atual aberto (ex: `v35944613rihp-01`). |
| **Status Atual** | `span.order-status` | Lê o texto para saber se é `Pendente`, `Realocado`, etc. |
| **Botão "Separar"** | `button[ng-click="actionManager.pickingFulfillment(fulfillment)"]` | **Extremamente importante para automação.** Se quisermos forçar a ida de um pedido individual para Separação via script ao abrir a página, clicamos neste botão. |
| **Lista de Produtos** | `table.order-products-table-products tbody tr` | Para iterar e visualizar os produtos contidos (quantidades `0/3`, sku, nome). |

## 3. Elementos Escondidos (Gatilhos Futuros)
Logo abaixo da tabela, notamos uma `.row.check-item` que no status *Pendente* costuma ficar escondida (`ng-hide`), mas que revela os próximos passos do fluxo da ferramenta:

1. **Input de Conferência:**
   `<input ng-model="productKey" linx-type="barcode">` e `<button ng-submit="checkFulfillmentItem()">Conferir</button>`
   *Usado durante o Faturamento/Conferência para "bipar" o código de barras.*
2. **Fechar Volume:**
   `<button ng-click="increaseVolumes()">Fechar volume</button>`
   *Usado quando os produtos terminam de ser bipados.*
3. **Imprimir Etiquetas:**
   `<button ng-click="showVolumePrint(fulfillment)">Etiquetas de volume</button>`

## 4. Estratégia de Injeção
- **Automação Ativa (Separação Express):** Um script poderia verificar o status (`.waiting`). Se configurado para aprovar automaticamente, pode buscar o seletor `button[ng-click^="actionManager.pickingFulfillment"]` e engatilhar o `.click()` nativo, empurrando o pedido direto para a tela de bipagem sem intervenção manual.
- **Leitura do Formulário:** Podemos extrair dados do cliente, endereço e CPF da área `div.order-details-container` caso seja necessário enviar via API para a "Lista de despacho" automática (conforme seu requisito de projeto).
