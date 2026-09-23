> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Listar áreas de atuação

> Esse endpoint retorna as áreas de atuação da bandeira. Serão retornados os seguintes dados de cada área:
- `id` - Identificador da área
- `nome`- Nome da área
- `padrao` - Indica se a área é a padrão da central



## OpenAPI

````yaml pages/v2/openapi-entregas.json GET /entregas/bandeiras/areas-atuacao
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
  /entregas/bandeiras/areas-atuacao:
    get:
      summary: Listar áreas de atuação
      description: >-
        Esse endpoint retorna as áreas de atuação da bandeira. Serão retornados
        os seguintes dados de cada área:

        - `id` - Identificador da área

        - `nome`- Nome da área

        - `padrao` - Indica se a área é a padrão da central
      responses:
        '200':
          description: Sucesso
          content:
            application/json:
              example:
                success: true
                data:
                  - id: 38
                    nome: Área 1
                    padrao: true
                  - id: 41
                    nome: Área 2
                    padrao: false
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