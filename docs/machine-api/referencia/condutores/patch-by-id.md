> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Atualizar condutor parcialmente

> Atualiza parcialmente os dados do condutor. Envie apenas o ID e os campos que deseja alterar.



## OpenAPI

````yaml pages/v2/openapi-corridas.json PATCH /condutores/{id}
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
  /condutores/{id}:
    patch:
      summary: Atualizar condutor parcialmente
      description: >-
        Atualiza parcialmente os dados do condutor. Envie apenas o ID e os
        campos que deseja alterar.
      parameters:
        - name: id
          in: path
          required: true
          description: Identificador numérico do condutor.
          schema:
            type: integer
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                nome:
                  type: string
                  description: Nome do condutor.
                sexo:
                  type: string
                  description: Sexo do condutor.
                data_nascimento:
                  type: string
                  description: Data de nascimento do condutor.
                email:
                  type: string
                  description: E-mail do condutor.
                telefone:
                  type: string
                  description: Telefone do condutor.
                status_condutor:
                  type: string
                  description: Status do condutor.
                endereco:
                  type: string
                  description: Logradouro do condutor.
                numero_endereco:
                  oneOf:
                    - type: integer
                    - type: string
                  description: Número do endereço do condutor.
                complemento:
                  type: string
                  description: Complemento do endereço.
                bairro:
                  type: string
                  description: Bairro do condutor.
                cpf:
                  type: string
                  description: CPF do condutor, com ou sem máscara.
                cnpj:
                  type: string
                  description: CNPJ do condutor, com ou sem máscara.
                possui_vinculo:
                  type: boolean
                  description: Indica se o condutor possui vínculo.
                vinculo:
                  type: string
                  description: Tipo de vínculo.
                veiculo_tipo:
                  type: string
                  description: Tipo do veículo do condutor.
                placa:
                  type: string
                  description: Placa do veículo.
                modelo:
                  type: string
                  description: Modelo do veículo.
                ano_modelo:
                  type: integer
                  description: Ano do modelo do veículo.
                cor:
                  type: string
                  description: Cor do veículo.
                porta_malas_grande:
                  type: boolean
                  description: Indica se o veículo possui porta-malas grande.
                adaptado_cadeirante:
                  type: boolean
                  description: Indica se o veículo é adaptado para cadeirante.
                numero_viatura:
                  type: integer
                  description: Número da viatura.
                categorias:
                  type: array
                  description: >-
                    Lista de categorias atendidas pelo condutor. Limite máximo
                    de 1000 itens.
                  maxItems: 1000
                  items:
                    type: integer
                pagamentos:
                  type: array
                  description: Lista de tipos de pagamento aceitos.
                  items:
                    type: string
                exigencia:
                  type: object
                  description: Bloco de exigências operacionais do condutor.
                  properties:
                    veiculo_a_disposicao:
                      type: boolean
                    aceita_encomendas:
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
                informacoes_adicionais:
                  type: string
                  description: Informações adicionais do condutor.
                observacao_interna_1:
                  type: string
                  description: Observação interna 1.
                observacao_interna_2:
                  type: string
                  description: Observação interna 2.
                observacao_interna_3:
                  type: string
                  description: Observação interna 3.
            example:
              nome: Lara Silva
              telefone: (21) 99876-5432
              status_condutor: A
              pagamentos:
                - B
                - X
              observacao_interna_1: Documentação revisada
      responses:
        '200':
          description: Condutor atualizado com sucesso
          content:
            application/json:
              example:
                success: true
                message: Condutor atualizado com sucesso
        '404':
          description: Condutor não encontrado
          content:
            application/json:
              example:
                success: false
                errors:
                  - code: 56
                    message: Condutor não encontrado.
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