> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Remover bandeiras de webhook

> Remove vinculo de um grupo de bandeiras do webhook. Regras importantes:
- Recebe um array bandeiras com cada bandeira_id a ser removido;
- Envio de eventos do webhook é alterado em até 5 minutos após a deleção.



## OpenAPI

````yaml pages/v2/openapi-corridas.json DELETE /engajamento/{id}/permissoes
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
  /engajamento/{id}/permissoes:
    delete:
      summary: Remover bandeiras de webhook
      description: >-
        Remove vinculo de um grupo de bandeiras do webhook. Regras importantes:

        - Recebe um array bandeiras com cada bandeira_id a ser removido;

        - Envio de eventos do webhook é alterado em até 5 minutos após a
        deleção.
      parameters:
        - name: id
          in: path
          required: true
          description: Id do webhook
          schema:
            type: integer
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                bandeiras:
                  type: array
                  description: >-
                    Array de IDs das bandeiras a serem removidas. Limite máximo
                    de 1000 itens.
                  maxItems: 1000
                  items:
                    type: integer
            example:
              bandeiras:
                - 669
                - 148
                - 941
      responses:
        '200':
          description: Sucesso
          content:
            application/json:
              example:
                success: true
                message: Permissões de engajamento excluídas com sucesso.
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