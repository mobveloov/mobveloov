> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Obter saldo da empresa

> As empresas podem possuir carteiras de crédito, com isso, esse endpoint permite verificar o saldo em créditos para a empresa em questão.
O tipo de identificação, é uma forma de identificação da empresa, desta forma de acordo com o tipo de identificação, o valor da identificação da empresa irá respeitar a regra do tipo enviado.
- `F`: CPF da empresa
- `J`: CNPJ da empresa
- `T`: Telefone do condutor
- `C`: Número do contrato
- `I`: Identificador da empresa



## OpenAPI

````yaml pages/v2/openapi-entregas.json GET /entregas/empresas/creditos/saldo
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
  /entregas/empresas/creditos/saldo:
    get:
      summary: Obter saldo da empresa
      description: >-
        As empresas podem possuir carteiras de crédito, com isso, esse endpoint
        permite verificar o saldo em créditos para a empresa em questão.

        O tipo de identificação, é uma forma de identificação da empresa, desta
        forma de acordo com o tipo de identificação, o valor da identificação da
        empresa irá respeitar a regra do tipo enviado.

        - `F`: CPF da empresa

        - `J`: CNPJ da empresa

        - `T`: Telefone do condutor

        - `C`: Número do contrato

        - `I`: Identificador da empresa
      parameters:
        - name: tipo_identificacao
          in: query
          required: true
          description: Forma de identificação da empresa
          schema:
            type: string
            enum:
              - F
              - J
              - T
              - C
              - I
        - name: identificacao
          in: query
          required: true
          description: Valor da identificação da empresa de acordo com o tipo enviado
          schema:
            type: string
      responses:
        '200':
          description: Sucesso
          content:
            application/json:
              example:
                success: true
                data:
                  saldo: 508.63
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