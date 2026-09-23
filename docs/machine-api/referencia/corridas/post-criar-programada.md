> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Criar corrida programada

> Cria uma corrida programada utilizando o payload de criação de corrida mais os campos de agendamento.



## OpenAPI

````yaml pages/v2/openapi-corridas.json POST /corridas/programadas
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
  /corridas/programadas:
    post:
      summary: Criar corrida programada
      description: >-
        Cria uma corrida programada utilizando o payload de criação de corrida
        mais os campos de agendamento.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - data
                - hora
                - dados_cadastro
                - dados_passageiro
                - forma_pagamento
                - partida
              properties:
                data:
                  type: string
                  description: Data da corrida programada em `DD/MM/YYYY`.
                hora:
                  type: string
                  description: Hora da corrida programada.
                antecedencia:
                  type: integer
                id_externo:
                  oneOf:
                    - type: string
                    - type: integer
                dados_cadastro:
                  type: object
                dados_passageiro:
                  type: object
                empresa:
                  type: object
                info_antes_aceite:
                  type: string
                info_apos_aceite:
                  type: string
                forma_pagamento:
                  type: string
                categoria_id:
                  type: integer
                categoria_nome:
                  type: string
                estimativas:
                  type: boolean
                ignorar_condutores_proximos:
                  type: boolean
                extras:
                  type: object
                condutor:
                  type: object
                partida:
                  type: object
                desejado:
                  type: object
                paradas:
                  type: array
                  description: Lista de paradas da corrida. Limite máximo de 1000 itens.
                  maxItems: 1000
                  items:
                    type: object
                retorno:
                  type: boolean
                codigo_cupom:
                  type: string
                  description: Código do cupom de desconto a ser aplicado na corrida.
            example:
              id_externo: '001'
              dados_cadastro:
                codigo_pais: 55
                codigo_area: 21
                telefone: 999999999
              dados_passageiro:
                codigo_pais: 55
                codigo_area: 21
                telefone: 999999999
                nome: Funcionário 1
              data: 19/08/2023
              hora: '10:35'
              antecedencia: 15
              empresa:
                id: 1
                cadastrar_funcionario: false
                centro_custo_id: 2
              info_antes_aceite: Embarque com animal
              info_apos_aceite: 2 paradas
              forma_pagamento: D
              categoria_id: 100
              categoria_nome: Comum
              estimativas: true
              ignorar_condutores_proximos: false
              extras:
                porta_malas_grande: false
                veiculo_a_disposicao: false
                adaptado_cadeirante: false
                motorista_mulher: false
                aceita_animais: false
                aceita_encomendas: false
                com_retorno: false
                filtro_1: false
                filtro_2: false
                filtro_3: false
                filtro_4: false
                filtro_5: false
                filtro_6: false
              condutor:
                tipo_identificacao: false
                identificacao: false
              partida:
                endereco: Rua da Assembléia, 10
                complemento: 2513
                bairro: Centro
                cidade: Rio de Janeiro
                estado: RJ
                referencia: Próximo à ALERJ
                lat: -22.9042273
                lng: -43.1774399
              desejado:
                endereco: Praça General Tibúrcio, 80
                complemento: 1 andar
                bairro: Urca
                cidade: Rio de Janeiro
                estado: RJ
                referencia: Próximo ao Pão de Açúcar
                lat: -22.9205645
                lng: -43.2325781
              paradas:
                - endereco_parada: Rua do ouvidor, 100
                  bairro_parada: Centro
                  cidade_parada: Rio de Janeiro
                  estado_parada: RJ
                  lat_parada: -22.903299
                  lng_parada: -43.177582
                - endereco_parada: Rua do rosário, 305
                  bairro_parada: Centro
                  cidade_parada: Rio de Janeiro
                  estado_parada: RJ
                  lat_parada: -22.903965
                  lng_parada: -43.180185
      responses:
        '200':
          description: Corrida programada criada com sucesso
          content:
            application/json:
              schema:
                type: object
              example:
                success: true
                data:
                  id_mch_programada: '100018556'
                  tipo: programada
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