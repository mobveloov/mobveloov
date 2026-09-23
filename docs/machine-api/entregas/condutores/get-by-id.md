> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Obter condutor

> Retorna um condutor da central conforme o ID informado. Para acessar este endpoint, o usuário autenticado deve ter a permissão `API - Corrida`.



## OpenAPI

````yaml pages/v2/openapi-entregas.json GET /condutores/{id}
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
  /condutores/{id}:
    get:
      summary: Obter condutor
      description: >-
        Retorna um condutor da central conforme o ID informado. Para acessar
        este endpoint, o usuário autenticado deve ter a permissão `API -
        Corrida`.
      parameters:
        - name: id
          in: path
          required: true
          description: ID do condutor.
          schema:
            type: integer
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
                  - id: '5574'
                    nome: Lara
                    email: lara@exemplo.com
                    telefone: (012) 93485-8345
                    status: E
                    cpf: 879.213.930-20
                    chave_pix: null
                    pagamentos: []
                    categorias:
                      - id: 1
                        nome: Categoria 1
                    avaliacao_media: null
                    data_hora_situacao_cadastral: '2024-03-27 09:54:53'
                    data_hora_ultima_corrida: null
                    numero_viatura: null
                    observacao_interna_1: null
                    observacao_interna_2: null
                    observacao_interna_3: null
                    endereco: Jeffery Well
                    numero_endereco: ''
                    complemento: ''
                    bairro: ''
                    nome_cidade: Mullerchester
                    uf_sigla: ''
                    cep: 99999-999
                    pais_nome: Guinea
                    referencia_endereco: null
                    dados_extras: ''
                    foto_url: >-
                      https://s3.amazonaws.com/exemplo-bucket/fotos/condutor-5574.jpg?X-Amz-Expires=...
        '404':
          description: Condutor não encontrado
          content:
            application/json:
              example:
                success: false
                errors:
                  - code: 56
                    message: Condutor não encontrado.
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