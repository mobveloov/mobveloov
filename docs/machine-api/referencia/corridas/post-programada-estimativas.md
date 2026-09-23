> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Estimar corrida programada

> Calcula estimativa de corrida programada a partir de data, hora e dados de origem e destino.



## OpenAPI

````yaml pages/v2/openapi-corridas.json POST /corridas/programadas/estimativas
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
  /corridas/programadas/estimativas:
    post:
      summary: Estimar corrida programada
      description: >-
        Calcula estimativa de corrida programada a partir de data, hora e dados
        de origem e destino.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - data
                - hora
              properties:
                data:
                  type: string
                  description: Data da programação em `YYYY-MM-DD`.
                hora:
                  type: string
                  description: Hora da programação.
                lat_desejado:
                  type: number
                lng_desejado:
                  type: number
                endereco_desejado:
                  type: string
                bairro_desejado:
                  type: string
                cidade_desejado:
                  type: string
                estado_desejado:
                  type: string
                lat_partida:
                  type: number
                lng_partida:
                  type: number
                endereco_partida:
                  type: string
                bairro_partida:
                  type: string
                cidade_partida:
                  type: string
                estado_partida:
                  type: string
                categoria_id:
                  type: integer
                multicategorias:
                  type: boolean
                  description: >-
                    Quando multicategorias é true, a API calcula a estimativa de
                    múltiplas categorias.
                latlng_paradas:
                  type: string
                codigo_cupom:
                  type: string
                  description: Código do cupom de desconto a ser aplicado na corrida.
            example:
              lat_partida: -22.904445
              lng_partida: -43.175508
              endereco_partida: Rua da Assembleia, 10
              bairro_partida: Centro
              cidade_partida: Rio de Janeiro
              estado_partida: RJ
              lat_desejado: -22.90789
              lng_desejado: -43.177878
              endereco_desejado: Rua do Rosário, 320
              bairro_desejado: Centro
              cidade_desejado: Rio de Janeiro
              estado_desejado: RJ
              multicategorias: true
              latlng_paradas: '-22.904434,-43.175555|-22.912385,-43.226663'
              data: '2026-05-05'
              hora: '15:00:00'
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
                  estimativa_minutos: 30
                  estimativa_km: 13.99
                  categorias:
                    - estimativa_valor: 40
                      categoria_nome: Comum
                      tarifa_nome: Tarifa padrão
                    - estimativa_valor: 22
                      categoria_nome: 15 Reais
                      tarifa_nome: Tarifa padrão
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