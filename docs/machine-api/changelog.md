> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Corridas

> Histórico de alterações e novidades da API de Corridas v2

export const Entry = ({date, label, labelColor = "#16A34A", children}) => <div style={{
  display: "flex",
  gap: "32px",
  marginBottom: "56px",
  position: "relative"
}}>
    <div style={{
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  minWidth: "140px",
  paddingTop: "4px"
}}>
      <div style={{
  fontSize: "13px",
  fontWeight: "600",
  color: "var(--tw-prose-body)",
  opacity: 0.55,
  whiteSpace: "nowrap",
  letterSpacing: "0.02em"
}}>{date}</div>
      {label && <div style={{
  marginTop: "8px",
  padding: "3px 10px",
  borderRadius: "20px",
  background: `${labelColor}22`,
  border: `1px solid ${labelColor}55`,
  color: labelColor,
  fontSize: "11px",
  fontWeight: "700",
  letterSpacing: "0.06em",
  textTransform: "uppercase"
}}>{label}</div>}
    </div>

    <div style={{
  width: "2px",
  background: "rgba(22, 163, 74, 0.15)",
  borderRadius: "2px",
  flexShrink: 0,
  position: "relative"
}}>
      <div style={{
  position: "absolute",
  top: "6px",
  left: "50%",
  transform: "translateX(-50%)",
  width: "10px",
  height: "10px",
  borderRadius: "50%",
  background: "#16A34A",
  border: "2px solid var(--tw-prose-bg, #fff)",
  boxShadow: "0 0 0 2px #16A34A44"
}} />
    </div>

    <div style={{
  flex: 1,
  paddingBottom: "8px"
}}>
      {children}
    </div>
  </div>;

export const ChangeSection = ({type, children}) => {
  const config = {
    added: {
      label: "Adicionado",
      bg: "#16A34A14",
      border: "#16A34A44",
      dot: "#16A34A"
    },
    changed: {
      label: "Alterado",
      bg: "#f59e0b14",
      border: "#f59e0b44",
      dot: "#f59e0b"
    },
    fixed: {
      label: "Corrigido",
      bg: "#3b82f614",
      border: "#3b82f644",
      dot: "#3b82f6"
    },
    removed: {
      label: "Removido",
      bg: "#ef444414",
      border: "#ef444444",
      dot: "#ef4444"
    }
  };
  const c = config[type] ?? config.added;
  return <div style={{
    marginBottom: "16px",
    padding: "16px 20px",
    borderRadius: "12px",
    background: c.bg,
    border: `1px solid ${c.border}`
  }}>
      <div style={{
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "10px"
  }}>
        <div style={{
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: c.dot,
    flexShrink: 0
  }} />
        <span style={{
    fontSize: "12px",
    fontWeight: "700",
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    color: c.dot
  }}>{c.label}</span>
      </div>
      <div style={{
    fontSize: "14px",
    lineHeight: "1.65"
  }}>
        {children}
      </div>
    </div>;
};

export const ParamBadge = ({name}) => <code style={{
  background: "rgba(22, 163, 74, 0.12)",
  border: "1px solid rgba(22, 163, 74, 0.25)",
  color: "#16A34A",
  borderRadius: "6px",
  padding: "1px 6px",
  fontSize: "13px",
  fontWeight: "600"
}}>{name}</code>;

export const EndpointBadge = ({method, path, href}) => <a href={href} style={{
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "8px",
  padding: "6px 12px",
  marginBottom: "16px",
  fontFamily: "monospace",
  fontSize: "13px",
  textDecoration: "none",
  cursor: href ? "pointer" : "default",
  transition: "border-color 0.15s, background 0.15s"
}} onMouseEnter={e => {
  if (href) {
    e.currentTarget.style.borderColor = "rgba(22,163,74,0.5)";
    e.currentTarget.style.background = "rgba(22,163,74,0.06)";
  }
}} onMouseLeave={e => {
  e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
  e.currentTarget.style.background = "rgba(255,255,255,0.04)";
}}>
    <span style={{
  background: method === "GET" ? "#3b82f6" : method === "POST" ? "#16A34A" : method === "DELETE" ? "#ef4444" : method === "PUT" ? "#f59e0b" : method === "PATCH" ? "#8b5cf6" : "#6b7280",
  color: "#fff",
  borderRadius: "4px",
  padding: "1px 7px",
  fontWeight: "700",
  fontSize: "11px",
  letterSpacing: "0.05em"
}}>{method}</span>
    <span style={{
  opacity: 0.8
}}>{path}</span>
  </a>;

<div style={{ maxWidth: "860px", margin: "0 auto", padding: "40px 20px 80px" }}>
  <div style={{ marginBottom: "56px" }}>
    <div style={{ fontSize: "40px", fontWeight: "800", marginBottom: "12px", letterSpacing: "-0.02em" }}>Corridas</div>

    <p style={{ fontSize: "17px", opacity: 0.65, lineHeight: "1.6" }}>
      Acompanhe todas as novidades, melhorias e alterações nos endpoints de Corridas da API v2.
    </p>
  </div>

  <Entry date="22 set 2026" label="Melhoria" labelColor="#16A34A">
    <h2 id="valor-original-corrida" style={{ fontSize: "22px", fontWeight: "700", marginBottom: "6px", marginTop: 0 }}>
      Valor da corrida antes do desconto do cupom
    </h2>

    <p style={{ fontSize: "15px", opacity: 0.7, marginBottom: "20px", lineHeight: "1.6" }}>
      A consulta e o recibo da corrida passaram a informar também o valor bruto, antes do desconto
      do cupom, ao lado do valor já líquido que era retornado. Sem cupom aplicado, os dois valores
      são iguais.
    </p>

    <EndpointBadge method="GET" path="/api/v2/integracao/corridas/{id}" href="/pages/v2/referencia/corridas/endpoint/get-by-id" />

    <ChangeSection type="added">
      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li><ParamBadge name="valor_corrida_integral" /> — valor bruto da corrida, antes do desconto do cupom. O campo <ParamBadge name="valor_corrida" /> continua trazendo o valor já líquido.</li>
      </ul>
    </ChangeSection>

    <div style={{ marginTop: "24px" }}>
      <EndpointBadge method="POST" path="/api/v2/integracao/corridas/consultar" href="/pages/v2/referencia/corridas/endpoint/post-consultar" />

      <ChangeSection type="added">
        <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <li><ParamBadge name="valor_corrida_integral" /> — mesmo campo, em cada corrida da lista retornada.</li>
        </ul>
      </ChangeSection>
    </div>

    <div style={{ marginTop: "24px" }}>
      <EndpointBadge method="GET" path="/api/v2/integracao/corridas/{id}/recibo" href="/pages/v2/referencia/corridas/endpoint/get-recibo" />

      <ChangeSection type="added">
        <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <li><ParamBadge name="valor_original" /> — dentro de <ParamBadge name="dados_solicitacao" />, traz o valor bruto da corrida, antes do desconto do cupom. O campo <ParamBadge name="valor" /> continua trazendo o valor já líquido.</li>
        </ul>
      </ChangeSection>
    </div>
  </Entry>

  <Entry date="22 set 2026" label="Novo" labelColor="#3b82f6">
    <h2 id="cupons-disponiveis-cliente" style={{ fontSize: "22px", fontWeight: "700", marginBottom: "6px", marginTop: 0 }}>
      Cupons disponíveis do cliente
    </h2>

    <p style={{ fontSize: "15px", opacity: 0.7, marginBottom: "20px", lineHeight: "1.6" }}>
      Novo endpoint para consultar os cupons que um cliente pode aplicar em uma corrida — a mesma
      vitrine exibida no aplicativo do passageiro, agora disponível para a integração.
    </p>

    <EndpointBadge method="GET" path="/api/v2/integracao/cupons/cliente/{cliente_id}/disponiveis" href="/pages/v2/referencia/cupons/endpoint/get-cliente-disponiveis" />

    <ChangeSection type="added">
      <p style={{ marginBottom: "10px" }}>Parâmetros aceitos:</p>

      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li><ParamBadge name="cliente_id" /> — obrigatório, na URL. Identificador interno do cliente, que precisa pertencer à bandeira da chave de API.</li>
        <li><ParamBadge name="lat_partida" /> e <ParamBadge name="lng_partida" /> — opcionais. Coordenadas do local de partida, usadas para avaliar os cupons restritos a uma área de partida.</li>
        <li><ParamBadge name="lat_destino" /> e <ParamBadge name="lng_destino" /> — opcionais. Coordenadas do destino, usadas para avaliar os cupons restritos a uma área de destino.</li>
      </ul>
    </ChangeSection>

    <ChangeSection type="added">
      <p style={{ marginBottom: "10px" }}>O retorno traz a lista <ParamBadge name="cupons" />, com os cupons cadastrados e vigentes que o cliente já resgatou ou que estão publicados para exibição no aplicativo, mais o cupom automático de primeira viagem ou de inatividade quando o cliente é elegível. Cada item inclui:</p>

      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li><ParamBadge name="codigo" /> — código a ser enviado em <ParamBadge name="codigo_cupom" /> na criação ou na estimativa da corrida.</li>
        <li><ParamBadge name="perc_desconto" /> ou <ParamBadge name="valor_desconto" /> — desconto do cupom em percentual ou em valor fixo; apenas um dos dois vem preenchido.</li>
        <li><ParamBadge name="valor_maximo" /> e <ParamBadge name="valor_maximo_corrida" /> — teto de desconto e valor máximo da corrida em que o cupom se aplica.</li>
        <li><ParamBadge name="validade" /> — data e hora finais da vigência do cupom.</li>
        <li><ParamBadge name="tipos_pagamento" /> — formas de pagamento em que o cupom pode ser usado.</li>
        <li><ParamBadge name="area_id" /> e <ParamBadge name="nome_area" /> — área a que o cupom está restrito, quando houver.</li>
      </ul>
    </ChangeSection>

    <div
      style={{
  marginTop: "20px",
  padding: "14px 18px",
  borderRadius: "10px",
  background: "rgba(59, 130, 246, 0.08)",
  border: "1px solid rgba(59, 130, 246, 0.2)",
  fontSize: "13px",
  lineHeight: "1.6",
}}
    >
      <strong>Nota:</strong> cupons restritos a uma área só aparecem quando as coordenadas da ponta correspondente são informadas — sem o par de coordenadas, não há como avaliar a área e o cupom fica fora da lista. Além da chave de API, o endpoint exige autenticação HTTP Basic de um gestor ativo da bandeira.
    </div>
  </Entry>

  <Entry date="17 set 2026" label="Novo" labelColor="#3b82f6">
    <h2 id="consulta-cupons" style={{ fontSize: "22px", fontWeight: "700", marginBottom: "6px", marginTop: 0 }}>
      Consulta e listagem de cupons
    </h2>

    <p style={{ fontSize: "15px", opacity: 0.7, marginBottom: "20px", lineHeight: "1.6" }}>
      Novo endpoint para consultar os cupons de desconto da central. É possível buscar um cupom
      específico por <ParamBadge name="id" /> ou por <ParamBadge name="codigo" />, ou listar todos
      os cupons da bandeira quando nenhum dos dois é informado.
    </p>

    <EndpointBadge method="GET" path="/api/v2/integracao/cupons" href="/pages/v2/referencia/cupons/endpoint/get" />

    <ChangeSection type="added">
      <p style={{ marginBottom: "10px" }}>Parâmetros aceitos na query string:</p>

      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li><ParamBadge name="id" /> — opcional. Identificador interno do cupom. Não pode ser combinado com <ParamBadge name="codigo" />.</li>
        <li><ParamBadge name="codigo" /> — opcional. Código do cupom, com até 21 caracteres e sem emojis. Não pode ser combinado com <ParamBadge name="id" />. Pode retornar mais de um cupom, porque o mesmo código pode ter sido cadastrado em cupons diferentes.</li>
        <li><ParamBadge name="status" /> — opcional. Filtra os cupons pela vigência: <code>ativo</code>, <code>inativo</code> ou <code>aguardo</code>.</li>
        <li><ParamBadge name="pagina" /> — opcional. Página da listagem, com 10 cupons por página. Padrão <code>1</code>.</li>
      </ul>
    </ChangeSection>

    <ChangeSection type="added">
      <p style={{ marginBottom: "10px" }}>Campos retornados para cada cupom:</p>

      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li><ParamBadge name="status" /> — vigência do cupom no momento da consulta: <code>aguardo</code> antes de <ParamBadge name="data_hora_inicio" />, <code>ativo</code> durante a vigência e <code>inativo</code> a partir de <ParamBadge name="data_hora_fim" />.</li>
        <li><ParamBadge name="tipo_desconto" /> e <ParamBadge name="desconto" /> — desconto do cupom como <code>percentual</code> ou <code>valor\_fixo</code>.</li>
        <li><ParamBadge name="tipo_limite_cupom" /> e <ParamBadge name="limite_uso_individual" /> — regra de limite de utilização do cupom.</li>
        <li><ParamBadge name="valor_maximo" /> e <ParamBadge name="valor_maximo_corrida" /> — teto de desconto e valor máximo da corrida em que o cupom se aplica.</li>
        <li><ParamBadge name="quantidade_usuarios_utilizaram" /> — número de passageiros distintos que já usaram o cupom.</li>
        <li><ParamBadge name="vezes_utilizado" /> — número total de usos do cupom.</li>
        <li><ParamBadge name="gerador_cupom_desconto_id" /> — gerador de cupom ao qual o cupom está vinculado.</li>
      </ul>
    </ChangeSection>

    <div
      style={{
  marginTop: "20px",
  padding: "14px 18px",
  borderRadius: "10px",
  background: "rgba(59, 130, 246, 0.08)",
  border: "1px solid rgba(59, 130, 246, 0.2)",
  fontSize: "13px",
  lineHeight: "1.6",
}}
    >
      <strong>Nota:</strong> a busca por <ParamBadge name="id" /> retorna no máximo um cupom e ignora a paginação. A busca por <ParamBadge name="codigo" /> e a listagem geral são paginadas em 10 cupons por página. Além da chave de API, o endpoint exige autenticação HTTP Basic de um gestor ativo da bandeira.
    </div>
  </Entry>

  <Entry date="16 set 2026" label="Melhoria" labelColor="#16A34A">
    <h2 id="cupom-area-destino" style={{ fontSize: "22px", fontWeight: "700", marginBottom: "6px", marginTop: 0 }}>
      Cupom com restrição por área de destino
    </h2>

    <p style={{ fontSize: "15px", opacity: 0.7, marginBottom: "20px", lineHeight: "1.6" }}>
      O endpoint de criação de cupom passou a aceitar o campo <ParamBadge name="local_aplicacao" />,
      permitindo restringir o cupom pela área de <strong>destino</strong> da corrida, além da área de
      partida já suportada.
    </p>

    <EndpointBadge method="POST" path="/api/v2/integracao/cupons" href="/pages/v2/referencia/cupons/endpoint/post" />

    <ChangeSection type="added">
      <p style={{ marginBottom: "10px" }}>Campo aceito no corpo da requisição:</p>

      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li><ParamBadge name="local_aplicacao" /> — opcional. Indica se a restrição de <ParamBadge name="area_id" /> se aplica ao local de partida (<code>P</code>) ou de destino (<code>D</code>) da corrida. Só é considerado quando <ParamBadge name="area_id" /> é informado; padrão <code>P</code>.</li>
      </ul>
    </ChangeSection>

    <div
      style={{
  marginTop: "20px",
  padding: "14px 18px",
  borderRadius: "10px",
  background: "rgba(59, 130, 246, 0.08)",
  border: "1px solid rgba(59, 130, 246, 0.2)",
  fontSize: "13px",
  lineHeight: "1.6",
}}
    >
      <strong>Nota:</strong> cupom de área de destino exige que a central esteja habilitada para essa
      funcionalidade e não está disponível para centrais que fazem somente entregas.
    </div>
  </Entry>

  <Entry date="15 set 2026" label="Novo" labelColor="#3b82f6">
    <h2 id="in-app-messaging-condutor" style={{ fontSize: "22px", fontWeight: "700", marginBottom: "6px", marginTop: 0 }}>
      Envio de notificação in-app para condutores
    </h2>

    <p style={{ fontSize: "15px", opacity: 0.7, marginBottom: "20px", lineHeight: "1.6" }}>
      Novos endpoints para exibir uma mensagem dentro do aplicativo dos condutores da central, em lote ou
      para um condutor específico. A mensagem aparece como um modal com título, conteúdo, imagem opcional e
      botão de redirecionamento opcional.
    </p>

    <EndpointBadge method="POST" path="/api/v2/integracao/notificacoes/condutor/in-app-messaging" href="/pages/v2/referencia/notificacao/endpoint/post-condutor-in-app-messaging" />

    <ChangeSection type="added">
      <p style={{ marginBottom: "10px" }}>Campos aceitos no corpo da requisição:</p>

      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li><ParamBadge name="condutores" /> — obrigatório. Lista de identificadores numéricos dos condutores que receberão a mensagem, com ao menos um item e no máximo 1000. IDs repetidos são considerados uma única vez.</li>
        <li><ParamBadge name="titulo" /> — obrigatório. Título exibido no topo da mensagem, limite de 40 caracteres.</li>
        <li><ParamBadge name="body" /> — obrigatório. Conteúdo principal da mensagem, limite de 255 caracteres.</li>
        <li><ParamBadge name="url_imagem" /> — opcional. URL válida da imagem exibida no topo da mensagem, limite de 2048 caracteres. Sem imagem, ou se ela não carregar, o aplicativo exibe a logo da central.</li>
        <li><ParamBadge name="solicitacao_id" /> — opcional. Identificador numérico da corrida vinculada. Quando informado, a mensagem só é exibida se a corrida for a corrida em andamento do condutor.</li>
        <li><ParamBadge name="titulo_botao_redirecionamento" /> — opcional. Texto do botão de redirecionamento, limite de 20 caracteres. Obrigatório quando <ParamBadge name="link_redirecionamento" /> for informado.</li>
        <li><ParamBadge name="link_redirecionamento" /> — opcional. URL válida aberta ao tocar no botão, limite de 2048 caracteres. Obrigatório quando <ParamBadge name="titulo_botao_redirecionamento" /> for informado.</li>
      </ul>
    </ChangeSection>

    <div style={{ marginTop: "24px" }}>
      <EndpointBadge method="POST" path="/api/v2/integracao/notificacoes/condutor/in-app-messaging/individual" href="/pages/v2/referencia/notificacao/endpoint/post-condutor-in-app-messaging-individual" />

      <ChangeSection type="added">
        <p style={{ marginBottom: "10px" }}>Campos aceitos no corpo da requisição:</p>

        <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <li><ParamBadge name="condutor_id" /> — obrigatório. Identificador numérico do condutor que receberá a mensagem.</li>
          <li>Os demais campos são os mesmos do envio em lote: <ParamBadge name="titulo" />, <ParamBadge name="body" />, <ParamBadge name="url_imagem" />, <ParamBadge name="solicitacao_id" />, <ParamBadge name="titulo_botao_redirecionamento" /> e <ParamBadge name="link_redirecionamento" />.</li>
        </ul>
      </ChangeSection>
    </div>

    <div
      style={{
  marginTop: "20px",
  padding: "14px 18px",
  borderRadius: "10px",
  background: "rgba(59, 130, 246, 0.08)",
  border: "1px solid rgba(59, 130, 246, 0.2)",
  fontSize: "13px",
  lineHeight: "1.6",
}}
    >
      <strong>Nota:</strong> só recebem a mensagem os condutores da bandeira da chave de API (ou de suas filiais) com aplicativo instalado e token de notificação registrado. No envio em lote, condutores fora desse escopo são ignorados sem erro — o retorno é <code>404</code> apenas quando nenhum dos condutores informados pode ser notificado. Mensagem recebida com o aplicativo fechado fica guardada e aparece na próxima abertura.
    </div>
  </Entry>

  <Entry date="9 set 2026" label="Novo" labelColor="#3b82f6">
    <h2 id="push-condutor" style={{ fontSize: "22px", fontWeight: "700", marginBottom: "6px", marginTop: 0 }}>
      Envio de notificação push para condutores
    </h2>

    <p style={{ fontSize: "15px", opacity: 0.7, marginBottom: "20px", lineHeight: "1.6" }}>
      Novos endpoints para enviar notificação push aos condutores da central, em lote ou para um
      condutor específico.
    </p>

    <EndpointBadge method="POST" path="/api/v2/integracao/notificacoes/condutor/push" href="/pages/v2/referencia/notificacao/endpoint/post-condutor-push" />

    <ChangeSection type="added">
      <p style={{ marginBottom: "10px" }}>Campos aceitos no corpo da requisição:</p>

      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li><ParamBadge name="condutores" /> — obrigatório. Lista de identificadores numéricos dos condutores que receberão a notificação, com ao menos um item e no máximo 1000. IDs repetidos são considerados uma única vez.</li>
        <li><ParamBadge name="titulo" /> — opcional. Título da notificação, limite de 40 caracteres.</li>
        <li><ParamBadge name="mensagem" /> — obrigatório. Mensagem da notificação, limite de 255 caracteres.</li>
      </ul>
    </ChangeSection>

    <div style={{ marginTop: "24px" }}>
      <EndpointBadge method="POST" path="/api/v2/integracao/notificacoes/condutor/push/individual" href="/pages/v2/referencia/notificacao/endpoint/post-condutor-push-individual" />

      <ChangeSection type="added">
        <p style={{ marginBottom: "10px" }}>Campos aceitos no corpo da requisição:</p>

        <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <li><ParamBadge name="condutor_id" /> — obrigatório. Identificador numérico do condutor que receberá a notificação.</li>
          <li><ParamBadge name="titulo" /> — opcional. Título da notificação, limite de 40 caracteres.</li>
          <li><ParamBadge name="mensagem" /> — obrigatório. Mensagem da notificação, limite de 255 caracteres.</li>
        </ul>
      </ChangeSection>
    </div>

    <div
      style={{
  marginTop: "20px",
  padding: "14px 18px",
  borderRadius: "10px",
  background: "rgba(59, 130, 246, 0.08)",
  border: "1px solid rgba(59, 130, 246, 0.2)",
  fontSize: "13px",
  lineHeight: "1.6",
}}
    >
      <strong>Nota:</strong> só recebem a notificação os condutores da bandeira da chave de API (ou de suas filiais) com aplicativo instalado e token de notificação registrado. No envio em lote, condutores fora desse escopo são ignorados sem erro — o retorno é <code>404</code> apenas quando nenhum dos condutores informados pode ser notificado.
    </div>
  </Entry>

  <Entry date="4 set 2026" label="Melhoria" labelColor="#16A34A">
    <h2 id="webhook-posicao-lote" style={{ fontSize: "22px", fontWeight: "700", marginBottom: "6px", marginTop: 0 }}>
      Novo formato do Webhook de Posição
    </h2>

    <p style={{ fontSize: "15px", opacity: 0.7, marginBottom: "20px", lineHeight: "1.6" }}>
      O Webhook de Posição passou a entregar as posições dos condutores em lote, a cada 10 segundos, em um envelope com o array <ParamBadge name="data" />. O contrato completo está em <a href="/pages/v2/referencia/webhooks/sobre">Webhooks > Sobre</a>.
    </p>

    <ChangeSection type="changed">
      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li>O corpo da requisição virou um envelope <ParamBadge name="event_id" /> / <ParamBadge name="datetime" /> / <ParamBadge name="data" />, com até 500 posições por envio. Uma janela com mais posições é dividida em várias requisições, cada uma com o seu próprio <ParamBadge name="event_id" />.</li>
        <li>As coordenadas passaram a ser enviadas dentro do objeto <ParamBadge name="coordinates" />, com <ParamBadge name="latitude" /> e <ParamBadge name="longitude" /> sempre juntas e com 6 casas decimais.</li>
        <li>Cada par condutor/solicitação aparece no máximo uma vez por janela, sempre com a leitura mais recente.</li>
        <li>Não há reenvio: se a URL cadastrada responder erro, o lote não é reentregue — a janela seguinte já traz uma posição mais nova. Leituras com mais de 15 segundos não são entregues.</li>
      </ul>
    </ChangeSection>

    <ChangeSection type="added">
      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li><ParamBadge name="timestamp" /> — momento em que a posição foi gerada pelo condutor, em milissegundos desde 1970-01-01 UTC. É distinto do <ParamBadge name="datetime" /> do envelope, que marca o envio do lote.</li>
        <li><ParamBadge name="enterprise_id" /> — identificador da empresa, presente apenas quando o webhook é cadastrado com o responsável <code>empresa</code>.</li>
      </ul>
    </ChangeSection>

    <ChangeSection type="removed">
      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li><ParamBadge name="links" /> — o objeto com as URLs de solicitação, condutor e empresa não é mais enviado.</li>
        <li><ParamBadge name="latitude" /> e <ParamBadge name="longitude" /> na raiz do item, substituídas pelo objeto <ParamBadge name="coordinates" />.</li>
      </ul>
    </ChangeSection>
  </Entry>

  <Entry date="3 set 2026" label="Melhoria" labelColor="#16A34A">
    <h2 id="patch-area-vertices-dinamica" style={{ fontSize: "22px", fontWeight: "700", marginBottom: "6px", marginTop: 0 }}>
      Atualização de área e vértices da dinâmica
    </h2>

    <p style={{ fontSize: "15px", opacity: 0.7, marginBottom: "20px", lineHeight: "1.6" }}>
      O endpoint de atualização da dinâmica por área agora aceita outros campos além de <ParamBadge name="ativo" />, e um novo endpoint permite substituir os vértices do polígono de uma área.
    </p>

    <EndpointBadge method="PATCH" path="/api/v2/integracao/dinamicas/area/{id}" href="/pages/v2/referencia/dinamicas/endpoint/patch-area" />

    <ChangeSection type="changed">
      <p style={{ marginBottom: "10px" }}>Novos campos opcionais no corpo da requisição (ao menos um deve ser informado):</p>

      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li><ParamBadge name="nome" /> — novo nome da área.</li>
        <li><ParamBadge name="fator" /> — novo valor do fator aplicado pela dinâmica.</li>
        <li><ParamBadge name="tipo_calculo" /> — forma de cálculo do fator: <code>F</code> (valor adicional, soma um valor fixo em R\$) ou <code>M</code> (fator multiplicador, multiplica o preço da corrida).</li>
        <li><ParamBadge name="tipo_fator" /> — momento de aplicação do fator: <code>P</code> (partida, na origem/embarque) ou <code>R</code> (parada, no destino).</li>
        <li><ParamBadge name="ativo" /> — comportamento inalterado, ativa ou desativa a dinâmica da área.</li>
      </ul>
    </ChangeSection>

    <div style={{ marginTop: "24px" }}>
      <EndpointBadge method="PATCH" path="/api/v2/integracao/dinamicas/area/{id}/vertices" href="/pages/v2/referencia/dinamicas/endpoint/patch-vertices" />
    </div>

    <ChangeSection type="added">
      <p style={{ marginBottom: "10px" }}>Novo endpoint para substituir todos os vértices do polígono de uma área, a partir de um objeto GeoJSON <code>Polygon</code> (RFC 7946) com um único anel de coordenadas.</p>
    </ChangeSection>

    <div
      style={{
  marginTop: "20px",
  padding: "14px 18px",
  borderRadius: "10px",
  background: "rgba(59, 130, 246, 0.08)",
  border: "1px solid rgba(59, 130, 246, 0.2)",
  fontSize: "13px",
  lineHeight: "1.6",
}}
    >
      <strong>Nota:</strong> a área é imutável depois de criada — alterar a geometria (endpoint de vértices) ou o <ParamBadge name="nome" /> (endpoint de área) cria internamente uma NOVA área, copiando os demais atributos da original. Em ambos os casos a resposta pode trazer um <code>id</code> de área diferente do informado na URL, que deve ser usado nas próximas requisições sobre essa área.
    </div>
  </Entry>

  <Entry date="1 set 2026" label="Novo" labelColor="#3b82f6">
    <h2 id="vertices-area-dinamica" style={{ fontSize: "22px", fontWeight: "700", marginBottom: "6px", marginTop: 0 }}>
      Vértices da área da dinâmica
    </h2>

    <p style={{ fontSize: "15px", opacity: 0.7, marginBottom: "20px", lineHeight: "1.6" }}>
      Novo endpoint para consultar os vértices que delimitam a área de uma dinâmica, no formato GeoJSON Polygon.
    </p>

    <EndpointBadge method="GET" path="/api/v2/integracao/dinamicas/area/{id}/vertices" href="/pages/v2/referencia/dinamicas/endpoint/get-vertices" />

    <ChangeSection type="added">
      <p style={{ marginBottom: "10px" }}>Retorna os vértices da área da dinâmica em formato GeoJSON Polygon, com o anel fechado (primeira coordenada igual à última):</p>

      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li><ParamBadge name="type" /> — sempre <code>"Polygon"</code>.</li>
        <li><ParamBadge name="coordinates" /> — array de anéis, cada um com pares <code>\[lng, lat]</code> descrevendo o polígono da área.</li>
      </ul>

      <p style={{ marginTop: "14px" }}>Retorna erro 404 quando a dinâmica/área não existe, está excluída ou inativa.</p>
    </ChangeSection>
  </Entry>

  <Entry date="01 set 2026" label="Novo" labelColor="#3b82f6">
    <h2 id="cupom-desconto-corridas" style={{ fontSize: "22px", fontWeight: "700", marginBottom: "6px", marginTop: 0 }}>
      Cupom de desconto na criação e estimativa de corridas
    </h2>

    <p style={{ fontSize: "15px", opacity: 0.7, marginBottom: "20px", lineHeight: "1.6" }}>
      Agora é possível aplicar um cupom de desconto via API, no mesmo fluxo já disponível no
      app do passageiro.
    </p>

    <EndpointBadge method="POST" path="/api/v2/integracao/corridas" href="/pages/v2/referencia/corridas/endpoint/post-criar" />

    <ChangeSection type="added">
      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li><ParamBadge name="codigo_cupom" /> — opcional. Código do cupom de desconto a ser aplicado na corrida.</li>
      </ul>
    </ChangeSection>

    <div style={{ marginTop: "24px" }}>
      <EndpointBadge method="POST" path="/api/v2/integracao/corridas/programadas" href="/pages/v2/referencia/corridas/endpoint/post-criar-programada" />

      <ChangeSection type="added">
        <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <li><ParamBadge name="codigo_cupom" /> — opcional. Código do cupom de desconto a ser aplicado na corrida.</li>
        </ul>
      </ChangeSection>
    </div>

    <div style={{ marginTop: "24px" }}>
      <EndpointBadge method="POST" path="/api/v2/integracao/corridas/estimativas" href="/pages/v2/referencia/corridas/endpoint/post-estimativas" />

      <ChangeSection type="added">
        <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <li><ParamBadge name="codigo_cupom" /> — opcional. Código do cupom de desconto; quando informado, <code>estimativa\_valor</code> retorna o valor já líquido, com o desconto aplicado.</li>
        </ul>
      </ChangeSection>
    </div>

    <div style={{ marginTop: "24px" }}>
      <EndpointBadge method="POST" path="/api/v2/integracao/corridas/empresas/{id}/estimativas" href="/pages/v2/referencia/corridas/endpoint/post-empresa-estimativas" />

      <ChangeSection type="added">
        <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <li><ParamBadge name="codigo_cupom" /> — opcional. Código do cupom de desconto; quando informado, <code>estimativa\_valor</code> retorna o valor já líquido, com o desconto aplicado.</li>
        </ul>
      </ChangeSection>
    </div>

    <div style={{ marginTop: "24px" }}>
      <EndpointBadge method="POST" path="/api/v2/integracao/corridas/programadas/estimativas" href="/pages/v2/referencia/corridas/endpoint/post-programada-estimativas" />

      <ChangeSection type="added">
        <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <li><ParamBadge name="codigo_cupom" /> — opcional. Código do cupom de desconto; quando informado, <code>estimativa\_valor</code> retorna o valor já líquido, com o desconto aplicado.</li>
        </ul>
      </ChangeSection>
    </div>
  </Entry>

  <Entry date="25 ago 2026" label="Melhoria" labelColor="#16A34A">
    <h2 id="filtros-engajamento-clientes" style={{ fontSize: "22px", fontWeight: "700", marginBottom: "6px", marginTop: 0 }}>
      Filtros de engajamento na consulta de clientes
    </h2>

    <p style={{ fontSize: "15px", opacity: 0.7, marginBottom: "20px", lineHeight: "1.6" }}>
      Novos parâmetros para segmentar clientes pelo último acesso ao app, além de novos campos de acesso e token na resposta.
    </p>

    <EndpointBadge method="GET" path="/api/v2/integracao/clientes" href="/pages/v2/referencia/clientes/endpoint/get" />

    <ChangeSection type="added">
      <p style={{ marginBottom: "10px" }}>Novos parâmetros de query disponíveis:</p>

      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li><ParamBadge name="ultimo_acesso_apos" /> — filtra clientes com último acesso ao app a partir desta data (ISO-8601 UTC, inclusive).</li>
        <li><ParamBadge name="ultimo_acesso_antes_de" /> — filtra clientes com último acesso ao app antes desta data (ISO-8601 UTC, exclusive).</li>
        <li><ParamBadge name="nunca_acessou" /> — quando <code>true</code> ou <code>1</code>, retorna somente clientes que nunca acessaram o app.</li>
      </ul>

      <p style={{ marginTop: "14px", marginBottom: "10px" }}>Novos campos no retorno de cada cliente:</p>

      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li><ParamBadge name="token_atualizado_em" /> — data da última atualização do token de acesso do cliente.</li>
        <li><ParamBadge name="ultimo_acesso_em" /> — data do último acesso do cliente ao app.</li>
      </ul>
    </ChangeSection>

    <div
      style={{
  marginTop: "20px",
  padding: "14px 18px",
  borderRadius: "10px",
  background: "rgba(59, 130, 246, 0.08)",
  border: "1px solid rgba(59, 130, 246, 0.2)",
  fontSize: "13px",
  lineHeight: "1.6",
}}
    >
      <strong>Nota:</strong> <ParamBadge name="ultimo_acesso_apos" /> e <ParamBadge name="ultimo_acesso_antes_de" /> comparam contra o último acesso registrado e por isso excluem clientes sem nenhum acesso — para esses, use <ParamBadge name="nunca_acessou" />. Esses filtros preservam a paginação e são combináveis com <ParamBadge name="status_cliente" />, que é independente (status administrativo do cadastro, não uso do app).
    </div>
  </Entry>

  <Entry date="13 ago 2026" label="Melhoria" labelColor="#16A34A">
    <h2 id="detalhes-corridas-programadas" style={{ fontSize: "22px", fontWeight: "700", marginBottom: "6px", marginTop: 0 }}>
      Detalhes da solicitação na consulta de corridas programadas
    </h2>

    <p style={{ fontSize: "15px", opacity: 0.7, marginBottom: "20px", lineHeight: "1.6" }}>
      A consulta de corridas programadas passa a devolver categoria, valor, observação, endereço de
      partida e a lista de paradas — antes era necessário consultar outro endpoint para saber
      qualquer um desses dados.
    </p>

    <EndpointBadge method="GET" path="/api/v2/integracao/corridas/programadas" href="/pages/v2/referencia/corridas/endpoint/get-programadas" />

    <div style={{ marginTop: "24px" }}>
      <EndpointBadge method="GET" path="/api/v2/integracao/corridas/programadas/{id}" href="/pages/v2/referencia/corridas/endpoint/get-programada-by-id" />
    </div>

    <ChangeSection type="added">
      <p style={{ marginBottom: "10px" }}>Campos novos na resposta dos dois endpoints:</p>

      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li><ParamBadge name="categoria" /> — <code>id</code> e <code>nome</code> da categoria da solicitação.</li>
        <li><ParamBadge name="valor" /> — <code>estimado</code> (estimativa no momento da criação) e <code>prefixado</code> (valor fechado, quando houver).</li>
        <li><ParamBadge name="observacao" /> — observação da solicitação.</li>
        <li><ParamBadge name="partida" /> — endereço de partida completo: <code>endereco</code>, <code>complemento</code>, <code>referencia</code>, <code>bairro</code>, <code>cidade</code>, <code>estado</code>, <code>lat</code> e <code>lng</code>.</li>
        <li><ParamBadge name="desejado" /> — endereço de destino do passageiro: <code>endereco</code>, <code>bairro</code>, <code>cidade</code>, <code>estado</code>, <code>lat</code> e <code>lng</code>.</li>
        <li><ParamBadge name="nome_passageiro" /> — nome do passageiro, já devolvido na consulta de solicitação.</li>
        <li><ParamBadge name="paradas" /> — lista de paradas intermediárias na ordem da corrida, cada uma com <code>id</code>, <code>ordem</code> e endereço completo. A chave só aparece quando há paradas: numa corrida direta ela não vem na resposta.</li>
      </ul>
    </ChangeSection>

    <ChangeSection type="changed">
      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li>A consulta por id passa a devolver <ParamBadge name="id_mch_programada" />, que antes só aparecia na listagem.</li>
      </ul>
    </ChangeSection>

    <div
      style={{
  marginTop: "20px",
  padding: "14px 18px",
  borderRadius: "10px",
  background: "rgba(59, 130, 246, 0.08)",
  border: "1px solid rgba(59, 130, 246, 0.2)",
  fontSize: "13px",
  lineHeight: "1.6",
}}
    >
      <strong>Nota:</strong> os campos são apenas adicionados — nenhum campo existente mudou de nome, tipo ou posição. As paradas de corrida trazem somente os dados de endereço: <code>numero\_pedido</code>, <code>nome\_cliente</code>, <code>telefone\_cliente</code> e <code>observacao</code> são dados de pedido e não existem em corridas, por isso não vêm na resposta.
    </div>
  </Entry>

  <Entry date="10 ago 2026" label="Novo" labelColor="#3b82f6">
    <h2 id="limite-webhooks-por-tipo" style={{ fontSize: "22px", fontWeight: "700", marginBottom: "6px", marginTop: 0 }}>
      Aumento do limite de webhooks por tipo
    </h2>

    <p style={{ fontSize: "15px", opacity: 0.7, marginBottom: "20px", lineHeight: "1.6" }}>
      Limite de cadastro de webhooks atualizado: até 5 webhooks por tipo. O webhook do tipo mensagem é limitado a 1 cadastro.
    </p>

    <EndpointBadge method="POST" path="/api/v2/integracao/webhooks" href="/pages/v2/referencia/webhooks/endpoint/post" />

    <ChangeSection type="added">
      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px" }}>
        <li>Aumentou o limite de webhooks cadastrados para até 5 webhooks por tipo.</li>
        <li>O webhook do tipo mensagem é limitado a 1 cadastro.</li>
      </ul>
    </ChangeSection>
  </Entry>

  <Entry date="28 jul 2026" label="Novo" labelColor="#3b82f6">
    <h2 id="notificacoes-passageiro-unico" style={{ fontSize: "22px", fontWeight: "700", marginBottom: "6px", marginTop: 0 }}>
      Envio de notificação para um único passageiro
    </h2>

    <p style={{ fontSize: "15px", opacity: 0.7, marginBottom: "20px", lineHeight: "1.6" }}>
      Novos endpoints para enviar notificação push e in-app messaging para um passageiro específico,
      sem precisar montar a lista de destinatários dos endpoints existentes.
    </p>

    <EndpointBadge method="POST" path="/api/v2/integracao/notificacoes/push/individual" href="/pages/v2/referencia/notificacao/endpoint/post-push-individual" />

    <ChangeSection type="added">
      <p style={{ marginBottom: "10px" }}>Campos aceitos no corpo da requisição:</p>

      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li><ParamBadge name="passageiro_id" /> — obrigatório. Identificador numérico do passageiro que receberá a notificação.</li>
        <li><ParamBadge name="titulo" /> — opcional. Título da notificação.</li>
        <li><ParamBadge name="mensagem" /> — obrigatório. Mensagem da notificação.</li>
      </ul>
    </ChangeSection>

    <div style={{ marginTop: "24px" }}>
      <EndpointBadge method="POST" path="/api/v2/integracao/notificacoes/in-app-messaging/individual" href="/pages/v2/referencia/notificacao/endpoint/post-in-app-messaging-individual" />

      <ChangeSection type="added">
        <p style={{ marginBottom: "10px" }}>Campos aceitos no corpo da requisição:</p>

        <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <li><ParamBadge name="passageiro_id" /> — obrigatório. Identificador numérico do passageiro que receberá a notificação.</li>
          <li><ParamBadge name="titulo" /> — obrigatório. Título da notificação, limite de 40 caracteres.</li>
          <li><ParamBadge name="body" /> — obrigatório. Conteúdo principal da notificação, limite de 255 caracteres.</li>
          <li><ParamBadge name="url_imagem" /> — opcional. URL de imagem exibida na notificação.</li>
          <li><ParamBadge name="solicitacao_id" /> — opcional. Vincula a notificação a uma solicitação; quando informado, só é exibida se a solicitação estiver em andamento.</li>
          <li><ParamBadge name="titulo_botao_redirecionamento" /> — opcional. Título do botão de redirecionamento, limite de 20 caracteres.</li>
          <li><ParamBadge name="link_redirecionamento" /> — opcional. Link acionado pelo botão de redirecionamento.</li>
        </ul>
      </ChangeSection>
    </div>

    <div
      style={{
  marginTop: "20px",
  padding: "14px 18px",
  borderRadius: "10px",
  background: "rgba(59, 130, 246, 0.08)",
  border: "1px solid rgba(59, 130, 246, 0.2)",
  fontSize: "13px",
  lineHeight: "1.6",
}}
    >
      <strong>Nota:</strong> os endpoints existentes de envio em lote (<code>/notificacoes/push</code> e <code>/notificacoes/in-app-messaging</code>) continuam disponíveis e não sofreram alteração de comportamento.
    </div>
  </Entry>

  <Entry date="16 jul 2026" label="Novo" labelColor="#3b82f6">
    <h2 id="consultar-status-webhook" style={{ fontSize: "22px", fontWeight: "700", marginBottom: "6px", marginTop: 0 }}>
      Consulta de status de entrega do webhook
    </h2>

    <p style={{ fontSize: "15px", opacity: 0.7, marginBottom: "20px", lineHeight: "1.6" }}>
      Novo endpoint para verificar se um webhook está entregando eventos normalmente ou se foi
      bloqueado por falhas de entrega, com detalhes do bloqueio e da próxima tentativa de reenvio.
    </p>

    <EndpointBadge method="GET" path="/api/v2/integracao/webhooks/{id}/status" href="/pages/v2/referencia/webhooks/endpoint/get-status" />

    <ChangeSection type="added">
      <p style={{ marginBottom: "10px" }}>Campos retornados na consulta:</p>

      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li><ParamBadge name="situacao" /> — <code>ativo</code>, <code>bloqueado\_temporariamente</code> (falhas consecutivas de entrega) ou <code>bloqueado\_definitivamente</code> (tentativas de reenvio esgotadas).</li>
        <li><ParamBadge name="bloqueio_temporario" /> — estado do bloqueio temporário: <code>ativo</code>, <code>falhas\_consecutivas</code>, <code>desde</code> e <code>proxima\_tentativa</code> (datas em ISO-8601, UTC).</li>
        <li><ParamBadge name="bloqueio_definitivo" /> — estado do bloqueio definitivo: <code>ativo</code> e <code>desde</code>.</li>
      </ul>
    </ChangeSection>

    <div
      style={{
  marginTop: "20px",
  padding: "14px 18px",
  borderRadius: "10px",
  background: "rgba(59, 130, 246, 0.08)",
  border: "1px solid rgba(59, 130, 246, 0.2)",
  fontSize: "13px",
  lineHeight: "1.6",
}}
    >
      <strong>Nota:</strong> durante um bloqueio temporário as entregas ficam suspensas até <code>proxima\_tentativa</code>. No bloqueio definitivo os eventos deixam de ser entregues ao webhook.
    </div>
  </Entry>

  <Entry date="14 jul 2026" label="Novo" labelColor="#3b82f6">
    <h2 id="categoria-id-estimativa-multicategorias" style={{ fontSize: "22px", fontWeight: "700", marginBottom: "6px", marginTop: 0 }}>
      Identificador da categoria na estimativa multicategorias
    </h2>

    <p style={{ fontSize: "15px", opacity: 0.7, marginBottom: "20px", lineHeight: "1.6" }}>
      Cada item de <code>categorias</code> na estimativa de múltiplas categorias agora inclui o ID da categoria,
      permitindo casar o retorno com a categoria configurada sem depender do nome.
    </p>

    <EndpointBadge method="POST" path="/api/v2/integracao/corridas/estimativas" href="/pages/v2/referencia/corridas/endpoint/post-estimativas" />

    <ChangeSection type="added">
      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li><ParamBadge name="categoria_id" /> — identificador da categoria, presente em cada item de <code>categorias</code> quando <ParamBadge name="multicategorias" /> é <code>true</code>.</li>
      </ul>
    </ChangeSection>
  </Entry>

  <Entry date="14 jul 2026" label="Novo" labelColor="#3b82f6">
    <h2 id="foto-cliente" style={{ fontSize: "22px", fontWeight: "700", marginBottom: "6px", marginTop: 0 }}>
      Foto do passageiro na consulta de clientes
    </h2>

    <p style={{ fontSize: "15px", opacity: 0.7, marginBottom: "20px", lineHeight: "1.6" }}>
      Os endpoints de consulta de clientes agora retornam a foto de cadastro do passageiro,
      permitindo exibi-la na interface do integrador.
    </p>

    <EndpointBadge method="GET" path="/api/v2/integracao/clientes" href="/pages/v2/referencia/clientes/endpoint/get" />

    <ChangeSection type="added">
      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li><ParamBadge name="foto_url" /> — link temporário (presigned, expira em 30 minutos) da foto de cadastro do cliente. <code>null</code> quando não há foto cadastrada.</li>
      </ul>
    </ChangeSection>

    <div style={{ marginTop: "24px" }}>
      <EndpointBadge method="GET" path="/api/v2/integracao/clientes/{clienteId}" href="/pages/v2/referencia/clientes/endpoint/get-by-id" />

      <ChangeSection type="added">
        <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <li><ParamBadge name="foto_url" /> — link temporário (presigned, expira em 30 minutos) da foto de cadastro do cliente. <code>null</code> quando não há foto cadastrada.</li>
        </ul>
      </ChangeSection>
    </div>
  </Entry>

  <Entry date="14 jul 2026" label="Novo" labelColor="#3b82f6">
    <h2 id="foto-condutor" style={{ fontSize: "22px", fontWeight: "700", marginBottom: "6px", marginTop: 0 }}>
      Foto do condutor na consulta por ID
    </h2>

    <p style={{ fontSize: "15px", opacity: 0.7, marginBottom: "20px", lineHeight: "1.6" }}>
      O endpoint de consulta de condutor por ID agora retorna a foto de rosto cadastrada,
      permitindo exibi-la na interface do integrador.
    </p>

    <EndpointBadge method="GET" path="/api/v2/integracao/condutores/{id}" href="/pages/v2/referencia/condutores/endpoint/get-by-id" />

    <ChangeSection type="added">
      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li><ParamBadge name="foto_url" /> — link temporário (presigned, expira em 30 minutos) da foto de rosto do condutor. <code>null</code> quando não há foto cadastrada.</li>
      </ul>
    </ChangeSection>
  </Entry>

  <Entry date="25 jun 2026" label="Melhoria" labelColor="#16A34A">
    <h2 id="filtros-busca-clientes-condutores" style={{ fontSize: "22px", fontWeight: "700", marginBottom: "6px", marginTop: 0 }}>
      Novos filtros de busca em Clientes e Condutores
    </h2>

    <p style={{ fontSize: "15px", opacity: 0.7, marginBottom: "20px", lineHeight: "1.6" }}>
      Os endpoints de listagem foram expandidos com filtros de busca direta por CPF, e-mail,
      telefone e nome, eliminando a necessidade de conhecer o ID do registro para localizá-lo.
    </p>

    <EndpointBadge method="GET" path="/api/v2/integracao/clientes" href="/pages/v2/referencia/clientes/endpoint/get" />

    <ChangeSection type="added">
      <p style={{ marginBottom: "10px" }}>Novos parâmetros de query disponíveis:</p>

      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li><ParamBadge name="cpf" /> — correspondência exata, com ou sem máscara (ex: <code>064.181.699-56</code> ou <code>06418169956</code>). Ignora <code>status\_cliente</code> e paginação.</li>
        <li><ParamBadge name="email" /> — correspondência exata. Ignora <code>status\_cliente</code> e paginação.</li>
        <li><ParamBadge name="telefone" /> — aceita com ou sem DDI e prefixo <code>+</code>; DDI inferido pelo país da bandeira, fallback Brasil (<code>55</code>). Ignora <code>status\_cliente</code> e paginação.</li>
        <li><ParamBadge name="nome" /> — busca parcial, mínimo 3 caracteres. Ignora <code>status\_cliente</code>, mas mantém paginação.</li>
      </ul>
    </ChangeSection>

    <ChangeSection type="changed">
      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px" }}>
        <li><ParamBadge name="status_cliente" />, <ParamBadge name="limite" /> e <ParamBadge name="pagina" /> agora documentam explicitamente quando são ignorados na presença de filtros diretos.</li>
      </ul>
    </ChangeSection>

    <div style={{ marginTop: "24px" }}>
      <EndpointBadge method="GET" path="/api/v2/integracao/condutores" href="/pages/v2/referencia/condutores/endpoint/get" />

      <ChangeSection type="added">
        <p style={{ marginBottom: "10px" }}>Novos parâmetros de query disponíveis:</p>

        <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <li><ParamBadge name="email" /> — correspondência exata. Ignora <code>status\_condutor</code> e paginação.</li>
          <li><ParamBadge name="nome" /> — busca parcial, mínimo 3 caracteres. Ignora <code>status\_condutor</code>, mas mantém paginação.</li>
        </ul>
      </ChangeSection>

      <ChangeSection type="changed">
        <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <li><ParamBadge name="cpf" /> passou a aceitar apenas correspondência exata com ou sem máscara (busca parcial por inteiro removida). Ignora <code>status\_condutor</code> e paginação.</li>
          <li><ParamBadge name="telefone" /> expandido: agora documenta comportamento de DDI e prefixo <code>+</code>, alinhado ao endpoint de clientes.</li>
          <li><ParamBadge name="status_condutor" />, <ParamBadge name="limite" /> e <ParamBadge name="pagina" /> agora documentam explicitamente quando são ignorados.</li>
        </ul>
      </ChangeSection>
    </div>

    <div
      style={{
  marginTop: "20px",
  padding: "14px 18px",
  borderRadius: "10px",
  background: "rgba(59, 130, 246, 0.08)",
  border: "1px solid rgba(59, 130, 246, 0.2)",
  fontSize: "13px",
  lineHeight: "1.6",
}}
    >
      <strong>Nota sobre prioridade de filtros:</strong> filtros diretos (<code>id</code>, <code>cpf</code>, <code>email</code> ou <code>telefone</code>) suprimem status e paginação automaticamente. O filtro <code>nome</code> mantém a paginação, mas ignora o status.
    </div>
  </Entry>

  <Entry date="16 jun 2026" label="Novo" labelColor="#3b82f6">
    <h2 id="link-acompanhamento-corrida" style={{ fontSize: "22px", fontWeight: "700", marginBottom: "6px", marginTop: 0 }}>
      Link de acompanhamento de solicitação no retorno da corrida
    </h2>

    <p style={{ fontSize: "15px", opacity: 0.7, marginBottom: "20px", lineHeight: "1.6" }}>
      O endpoint de consulta de corrida por ID agora retorna um link direto para o acompanhamento
      da solicitação, facilitando a integração com interfaces de rastreamento em tempo real.
    </p>

    <EndpointBadge method="GET" path="/api/v2/integracao/corridas/{id}" href="/pages/v2/referencia/corridas/endpoint/get-by-id" />

    <ChangeSection type="added">
      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li><ParamBadge name="link_acompanhamento_solicitacao" /> — URL de acompanhamento da solicitação em tempo real. Presente no objeto <code>data</code> da resposta.</li>
      </ul>
    </ChangeSection>
  </Entry>
</div>
