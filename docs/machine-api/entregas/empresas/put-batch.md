> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Atualizar empresas (batch)

> Esse endpoint permite atualizar as empresas em lote.



## OpenAPI

````yaml pages/v2/openapi-entregas.json PUT /empresas/batch
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
  /empresas/batch:
    put:
      summary: Atualizar empresas (batch)
      description: Esse endpoint permite atualizar as empresas em lote.
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                status_empresa:
                  type: string
                  enum:
                    - A
                    - S
                    - G
                  description: A - Ativo, S - Suspenso, G - Aguardando Ativação
                empresas:
                  type: array
                  description: >-
                    IDs das empresas a serem atualizadas. Limite máximo de 1000
                    itens.
                  maxItems: 1000
                  items:
                    type: integer
                categorias:
                  type: array
                  description: Lista de categorias. Limite máximo de 1000 itens.
                  maxItems: 1000
                  items:
                    type: integer
                tipos_pagamento:
                  type: array
                  items:
                    type: string
                    enum:
                      - B
                      - C
                      - D
                      - F
                      - H
                      - P
                      - R
                      - X
                  description: >-
                    Array vazio indica todos os tipos. B: Débito (máquina), C:
                    Crédito (máquina), D: Dinheiro, F: Faturado, H: Whatsapp, P:
                    Picpay, R: Carteira de Créditos, X: Pix
                area_atuacao_empresa_id:
                  type: integer
      responses:
        '200':
          description: Sucesso
          content:
            application/json:
              example:
                success: true
                data: []
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