# Mapeamento - OMS (Página de Detalhes do Pedido - Orçamento Gerado)

## 1. Estrutura e Objetivo
- **Controlador Base:** `fulfillmentViewController`.
- **Status Atualizado:** Após o SEFAZ processar (ou após a etapa de Faturamento fluir com sucesso), o pedido altera para `<span class="order-status billing_confirmation">Orçamento Gerado</span>` (ou Faturado).

## 2. Ligação com a Próxima Etapa
Este status serve de "ponte". Quando o pedido atinge este estado, ele entra automaticamente na lista de **Preparar Entrega** (que nós mapeamos no passo `05` dentro da aba de `Seleção`).

**Como funciona no OMS Padrão:**
1. A SEFAZ aprova. O status vira "Orçamento Gerado".
2. O operador tem que ir na aba "Seleção" -> "Preparar Entrega".
3. Ele clica na checkbox do pedido e depois no botão **Preparar**.
4. Nesse momento (após preparar), o OMS vai emitir as etiquetas de volume finais e liberar o pedido para ser atrelado a uma **Lista de Despacho** para a transportadora.

## 3. Onde Entra a Automação Anti-Atraso (Os 25%)
Você mencionou que 25% dos atrasos ocorrem porque a equipe esquece de gerar a "Lista de Despacho". O gatilho de esquecimento começa exatamente aqui. 

Com nosso script:
Quando o status chegar em "Orçamento Gerado" (seja detectando na página do pedido ou na lista da Seleção), o nosso bot não vai esperar o humano lembrar. O bot seleciona o pedido e clica no botão de **Preparar Entrega**, já jogando ele pra gaveta da transportadora pronta pra viagem. Em seguida, a etapa final (a criação do documento de despacho) precisa ser efetuada.

**Próximo Passo:** Precisamos do DOM da página "Envio e Retirada -> Lista de Despacho" (menu superior). É lá que a mágica final vai acontecer e vamos eliminar esses 25% de atrasos pra sempre.
