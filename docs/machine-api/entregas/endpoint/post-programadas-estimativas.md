> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Estimar entrega programada

> Permite obter a estimativa do valor da entrega programada em uma única categoria



## OpenAPI

````yaml pages/v2/openapi-entregas.json POST /entregas/programadas/estimativas
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
  /entregas/programadas/estimativas:
    post:
      summary: Estimar entrega programada
      description: >-
        Permite obter a estimativa do valor da entrega programada em uma única
        categoria
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                endereco_partida:
                  type: string
                  description: Endereço do local de partida
                bairro_partida:
                  type: string
                  description: Bairro do local de partida
                cidade_partida:
                  type: string
                  description: Cidade do local de partida
                estado_partida:
                  type: string
                  description: Sigla do estado do local de partida
                lat_partida:
                  type: number
                  description: Latitude do local de partida
                lng_partida:
                  type: number
                  description: Longitude do local de partida
                endereco_desejado:
                  type: string
                  description: Endereço do local desejado
                bairro_desejado:
                  type: string
                  description: Bairro do local desejado
                cidade_desejado:
                  type: string
                  description: Cidade do local desejado
                estado_desejado:
                  type: string
                  description: Sigla do estado do local desejado
                lat_desejado:
                  type: number
                  description: Latitude do local desejado
                lng_desejado:
                  type: number
                  description: Longitude do local desejado
                latlng_paradas:
                  type: string
                  description: >-
                    Latitude e longitude das paradas. Cada parada deve conter o
                    separador |
                categoria_id:
                  type: integer
                  description: Identificação da categoria
                categoria_nome:
                  type: string
                  description: Nome da categoria
                data:
                  type: string
                  description: Data da entrega programada. Formato YYYY-MM-DD
                hora:
                  type: string
                  description: Hora da entrega programada. Formato HH:MM:SS
                com_retorno:
                  type: boolean
                  description: Indica se a solictação irá ter retorno ao local de coleta
              required:
                - endereco_partida
                - bairro_partida
                - cidade_partida
                - estado_partida
                - endereco_desejado
                - bairro_desejado
                - cidade_desejado
                - estado_desejado
      responses:
        '200':
          description: Sucesso
          content:
            application/json:
              example:
                success: true
                data:
                  estimativa_valor: 846.18
                  estimativa_minutos: 7
                  estimativa_km: 4.05
                  categoria_nome: dolorem
                  tarifa_nome: ut
                  partida:
                    lat: -16.7177506
                    lng: -43.8340907
                  desejado:
                    lat: -16.7049531
                    lng: -43.8199862
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