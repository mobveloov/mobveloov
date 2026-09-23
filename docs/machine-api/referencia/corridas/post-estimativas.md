> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Estimar corrida

> Calcula estimativa de corrida simples ou multicategorias a partir de coordenadas ou endereço. Quando `multicategorias` é `true`, a API calcula a estimativa de múltiplas categorias. Quando `codigo_cupom` é informado, `estimativa_valor` retorna o valor já líquido, com o desconto do cupom aplicado.



## OpenAPI

````yaml pages/v2/openapi-corridas.json POST /corridas/estimativas
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
  /corridas/estimativas:
    post:
      summary: Estimar corrida
      description: >-
        Calcula estimativa de corrida simples ou multicategorias a partir de
        coordenadas ou endereço. Quando `multicategorias` é `true`, a API
        calcula a estimativa de múltiplas categorias. Quando `codigo_cupom` é
        informado, `estimativa_valor` retorna o valor já líquido, com o desconto
        do cupom aplicado.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
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
                categoria_id:
                  type: integer
                categoria_nome:
                  type: string
                empresa_id:
                  type: integer
                latlng_paradas:
                  type: string
                data:
                  type: string
                hora:
                  type: string
                ignorar_condutores_proximos:
                  type: boolean
                multicategorias:
                  type: boolean
                  description: >-
                    Quando multicategorias é true, a API calcula a estimativa de
                    múltiplas categorias.
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
              codigo_cupom: PROMO10
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
                    - categoria_id: 3
                      estimativa_valor: 32
                      categoria_nome: Comum
                      tarifa_nome: Tarifa padrão
                    - categoria_id: 1
                      estimativa_valor: 22
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