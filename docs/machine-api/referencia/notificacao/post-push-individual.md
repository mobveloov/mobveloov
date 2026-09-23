> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Enviar notificação push para um passageiro

> Envia notificação push para um único passageiro identificado pelo `passageiro_id`.



## OpenAPI

````yaml pages/v2/openapi-corridas.json POST /notificacoes/push/individual
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
  /notificacoes/push/individual:
    post:
      summary: Enviar notificação push para um passageiro
      description: >-
        Envia notificação push para um único passageiro identificado pelo
        `passageiro_id`.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - passageiro_id
                - mensagem
              properties:
                passageiro_id:
                  type: integer
                  description: >-
                    Identificador do passageiro que receberá a notificação. Deve
                    ser numérico.
                titulo:
                  type: string
                  description: Título da notificação.
                  maxLength: 40
                mensagem:
                  type: string
                  description: Mensagem da notificação.
                  maxLength: 255
            example:
              passageiro_id: 123
              titulo: Aviso de corrida
              mensagem: Seu veículo está a caminho.
      responses:
        '200':
          description: Notificação enviada com sucesso
          content:
            application/json:
              schema:
                type: object
              example:
                success: true
                data:
                  status: OK
                message: Notificação enviada com sucesso.
        '400':
          description: Erro de validação
          content:
            application/json:
              schema:
                type: object
              examples:
                passageiro_invalido:
                  summary: passageiro_id não é numérico
                  value:
                    success: false
                    errors:
                      - field: passageiro_id
                        message: Deve ser numérico.
                mensagem_obrigatoria:
                  summary: Campo mensagem ausente
                  value:
                    success: false
                    errors:
                      - field: mensagem
                        message: Campo obrigatório.
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