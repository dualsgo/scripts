# Mapeamento - OMS (Modal de Conferência de Volumes / Preparar Entrega)

## 1. Estrutura e Objetivo
- **Ação:** Ocorre ao clicar em "Preparar" na lista de Faturados (`actionManager.showVolumesCheckingModal`).
- **Objetivo:** Obrigar o operador a "bipar" a caixa (volume) associada àquele pedido antes de imprimir a Nota Fiscal e Etiqueta de Transporte.

## 2. A Lógica de Validação (O Input do Usuário)
- O colaborador deve ler o pedido atual (ex: `...rihp-01`).
- No campo `ng-model="volumeId"`, ele não pode usar `rihp-01`. Ele digita o final correspondente: `0101`.
- Se o pedido terminasse em `02`, ele digitaria `0201`.
- Após inserir e confirmar (`ng-submit="checkVolume()"`), o OMS valida a caixa e gera as impressões.

## 3. O Gargalo dos 25% (O Esquecimento)
O colaborador:
1. Imprime as etiquetas.
2. Cola na caixa física.
3. Acha que a tarefa terminou.
4. **Esquece** de navegar até a tela de "Lista de Despacho" para registrar a entrega para a transportadora.
5. A caixa fica parada na loja esperando a transportadora, mas a transportadora não sabe que a caixa existe, gerando atraso de SLA.

## 4. Oportunidade de Intervenção (Automação Visual)
O usuário solicitou um **Aviso Visual** nesta etapa. 

Como faremos:
- O script vai interceptar este modal.
- Assim que o progresso chegar a 100% (ou a função `checkVolume()` for bem-sucedida para o último item do lote), vamos injetar um **Alerta Gigante em Tela Cheia (Overlay Vermelho/Laranja)** piscando.
- Mensagem: "ATENÇÃO! VOCÊ AINDA NÃO TERMINOU! CLIQUE AQUI PARA GERAR A LISTA DE DESPACHO AGORA!".
- O próprio aviso pode conter um botão que redireciona o navegador diretamente para `/rihappy/fulfillments/shipping` e até já aciona a geração da lista na próxima tela, tornando à prova de erros.

**Aguardando:** O usuário vai enviar a tela final de "Lista de Despacho" a seguir. Assim que recebida, o Plano de Implementação (Artifact) será elaborado.
