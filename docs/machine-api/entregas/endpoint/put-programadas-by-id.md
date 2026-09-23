> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Editar entrega programada

> Edita uma entrega programada ainda não disparada via reenvio completo dos dados (substituição total). Reutiliza as mesmas regras de negócio do pipeline de criação: recria paradas, notifica providers das paradas removidas e recalcula estimativa.

Requer autenticação HTTP Basic do gestor da empresa.



## OpenAPI

````yaml pages/v2/openapi-entregas.json PUT /entregas/programadas/{id}
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
  /entregas/programadas/{id}:
    put:
      summary: Editar entrega programada
      description: >-
        Edita uma entrega programada ainda não disparada via reenvio completo
        dos dados (substituição total). Reutiliza as mesmas regras de negócio do
        pipeline de criação: recria paradas, notifica providers das paradas
        removidas e recalcula estimativa.


        Requer autenticação HTTP Basic do gestor da empresa.
      parameters:
        - name: id
          in: path
          required: true
          description: id da solicitação programada
          schema:
            type: integer
      requestBody:
        required: true
        content:
          application/json:
            example:
              data: 31/12/2026
              hora: '10:00:00'
              forma_pagamento: D
              partida:
                endereco: Rua da Coleta, 10
                bairro: Centro
                lat: '-23.5500000'
                lng: '-46.6300000'
              paradas:
                - endereco_parada: Rua da Entrega, 200
                  bairro_parada: Vila Nova
                  lat_parada: '-23.56'
                  lng_parada: '-46.64'
                  nome_cliente_parada: Maria Souza
                  telefone_cliente_parada: (11) 99999-0002
            schema:
              type: object
              required:
                - data
                - hora
                - forma_pagamento
                - partida
                - paradas
              properties:
                data:
                  type: string
                  description: Data do disparo no formato `DD/MM/AAAA`.
                hora:
                  type: string
                  description: Hora do disparo no formato `HH:MM:SS`.
                forma_pagamento:
                  type: string
                  description: >-
                    As formas de pagamento possíveis são: Dinheiro (`D`), Débito
                    (`B`), Crédito (`C`), Pix (`X`), Picpay (`P`), Whatsapp
                    (`H`), Faturado (`F`), Carteira de créditos (`R`)
                partida:
                  type: object
                  properties:
                    endereco:
                      type: string
                    bairro:
                      type: string
                    complemento:
                      type: string
                    cidade:
                      type: string
                    estado:
                      type: string
                    referencia:
                      type: string
                    lat:
                      type: string
                    lng:
                      type: string
                paradas:
                  type: array
                  description: Lista completa de paradas desejadas (substituição total).
                  items:
                    type: object
                    required:
                      - endereco_parada
                      - bairro_parada
                    properties:
                      endereco_parada:
                        type: string
                      bairro_parada:
                        type: string
                      complemento_parada:
                        type: string
                      cidade_parada:
                        type: string
                      estado_parada:
                        type: string
                      referencia_parada:
                        type: string
                      lat_parada:
                        type: string
                      lng_parada:
                        type: string
                      nome_cliente_parada:
                        type: string
                      telefone_cliente_parada:
                        type: string
                      observacao_parada:
                        type: string
                      codigo_confirmacao:
                        type: string
                        description: >-
                          Código de confirmação da entrega, com **4 dígitos**
                          (de `0001` a `9999`), informado pelo condutor no app
                          no momento da entrega. Se a entrega foi criada com
                          `url_confirmacao`, quem valida o código é o seu
                          sistema e este campo é ignorado — a URL não é alterada
                          por este endpoint.
                      id_externo:
                        type: string
      responses:
        '200':
          description: Sucesso
          content:
            application/json:
              example:
                success: true
                id_mch: 90976
        '400':
          description: Requisição inválida
          content:
            application/json:
              example:
                success: false
                errors:
                  - code: 0
                    message: Descrição do erro
        '401':
          description: Não autorizado
          content:
            application/json:
              example:
                success: false
                errors:
                  - code: 0
                    message: Usuário e/ou senhas inválidos.
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