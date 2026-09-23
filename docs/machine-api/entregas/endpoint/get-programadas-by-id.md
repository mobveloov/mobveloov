> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Consultar entrega programada

> Permite obter uma única entrega programada através de seu id. O endereço de origem vem em `coleta`.



## OpenAPI

````yaml pages/v2/openapi-entregas.json GET /entregas/programadas/{id}
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
    get:
      summary: Consultar entrega programada
      description: >-
        Permite obter uma única entrega programada através de seu id. O endereço
        de origem vem em `coleta`.
      parameters:
        - name: id
          in: path
          required: true
          description: id da solicitação de entrega
          schema:
            type: integer
      responses:
        '200':
          description: Sucesso
          content:
            application/json:
              example:
                success: true
                data:
                  id_mch_programada: '1587'
                  situacao: D
                  situacao_formatada: Distribuída
                  data_previsao_disparo: 11/12/2025
                  hora_previsao_disparo: '11:44:00'
                  id_mch: '90976'
                  observacao: Retirar no balcão
                  empresa:
                    id: null
                    nome: null
                  categoria:
                    id: '3'
                    nome: Entrega Moto
                  valor:
                    estimado: '12.50'
                    prefixado: null
                  coleta:
                    endereco: Rua da Coleta, 10
                    complemento: Loja 2
                    referencia: Em frente à praça
                    bairro: Centro
                    cidade: João Pessoa
                    estado: PB
                    lat: '-7.115000000'
                    lng: '-34.834000000'
                  paradas:
                    - id: '900'
                      ordem: 0
                      endereco: Rua das Palmeiras, 200
                      complemento: Apto 31
                      referencia: Ao lado do mercado
                      bairro: Centro
                      cidade: João Pessoa
                      uf: PB
                      lat: '-7.209233800'
                      lng: '-34.878063100'
                      numero_pedido: PED-123
                      nome_cliente: Maria Souza
                      telefone_cliente: '+5583999990000'
                      observacao: Entregar na portaria
                    - id: '901'
                      ordem: 1
                      endereco: Avenida Epitácio Pessoa, 1500
                      complemento: null
                      referencia: null
                      bairro: Tambaú
                      cidade: João Pessoa
                      uf: PB
                      lat: '-7.115000000'
                      lng: '-34.834000000'
                      numero_pedido: PED-124
                      nome_cliente: João Lima
                      telefone_cliente: '+5583988887777'
                      observacao: null
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