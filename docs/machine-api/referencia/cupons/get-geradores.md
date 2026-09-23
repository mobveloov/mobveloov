> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Listar geradores de cupom

> Retorna a lista de geradores de cupom disponíveis para a bandeira autenticada. Os geradores são necessários para criar novos cupons via `POST /cupons`.



## OpenAPI

````yaml pages/v2/openapi-corridas.json GET /cupons/geradores
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
  /cupons/geradores:
    get:
      summary: Listar geradores de cupom
      description: >-
        Retorna a lista de geradores de cupom disponíveis para a bandeira
        autenticada. Os geradores são necessários para criar novos cupons via
        `POST /cupons`.
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
                    nome: Gerador sem limites
                    tipo: sem_limite
                    data_hora_inicio: '2026-04-20T03:00:00Z'
                    data_hora_fim: '2027-04-20T03:00:00Z'
                    quantidade_maxima_cupons: '100'
                    quantidade_cupons_gerados: '38'
                    tipo_desconto: percentual
                    desconto: '50.00'
                    tipos_pagamentos:
                      - tipo: D
                        nome: Dinheiro
        '400':
          description: Erro de autenticação
          content:
            application/json:
              schema:
                type: object
              example:
                success: false
                errors:
                  - code: 0
                    message: Chave da app não informada.
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