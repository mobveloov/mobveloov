> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Consultar documentos do condutor

> Retorna os documentos cadastrados do condutor. O tipo de identificação pode ser CPF (C), viatura (V), telefone (T), placa do veículo (P) ou identificador do condutor (I).



## OpenAPI

````yaml pages/v2/openapi-corridas.json GET /condutores/documentos
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
  /condutores/documentos:
    get:
      summary: Consultar documentos do condutor
      description: >-
        Retorna os documentos cadastrados do condutor. O tipo de identificação
        pode ser CPF (C), viatura (V), telefone (T), placa do veículo (P) ou
        identificador do condutor (I).
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
            example: C
        - name: identificacao
          in: query
          required: true
          description: Valor da identificação conforme o tipo informado.
          schema:
            type: string
            example: 123.456.789-09
      responses:
        '200':
          description: Sucesso
          content:
            application/json:
              example:
                success: true
                data:
                  documentos:
                    - tipo: ZG9jXzg
                      nome: CNH (Carteira Nacional de Habilitação)
                      url_foto: /api/foto?user_id=993&id=896
                  quantidade_documentos: 1
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