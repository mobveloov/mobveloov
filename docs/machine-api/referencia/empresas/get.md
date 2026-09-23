> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Listar empresas

> Retorna todas as empresas conveniadas à central. O campo "dados_extras" somente é retornado com autenticação de Central. Caso uma quebra de linha ocorra, serão retornados os caracteres "\r\n" indicando a quebra de linha.



## OpenAPI

````yaml pages/v2/openapi-corridas.json GET /empresas
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
  /empresas:
    get:
      summary: Listar empresas
      description: >-
        Retorna todas as empresas conveniadas à central. O campo "dados_extras"
        somente é retornado com autenticação de Central. Caso uma quebra de
        linha ocorra, serão retornados os caracteres "\r\n" indicando a quebra
        de linha.
      parameters:
        - name: pagina
          in: query
          description: Qual início da contagem para o limite. O padrão é 1.
          schema:
            type: integer
            default: 1
        - name: limite
          in: query
          description: >-
            Quantidade de empresas retornadas. O limite padrão é 20 e o máximo é
            100.
          schema:
            type: integer
            default: 20
            maximum: 100
      responses:
        '200':
          description: Sucesso
          content:
            application/json:
              example:
                success: true
                data:
                  - id: '719'
                    nome: O'Conner and Sons
                    numero_contrato: '496'
                    endereco: Rua 32
                    complemento: null
                    bairro: Centro
                    cidade: Barretos
                    uf: SP
                    cep: 14783-215
                    lat: '-20.556480000'
                    lng: '-48.577464800'
                    telefone: 627-706-0824
                    status_empresa: A
                    data_hora_cadastro: '2024-07-21 12:15:00'
                    dados_extras: "Dados extras 1\r\nDados extras 2"
                    tipo_documento: CNPJ
                    documento: 42.129.155/0001-72
                    tipos_pagamento:
                      - B
                      - C
                    categorias:
                      - id: '72'
                        nome: Categoria1
                      - id: '94'
                        nome: Categoria2
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