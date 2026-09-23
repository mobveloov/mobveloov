> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Listar áreas geográficas

> Responsável por listar as áreas de bloqueio disponíveis para central.



## OpenAPI

````yaml pages/v2/openapi-corridas.json GET /configuracoes/areas-geograficas
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
  /configuracoes/areas-geograficas:
    get:
      summary: Listar áreas geográficas
      description: Responsável por listar as áreas de bloqueio disponíveis para central.
      parameters:
        - name: limite
          in: query
          description: Default 20, max 100
          schema:
            type: integer
            default: 20
            maximum: 100
        - name: pagina
          in: query
          description: Default 1
          schema:
            type: integer
            default: 1
      responses:
        '200':
          description: Sucesso
          content:
            application/json:
              example:
                success: true
                data:
                  - id: '24'
                    nome: Área 33
                  - id: '124'
                    nome: Campo Santana
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