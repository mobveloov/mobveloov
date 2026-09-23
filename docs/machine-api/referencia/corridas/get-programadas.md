> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Listar corridas programadas

> Lista corridas programadas com paginação.



## OpenAPI

````yaml pages/v2/openapi-corridas.json GET /corridas/programadas
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
    get:
      summary: Listar corridas programadas
      description: Lista corridas programadas com paginação.
      parameters:
        - name: limite
          in: query
          description: Quantidade de registros por página.
          schema:
            type: integer
        - name: pagina
          in: query
          description: Página da listagem.
          schema:
            type: integer
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
                  - id_mch_programada: '1393'
                    situacao: C
                    situacao_formatada: Cancelada
                    data_previsao_disparo: 26/01/2021
                    hora_previsao_disparo: '01:50:00'
                    id_mch: null
                    observacao: Passageiro com bagagem
                    nome_passageiro: Rogério Barreto
                    empresa:
                      id: '404'
                      nome: empresa_nome
                    categoria:
                      id: '1'
                      nome: Executivo
                    valor:
                      estimado: '12.50'
                      prefixado: null
                    partida:
                      endereco: Rua da Coleta, 10
                      complemento: Loja 2
                      referencia: Em frente à praça
                      bairro: Centro
                      cidade: João Pessoa
                      estado: PB
                      lat: '-7.115000000'
                      lng: '-34.834000000'
                    desejado:
                      endereco: Rua Quinze de Novembro, 8
                      bairro: Centro
                      cidade: Niterói
                      estado: RJ
                      lat: '-22.896461500'
                      lng: '-43.123927100'
                    paradas:
                      - id: '900'
                        ordem: 0
                        endereco: Avenida Epitácio Pessoa, 1500
                        complemento: null
                        referencia: null
                        bairro: Tambaú
                        cidade: João Pessoa
                        uf: PB
                        lat: '-7.115000000'
                        lng: '-34.834000000'
                  - id_mch_programada: '1392'
                    situacao: D
                    situacao_formatada: Distribuída
                    data_previsao_disparo: 21/01/2021
                    hora_previsao_disparo: '00:55:00'
                    id_mch: '100003594'
                    observacao: null
                    nome_passageiro: Rogério Barreto
                    empresa:
                      id: null
                      nome: null
                    categoria:
                      id: '1'
                      nome: Executivo
                    valor:
                      estimado: '12.50'
                      prefixado: null
                    partida:
                      endereco: Rua da Coleta, 10
                      complemento: Loja 2
                      referencia: Em frente à praça
                      bairro: Centro
                      cidade: João Pessoa
                      estado: PB
                      lat: '-7.115000000'
                      lng: '-34.834000000'
                    desejado:
                      endereco: Rua Quinze de Novembro, 8
                      bairro: Centro
                      cidade: Niterói
                      estado: RJ
                      lat: '-22.896461500'
                      lng: '-43.123927100'
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