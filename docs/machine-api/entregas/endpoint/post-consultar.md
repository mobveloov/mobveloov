> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Consultar entregas

> Ao acionar, são retornadas todas as entregas da central conforme os parâmetros informados.



## OpenAPI

````yaml pages/v2/openapi-entregas.json POST /entregas/consultar
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
  /entregas/consultar:
    post:
      summary: Consultar entregas
      description: >-
        Ao acionar, são retornadas todas as entregas da central conforme os
        parâmetros informados.
      requestBody:
        required: false
        content:
          application/json:
            schema:
              type: object
              properties:
                status_solicitacao:
                  type: string
                  description: >-
                    Status da entrega, podendo ser: D - Distribuindo, G -
                    Aguardando aceite, A - Aceita, E - Em andamento, F -
                    Finalizada, N - Não atendida, C - Cancelada, P - Pendente, L
                    - Aguardando a liberação
                  enum:
                    - D
                    - G
                    - A
                    - E
                    - F
                    - 'N'
                    - C
                    - P
                    - L
                tipo_pagamento:
                  type: string
                  description: >-
                    Pagamento utilizado na entrega, podendo ser: D - Dinheiro, V
                    - Voucher, T - Ticket, W - Wappa, C - Cartão de crédito, B -
                    Cartão de débito, A - Cartão App, X - Pix, P - PicPay, H -
                    Whatsapp, R - Carteira de créditos, F - Faturado
                  enum:
                    - D
                    - V
                    - T
                    - W
                    - C
                    - B
                    - A
                    - X
                    - P
                    - H
                    - R
                    - F
                condutor_id:
                  type: integer
                  description: Id do condutor
                pagina:
                  type: integer
                  default: 1
                limite:
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
                  - id: '83381'
                    data_hora_solicitacao: '2025-02-20 11:45:13'
                    data_hora_chegada_local: '2025-02-20 14:12:34'
                    status_solicitacao: F
                    cliente_id: '3'
                    nome_passageiro: Empresa
                    empresa_id: null
                    bandeira_chamada_id: '8'
                    bandeira_configuracao_id: '8'
                    data_hora_aceite: '2025-02-20 14:12:32'
                    data_hora_finalizacao: '2025-02-20 14:12:45'
                    data_hora_cancelamento: null
                    data_hora_pendencia: null
                    distancia_coleta_km: '0.005'
                    valor_corrida: '26.80'
                    condutor_especificado: false
                    com_retorno: false
                    taxista_id: '5539'
                    nome_taxista: TAXISTA_EXEMPLO
                    telefone_taxista: (99) 99898-9898
                    veiculo: gol
                    placa_veiculo: MOJ-8232
                    cor_veiculo: null
                    duracao_corrida: '0'
                    distancia_percorrida_km: '0.000'
                    taxas_cancelamento: null
                    paradas:
                      - id: '7673'
                        endereco: R. Silva Mariz, 51
                        complemento: ''
                        bairro: Cruz das Armas
                        cidade: João Pessoa
                        uf: PB
                        lat: '-7.139168000'
                        lng: '-34.888007000'
                        ordem: 0
                        numero_pedido: '123'
                    condutor_id: '5539'
                    nome_condutor: Felipe Nunes
                    telefone_condutor: (99) 99898-9898
                    telefone_condutor_internacional: '+5599998989898'
                    partida:
                      endereco: R. José Borges, 88
                      complemento: null
                      referencia: null
                      bairro: Gramame
                      cidade: João Pessoa
                      estado: PB
                      lat: '-7.209233800'
                      lng: '-34.878063100'
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