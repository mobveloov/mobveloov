> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Obter vértices da área da dinâmica

> Obtém os vértices da área da dinâmica em formato GeoJSON Polygon.



## OpenAPI

````yaml pages/v2/openapi-corridas.json GET /dinamicas/area/{id}/vertices
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
  /dinamicas/area/{id}/vertices:
    get:
      summary: Obter vértices da área da dinâmica
      description: Obtém os vértices da área da dinâmica em formato GeoJSON Polygon.
      parameters:
        - name: id
          in: path
          required: true
          description: Identificador da área da dinâmica.
          schema:
            type: integer
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
                  type: Polygon
                  coordinates:
                    - - - -46.633309
                        - -23.55052
                      - - -46.634309
                        - -23.55152
                      - - -46.632309
                        - -23.55152
                      - - -46.633309
                        - -23.55052
        '404':
          description: Dinâmica não encontrada
          content:
            application/json:
              schema:
                type: object
              example:
                success: false
                errors:
                  - code: 0
                    message: Dinâmica não encontrada.
        '500':
          description: Erro interno
          content:
            application/json:
              schema:
                type: object
              example:
                success: false
                errors:
                  - code: 0
                    message: >-
                      Ocorreu um erro interno no servidor. Por favor, tente
                      novamente mais tarde.
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