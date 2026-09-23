> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Criar entrega programada

> Permite criar uma solicitação de entrega programada.



## OpenAPI

````yaml pages/v2/openapi-entregas.json POST /entregas/programadas
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
  /entregas/programadas:
    post:
      summary: Criar entrega programada
      description: Permite criar uma solicitação de entrega programada.
      requestBody:
        required: true
        content:
          application/json:
            example:
              forma_pagamento: >-
                D (As formas de pagamento possíveis são: Dinheiro (`D`), Débito
                (`B`), Crédito (`C`), Pix (`X`), Picpay (`P`), Whatsapp (`H`),
                Faturado (`F`), Carteira de créditos (`R`))
              partida:
                endereco: Rua Evandro Câmara, 717
                bairro: Monte Carmelo
                complemento: est a tempore
                cidade: Montes Claros
                estado: MG
                referencia: Nam animi molestiae reiciendis aut voluptas ea aut commodi.
                lat: '-16.7176723'
                lng: '-43.8341584'
              paradas:
                - endereco_parada: Aeroporto de Montes Claros - Mário Ribeiro
                  bairro_parada: Jaraguá
                  complemento_parada: quo vel possimus
                  cidade_parada: Montes Claros
                  estado_parada: MG
                  referencia_parada: >-
                    Est dolores ut voluptate perspiciatis et dolorem
                    necessitatibus.
                  lat_parada: '-16.7176723'
                  lng_parada: '-43.8341584'
                  id_externo: '343'
                  observacao_parada: Facere pariatur fugit ut soluta consequatur.
                  nome_cliente_parada: Joanna Harris
                  telefone_cliente_parada: (099) 99999-9999
                  codigo_confirmacao: '9999'
                  valor_cobrar: 852.37
              data: 31/12/2026
              hora: '14:30:00'
              info_antes_aceite: Portaria fecha às 18h
              exigir_codigo_confirmacao: true
            schema:
              type: object
              properties:
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
                  description: Lista de paradas da entrega. Limite máximo de 1000 itens.
                  maxItems: 1000
                  items:
                    type: object
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
                      id_externo:
                        type: string
                      observacao_parada:
                        type: string
                      nome_cliente_parada:
                        type: string
                      telefone_cliente_parada:
                        type: string
                      codigo_confirmacao:
                        type: string
                        description: >-
                          Código de confirmação da entrega, com **4 dígitos**
                          (de `0001` a `9999`), informado pelo condutor no app
                          no momento da entrega. Exige que a empresa (ou a
                          central) solicite o código, ou que
                          `exigir_codigo_confirmacao` seja `true`; fora isso a
                          entrega é recusada com `400
                          CODIGO_CONFIRMACAO_NAO_PERMITIDO` (código 118). Não
                          envie junto de `url_confirmacao`: com a URL, quem
                          valida o código é o seu sistema.
                      url_confirmacao:
                        type: string
                        description: >-
                          URL do seu sistema que valida o código de confirmação
                          desta parada. Use quando o código fica no seu lado —
                          por exemplo, um PDV integrado ao iFood — e não pode
                          ser enviado na criação da entrega. Com a URL
                          informada, o app pede os 4 dígitos ao condutor e, na
                          confirmação, enviamos um `POST` com corpo JSON
                          contendo `codigo_confirmacao`, `solicitacao_id`,
                          `solicitacao_parada_id` e `id_externo`; responda `2xx`
                          para confirmar a entrega e `4xx` para recusar o
                          código. Requisitos: `https`, no máximo 500 caracteres
                          e endereço público — fora disso a entrega é recusada
                          com `400 URL_CONFIRMACAO_INVALIDA` (código 142). O
                          tempo limite é de 10 segundos e não há reenvio: se o
                          seu sistema não responder, a entrega não é confirmada
                          e a liberação fica a cargo da central. Aceita apenas
                          na criação da entrega e não é retornada nas consultas.
                      valor_cobrar:
                        type: number
                data:
                  type: string
                  description: Data da entrega programada. Formato YYYY-MM-DD
                hora:
                  type: string
                  description: Hora da entrega programada. Formato HH:MM:SS
                info_antes_aceite:
                  type: string
                  description: >-
                    Informação exibida ao condutor antes do aceite da entrega.
                    Textos com mais de 70 caracteres são truncados.
                exigir_codigo_confirmacao:
                  type: boolean
                  description: >-
                    Torna obrigatória a inserção do código de confirmação pelo
                    condutor nesta solicitação, independente das configurações
                    do cadastro da empresa (ou da central) — vale tanto sobre
                    "Tornar os códigos de confirmação de entrega obrigatórios"
                    quanto sobre "Solicitar código de confirmação de entrega dos
                    pedidos". Envie `true` para exigir; omitir o campo ou enviar
                    `false` mantém o que está configurado — o parâmetro nunca
                    dispensa uma exigência já configurada. Ao enviar `true`, o
                    `codigo_confirmacao` passa a ser obrigatório em todas as
                    paradas: sem ele o condutor não teria o que informar para
                    concluir a entrega, e a solicitação é recusada com `400
                    CODIGO_CONFIRMACAO_OBRIGATORIO` (código 136). Pedidos do
                    iFood continuam exigindo o código, por ser regra da própria
                    integração. Uma vez criada com `true`, a exigência não é
                    removível: não há ação de operador que a dispense (o
                    "prosseguir sem código" da plataforma atende os pedidos do
                    iFood e os abertos com `url_confirmacao`) e a edição da
                    entrega não altera o parâmetro. O código fica visível no
                    painel da empresa, no link de acompanhamento do cliente e em
                    `GET /entregas/{id}/links-rastreio`; se for preciso concluir
                    sem ele, resta cancelar a entrega. Em entregas programadas,
                    o valor informado é aplicado à solicitação gerada no momento
                    do disparo.
      responses:
        '200':
          description: Sucesso
          content:
            application/json:
              example:
                success: true
                data:
                  id_mch: '140'
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