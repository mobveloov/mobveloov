> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Listar consumidores

> Lista os consumidores da empresa do gestor autenticado, de forma paginada. Requer Api-Key (bandeira) + autenticação HTTP Basic do gestor da empresa; uso obrigatório de HTTPS.



## OpenAPI

````yaml pages/v2/openapi-entregas.json GET /consumidores
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
  /consumidores:
    get:
      summary: Listar consumidores
      description: >-
        Lista os consumidores da empresa do gestor autenticado, de forma
        paginada. Requer Api-Key (bandeira) + autenticação HTTP Basic do gestor
        da empresa; uso obrigatório de HTTPS.
      parameters:
        - name: limite
          in: query
          description: Quantidade de consumidores retornados. Padrão 20, máximo 100.
          schema:
            type: integer
            default: 20
            maximum: 100
            minimum: 1
        - name: pagina
          in: query
          description: Página da listagem. Padrão 1.
          schema:
            type: integer
            default: 1
            minimum: 1
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
                  - id: 1
                    nome: Maria
                    telefone: '+5544999999999'
                __links:
                  - rel: self
                    href: api/v2/integracao/consumidores
                    metodo: get
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