> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Consultar corridas

> Retorna as solicitações da central conforme os filtros informados. O intervalo máximo aceito entre `data_hora_solicitacao_min` e `data_hora_solicitacao_max` é de 30 dias. Para acessar este endpoint, o usuário precisa ter a permissão `API - Corrida`.

O campo `valor_corrida` traz o valor já líquido, com o desconto do cupom aplicado, e `valor_corrida_integral` traz o valor bruto da corrida, antes do desconto. Sem cupom aplicado, os dois campos são iguais.



## OpenAPI

````yaml pages/v2/openapi-corridas.json POST /corridas/consultar
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
  /corridas/consultar:
    post:
      summary: Consultar corridas
      description: >-
        Retorna as solicitações da central conforme os filtros informados. O
        intervalo máximo aceito entre `data_hora_solicitacao_min` e
        `data_hora_solicitacao_max` é de 30 dias. Para acessar este endpoint, o
        usuário precisa ter a permissão `API - Corrida`.


        O campo `valor_corrida` traz o valor já líquido, com o desconto do cupom
        aplicado, e `valor_corrida_integral` traz o valor bruto da corrida,
        antes do desconto. Sem cupom aplicado, os dois campos são iguais.
      requestBody:
        required: false
        content:
          application/json:
            schema:
              type: object
              properties:
                pagina:
                  type: integer
                  description: Página da listagem.
                limite:
                  type: integer
                  description: Quantidade de registros por página.
                condutor_id:
                  type: integer
                  description: Filtra por condutor.
                empresa_id:
                  type: integer
                  description: Filtra por empresa.
                cliente_id:
                  type: integer
                  description: Filtra por cliente.
                obter_filiais:
                  type: boolean
                  description: Inclui corridas de filiais quando permitido.
                data_hora_solicitacao_min:
                  type: string
                  format: date-time
                  description: Início do intervalo em formato ISO 8601.
                data_hora_solicitacao_max:
                  type: string
                  format: date-time
                  description: Fim do intervalo em formato ISO 8601.
                status_solicitacao:
                  type: string
                  description: >-
                    Status da corrida. Caso não seja informado, todos serão
                    considerados. Valores aceitos: Redistribuindo (`T`),
                    Aguardando pagamento (`R`), Não atendida (`N`), Distribuindo
                    (`D`), Em espera (`S`), Cancelada (`C`), Finalizada (`F`),
                    Em andamento (`E`), Pendente (`P`), Aceita (`A`), Aguardando
                    aceite (`G`), Agrupada (`U`).
                  enum:
                    - T
                    - R
                    - 'N'
                    - D
                    - S
                    - C
                    - F
                    - E
                    - P
                    - A
                    - G
                    - U
                tipo_pagamento:
                  type: string
                  description: >-
                    Tipo de pagamento selecionado pelo cliente. Caso não seja
                    informado, todos serão considerado. Valores aceitos:
                    Dinheiro (`D`), Débito (máquina) (`B`), Crédito máquina
                    (`C`), eTicket (`T`), Voucher (`V`), Pix (`X`), Picpay
                    (`P`), Whatsapp (`H`), Cartão via app (`A`), Faturado (`F`),
                    Pix via app (`I`), Carteira de créditos (`R`).
                  enum:
                    - D
                    - B
                    - C
                    - T
                    - V
                    - X
                    - P
                    - H
                    - A
                    - F
                    - I
                    - R
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
                  - id: '100018001'
                    data_hora_solicitacao: '2024-05-02 08:53:42'
                    data_hora_chegada_local: null
                    status_solicitacao: 'N'
                    cliente_id: '83605'
                    nome_passageiro: Rogério Barreto
                    empresa_id: null
                    bandeira_chamada_id: '8'
                    data_hora_aceite: null
                    data_hora_finalizacao: null
                    data_hora_cancelamento: null
                    data_hora_pendencia: '2024-05-02 08:53:49'
                    distancia_coleta_km: null
                    valor_corrida: '7.00'
                    valor_corrida_integral: '10.00'
                    condutor_especificado: false
                    com_retorno: false
                    condutor_id: ''
                    nome_condutor: ''
                    telefone_condutor: ''
                    veiculo: ''
                    placa_veiculo: ''
                    cor_veiculo: null
                    duracao_corrida: '0'
                    distancia_percorrida_km: '0'
                    taxas_cancelamento: null
                    paradas: []
                  - id: '100018035'
                    data_hora_solicitacao: '2024-05-03 09:36:44'
                    data_hora_chegada_local: null
                    status_solicitacao: 'N'
                    cliente_id: '83316'
                    nome_passageiro: Maria Andreia
                    bandeira_chamada_id: '8'
                    data_hora_aceite: null
                    data_hora_finalizacao: null
                    data_hora_cancelamento: null
                    data_hora_pendencia: '2024-05-03 09:36:45'
                    distancia_coleta_km: null
                    valor_corrida: '10.50'
                    valor_corrida_integral: '10.50'
                    condutor_especificado: false
                    com_retorno: false
                    condutor_id: ''
                    nome_condutor: ''
                    telefone_condutor: ''
                    veiculo: ''
                    placa_veiculo: ''
                    cor_veiculo: null
                    duracao_corrida: '0'
                    distancia_percorrida_km: '0'
                    taxas_cancelamento: null
                    partida:
                      endereco: Rua Altaneira
                      complemento: null
                      referencia: null
                      bairro: Campo Grande
                      cidade: Rio de Janeiro
                      estado: RJ
                      lat: '-22.8743056'
                      lng: '-43.5626744'
                    paradas:
                      - id: '896'
                        endereco: Praia do Arpoador
                        complemento: ''
                        bairro: Arpoador
                        cidade: Rio de Janeiro
                        uf: RJ
                        lat: '-22.988420900610592'
                        lng: '-43.1934916318077'
                        ordem: 0
                        numero_pedido: '2'
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