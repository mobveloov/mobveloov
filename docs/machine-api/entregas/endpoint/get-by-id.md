> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Consultar entrega

> Ao acionar, retorna uma entrega da central especificada pelo id da solicitação



## OpenAPI

````yaml pages/v2/openapi-entregas.json GET /entregas/{id}
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
  /entregas/{id}:
    get:
      summary: Consultar entrega
      description: >-
        Ao acionar, retorna uma entrega da central especificada pelo id da
        solicitação
      parameters:
        - name: id
          in: path
          required: true
          description: id da solicitação
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
                  - id: '1'
                    data_hora_solicitacao: '2025-02-17 15:03:54'
                    data_hora_chegada_local: null
                    status_solicitacao: 'N'
                    cliente_id: '119459'
                    nome_passageiro: Felipe Teste
                    empresa_id: null
                    bandeira_chamada_id: '8'
                    bandeira_configuracao_id: '8'
                    data_hora_aceite: null
                    data_hora_finalizacao: null
                    data_hora_cancelamento: null
                    data_hora_pendencia: null
                    distancia_coleta_km: null
                    valor_corrida: '0.00'
                    condutor_especificado: false
                    com_retorno: false
                    taxista_id: ''
                    nome_taxista: ''
                    telefone_taxista: ''
                    veiculo: ''
                    placa_veiculo: ''
                    cor_veiculo: null
                    duracao_corrida: '0'
                    distancia_percorrida_km: '0.000'
                    taxas_cancelamento: null
                    paradas: []
                    condutor_id: ''
                    nome_condutor: ''
                    telefone_condutor: ''
                    telefone_condutor_internacional: ''
                    partida:
                      endereco: Rua José Borges, 88
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