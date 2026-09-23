> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Consultar requisitos de documentos para cadastro

> Retorna os documentos necessários para o cadastro do condutor.



## OpenAPI

````yaml pages/v2/openapi-corridas.json GET /condutores/requisitos-cadastro/documentos
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
  /condutores/requisitos-cadastro/documentos:
    get:
      summary: Consultar requisitos de documentos para cadastro
      description: Retorna os documentos necessários para o cadastro do condutor.
      parameters:
        - name: tipo_identificacao
          in: query
          required: true
          description: >-
            Forma de identificação do condutor: CPF (C), VTR (V), Telefone (T),
            Placa (P) ou ID (I).
          schema:
            type: string
            enum:
              - C
              - V
              - T
              - P
              - I
            example: I
        - name: identificacao
          in: query
          required: true
          description: Valor da identificação conforme o tipo informado.
          schema:
            type: string
            example: '5574'
      responses:
        '200':
          description: Sucesso
          content:
            application/json:
              example:
                success: true
                data:
                  documentos:
                    - nome: Alvará de táxi
                      tipo: ZG9jXzEy
                      ativo: false
                    - nome: Certidão de antecedentes criminais
                      tipo: ZG9jXzEx
                      ativo: true
                    - nome: CNH (Carteira Nacional de Habilitação)
                      tipo: ZG9jXzg
                      ativo: true
                  quantidade_documentos: 6
        '400':
          description: Erro de validação
          content:
            application/json:
              examples:
                enum_invalido:
                  summary: Enum inválido
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: >-
                          'tipo_identificacao': Deve estar dentre os valores: C,
                          V, T, P, I
                corpo_incompleto:
                  summary: Parâmetros obrigatórios ausentes
                  value:
                    success: false
                    errors:
                      - code: 2
                        message: '''tipo_identificacao'': Preenchimento obrigatório'
                      - code: 2
                        message: '''identificacao'': Preenchimento obrigatório'
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