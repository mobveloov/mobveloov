> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Listar centros de custo da empresa

> Lista centros de custo de uma empresa para uso no domínio de corridas.



## OpenAPI

````yaml pages/v2/openapi-corridas.json GET /corridas/empresas/{id}/centros-custo
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
  /corridas/empresas/{id}/centros-custo:
    get:
      summary: Listar centros de custo da empresa
      description: Lista centros de custo de uma empresa para uso no domínio de corridas.
      parameters:
        - name: id
          in: path
          required: true
          description: Identificador da empresa.
          schema:
            type: integer
        - name: pagina
          in: query
          description: Página da listagem.
          schema:
            type: integer
        - name: limite
          in: query
          description: Quantidade de registros por página.
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
                  - id: '1'
                    nome: Administrativo
                    limite_mensal: '10000.00'
                  - id: '25'
                    nome: CEO
                    limite_mensal: '1500000.00'
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