# Estratégia de Customização - Relatório de Separação (Etiqueta Térmica)

## 1. O Cenário Atual
O botão de impressão atual aciona a função:
`ng-click="main.printFulfillmentsTag(fulfillment, false)"`

Por padrão, o OMS gera um relatório em formato A4 ou genérico contendo a lista de itens. O objetivo é transformar isso numa etiqueta térmica padrão **Epson (80mm x 50mm)**, a mesma usada no projeto de eventos.

## 2. É possível alterar o DOM de impressão?
**SIM, perfeitamente possível e de forma muito robusta.**

Como o sistema é feito em AngularJS e nós temos acesso ao objeto completo da entrega no frontend (`$scope.fulfillment`), nós **não precisamos** tentar "consertar" o HTML original mal formatado da Linx. Nós podemos criar a nossa própria etiqueta do zero!

## 3. Como a Automação/Monitor fará isso:

### Passo A: Extração dos Dados
No momento que o usuário clicar em imprimir (ou podemos criar um botão "Imprimir Etiqueta Térmica" injetado pelo Monitor), nosso script fará a leitura do escopo:
```javascript
let scope = angular.element(document.querySelector('.order-content')).scope();
let dadosPedido = scope.fulfillment;
```
A partir desse `dadosPedido`, nós temos TUDO:
- Número do pedido (`dadosPedido.getOrderId()`)
- Cliente (`dadosPedido.getCustomer().getName()`)
- Itens (`dadosPedido.getItems()`) -> Para cada item temos o EAN, SKU(SAP), Nome e Quantidade.
- Modalidade de Entrega, Prazo, etc.

### Passo B: Geração do Layout Customizado (DOM Injetado)
Nós criaremos um template HTML/CSS oculto, com as medidas exatas de bobina 80mm (`width: 80mm`). 

Exemplo estrutural da etiqueta:
```html
<div id="etiqueta-termica" style="width: 80mm; font-family: sans-serif; color: #000;">
   <!-- Cabeçalho: Pedido e Cliente -->
   <h2 style="font-size: 16px; font-weight: bold; text-align: center;">PED: v35944745rihp-01</h2>
   <p style="font-size: 12px;">Cliente: Mateus Oliveira</p>
   <p style="font-size: 12px;">Modalidade: Receba em até 2 dias</p>
   <hr/>
   <!-- Lista de Itens -->
   <table style="width: 100%; font-size: 11px;">
      <tr><th>QTD</th><th>EAN / SAP</th><th>DESCRIÇÃO</th></tr>
      <tr>
         <td>3</td>
         <td>196214155961<br/>5149468</td>
         <td>Jogo De Cartas Pokémon...</td>
      </tr>
   </table>
</div>
```

### Passo C: O Comando de Impressão
O nosso Monitor abrirá um `iframe` invisível ou uma nova janela temporária, injetará esse HTML perfeito, e chamará o comando `window.print()`.

Dessa forma, a impressora térmica receberá as instruções perfeitamente formatadas para 80mm, sem margens sobrando, com código de barras, código SAP grande para os separadores lerem fácil e nome do cliente organizado!

## Resumo
Não ficaremos reféns da formatação da Linx. Como os dados vêm limpos no `$scope`, nós renderizaremos nossa própria interface de etiqueta de impressão.
