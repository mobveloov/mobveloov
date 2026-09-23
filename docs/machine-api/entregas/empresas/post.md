> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Cadastrar empresa

> Este endpoint permite o cadastro de empresas.



## OpenAPI

````yaml pages/v2/openapi-entregas.json POST /empresas
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
  /empresas:
    post:
      summary: Cadastrar empresa
      description: Este endpoint permite o cadastro de empresas.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - documento
                - tipo_documento
                - numero_contrato
                - razao_social
                - nome_fantasia
                - endereco
                - telefone
                - situacao_cadastral
                - categorias
                - tipos_pagamento
                - cobrar_retorno
                - obrigar_finalizacao_com_retorno_pela_empresa
                - solicitacao_rapida
              properties:
                documento:
                  type: string
                tipo_documento:
                  type: string
                  enum:
                    - CPF
                    - CNPJ
                numero_contrato:
                  oneOf:
                    - type: integer
                    - type: string
                razao_social:
                  type: string
                nome_fantasia:
                  type: string
                endereco:
                  type: object
                  required:
                    - logradouro
                    - cidade
                    - bairro
                    - cep
                  properties:
                    logradouro:
                      type: string
                    complemento:
                      type: string
                    uf:
                      type: string
                      description: SP, RJ, PB, PE, RN, ...
                    cidade:
                      type: string
                    bairro:
                      type: string
                    cep:
                      oneOf:
                        - type: integer
                        - type: string
                telefone:
                  type: object
                  required:
                    - ddd
                    - numero
                  properties:
                    ddd:
                      oneOf:
                        - type: string
                        - type: integer
                    numero:
                      type: string
                situacao_cadastral:
                  type: string
                  enum:
                    - A
                    - S
                    - G
                  description: A - Ativo, S - Suspenso, G - Aguardando Ativação
                categorias:
                  type: array
                  description: >-
                    Lista de categorias atendidas pela empresa. Limite máximo de
                    1000 itens. Array vazio ([]) indica todas as categorias.
                  maxItems: 1000
                  items:
                    type: integer
                tipos_pagamento:
                  type: array
                  items:
                    type: string
                    enum:
                      - B
                      - C
                      - D
                      - F
                      - H
                      - P
                      - R
                      - X
                  description: >-
                    Array vazio indica todos os tipos. B: Débito (máquina), C:
                    Crédito (máquina), D: Dinheiro, F: Faturado, H: Whatsapp, P:
                    Picpay, R: Carteira de Créditos, X: Pix
                area_atuacao_empresa_id:
                  type: integer
                cobrar_retorno:
                  type: boolean
                obrigar_finalizacao_com_retorno_pela_empresa:
                  type: boolean
                solicitacao_rapida:
                  type: object
                  required:
                    - habilitar
                  properties:
                    habilitar:
                      type: boolean
                    categoria:
                      type: integer
                      description: Obrigatório se habilitar for true
                    tipo_pagamento:
                      type: string
                      description: Obrigatório se habilitar for true
                observacao_condutor:
                  type: string
                dados_extras:
                  type: string
            example:
              documento: 42.129.155/0001-72
              tipo_documento: CNPJ
              numero_contrato: '997104'
              razao_social: Empresa Teste
              nome_fantasia: Teste
              endereco:
                logradouro: Rua 1
                cidade: Barretos
                bairro: Centro
                cep: 14783-215
              telefone:
                ddd: '17'
                numero: '999999999'
              situacao_cadastral: A
              categorias: []
              tipos_pagamento: []
              cobrar_retorno: false
              obrigar_finalizacao_com_retorno_pela_empresa: false
              solicitacao_rapida:
                habilitar: false
      responses:
        '200':
          description: Sucesso
          content:
            application/json:
              example:
                success: true
                data:
                  status: OK
                message: Empresa cadastrada com sucesso.
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