> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Listar tipos de documento

> Responsável por retornar todos os documentos criados pela central.



## OpenAPI

````yaml pages/v2/openapi-corridas.json GET /configuracoes/tipos-documento
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
  /configuracoes/tipos-documento:
    get:
      summary: Listar tipos de documento
      description: Responsável por retornar todos os documentos criados pela central.
      responses:
        '200':
          description: Sucesso
          content:
            application/json:
              example:
                success: true
                data:
                  documentos:
                    - nome: CNH (Carteira Nacional de Habilitação)
                      tipo: ZG9jXzQ0Mg
                      ativo: true
                  quantidade_documentos: 1
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