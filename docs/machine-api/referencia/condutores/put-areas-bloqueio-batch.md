> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Atualizar áreas de bloqueio em lote

> Atualiza em lote as áreas de bloqueio de um conjunto de condutores.



## OpenAPI

````yaml pages/v2/openapi-corridas.json PUT /condutores/areas-bloqueio/batch
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
  /condutores/areas-bloqueio/batch:
    put:
      summary: Atualizar áreas de bloqueio em lote
      description: Atualiza em lote as áreas de bloqueio de um conjunto de condutores.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - condutores
                - areas_bloqueio
              properties:
                condutores:
                  type: array
                  description: >-
                    Lista de IDs numéricos de condutores. Limite máximo de 1000
                    itens.
                  maxItems: 1000
                  items:
                    type: integer
                areas_bloqueio:
                  type: array
                  description: >-
                    Lista de IDs numéricos das áreas de bloqueio. Limite máximo
                    de 1000 itens.
                  maxItems: 1000
                  items:
                    type: integer
            example:
              condutores:
                - 5574
                - 5575
              areas_bloqueio:
                - 24
                - 124
      responses:
        '200':
          description: Sucesso
          content:
            application/json:
              example:
                success: true
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