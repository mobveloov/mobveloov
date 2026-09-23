> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Enviar notificação push

> Envia notificação push para uma lista de passageiros.



## OpenAPI

````yaml pages/v2/openapi-corridas.json POST /notificacoes/push
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
  /notificacoes/push:
    post:
      summary: Enviar notificação push
      description: Envia notificação push para uma lista de passageiros.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - passageiros
                - mensagem
              properties:
                passageiros:
                  type: array
                  description: >-
                    Lista de passageiros que receberão a notificação. Deve
                    conter ao menos um item e todos os itens devem ser
                    numéricos. Limite máximo de 1000 itens.
                  minItems: 1
                  maxItems: 1000
                  items:
                    type: integer
                titulo:
                  type: string
                  description: Título da notificação.
                  maxLength: 40
                mensagem:
                  type: string
                  description: Mensagem da notificação.
                  maxLength: 255
            example:
              passageiros:
                - 123
                - 456
                - 789
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
                passageiros_vazio:
                  summary: Lista de passageiros vazia
                  value:
                    success: false
                    errors:
                      - field: passageiros
                        message: Informe ao menos um passageiro.
                passageiro_invalido:
                  summary: Item da lista não é numérico
                  value:
                    success: false
                    errors:
                      - field: passageiros.1
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