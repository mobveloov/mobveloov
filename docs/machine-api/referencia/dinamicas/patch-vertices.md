> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Atualizar vértices da área da dinâmica

> Substitui todos os vértices do polígono de uma área de dinâmica, a partir de um objeto GeoJSON do tipo `Polygon` (RFC 7946). Como a área é imutável após criada, a alteração de geometria cria internamente uma NOVA área (copiando os demais atributos da área original) — a resposta traz um `id` de área diferente do informado na URL, que deve ser usado nas próximas requisições.



## OpenAPI

````yaml pages/v2/openapi-corridas.json PATCH /dinamicas/area/{id}/vertices
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
  /dinamicas/area/{id}/vertices:
    patch:
      summary: Atualizar vértices da área da dinâmica
      description: >-
        Substitui todos os vértices do polígono de uma área de dinâmica, a
        partir de um objeto GeoJSON do tipo `Polygon` (RFC 7946). Como a área é
        imutável após criada, a alteração de geometria cria internamente uma
        NOVA área (copiando os demais atributos da área original) — a resposta
        traz um `id` de área diferente do informado na URL, que deve ser usado
        nas próximas requisições.
      parameters:
        - name: id
          in: path
          required: true
          description: Identificador da área cujos vértices serão atualizados.
          schema:
            type: integer
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - type
                - coordinates
              properties:
                type:
                  type: string
                  description: Tipo de geometria GeoJSON. Deve ser `Polygon`.
                  enum:
                    - Polygon
                coordinates:
                  type: array
                  description: >-
                    Array com exatamente um anel de coordenadas
                    (`coordinates[0]`), com ao menos 4 posições (mínimo de 3
                    vértices distintos mais o fechamento do anel, ou seja, a
                    primeira posição igual à última). Cada posição é um par
                    `[lng, lat]`, com `lng` entre -180 e 180 e `lat` entre -90 e
                    90.
                  items:
                    type: array
                    items:
                      type: array
                      items:
                        type: number
                      minItems: 2
                      maxItems: 2
                    minItems: 4
                  minItems: 1
                  maxItems: 1
            example:
              type: Polygon
              coordinates:
                - - - -46.6558
                    - -23.5615
                  - - -46.65
                    - -23.5615
                  - - -46.65
                    - -23.557
                  - - -46.6558
                    - -23.557
                  - - -46.6558
                    - -23.5615
      responses:
        '200':
          description: Vértices atualizados com sucesso
          content:
            application/json:
              schema:
                type: object
              example:
                success: true
                data:
                  id: 27
                  type: Polygon
                  coordinates:
                    - - - -46.6558
                        - -23.5615
                      - - -46.65
                        - -23.5615
                      - - -46.65
                        - -23.557
                      - - -46.6558
                        - -23.557
                      - - -46.6558
                        - -23.5615
        '400':
          description: Erro de validação
          content:
            application/json:
              schema:
                type: object
              examples:
                tipo_invalido:
                  summary: Tipo de geometria inválido
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: O campo 'type' deve ser 'Polygon'
                coordinates_insuficientes:
                  summary: Vértices insuficientes
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: O polígono deve conter ao menos 3 vértices distintos
                posicao_invalida:
                  summary: Coordenada fora do intervalo permitido
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: >-
                          As coordenadas devem ser numéricas, com 'lng' entre
                          -180 e 180 e 'lat' entre -90 e 90
                json_malformado:
                  summary: JSON malformado
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: JSON_INVALIDO
        '404':
          description: Dinâmica não encontrada
          content:
            application/json:
              schema:
                type: object
              example:
                success: false
                errors:
                  - code: 0
                    message: Dinâmica não encontrada.
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