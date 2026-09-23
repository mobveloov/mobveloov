> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Listar categorias

> Retorna as categorias ativas da central. Caso seja informada uma localização pertencente a uma filial, serão retornadas as categorias ativas da filial. Caso seja informada a latitude e longitude, não é necessário passar as demais informações.



## OpenAPI

````yaml pages/v2/openapi-entregas.json GET /configuracoes/categorias
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
  /configuracoes/categorias:
    get:
      summary: Listar categorias
      description: >-
        Retorna as categorias ativas da central. Caso seja informada uma
        localização pertencente a uma filial, serão retornadas as categorias
        ativas da filial. Caso seja informada a latitude e longitude, não é
        necessário passar as demais informações.
      parameters:
        - name: lat
          in: query
          description: Obrigatório se lng for informado
          schema:
            type: number
        - name: lng
          in: query
          description: Obrigatório se lat for informado
          schema:
            type: number
        - name: endereco
          in: query
          description: Obrigatório se lat/lng não forem informados
          schema:
            type: string
        - name: bairro
          in: query
          description: Obrigatório se lat/lng não forem informados
          schema:
            type: string
        - name: cidade
          in: query
          description: Obrigatório se lat/lng não forem informados
          schema:
            type: string
        - name: estado
          in: query
          description: Não obrigatório
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
                  - id: '71'
                    nome: Comum
                  - id: '162'
                    nome: 15 Reais
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