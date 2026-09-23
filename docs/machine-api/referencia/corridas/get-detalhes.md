> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Consultar detalhes da corrida

> Consulta o payload detalhado de uma corrida, incluindo progresso, motorista, empresa e paradas.



## OpenAPI

````yaml pages/v2/openapi-corridas.json GET /corridas/{id}/detalhes
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
  /corridas/{id}/detalhes:
    get:
      summary: Consultar detalhes da corrida
      description: >-
        Consulta o payload detalhado de uma corrida, incluindo progresso,
        motorista, empresa e paradas.
      parameters:
        - name: id
          in: path
          required: true
          description: Identificador interno da corrida.
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
                  request_id: 1948853
                  external_id: PED-123
                  full_code: ABC123456
                  short_code: '1234'
                  driver:
                    id: 998
                    nome: Condutor Exemplo
                  enterprise:
                    id: 12
                    nome: Empresa Exemplo
                  stops: []
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