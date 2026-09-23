> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Consultar saldo de créditos do condutor

> Consulta o saldo de créditos de um condutor identificado por tipo e valor de identificação.



## OpenAPI

````yaml pages/v2/openapi-entregas.json GET /condutores/creditos/saldo
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
  /condutores/creditos/saldo:
    get:
      summary: Consultar saldo de créditos do condutor
      description: >-
        Consulta o saldo de créditos de um condutor identificado por tipo e
        valor de identificação.
      parameters:
        - name: tipo_identificacao
          in: query
          required: true
          description: >-
            Forma de identificação do condutor: CPF (C), VTR (V), Telefone (T),
            Placa (P) ou ID (I).
          schema:
            type: string
            enum:
              - C
              - V
              - T
              - P
              - I
            example: I
        - name: identificacao
          in: query
          required: true
          description: Valor da identificação conforme o tipo informado.
          schema:
            type: string
            example: '5574'
      responses:
        '200':
          description: Sucesso
          content:
            application/json:
              example:
                success: true
                data:
                  saldo: 587.69
        '400':
          description: Erro de validação
          content:
            application/json:
              examples:
                enum_invalido:
                  summary: Enum inválido
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: >-
                          'tipo_identificacao': Deve estar dentre os valores: C,
                          V, T, P, I
                corpo_incompleto:
                  summary: Parâmetros obrigatórios ausentes
                  value:
                    success: false
                    errors:
                      - code: 2
                        message: '''tipo_identificacao'': Preenchimento obrigatório'
                      - code: 2
                        message: '''identificacao'': Preenchimento obrigatório'
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