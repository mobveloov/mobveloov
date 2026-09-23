> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Consultar cupons

> Consulta os cupons de desconto da bandeira autenticada.

Informe `id` ou `codigo` para buscar um cupom específico — os dois parâmetros são mutuamente exclusivos. Quando nenhum dos dois é informado, o endpoint lista todos os cupons da bandeira. A busca por `codigo` e a listagem geral retornam até 10 cupons por página, navegados pelo parâmetro `pagina`; a busca por `id` retorna no máximo um cupom e ignora a paginação.

O campo `status` do retorno é derivado da vigência do cupom: `aguardo` antes de `data_hora_inicio`, `ativo` durante a vigência e `inativo` a partir de `data_hora_fim`. `quantidade_usuarios_utilizaram` conta passageiros distintos e `vezes_utilizado` conta todos os usos do cupom.

Requer Api-Key (bandeira) + autenticação HTTP Basic de um gestor ativo da bandeira.



## OpenAPI

````yaml pages/v2/openapi-corridas.json GET /cupons
openapi: 3.1.0
info:
  title: API de Integração
  description: API de Integração v2 - Corridas
  license:
    name: MIT
  version: 2.0.0
servers:
  - url: https://api-vendas.taximachine.com.br/api/v2/integracao
  - url: https://api.taximachine.com.br/api/v2/integracao
security:
  - basicAuth: []
    ApiKeyAuth: []
paths:
  /cupons:
    get:
      summary: Consultar cupons
      description: >-
        Consulta os cupons de desconto da bandeira autenticada.


        Informe `id` ou `codigo` para buscar um cupom específico — os dois
        parâmetros são mutuamente exclusivos. Quando nenhum dos dois é
        informado, o endpoint lista todos os cupons da bandeira. A busca por
        `codigo` e a listagem geral retornam até 10 cupons por página, navegados
        pelo parâmetro `pagina`; a busca por `id` retorna no máximo um cupom e
        ignora a paginação.


        O campo `status` do retorno é derivado da vigência do cupom: `aguardo`
        antes de `data_hora_inicio`, `ativo` durante a vigência e `inativo` a
        partir de `data_hora_fim`. `quantidade_usuarios_utilizaram` conta
        passageiros distintos e `vezes_utilizado` conta todos os usos do cupom.


        Requer Api-Key (bandeira) + autenticação HTTP Basic de um gestor ativo
        da bandeira.
      parameters:
        - name: id
          in: query
          required: false
          description: Identificador interno do cupom. Não pode ser combinado com `codigo`.
          schema:
            type: integer
            example: 1042
        - name: codigo
          in: query
          required: false
          description: >-
            Código do cupom, com até 21 caracteres e sem emojis. Não pode ser
            combinado com `id`. Pode retornar mais de um cupom, porque o mesmo
            código pode ter sido cadastrado em cupons diferentes.
          schema:
            type: string
            example: DESCONTO10
        - name: status
          in: query
          required: false
          description: Filtra os cupons pela vigência.
          schema:
            type: string
            enum:
              - ativo
              - inativo
              - aguardo
            example: ativo
        - name: pagina
          in: query
          required: false
          description: Página da listagem, com 10 cupons por página. Padrão 1.
          schema:
            type: integer
            minimum: 1
            default: 1
            example: 1
      responses:
        '200':
          description: Sucesso
          content:
            application/json:
              schema:
                type: object
              example:
                success: true
                data:
                  - id: 1042
                    codigo: DESCONTO10
                    status: ativo
                    data_hora_inicio: '2026-09-01 00:00:00'
                    data_hora_fim: '2026-10-01 23:59:59'
                    tipo_desconto: percentual
                    desconto: '10.00'
                    tipo_limite_cupom: ate_n_vezes_por_passageiro
                    limite_uso_individual: 3
                    valor_maximo: '20.00'
                    valor_maximo_corrida: '50.00'
                    gerador_cupom_desconto_id: 17
                    quantidade_usuarios_utilizaram: 12
                    vezes_utilizado: 27
                  - id: 1043
                    codigo: BEMVINDO
                    status: aguardo
                    data_hora_inicio: '2026-10-05 00:00:00'
                    data_hora_fim: '2026-11-05 23:59:59'
                    tipo_desconto: valor_fixo
                    desconto: '5.00'
                    tipo_limite_cupom: apenas_primeira_corrida
                    limite_uso_individual: null
                    valor_maximo: null
                    valor_maximo_corrida: null
                    gerador_cupom_desconto_id: 18
                    quantidade_usuarios_utilizaram: 0
                    vezes_utilizado: 0
        '400':
          description: Parâmetros inválidos
          content:
            application/json:
              schema:
                type: object
              example:
                success: false
                errors:
                  - code: 0
                    message: '''id'': Informe exatamente um dos parâmetros: id ou codigo.'
components:
  securitySchemes:
    basicAuth:
      type: http
      scheme: basic
    ApiKeyAuth:
      type: apiKey
      in: header
      name: api-key
      description: Obrigatório. Sua chave API.

````