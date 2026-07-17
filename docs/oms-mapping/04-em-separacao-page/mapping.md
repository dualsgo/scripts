# Mapeamento - OMS (Página de Detalhes do Pedido - Em Separação)

## 1. Estrutura da Página e Controladores
- **Controlador Base:** Permanece o `fulfillmentViewController`.
- **Status Atualizado:** A classe mudou para `<span class="order-status picking">Em Separação</span>`. O layout é o mesmo do status anterior (Pendente), mas os botões de ação na tela mudaram através do sistema de binding e controllers do AngularJS.

## 2. Seletores e Elementos Chave Ativados

| Elemento | Seletor CSS / Atributo | Ação / Utilidade para Automação |
|---|---|---|
| **Input de Código de Barras** | `input[ng-model="productKey"]` | Campo fundamental. Para automatizar o despacho, precisamos preencher isso com o EAN ou SKU de cada item e submeter o formulário. |
| **Botão Conferir** | `form[ng-submit="checkFulfillmentItem()"] button[type="submit"]` | Executa a conferência do item. Se feito via script, o `ng-submit` ou botão precisam ser acionados após injetar o EAN. |
| **Botão Fechar Volume** | `button[ng-click="increaseVolumes()"]` | Após conferir todas as unidades de todos os itens (a quantidade passar de `0/3` para `3/3` e a classe `.product-checked` ser ativada na linha `tr`), este botão encerra o processo de embalagem. |
| **Quebra de Estoque** | `#rupture-button` (com `ng-click="showRupture(true)"`) | Abre a view de `report-rupture` caso não haja estoque físico real. |

## 3. Extraindo Dados dos Produtos para Automação
Se quisermos forçar a separação completa automaticamente (ignorando o ato físico de bipar produto por produto com um leitor de código de barras), o fluxo do script deve ser:
1. Ler os dados da tabela (`table.order-products-table-products tbody tr`).
2. Extrair o código de barras (EAN), que está na **6ª coluna** (ex: `196214155961`).
3. Extrair a quantidade necessária, que está na **7ª coluna** (`td.text-center`). O formato geralmente é `<bipados>/<total>` (ex: `0/3`). Isso indica que precisamos injetar `196214155961` no `input` exatas 3 vezes.
4. Para cada injeção, usar algo como:
   ```javascript
   // Exemplo teórico via escopo do Angular:
   let scope = angular.element(document.querySelector('.order-content')).scope();
   scope.productKey = "196214155961";
   scope.checkFulfillmentItem();
   ```
5. Após o loop processar todas as quantidades de todos os itens, acionar:
   ```javascript
   scope.increaseVolumes();
   ```

## 4. O Caminho para a Automação de Despacho
Ao finalizar o volume (com a rotina do `increaseVolumes()`), o pedido geralmente muda para "Faturado/Preparar Entrega" ou direto para a possibilidade de ir para a "Lista de Despacho". Com esse mapeamento da Separação, descobrimos a engrenagem exata para passar um pedido de Pendente até Despachado sem tocar no teclado.
