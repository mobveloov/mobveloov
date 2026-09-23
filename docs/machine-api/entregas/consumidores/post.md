> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Criar consumidor

> Cria um consumidor na empresa do gestor autenticado. Requer Api-Key (bandeira) + autenticação HTTP Basic do gestor da empresa; uso obrigatório de HTTPS.



## OpenAPI

````yaml pages/v2/openapi-entregas.json POST /consumidores
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
  /consumidores:
    post:
      summary: Criar consumidor
      description: >-
        Cria um consumidor na empresa do gestor autenticado. Requer Api-Key
        (bandeira) + autenticação HTTP Basic do gestor da empresa; uso
        obrigatório de HTTPS.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - nome
                - telefone
              properties:
                nome:
                  type: string
                  description: >-
                    Apenas letras, espaços e os sinais - ' . (não aceita números
                    nem outros caracteres especiais).
                telefone:
                  type: string
                  description: >-
                    Telefone em formato internacional E.164, ex.:
                    +5544999999999.
            example:
              nome: Maria
              telefone: '+5544999999999'
      responses:
        '201':
          description: Criado
          content:
            application/json:
              schema:
                type: object
              example:
                success: true
                data:
                  id: 10
                  nome: Maria
        '400':
          description: Erro de validação
          content:
            application/json:
              schema:
                type: object
              example:
                success: false
                errors:
                  - code: 0
                    message: Já existe um consumidor com este telefone.
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