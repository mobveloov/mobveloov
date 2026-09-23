> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Sobre

> Entenda o funcionamento, payloads e campos dos Webhooks da plataforma Machine.

Um webhook é uma forma de recebimento de informações quando ocorre um dado evento. Neste caso, quando uma solicitação sofrer uma alteração do seu estado, a Machine irá acionar uma URL informada pela central com determinadas informações sobre a solicitação que sofreu a mudança.

O nosso webhook do tipo status envia eventos nos seguintes momentos: quando uma solicitação muda de status, quando o condutor sinaliza que chegou ao local e quando uma parada é confirmada. As informações enviadas vão variar conforme o estado da solicitação. Por exemplo, enquanto a solicitação não foi aceita, nenhum dado associado ao aceite será enviado, entretanto, quando ela for aceita, as informações associadas ao aceite serão enviadas.

O nosso webhook do tipo posição envia, em lote e a cada 10 segundos, a posição dos condutores que estão com solicitações aceitas (`A`), em andamento (`E`) ou em espera (`S`).

> ℹ️ **Limite de cadastro**: é possível cadastrar até 5 webhooks por tipo. O webhook do tipo mensagem é limitado a 1 cadastro.

> ⚠️ **Atenção**: Os antigos formatos dos Webhooks de Status e Posição serão deprecados. A central deve cadastrar novamente os webhooks para utilizar os novos formatos.

***

# (Novo) Webhook de Posição

O **Webhook de Posição** envia a posição dos condutores que estão com solicitações em espera (`S`), em andamento (`E`) ou aceitas (`A`). O envio é feito **em lote**: a cada 10 segundos a Machine agrupa a posição mais recente de cada condutor e faz uma requisição `POST` na URL cadastrada.

## Exemplo do Payload

```json theme={null}
{
 "event_id": "01a01e79-080c-7d22-bdf6-432b1ba40c44",
 "datetime": "2026-08-10T17:00:00Z",
 "data": [
  {
   "timestamp": 1786381200000,
   "company_id": 8,
   "request_id": 12345,
   "driver_id": 8101,
   "coordinates": {
    "latitude": -22.906847,
    "longitude": -43.172896
   }
  }
 ]
}
```

## Campos do envelope

| Campo      | Formato        | Requerido | Descrição                                                              |
| :--------- | :------------- | :-------- | :--------------------------------------------------------------------- |
| `event_id` | UUID           | SIM       | Identificação única do lote (idempotência). Cada requisição tem o seu. |
| `datetime` | ISO-8601 (UTC) | SIM       | Data e hora em que o lote foi montado pela Machine.                    |
| `data`     | Array          | SIM       | Lista de posições do lote. No máximo 500 por requisição.               |

## Campos de cada item de `data`

| Campo                   | Formato        | Requerido | Descrição                                                                                           |
| :---------------------- | :------------- | :-------- | :-------------------------------------------------------------------------------------------------- |
| `timestamp`             | INT (epoch ms) | SIM       | Data e hora em que a posição foi gerada pelo condutor, em milissegundos desde 1970-01-01 UTC.       |
| `company_id`            | INT            | SIM       | Identificador da central.                                                                           |
| `request_id`            | INT            | SIM       | Identificador da solicitação.                                                                       |
| `driver_id`             | INT            | SIM       | Identificador do condutor na plataforma Machine.                                                    |
| `coordinates`           | Object         | SIM       | Coordenada do condutor. As duas chaves vêm sempre juntas.                                           |
| `coordinates.latitude`  | DECIMAL        | SIM       | Latitude do condutor, com 6 casas decimais.                                                         |
| `coordinates.longitude` | DECIMAL        | SIM       | Longitude do condutor, com 6 casas decimais.                                                        |
| `enterprise_id`         | INT            | NÃO       | Identificador da empresa. Enviado apenas quando o webhook é cadastrado com o responsável `empresa`. |

## As duas datas do payload

O payload carrega dois relógios diferentes:

* `datetime` (envelope) -> quando a Machine montou e enviou o lote.
* `timestamp` (item) -> quando a posição foi gerada pelo condutor. É o campo a usar para ordenar posições e calcular a idade da leitura.

## Variação conforme o responsável do webhook

| Responsável cadastrado | Efeito no payload                         |
| :--------------------- | :---------------------------------------- |
| `solicitante`          | `company_id` é a central de configuração. |
| `corrida`              | `company_id` é a central da corrida.      |
| `empresa`              | acrescenta o campo `enterprise_id`.       |

## Como consumir

* **Deduplique por `event_id`.** Uma janela com mais de 500 posições é dividida em várias requisições, cada uma com o seu próprio `event_id` e o mesmo `datetime`.
* **Um item por condutor e solicitação por janela.** Dentro dos 10 segundos, só a posição mais recente de cada par condutor/solicitação é enviada. Um condutor com duas solicitações ativas gera dois itens.
* **Não há reenvio.** Se a sua URL responder erro ou não responder, o lote não é reentregue — a janela seguinte já traz uma posição mais nova.
* **Posições antigas não são entregues.** Uma leitura com mais de 15 segundos é descartada, para que você nunca receba uma posição que já não representa o condutor.
* **Trate campos desconhecidos com tolerância.** Campos novos podem ser acrescentados ao item sem aviso.

***

# (Novo) Webhook de Status

O **Webhook de Status** é acionado sempre que uma solicitação passa por uma **mudança de estado** (ex.: aceita, em andamento, finalizada, cancelada), quando o condutor indica chegada ao local ou quando uma parada é confirmada.

## Exemplo do Payload

```json theme={null}
{
 "datetime": "2025-08-29T13:20:05Z",
 "event_id": "550e8400-e29b-41d4-a716-446655440000",
 "company_id": 8,
 "request_id": 12345,
 "status_code": "A",
 "status_label": "ACEITA",
 "stop_id": 567,
 "links": {
   "request": "https://api.taximachine.com.br/api/v1/request/12345",
   "driver": "https://api.taximachine.com.br/api/integracao/condutor?id=321",
   "enterprise": "https://api.taximachine.com.br/api/integracao/empresa?empresa_id=987"
 }
}
```

## Exemplo de apresentação do `status_label`

#### Enum de Status

| Código (`status_code`) | Label (`status_label`) | Descrição                                     |
| :--------------------- | :--------------------- | :-------------------------------------------- |
| `AP`                   | `ARRIVED_AT_LOCATION`  | Condutor chegou ao local                      |
| `ER`                   | `STOP_FINISHED`        | Parada finalizada                             |
| `L`                    | `WAITING_RELEASE`      | Aguardando liberação                          |
| `R`                    | `WAITING_PAYMENT`      | Aguardando pagamento                          |
| `D`                    | `DISTRIBUTING`         | Distribuindo                                  |
| `G`                    | `WAITING_ACCEPTANCE`   | Aguardando aceite                             |
| `P`                    | `PENDING`              | Pendente                                      |
| `S`                    | `ON_HOLD`              | Solicitação em espera                         |
| `N`                    | `NOT_SERVED`           | Solicitação não atendida ou buscando condutor |
| `A`                    | `ACCEPTED`             | Solicitação aceita                            |
| `E`                    | `IN_PROGRESS`          | Solicitação em andamento                      |
| `C`                    | `CANCELLED`            | Solicitação cancelada                         |
| `F`                    | `FINISHED`             | Solicitação finalizada                        |
| `U`                    | `GROUPED`              | Solicitação agrupada em andamento             |

#### Como usar

* `status_code`: valor curto do status
* `status_label`: valor descritivo do status
* **Extensibilidade**: se a Machine adicionar novos status no futuro, basta incluir novos pares para `codes/label`

## Campos

| Campo          | Formato    | Requerido | Descrição                                                                                                  |
| :------------- | :--------- | :-------- | :--------------------------------------------------------------------------------------------------------- |
| `datetime`     | ISO-8601   | SIM       | Data e hora do evento gerado pela Machine.                                                                 |
| `event_id`     | UUID       | SIM       | Identificação única do evento (idempotência).                                                              |
| `company_id`   | INT        | SIM       | Identificador da central                                                                                   |
| `request_id`   | INT        | SIM       | Identificador da solicitação                                                                               |
| `status_code`  | VARCHAR(2) | SIM       | Código do status                                                                                           |
| `status_label` | ENUM       | SIM       | Status descritivo                                                                                          |
| `stop_id`      | INT        | NÃO       | Identificador da parada (preenchido apenas no status `STOP_FINISHED`)                                      |
| `links`        | Object     | SIM       | URLs relacionadas ao evento. Inclui sempre `request` e pode incluir `enterprise` e `driver` (se aplicável) |

### Links no Payload

* `links.request` -> acesso aos detalhes da solicitação
* `links.enterprise` -> (opcional) referência à empresa
* `links.driver` -> (opcional) referência ao condutor

***

# Webhook de Mensagens

O **Webhook de Mensagens** é acionado sempre que ocorre o recebimento de mensagens relacionadas a uma central. Ele possibilita à central receber as mensagens enviadas pelo **condutor** e **empresa**, garantindo histórico e rastreabilidade da comunicação.

## Exemplo do Payload

```json theme={null}
{
 "company_id": 8,
 "content": "me aguarde",
 "datetime": "2025-08-29T14:01:36Z",
 "event_id": "0198f622-400f-7137-a03d-142dd9c2298a",
 "message_id": 24148,
 "sender_id": 8101,
 "sequence": 1,
 "type_code": "DRIVER",
 "type_label": "P",
 "links": {
   "sender": "https://api.taximachine.com.br/api/integracao/condutor?id=8101"
 }
}
```

## Campos

| Campo        | Formato  | Requerido | Descrição                                                                               |
| :----------- | :------- | :-------- | :-------------------------------------------------------------------------------------- |
| `datetime`   | ISO-8601 | SIM       | Data e hora do evento gerado pela Machine.                                              |
| `event_id`   | UUID     | SIM       | Identificação única do evento (idempotência).                                           |
| `company_id` | INT      | SIM       | Identificador da central                                                                |
| `message_id` | INT      | SIM       | Identificador da mensagem                                                               |
| `sender_id`  | INT      | SIM       | Identificador do remetente (condutor, empresa)                                          |
| `sequence`   | INT      | SIM       | Número sequencial da mensagem no contexto da solicitação                                |
| `type_code`  | ENUM     | SIM       | Origem da mensagem ( `DRIVER`, `ENTERPRISE`)                                            |
| `type_label` | String   | SIM       | Indicação adicional do tipo de mensagem (pode variar por contexto)                      |
| `content`    | String   | SIM       | Conteúdo textual da mensagem                                                            |
| `links`      | Object   | SIM       | URLs relacionadas ao evento. Inclui, por exemplo, a referência ao remetente ( `sender`) |

### Enum `type_label`

| Code | Label        | Descrição             |
| :--- | :----------- | :-------------------- |
| `P`  | `DRIVER`     | Chat do tipo condutor |
| `E`  | `ENTERPRISE` | Chat do tipo empresa  |

***

# (DEPRECADO) Webhook de Posição

O webhook de posição realiza o envio de posição de condutores, a cada 15s, que estão com solicitações em espera (S), em andamento (E) ou aceitas (A). Caso a central configuração e de corrida sejam a mesma, a central receberá o evento do webhook apenas uma vez.

| Campo         | Formato              | Descrição                                   |
| :------------ | :------------------- | :------------------------------------------ |
| `id_mch`      | String (Obrigatório) | Identificação da corrida no Sistema Machine |
| `condutor_id` | String               | Identificação do condutor                   |
| `lat_cond`    | String (Obrigatório) | Latitude do condutor                        |
| `lng_cond`    | String (Obrigatório) | Longitude do condutor                       |

***

# (DEPRECADO) Webhook de Mudança de Status

Um webhook é uma forma de recebimento de informações quando ocorre um dado evento. Neste caso, quando uma corrida sofrer uma alteração do seu estado, quando uma parada for confirmada ou quando o condutor indicar que chegou ao local, a Machine irá acionar uma URL informada pela central com determinadas informações. Este é um mecanismo prático para receber dados da Machine. Caso a central configuração e de corrida sejam a mesma, a central receberá o evento do webhook apenas uma vez.

| Campo                   | Formato                | Descrição                                                               |
| :---------------------- | :--------------------- | :---------------------------------------------------------------------- |
| `id_mch`                | String (Obrigatório)   | Identificação da solicitação no Sistema Machine                         |
| `id_externo`            | String                 | Identificação da solicitação pela central                               |
| `status_solicitacao`    | String (Obrigatório)   | Status da solicitação.                                                  |
| `data_hora_solicitacao` | Datetime (Obrigatório) | Data e hora de abertura da solicitação                                  |
| `chave_trajeto`         | String (Obrigatório)   | Chave para acesso a consulta aos trajetos                               |
| `usuario`               | String                 | Nome do usuário de abertura da solicitação                              |
| `condutor`              |                        | (Bloco opcional) - usado apenas quando o condutor atender a solicitação |
| `id`                    | Integer (Obrigatório)  | Identificação do condutor na plataforma machine                         |
| `nome`                  | String (Obrigatório)   | Nome do condutor                                                        |
| `vtr`                   | String (Obrigatório)   | Número da viatura no cadastro do condutor                               |
| `telefone`              | String (Obrigatório)   | Telefone do cadastro do condutor                                        |
| `cpf`                   | String (Obrigatório)   | CPF do condutor                                                         |
| `modelo`                | String (Obrigatório)   | Modelo do veículo                                                       |
| `placa`                 | String (Obrigatório)   | Placa do veículo                                                        |
| `empresa`               |                        | (Bloco opcional) - usado para solicitação em eTicket ou Voucher         |
| `nome`                  | String (Obrigatório)   | Nome da empresa                                                         |
| `centro_custo`          | String                 | Nome do centro de custo                                                 |
| `serie_voucher`         | String (Obrigatório)   | Série do voucher                                                        |
| `numero_voucher`        | String (Obrigatório)   | Número do voucher                                                       |
| `status_ticket`         | String (Obrigatório)   | Status de autorização do eTicket.                                       |
| `numero_autorizacao`    | Number (Obrigatório)   | Número de autorização                                                   |
| `data_hora_autorizacao` | Datetime (Obrigatório) | Data e hora da autorização                                              |
| `tipo_finalizacao`      | String (Obrigatório)   | Tipo de finalização do eTicket                                          |
| `andamento`             |                        | (Bloco opcional) - usado para andamento da solicitação                  |

***

# Assinatura de validação do Webhook

A assinatura de validação do webhook tem como objetivo garantir a integridade e a autenticação da mensagem.

Os campos de assinatura, contidos no HEADER, seguem o padrão HMAC-SHA-512.

O campo `Signature-V2` é composto pelos elementos enviados no webhook, a função de hash SHA-512 e a chave da API.

No webhook de posição, a `Signature-V2` é calculada sobre o corpo inteiro da requisição — o envelope com o array `data` —, e não sobre cada posição.

É importante observar que o campo `Signature` está atualmente obsoleto, sendo substituído pelo `Signature-V2`; no entanto, ele é construído com base nos dados recebidos no webhook, a função de hash SHA-512 e a chave privada previamente informada.

```http theme={null}
Content-Type: application/json
Signature-V2: 17d3170aa2271f8ce1151f730cfea1660359f073e99bc96c2320a49a23bf0700225017c3135693eb7bd1ba9aa06ada60924fdf38f2856bd3ef3aca169f89988a
@deprecated Signature: 17d3170aa2271f8ce1151f730cfea1660359f073e99bc96c2320a49a23bf0700225017c3135693eb7bd1ba9aa06ada60924fdf38f2856bd3ef3aca169f89988a
```
