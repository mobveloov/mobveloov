> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Introdução

> Base URL, autenticação, códigos de status e limites da API.

## Tipos de Solicitações e Pagamento

As solicitações podem ser feitas de imediato ou programadas para o futuro, cada uma identificada por números diferentes.
Após o disparo de uma solicitação programada, uma nova solicitação é criada no sistema.

<Card title="Formas de Pagamento Suportadas" icon="credit-card" iconType="duotone">
  Todas as solicitações estão associadas a uma forma de pagamento. As opções incluem:

  <div
    style={{
display: "grid",
gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
gap: "12px",
marginTop: "24px"
}}
  >
    {[
            { name: 'Dinheiro', code: 'D' }, { name: 'Débito', code: 'B' }, { name: 'Crédito', code: 'C' },
            { name: 'eTicket', code: 'T' }, { name: 'Voucher', code: 'V' }, { name: 'Pix', code: 'X' },
            { name: 'PicPay', code: 'P' }, { name: 'WhatsApp', code: 'H' }, { name: 'Cartão via app', code: 'A' },
            { name: 'Faturado', code: 'F' }, { name: 'Pix via app', code: 'I' }, { name: 'Carteira de Créditos', code: 'R' }
          ].map(item => (
            <div key={item.code} style={{
              padding: "10px 16px",
              background: "rgba(22, 163, 74, 0.05)",
              borderRadius: "12px",
              fontSize: "14px",
              border: "1px solid rgba(22, 163, 74, 0.15)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <span style={{ fontWeight: "500" }}>{item.name}</span>
              <code style={{ fontSize: "12px", background: "rgba(22, 163, 74, 0.2)", padding: "2px 6px", borderRadius: "4px", color: "#16A34A" }}>{item.code}</code>
            </div>
          ))}
  </div>
</Card>

As solicitações podem ter vários objetivos, dependendo do modelo de negócio e do tipo de cliente:

<CardGroup cols={3}>
  <Card title="Passageiro" icon="user" iconType="duotone">
    Levar uma pessoa para o destino solicitado.
  </Card>

  <Card title="Empresa" icon="briefcase" iconType="duotone">
    Transportar o funcionário de uma organização.
  </Card>

  <Card title="Estabelecimento" icon="hotel" iconType="duotone">
    Levar o hóspede de um hotel para o destino.
  </Card>
</CardGroup>

***

## Agentes das Solicitações e Estimativas

<Card icon="calculator" iconType="duotone">
  Os principais agentes das solicitações são os **condutores** (motoristas, mototaxistas e taxistas).
  Para otimizar seu negócio, é possível criar categorias e associar os condutores a elas, como uma categoria específica para carregar compras.

  Antes da solicitação, o cliente pode obter uma **estimativa de custo**, que é sempre feita por categoria.
  Cada categoria tem suas tarifas definidas pela central.
</Card>

***

## Ciclo de Vida das Solicitações

As solicitações passam por várias etapas e subetapas. Os registros de solicitação não alteram o status da solicitação. Segue a estrutura correta do ciclo:

<div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px" }}>
  {[
      { n: '1', title: 'Distribuindo', code: 'D', desc: 'Solicitação aberta e ainda não atribuída a um condutor.' },
      { n: '2', title: 'Aguardando aceite', code: 'G', desc: 'Esperando um condutor aceitar a solicitação.' },
      { n: '3', title: 'Pendente', code: 'P', desc: 'Solicitação não aceita, aguardando aceitação.' },
      { n: '4', title: 'Não atendida', code: 'N', desc: 'Nenhum condutor aceitou a solicitação.' },
      { n: '5', title: 'Aceita', code: 'A', desc: 'Solicitação aceita por um condutor.', sub: [
        { code: 'A', title: 'Arredores local', desc: 'Condutor próximo ao local de embarque.' },
        { code: 'C', title: 'Cheguei ao local', desc: 'Condutor chegou ao local de embarque.' },
        { code: 'E', title: 'Entrada do passageiro', desc: 'Passageiro entrou no veículo.' },
        { code: 'O', title: 'Partida prolongada', desc: 'Passageiro demorou para embarcar.' },
        { code: 'T', title: 'Alteração de trajeto', desc: 'Passageiro alterou o trajeto.' },
      ]},
      { n: '6', title: 'Em espera', code: 'S', desc: 'Solicitação em espera até a conclusão de uma anterior.' },
      { n: '7', title: 'Em andamento', code: 'E', desc: 'Corrida iniciada.', sub: [
        { code: 'R', title: 'Parada confirmada', desc: 'Parada concluída.' },
        { code: 'S', title: 'Registro saída passageiro', desc: 'Solicitação finalizada pelo condutor.' },
      ]},
      { n: '8', title: 'Finalizada', code: 'F', desc: 'Corrida concluída.' },
      { n: '9', title: 'Cancelada', code: 'C', desc: 'Solicitação cancelada.' },
      { n: '10', title: 'Aguardando pagamento', code: 'R', desc: 'Pagamento pendente de confirmação.' },
    ].map((item) => (
      <div key={item.n} style={{
        padding: "20px 24px",
        background: "rgba(255, 255, 255, 0.02)",
        borderRadius: "16px",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        display: "flex",
        flexDirection: "column",
        gap: "8px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{
            width: "28px", height: "28px", borderRadius: "50%", background: "#16A34A",
            color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "14px", fontWeight: "700"
          }}>
            {item.n}
          </span>
          <span style={{ fontSize: "18px", fontWeight: "600" }}>{item.title}</span>
          <code style={{ fontSize: "12px", background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: "4px" }}>{item.code}</code>
        </div>
        <p style={{ opacity: 0.7, fontSize: "15px", marginLeft: "40px" }}>{item.desc}</p>

        {item.sub && (
          <div style={{ marginLeft: "40px", marginTop: "12px", display: "grid", gap: "8px" }}>
            {item.sub.map((s, idx) => (
              <div key={idx} style={{
                display: "flex", alignItems: "baseline", gap: "10px", padding: "10px 16px",
                background: "rgba(22, 163, 74, 0.03)", borderRadius: "10px", fontSize: "14px",
                border: "1px solid rgba(22, 163, 74, 0.1)"
              }}>
                <span style={{ fontWeight: "700", color: "#16A34A" }}>{String.fromCharCode(97 + idx)}.</span>
                <span style={{ fontWeight: "600" }}>{s.title} ({s.code}):</span>
                <span style={{ opacity: 0.8 }}>{s.desc}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    ))}
</div>

***

## Solicitações Programadas

Solicitações aceitas e canceladas por um condutor antes do início podem ser redistribuídas, ocasionando a repetição de alguns status.
Solicitações programadas seguem um ciclo específico de estados:

<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
  {[
      { name: 'Aguardando', code: 'A', color: '#3b82f6', desc: 'Aguardando horário de disparo.' },
      { name: 'Disparada', code: 'D', color: '#10b981', desc: 'Solicitação programada disparada.' },
      { name: 'Cancelada', code: 'C', color: '#ef4444', desc: 'Solicitação cancelada.' },
      { name: 'Erro', code: 'X', color: '#f59e0b', desc: 'Problema no processo da solicitação.' }
    ].map(status => (
      <div key={status.code} style={{
        padding: "20px",
        background: "rgba(255, 255, 255, 0.02)",
        borderRadius: "16px",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderLeft: `4px solid ${status.color}`,
      }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
          <span style={{ fontWeight: "700", fontSize: "18px" }}>{status.name}</span>
          <code style={{ fontSize: "12px", background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: "4px", whiteSpace: "nowrap", flexShrink: 0 }}>({status.code})</code>
        </div>
        <p style={{ fontSize: "14px", opacity: 0.7, lineHeight: "1.4" }}>{status.desc}</p>
      </div>
    ))}
</div>

***

## Autorização

Toda requisição deve incluir sua chave de API no header `api-key`:

```bash theme={null}
api-key: SUA_CHAVE_API
```

Também é necessário informar as credenciais de `Authorization` do tipo `Basic`:

```bash theme={null}
username: SEU_USERNAME
password: SUA_SENHA
```

Depois isso vira algo como:

```bash theme={null}
Authorization: Basic base64(SEU_USERNAME:SUA_SENHA)
```

No final, o formato da request com os campos de autorização ficam similar a:

```bash theme={null}
curl --request GET \
  --url '<endpoint>' \
  --header 'Authorization: Basic <base64(SEU_USERNAME:SUA_SENHA)>' \
  --header 'api-key: SUA_CHAVE_API'
```

Requisições sem chave ou com chave inválida retornam `400` ou `403`.

***

## Usuário autenticado

O usuário autenticado é a entidade utilizada para realizar as requisições na API da Machine.
Assim como qualquer outro, este possui um cargo e suas permissões.
O usuário autenticado terá acesso às endpoints conforme às permissões concedidas na seção Integração em: `Minha equipe > Usuário > Permissões`.

Há dois logins que permitem acesso às endpoints: login de empresa (quando o usuário é de uma empresa) e o login da central (quando o usuário é da central).
O login também irá limitar alguns acessos, pois usuários de empresa terão acesso apenas às informações associadas a sua empresa.

***

## Padrão da API

Todas as respostas da nossa API são em JSON.

Usamos como retorno os códigos HTTP padrão para indicar tanto o sucesso de uma requisição, quanto para indicar falhas. Os principais retornos são:

* 200: Sucesso.

* 400: Os dados serão validados e, se faltar algum parâmetro obrigatório, será gerado um código de retorno HTTP 400. Outros erros de validação, como erros associados a regra de negócio, serão tratados com códigos de erro específicos e mensagens explicativas.

* 404: Endpoint não encontrado, revise a URL passada.

* 500: Erro interno, contate o nosso suporte.

Caso ocorra algum erro na autenticação básica, um erro padrão de código 1 informando “usuário e/ou senhas inválidas”, será retornado.

Caso a chave API não seja informada, um erro padrão será retornado:

```json theme={null}
{
  "success": false,
  "errors": [
    "Chave da app não informada."
  ]
}
```

***

## Ambientes de integração com a API

Para garantir uma integração eficiente e segura, a API oferece integração com dois ambientes distintos: Homologação (ou Testes) e Produção.

### Ambiente de Homologação (Testes)

* Finalidade: Este ambiente é destinado exclusivamente a testes de integração, desenvolvimento e validação de funcionalidades. Ele permite que você experimente e refine a comunicação com a API sem qualquer risco de afetar as operações reais da central.

* URL de Acesso: [https://api-vendas.taximachine.com.br/api/v2/integracao](https://api-vendas.taximachine.com.br/api/v2/integracao)

* Observação: Todas as ações realizadas neste ambiente são simuladas e não impactarão os dados ou operações da central em produção.

### Ambiente de Produção

* Finalidade: Este é o ambiente principal para atuação real com a central. Após a conclusão bem-sucedida dos seus testes no ambiente de Homologação, você deve migrar para este ambiente para iniciar as operações reais.

* URL de Acesso: [https://api.taximachine.com.br/api/v2/integracao](https://api.taximachine.com.br/api/v2/integracao)

* Observação: Utilize este ambiente somente quando estiver pronto para interagir de fato com a central, pois as ações aqui são reais e permanentes.

***

## Rate limit

O gateway aplica rate limit por janela deslizante de 60 segundos.
Quando a requisição excede o limite de bloqueio, a API retorna `429`.

Os limites são aplicados por `api-key`.
A avaliação segue a prioridade das regras: grupos específicos são avaliados antes dos prefixos mais genéricos (`corridas/*` e, por fim, `/api/v2/integracao/*`).

O limite é contado **por grupo de endpoints**, e não por endpoint isolado: todas as chamadas às rotas de um mesmo grupo somam no mesmo contador. Por exemplo, chamar `/api/v2/integracao/corridas/estimativas`, `/api/v2/integracao/corridas/programadas/estimativas` e `/api/v2/integracao/corridas/empresas` com a mesma chave em menos de um minuto consome 3 requisições do grupo "Estimativas e empresas", e não 1 de cada endpoint.

Os valores da tabela são **limites base**. O limite efetivo de cada grupo é o limite base multiplicado pela **faixa** da central. A faixa é um multiplicador inteiro, a partir de `1`, definido para cada central. Por isso, na coluna Limite, os valores aparecem como `limite base * faixa`. Quando a central não possui faixa definida, vale a faixa `1`.

| Grupo                                     | Paths                                                                                                                                                                                                                                                                                | Limite                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| Estimativas e empresas                    | `/api/v2/integracao/corridas/estimativas`<br />`/api/v2/integracao/corridas/programadas/estimativas`<br />`/api/v2/integracao/corridas/empresas/*`                                                                                                                                   | 1000 \* faixa requisições por minuto |
| Créditos e documentos de condutores       | `/api/v2/integracao/condutores/creditos/recargas`<br />`/api/v2/integracao/condutores/creditos/saques`<br />`/api/v2/integracao/condutores/documentos`<br />`/api/v2/integracao/condutores/requisitos-cadastro/documentos`<br />`/api/v2/integracao/condutores/areas-bloqueio/batch` | 1000 \* faixa requisições por minuto |
| Condutores                                | `/api/v2/integracao/condutores`<br />`/api/v2/integracao/condutores/*`                                                                                                                                                                                                               | 750 \* faixa requisições por minuto  |
| Programadas                               | `/api/v2/integracao/corridas/programadas`<br />`/api/v2/integracao/corridas/programadas/*`                                                                                                                                                                                           | 200 \* faixa requisições por minuto  |
| Crítico                                   | `/api/v2/integracao/corridas`<br />`/api/v2/integracao/corridas/*`                                                                                                                                                                                                                   | 800 \* faixa requisições por minuto  |
| Categorias                                | `/api/v2/integracao/configuracoes/categorias/*`                                                                                                                                                                                                                                      | 200 \* faixa requisições por minuto  |
| Configurações (bandeira)                  | `/api/v2/integracao/configuracoes`                                                                                                                                                                                                                                                   | 200 \* faixa requisições por minuto  |
| Saque automático                          | `/api/v2/integracao/configuracoes/saque-automatico/ativacao`                                                                                                                                                                                                                         | 50 \* faixa requisições por minuto   |
| Dinâmica                                  | `/api/v2/integracao/dinamicas*`                                                                                                                                                                                                                                                      | 200 \* faixa requisições por minuto  |
| Notificações (in-app e push)              | `/api/v2/integracao/notificacoes/in-app-messaging`<br />`/api/v2/integracao/notificacoes/push`                                                                                                                                                                                       | 230 \* faixa requisições por minuto  |
| In-app messaging (individual)             | `/api/v2/integracao/notificacoes/in-app-messaging/individual`                                                                                                                                                                                                                        | 900 \* faixa requisições por minuto  |
| Push (individual)                         | `/api/v2/integracao/notificacoes/push/individual`                                                                                                                                                                                                                                    | 1100 \* faixa requisições por minuto |
| Notificações de condutor (in-app e push)  | `/api/v2/integracao/notificacoes/condutor/in-app-messaging`<br />`/api/v2/integracao/notificacoes/condutor/push`                                                                                                                                                                     | 100 \* faixa requisições por minuto  |
| In-app messaging de condutor (individual) | `/api/v2/integracao/notificacoes/condutor/in-app-messaging/individual`                                                                                                                                                                                                               | 200 \* faixa requisições por minuto  |
| Push de condutor (individual)             | `/api/v2/integracao/notificacoes/condutor/push/individual`                                                                                                                                                                                                                           | 200 \* faixa requisições por minuto  |
| Cupons                                    | `/api/v2/integracao/cupons`                                                                                                                                                                                                                                                          | 60 \* faixa requisições por minuto   |
| Webhooks                                  | `/api/v2/integracao/webhooks`<br />`/api/v2/integracao/webhooks/*`                                                                                                                                                                                                                   | 60 \* faixa requisições por minuto   |
| Padrão                                    | `/api/v2/integracao/*`                                                                                                                                                                                                                                                               | 1000 \* faixa requisições por minuto |

### Limites por recurso

Alguns endpoints têm, além do limite do grupo, um limite **por recurso informado na requisição**: a mesma `api-key` só pode operar o mesmo recurso, identificado na requisição, um número fixo de vezes por minuto. Esses limites são fixos e não são multiplicados pela faixa.

| Recurso                                | Paths                                                                                                                                                                                                                    | Identificador                            | Limite                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- | ------------------------------------------------------ |
| Créditos de condutor (recarga e saque) | `/api/v2/integracao/condutores/creditos/recargas`<br />`/api/v2/integracao/condutores/creditos/saques`                                                                                                                   | `condutor.identificacao` no body         | 5 por minuto por condutor                              |
| Saldo e documentos de condutor         | `/api/v2/integracao/condutores/creditos/saldo`<br />`/api/v2/integracao/condutores/documentos`<br />`/api/v2/integracao/condutores/requisitos-cadastro/documentos`                                                       | `identificacao` na query string          | 12 por minuto por condutor                             |
| Notificações a passageiro              | `/api/v2/integracao/notificacoes/in-app-messaging`<br />`/api/v2/integracao/notificacoes/push`<br />`/api/v2/integracao/notificacoes/in-app-messaging/individual`<br />`/api/v2/integracao/notificacoes/push/individual` | `passageiros` ou `passageiro_id` no body | 4 por minuto por passageiro ou conjunto de passageiros |
| Criação de cupom                       | `/api/v2/integracao/cupons`                                                                                                                                                                                              | `gerador_cupom_id` no body (`POST`)      | 20 por minuto por gerador                              |

Nas notificações, o envio individual conta por `passageiro_id`, e no envio em lote o conjunto de passageiros informado em `passageiros` é tratado como um único recurso: o mesmo conjunto só pode receber 4 envios por minuto. Lotes com mais de 100 passageiros contam apenas no limite do grupo.

Requisições sem identificador (por exemplo, listagens por filtro) contam apenas no limite do grupo. Os limites valem ao mesmo tempo: exceder qualquer um deles retorna `429`. O contador por recurso é separado para cada `api-key`, então o consumo de um integrador não afeta o de outro.

### Headers de rate limit

Nas respostas dos endpoints com limite de bloqueio configurado, o gateway informa o consumo da janela atual. Use esses headers para se auto-regular antes de receber `429`.

| Header                  | Descrição                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| `X-RateLimit-Limit`     | Limite efetivo do grupo na janela (limite base \* faixa).                                                  |
| `X-RateLimit-Remaining` | Requisições ainda disponíveis na janela atual. Vale `0` na resposta `429`.                                 |
| `X-Total-Period`        | Duração da janela em segundos (hoje sempre `60`). A taxa permitida é `X-RateLimit-Limit / X-Total-Period`. |

Quando mais de um limite de bloqueio se aplica à requisição (por exemplo, o do grupo e um limite por recurso), os headers refletem o mais restritivo (o de menor saldo).

Não existe header de reset: como a contagem usa janela deslizante, não há um instante único de zeragem do contador. Na resposta `429`, o tempo de espera continua sendo indicado pelo header `Retry-After`, em segundos.

***

## Paginação

Alguns endpoints de listagem retornam todos os registros disponíveis. Porém, alguns possuem paginação,
controlável pelos parâmetros `limite` e `página`:

* `limite`: número de registros por página (default 20, máximo 100)
* `página`: página atual (default 1)

Exemplo:

```
/endpoints?limite=10&página=2
```
