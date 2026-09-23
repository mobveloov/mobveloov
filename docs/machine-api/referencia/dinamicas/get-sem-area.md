> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Obter dinâmica sem área

> Obtém a dinâmica sem área.



## OpenAPI

````yaml pages/v2/openapi-corridas.json GET /dinamicas/sem-area
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
  /dinamicas/sem-area:
    get:
      summary: Obter dinâmica sem área
      description: Obtém a dinâmica sem área.
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
                  nome: Dinâmica sem área
                  fator: 1.5
                  tipo_calculo: Fator multiplicador
                  ativo: true
                  tipo: Sem área
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