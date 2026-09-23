> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Listar condutores

> Retorna todos os condutores da central conforme os parâmetros informados. Para acessar este endpoint, o usuário autenticado deve ter a permissão `API - Corrida`.



## OpenAPI

````yaml pages/v2/openapi-corridas.json GET /condutores
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
  /condutores:
    get:
      summary: Listar condutores
      description: >-
        Retorna todos os condutores da central conforme os parâmetros
        informados. Para acessar este endpoint, o usuário autenticado deve ter a
        permissão `API - Corrida`.
      parameters:
        - name: status_condutor
          in: query
          description: |-
            Retorna apenas os condutores no status desejado.

            A: Ativo
            E: Em análise
            F: Fila de espera
            I: Inativo
            S: Suspenso
            R: Rejeitado
            D: Deletado
          schema:
            type: string
            enum:
              - A
              - E
              - F
              - I
              - S
              - R
              - D
        - name: limite
          in: query
          description: >-
            Quantidade de registros por página. O limite padrão é 20 e o máximo
            é 100.
          schema:
            type: integer
            default: 20
            maximum: 100
        - name: pagina
          in: query
          description: Qual início da contagem para o limite. O padrão é 1.
          schema:
            type: integer
            default: 1
        - name: telefone
          in: query
          description: Telefone do condutor que deseja visualizar as informações.
          schema:
            type: string
        - name: id
          in: query
          description: ID do condutor.
          schema:
            type: integer
        - name: cpf
          in: query
          description: >-
            CPF do condutor. Aceita valor completo ou parcial, com ou sem
            máscara, por exemplo: `123.456.789-09` ou `12345`.
          schema:
            oneOf:
              - type: string
              - type: integer
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
                  - id: '5575'
                    nome: Jorge
                    email: jorge@exemplo.com
                    telefone: (012) 93485-8345
                    status: E
                    cpf: 879.213.930-20
                    chave_pix: null
                    pagamentos: []
                    avaliacao_media: null
                    data_hora_situacao_cadastral: '2024-03-27 09:55:40'
                    data_hora_ultima_corrida: null
                    numero_viatura: null
                    observacao_interna_1: null
                    observacao_interna_2: null
                    observacao_interna_3: null
                    endereco: Lemuel Tunnel
                    numero_endereco: ''
                    complemento: ''
                    bairro: ''
                    nome_cidade: Toledo
                    uf_sigla: ''
                    cep: 99999-999
                    pais_nome: Jamaica
                    referencia_endereco: null
                    dados_extras: ''
                  - id: '712'
                    nome: Roberto
                    email: roberto@exemplo.com
                    telefone: (021) 98466-9933
                    status: E
                    cpf: 145.744.687-18
                    chave_pix: null
                    pagamentos:
                      - B
                    avaliacao_media: null
                    data_hora_situacao_cadastral: '2018-05-22 14:32:32'
                    data_hora_ultima_corrida: null
                    numero_viatura: null
                    observacao_interna_1: null
                    observacao_interna_2: null
                    observacao_interna_3: null
                    endereco: Trantow Trail
                    numero_endereco: ''
                    complemento: ''
                    bairro: ''
                    nome_cidade: Romagueraside
                    uf_sigla: ''
                    cep: 99999-999
                    pais_nome: El Salvador
                    referencia_endereco: null
                    dados_extras: ''
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