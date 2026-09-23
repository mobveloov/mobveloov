> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Sacar créditos do condutor

> Realiza um saque de créditos para um condutor identificado por tipo e valor de identificação.



## OpenAPI

````yaml pages/v2/openapi-entregas.json POST /condutores/creditos/saques
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
  /condutores/creditos/saques:
    post:
      summary: Sacar créditos do condutor
      description: >-
        Realiza um saque de créditos para um condutor identificado por tipo e
        valor de identificação.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - valor
                - condutor
              properties:
                valor:
                  type: number
                  format: float
                  description: Valor numérico do saque.
                observacao:
                  type: string
                  description: Observação opcional da operação.
                condutor:
                  type: object
                  required:
                    - tipo_identificacao
                    - identificacao
                  properties:
                    tipo_identificacao:
                      type: string
                      description: >-
                        Forma de identificação do condutor: CPF (C), VTR (V),
                        Telefone (T), Placa (P) ou ID (I).
                      enum:
                        - C
                        - V
                        - T
                        - P
                        - I
                    identificacao:
                      type: string
            example:
              valor: 50.25
              observacao: Saque solicitado pelo parceiro
              condutor:
                tipo_identificacao: I
                identificacao: '5574'
      responses:
        '200':
          description: Sucesso
          content:
            application/json:
              example:
                success: true
                data:
                  registro_id: '26'
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