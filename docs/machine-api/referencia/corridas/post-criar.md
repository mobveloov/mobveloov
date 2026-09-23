> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Criar corrida

> Cria uma corrida avulsa, aceitando dados de cadastro, passageiro, origem, destino, empresa, filtros extras, paradas e cupom de desconto (`codigo_cupom`). Quando a bandeira usa cálculo pré-fixo ou pré-variável, o valor calculado da corrida — já líquido do desconto do cupom, se houver — volta no response em `valor_corrida`, `valor_desconto` e `valor_cupom`.



## OpenAPI

````yaml pages/v2/openapi-corridas.json POST /corridas
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
  /corridas:
    post:
      summary: Criar corrida
      description: >-
        Cria uma corrida avulsa, aceitando dados de cadastro, passageiro,
        origem, destino, empresa, filtros extras, paradas e cupom de desconto
        (`codigo_cupom`). Quando a bandeira usa cálculo pré-fixo ou
        pré-variável, o valor calculado da corrida — já líquido do desconto do
        cupom, se houver — volta no response em `valor_corrida`,
        `valor_desconto` e `valor_cupom`.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - dados_cadastro
                - dados_passageiro
                - forma_pagamento
                - partida
              properties:
                id_externo:
                  oneOf:
                    - type: string
                    - type: integer
                  description: Identificador externo da integração.
                dados_cadastro:
                  type: object
                  required:
                    - codigo_pais
                    - codigo_area
                    - telefone
                  properties:
                    codigo_pais:
                      type: integer
                    codigo_area:
                      type: integer
                    telefone:
                      oneOf:
                        - type: integer
                        - type: string
                dados_passageiro:
                  type: object
                  required:
                    - codigo_pais
                    - codigo_area
                    - telefone
                  properties:
                    codigo_pais:
                      type: integer
                    codigo_area:
                      type: integer
                    telefone:
                      oneOf:
                        - type: integer
                        - type: string
                    nome:
                      type: string
                forma_pagamento:
                  type: string
                  description: Forma de pagamento da corrida.
                partida:
                  type: object
                  required:
                    - endereco
                    - bairro
                  properties:
                    endereco:
                      type: string
                    bairro:
                      type: string
                    cidade:
                      type: string
                    estado:
                      type: string
                    complemento:
                      oneOf:
                        - type: string
                        - type: integer
                    referencia:
                      type: string
                    lat:
                      type: number
                    lng:
                      type: number
                desejado:
                  type: object
                  properties:
                    endereco:
                      type: string
                    bairro:
                      type: string
                    cidade:
                      type: string
                    estado:
                      type: string
                    complemento:
                      type: string
                    referencia:
                      type: string
                    lat:
                      type: number
                    lng:
                      type: number
                empresa:
                  type: object
                  properties:
                    id:
                      type: integer
                    cadastrar_funcionario:
                      type: boolean
                    centro_custo_id:
                      type: integer
                categoria_id:
                  type: integer
                categoria_nome:
                  type: string
                info_antes_aceite:
                  type: string
                info_apos_aceite:
                  type: string
                estimativas:
                  type: boolean
                ignorar_condutores_proximos:
                  type: boolean
                extras:
                  type: object
                  properties:
                    porta_malas_grande:
                      type: boolean
                    veiculo_a_disposicao:
                      type: boolean
                    adaptado_cadeirante:
                      type: boolean
                    motorista_mulher:
                      type: boolean
                    aceita_animais:
                      type: boolean
                    aceita_encomendas:
                      type: boolean
                    com_retorno:
                      type: boolean
                    filtro_1:
                      type: boolean
                    filtro_2:
                      type: boolean
                    filtro_3:
                      type: boolean
                    filtro_4:
                      type: boolean
                    filtro_5:
                      type: boolean
                    filtro_6:
                      type: boolean
                condutor:
                  type: object
                  properties:
                    tipo_identificacao:
                      oneOf:
                        - type: string
                        - type: boolean
                    identificacao:
                      oneOf:
                        - type: string
                        - type: boolean
                paradas:
                  type: array
                  description: Lista de paradas da corrida. Limite máximo de 1000 itens.
                  maxItems: 1000
                  items:
                    type: object
                    properties:
                      endereco_parada:
                        type: string
                      bairro_parada:
                        type: string
                      cidade_parada:
                        type: string
                      estado_parada:
                        type: string
                      lat_parada:
                        type: number
                      lng_parada:
                        type: number
                antecedencia:
                  type: integer
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
              codigo_cupom: PROMO10
      responses:
        '200':
          description: >-
            Corrida criada com sucesso. Os campos `valor_corrida`,
            `valor_desconto` e `valor_cupom` só vêm presentes quando a bandeira
            usa cálculo pré-fixo ou pré-variável (valor pré-calculado).
          content:
            application/json:
              schema:
                type: object
              example:
                success: true
                data:
                  id_mch: '100018556'
                  tipo: normal
                  valor_corrida: 32
                  valor_desconto: 10
                  valor_cupom: 8
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