> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Consultar posição do condutor na corrida

> Retorna a posição do condutor em uma corrida.



## OpenAPI

````yaml pages/v2/openapi-corridas.json GET /corridas/{id}/condutor/posicao
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
  /corridas/{id}/condutor/posicao:
    get:
      summary: Consultar posição do condutor na corrida
      description: Retorna a posição do condutor em uma corrida.
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
                  lat_condutor: '-23.256762417'
                  lng_condutor: '-45.896997749'
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