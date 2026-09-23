> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Obter empresa

> Retorna dados de uma empresa específica.



## OpenAPI

````yaml pages/v2/openapi-entregas.json GET /empresas/{id}
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
  /empresas/{id}:
    get:
      summary: Obter empresa
      description: Retorna dados de uma empresa específica.
      parameters:
        - name: id
          in: path
          required: true
          description: identificador da empresa
          schema:
            type: integer
      responses:
        '200':
          description: Sucesso
          content:
            application/json:
              example:
                success: true
                data:
                  id: '12'
                  nome: 101512 - Banco Itau2
                  numero_contrato: '997104'
                  endereco: null
                  complemento: null
                  bairro: null
                  cidade: null
                  uf: null
                  cep: null
                  lat: null
                  lng: null
                  telefone: null
                  telefone_internacional: null
                  status_empresa: S
                  data_hora_cadastro: null
                  dados_extras: null
                  tipo_documento: CNPJ
                  documento: 42.129.155/0001-72
                  tipos_pagamento:
                    - C
                    - D
                  categorias:
                    - id: '71'
                      nome: Comum
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