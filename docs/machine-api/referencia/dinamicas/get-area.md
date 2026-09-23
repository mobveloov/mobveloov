> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Obter dinâmicas por área

> Lista as dinâmicas associadas às áreas.



## OpenAPI

````yaml pages/v2/openapi-corridas.json GET /dinamicas/area
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
  /dinamicas/area:
    get:
      summary: Obter dinâmicas por área
      description: Lista as dinâmicas associadas às áreas.
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
                  - id: 10
                    nome: Área Central
                    fator: 1.5
                    tipo_calculo: Fator multiplicador
                    ativo: true
                    tipo: No embarque
                  - id: 12
                    nome: Zona Norte
                    fator: 1.1
                    tipo_calculo: Fator multiplicador
                    ativo: false
                    tipo: No destino
                  - id: '14'
                    nome: Zona Sul
                    valor_adicional: 2.5
                    tipo_calculo: Valor adicional
                    ativo: true
                    tipo: No embarque
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