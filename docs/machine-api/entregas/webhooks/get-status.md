> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Consultar status do webhook

> Consulta o status de entrega de um webhook, indicando se ele está ativo, bloqueado temporariamente (circuit breaker, após falhas consecutivas de entrega) ou bloqueado definitivamente (após esgotar as tentativas de reenvio, os eventos deixam de ser entregues). Datas no formato ISO-8601 (UTC).



## OpenAPI

````yaml pages/v2/openapi-entregas.json GET /webhooks/{id}/status
openapi: 3.1.0
info:
  title: API de Integração
  description: API de Integração v2 - Entregas
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
  /webhooks/{id}/status:
    get:
      summary: Consultar status do webhook
      description: >-
        Consulta o status de entrega de um webhook, indicando se ele está ativo,
        bloqueado temporariamente (circuit breaker, após falhas consecutivas de
        entrega) ou bloqueado definitivamente (após esgotar as tentativas de
        reenvio, os eventos deixam de ser entregues). Datas no formato ISO-8601
        (UTC).
      parameters:
        - name: id
          in: path
          required: true
          description: ID do webhook a ser consultado
          schema:
            type: integer
      responses:
        '200':
          description: Sucesso
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type: integer
                    description: ID do webhook
                  url:
                    type: string
                    description: URL cadastrada que recebe os eventos
                  situacao:
                    type: string
                    enum:
                      - ativo
                      - bloqueado_temporariamente
                      - bloqueado_definitivamente
                    description: >-
                      Situação atual do webhook. `ativo`: entregas funcionando
                      normalmente. `bloqueado_temporariamente`: entregas
                      suspensas após falhas consecutivas; uma nova tentativa
                      ocorre em `bloqueio_temporario.proxima_tentativa`.
                      `bloqueado_definitivamente`: entregas interrompidas após
                      esgotar as tentativas de reenvio.
                  bloqueio_temporario:
                    type: object
                    description: Estado do bloqueio temporário (circuit breaker)
                    properties:
                      ativo:
                        type: boolean
                        description: Indica se o bloqueio temporário está ativo
                      falhas_consecutivas:
                        type: integer
                        description: >-
                          Quantidade de falhas consecutivas de entrega
                          registradas
                      desde:
                        type: string
                        nullable: true
                        description: >-
                          Data/hora (ISO-8601, UTC) em que o bloqueio temporário
                          foi ativado. `null` quando não há bloqueio.
                      proxima_tentativa:
                        type: string
                        nullable: true
                        description: >-
                          Data/hora (ISO-8601, UTC) da próxima tentativa de
                          entrega. `null` quando não há bloqueio.
                  bloqueio_definitivo:
                    type: object
                    description: Estado do bloqueio definitivo
                    properties:
                      ativo:
                        type: boolean
                        description: Indica se o webhook está bloqueado definitivamente
                      desde:
                        type: string
                        nullable: true
                        description: >-
                          Data/hora (ISO-8601, UTC) em que o bloqueio definitivo
                          foi aplicado. `null` quando não há bloqueio.
              example:
                success: true
                data:
                  id: 5
                  url: https://minha-integracao.com/webhook
                  situacao: bloqueado_temporariamente
                  bloqueio_temporario:
                    ativo: true
                    falhas_consecutivas: 4
                    desde: '2026-07-14T12:00:00Z'
                    proxima_tentativa: '2026-07-14T12:30:00Z'
                  bloqueio_definitivo:
                    ativo: false
                    desde: null
                __links:
                  - rel: self
                    href: api/v2/integracao/webhooks/<id:\d+>/status
                    metodo: get
                  - rel: listar-webhook
                    href: api/v2/integracao/webhooks
                    metodo: get
                  - rel: criar-webhook
                    href: api/v2/integracao/webhooks
                    metodo: post
                  - rel: atualizar-webhook
                    href: api/v2/integracao/webhooks/<id:\d+>
                    metodo: put
                  - rel: excluir-webhook
                    href: api/v2/integracao/webhooks/<id:\d+>
                    metodo: delete
        '404':
          description: Webhook não encontrado
          content:
            application/json:
              schema:
                type: object
              example:
                success: false
                errors:
                  - code: 0
                    message: Webhook não encontrado
        '503':
          description: Status temporariamente indisponível
          content:
            application/json:
              schema:
                type: object
              example:
                success: false
                errors:
                  - code: 0
                    message: >-
                      Não foi possível consultar o status do webhook neste
                      momento. Tente novamente mais tarde
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