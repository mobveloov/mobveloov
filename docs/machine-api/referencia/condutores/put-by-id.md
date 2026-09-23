> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Atualizar condutor completo

> Atualiza completamente os dados do condutor. Todos os campos do corpo são obrigatórios, com exceção da regra entre `cpf` e `cnpj`: é obrigatório enviar pelo menos um dos dois.



## OpenAPI

````yaml pages/v2/openapi-corridas.json PUT /condutores/{id}
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
    put:
      summary: Atualizar condutor completo
      description: >-
        Atualiza completamente os dados do condutor. Todos os campos do corpo
        são obrigatórios, com exceção da regra entre `cpf` e `cnpj`: é
        obrigatório enviar pelo menos um dos dois.
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
              required:
                - nome
                - sexo
                - data_nascimento
                - email
                - telefone
                - status_condutor
                - endereco
                - numero_endereco
                - complemento
                - cep
                - bairro
                - possui_vinculo
                - vinculo
                - veiculo_tipo
                - placa
                - modelo
                - ano_modelo
                - cor
                - porta_malas_grande
                - adaptado_cadeirante
                - numero_viatura
                - categorias
                - pagamentos
                - exigencia
                - informacoes_adicionais
                - observacao_interna_1
                - observacao_interna_2
                - observacao_interna_3
              properties:
                nome:
                  type: string
                sexo:
                  type: string
                data_nascimento:
                  type: string
                email:
                  type: string
                telefone:
                  type: string
                status_condutor:
                  type: string
                endereco:
                  type: string
                numero_endereco:
                  oneOf:
                    - type: integer
                    - type: string
                complemento:
                  type: string
                cep:
                  type: string
                bairro:
                  type: string
                cpf:
                  type: string
                  description: Obrigatório se `cnpj` não for enviado.
                cnpj:
                  type: string
                  description: Obrigatório se `cpf` não for enviado.
                possui_vinculo:
                  type: boolean
                vinculo:
                  type: string
                veiculo_tipo:
                  type: string
                placa:
                  type: string
                modelo:
                  type: string
                ano_modelo:
                  type: integer
                cor:
                  type: string
                porta_malas_grande:
                  type: boolean
                adaptado_cadeirante:
                  type: boolean
                numero_viatura:
                  type: integer
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
                  items:
                    type: string
                exigencia:
                  type: object
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
                observacao_interna_1:
                  type: string
                observacao_interna_2:
                  type: string
                observacao_interna_3:
                  type: string
            example:
              nome: Lara Silva
              sexo: F
              data_nascimento: '1990-04-18'
              email: lara@exemplo.com
              telefone: (21) 99876-5432
              status_condutor: A
              endereco: Rua Exemplo
              numero_endereco: '123'
              complemento: Apto 45
              cep: 20000-000
              bairro: Centro
              cpf: 123.456.789-09
              possui_vinculo: true
              vinculo: permissionario
              veiculo_tipo: carro
              placa: ABC1D23
              modelo: Sedan
              ano_modelo: 2023
              cor: Branco
              porta_malas_grande: true
              adaptado_cadeirante: false
              numero_viatura: 202
              categorias:
                - 1
                - 2
              pagamentos:
                - D
                - B
                - X
              exigencia:
                veiculo_a_disposicao: false
                aceita_encomendas: true
                filtro_1: false
                filtro_2: false
                filtro_3: false
                filtro_4: false
                filtro_5: false
                filtro_6: false
              informacoes_adicionais: Disponível para corridas corporativas
              observacao_interna_1: Cadastro atualizado
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