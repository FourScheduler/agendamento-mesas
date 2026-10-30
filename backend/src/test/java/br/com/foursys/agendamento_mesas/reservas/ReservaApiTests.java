package br.com.foursys.agendamento_mesas.reservas;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import br.com.foursys.agendamento_mesas.dto.request.CriarReservaRequest;
import br.com.foursys.agendamento_mesas.enums.*;
import br.com.foursys.agendamento_mesas.model.*;
import br.com.foursys.agendamento_mesas.port.out.MesaRepositoryPort;
import br.com.foursys.agendamento_mesas.port.out.ReservaRepositoryPort;
import br.com.foursys.agendamento_mesas.port.out.UsuarioRepositoryPort;
import br.com.foursys.agendamento_mesas.security.*;
import br.com.foursys.agendamento_mesas.service.ReservaService;
import java.time.*;
import java.util.List;
import java.util.concurrent.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/** Transações reais, sem @Transactional no teste: as requisições precisam efetuar commit. */
@ActiveProfiles("test")
@SpringBootTest
@AutoConfigureMockMvc
@Import(ReservaApiTests.RelogioTeste.class)
public class ReservaApiTests {
    static final LocalDate HOJE = LocalDate.of(2026, 10, 26);
    @Autowired MockMvc mvc;
    @Autowired MesaRepositoryPort mesas;
    @Autowired UsuarioRepositoryPort usuarios;
    @Autowired ReservaRepositoryPort reservas;
    @Autowired JwtService jwt;
    @Autowired ReservaService service;
    @Autowired PlatformTransactionManager transactionManager;
    Usuario maria;
    Usuario joao;
    Mesa mesa;
    Mesa outraMesa;

    @TestConfiguration
    public static class RelogioTeste {
        @Bean @Primary
        Clock relogioFixo() {
            return Clock.fixed(Instant.parse("2026-10-26T12:00:00Z"), ZoneId.of("America/Sao_Paulo"));
        }
    }

    @BeforeEach
    void prepararBanco() {
        reservas.deletarTodos();
        mesas.deletarTodos();
reservas.deletarTodos();
        mesas.deletarTodos();
        usuarios.deletarTodos();
        maria = usuarios.salvar(new Usuario("Maria", "maria@teste.com", "hash", PerfilUsuario.USUARIO, true));
        joao = usuarios.salvar(new Usuario("João", "joao@teste.com", "hash", PerfilUsuario.USUARIO, true));
        mesa = mesas.salvar(new Mesa(null, "044", "DEMO", TipoMesa.LIVRE, true, "DEMO", 0, 0, null));
        outraMesa = mesas.salvar(new Mesa(null, "053", "DEMO", TipoMesa.LIVRE, true, "DEMO", 200, 0, null));
    }

    @Test
    void confirmaAutoriaDoTokenMesmoComRequestManipuladoEPersisteAntesDoSucesso() throws Exception {
        mvc.perform(post("/api/reservas").header("Authorization", "Bearer " + jwt.gerarToken(maria))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"mesaId\":" + mesa.getId() + ",\"data\":\"2026-10-26\",\"usuarioId\":"
                        + joao.getId() + ",\"solicitante\":{\"id\":" + joao.getId() + "}}"))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.status").value("CONFIRMADA"))
                .andExpect(jsonPath("$.data").value("2026-10-26"))
                .andExpect(jsonPath("$.mesa.id").value(mesa.getId()))
                .andExpect(jsonPath("$.solicitante.id").value(maria.getId()))
                .andExpect(jsonPath("$.solicitante.nome").value("Maria"))
                .andExpect(jsonPath("$.solicitante.email").value("maria@teste.com"))
                .andExpect(jsonPath("$.criadaEm").value("2026-10-26T09:00:00"))
                .andExpect(jsonPath("$.confirmadaEm").value("2026-10-26T09:00:00"));
        // Leitura em outra transação depois da resposta HTTP.
        transacao().executeWithoutResult(tx -> {
            assertThat(reservas.contar()).isEqualTo(1);
            var salva = reservas.buscarTodos().getFirst();
            assertThat(salva.getUsuario().getId()).isEqualTo(maria.getId());
            assertThat(salva.getMesa().getId()).isEqualTo(mesa.getId());
            assertThat(salva.getStatus()).isEqualTo(StatusReserva.CONFIRMADA);
        });
    }

    @Test
    void exigeAutenticacao() throws Exception {
        mvc.perform(post("/api/reservas").contentType(MediaType.APPLICATION_JSON)
                .content(corpo(mesa, HOJE))).andExpect(status().isUnauthorized());
        assertThat(reservas.contar()).isZero();
    }

    @Test
    void validaCamposFormatosEDatasNasDuasRotas() throws Exception {
        for (String body : List.of("{}", "null", "{\"mesaId\":0,\"data\":\"2026-10-26\"}",
                "{\"mesaId\":1}", "{\"mesaId\":1,\"data\":\"28-10-2026\"}",
                "{\"mesaId\":1,\"data\":\"2026-02-30\"}", "{malformado")) {
            mvc.perform(post("/api/reservas").header("Authorization", "Bearer " + jwt.gerarToken(maria))
                    .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.status").value(400));
        }
        for (LocalDate data : List.of(HOJE.minusDays(1), HOJE.plusDays(5), HOJE.plusDays(6), HOJE.plusDays(16))) {
            criar(maria, mesa, data).andExpect(status().isBadRequest());
            disponiveis(data).andExpect(status().isBadRequest()).andExpect(jsonPath("$.status").value(400));
        }
        assertThat(reservas.contar()).isZero();
    }

    @Test
    void aceitaHojeELimiteDeQuinzeDias() throws Exception {
        criar(maria, mesa, HOJE).andExpect(status().isCreated());
        criar(maria, mesa, HOJE.plusDays(15)).andExpect(status().isCreated());
    }

    @Test
    void recusaMesaInexistenteFixaEInativa() throws Exception {
        mvc.perform(post("/api/reservas").header("Authorization", "Bearer " + jwt.gerarToken(maria))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"mesaId\":9999999,\"data\":\"2026-10-26\"}"))
                .andExpect(status().isNotFound());
        var fixa = mesas.salvar(new Mesa(null, "018", "DEMO", TipoMesa.FIXA, true, "DEMO", 0, 100, null));
        var inativa = mesas.salvar(new Mesa(null, "005", "DEMO", TipoMesa.LIVRE, false, "DEMO", 0, 200, null));
        criar(maria, fixa, HOJE).andExpect(status().isConflict()).andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("fixa")));
        criar(maria, inativa, HOJE).andExpect(status().isConflict()).andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("inativa")));
        assertThat(reservas.contar()).isZero();
    }

    @Test
    void reservaOcupaApenasOSeuDiaEDiasConsecutivosSaoPermitidos() throws Exception {
        criar(maria, mesa, HOJE).andExpect(status().isCreated());
        disponiveis(HOJE).andExpect(jsonPath("$[*].id", org.hamcrest.Matchers.not(org.hamcrest.Matchers.hasItem(mesa.getId().intValue()))));
        disponiveis(HOJE.plusDays(1)).andExpect(jsonPath("$[*].id", org.hamcrest.Matchers.hasItem(mesa.getId().intValue())));
        criar(maria, mesa, HOJE.plusDays(1)).andExpect(status().isCreated());
    }

    @Test
    void reservasNaoCanceladasBloqueiamMesaEUsuarioMasCanceladasNao() throws Exception {
        for (var status : List.of(StatusReserva.PENDENTE, StatusReserva.CONFIRMADA)) {
            reservas.deletarTodos();
            reservas.salvarESincronizar(new Reserva(mesa, maria, HOJE, status));
            criar(joao, mesa, HOJE).andExpect(status().isConflict());
            criar(maria, outraMesa, HOJE).andExpect(status().isConflict());
        }
        reservas.deletarTodos();
        // O status é a referência de cancelamento, mesmo em dados legados sem timestamp.
        reservas.salvarESincronizar(new Reserva(mesa, maria, HOJE, StatusReserva.CANCELADA));
        disponiveis(HOJE).andExpect(jsonPath("$[*].id", org.hamcrest.Matchers.hasItem(mesa.getId().intValue())));
        criar(maria, mesa, HOJE).andExpect(status().isCreated());
    }

    @Test
    void recusaCancelamentoRepetidoSemAlterarReservaJaCancelada() throws Exception {
        var reserva = reservas.salvarESincronizar(new Reserva(mesa, maria, HOJE, StatusReserva.CONFIRMADA));
        var token = "Bearer " + jwt.gerarToken(maria);

        mvc.perform(patch("/api/reservas/{id}/cancelamento", reserva.getId())
                .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(content().string(""));

        var cancelada = reservas.buscarPorId(reserva.getId()).orElseThrow();
        var canceladaEm = cancelada.getCanceladaEm();
        assertThat(cancelada.getStatus()).isEqualTo(StatusReserva.CANCELADA);
        assertThat(canceladaEm).isNotNull();

        mvc.perform(patch("/api/reservas/{id}/cancelamento", reserva.getId())
                .header("Authorization", token))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("Reserva " + reserva.getId() + " já está cancelada."));

        var persistida = reservas.buscarPorId(reserva.getId()).orElseThrow();
        assertThat(persistida.getStatus()).isEqualTo(StatusReserva.CANCELADA);
        assertThat(persistida.getCanceladaEm()).isEqualTo(canceladaEm);

        criar(joao, mesa, HOJE).andExpect(status().isCreated());
    }

    @Test
    void cancelaReservaPendenteMesmoAposDataReservada() throws Exception {
        var reserva = reservas.salvarESincronizar(new Reserva(mesa, maria, HOJE.minusDays(1), StatusReserva.PENDENTE));

        mvc.perform(patch("/api/reservas/{id}/cancelamento", reserva.getId())
                .header("Authorization", "Bearer " + jwt.gerarToken(maria)))
                .andExpect(status().isOk())
                .andExpect(content().string(""));

        var persistida = reservas.buscarPorId(reserva.getId()).orElseThrow();
        assertThat(persistida.getStatus()).isEqualTo(StatusReserva.CANCELADA);
        assertThat(persistida.getCanceladaEm()).isNotNull();
    }

    @Test
    void exigeAutenticacaoAoCancelarReserva() throws Exception {
        var reserva = reservas.salvarESincronizar(new Reserva(mesa, maria, HOJE, StatusReserva.CONFIRMADA));

        mvc.perform(patch("/api/reservas/{id}/cancelamento", reserva.getId()))
                .andExpect(status().isUnauthorized());

        assertThat(reservas.buscarPorId(reserva.getId()).orElseThrow().getStatus())
                .isEqualTo(StatusReserva.CONFIRMADA);
    }

    @Test
    void recusaCancelarReservaDeOutroUsuarioSemAlterarReserva() throws Exception {
        var reserva = reservas.salvarESincronizar(new Reserva(mesa, maria, HOJE, StatusReserva.CONFIRMADA));

        mvc.perform(patch("/api/reservas/{id}/cancelamento", reserva.getId())
                .header("Authorization", "Bearer " + jwt.gerarToken(joao)))
                .andExpect(status().isForbidden());

        var persistida = reservas.buscarPorId(reserva.getId()).orElseThrow();
        assertThat(persistida.getStatus()).isEqualTo(StatusReserva.CONFIRMADA);
        assertThat(persistida.getCanceladaEm()).isNull();
    }

    @Test
    void retorna404AoCancelarReservaInexistente() throws Exception {
        mvc.perform(patch("/api/reservas/{id}/cancelamento", 999999L)
                .header("Authorization", "Bearer " + jwt.gerarToken(maria)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("Reserva 999999 não encontrada."));
    }

    @Test
    void listaHistoricoProprioComPeriodoStatusEOrdenacaoEstavel() throws Exception {
        var antiga = reservas.salvarESincronizar(new Reserva(mesa, maria, HOJE.minusDays(2), StatusReserva.PENDENTE));
        var confirmada = reservas.salvarESincronizar(new Reserva(mesa, maria, HOJE, StatusReserva.CONFIRMADA));
        var cancelada = reservas.salvarESincronizar(new Reserva(outraMesa, maria, HOJE, StatusReserva.CANCELADA));
        var futura = reservas.salvarESincronizar(new Reserva(mesa, maria, HOJE.plusDays(20), StatusReserva.CONFIRMADA));
        reservas.salvarESincronizar(new Reserva(outraMesa, joao, HOJE.plusDays(21), StatusReserva.CONFIRMADA));
        var token = "Bearer " + jwt.gerarToken(maria);

        for (int tentativa = 0; tentativa < 2; tentativa++) {
            mvc.perform(get("/api/reservas/minhas").header("Authorization", token))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[*].id", org.hamcrest.Matchers.contains(futura.getId().intValue(), cancelada.getId().intValue(),
                            confirmada.getId().intValue(), antiga.getId().intValue())));
        }
        mvc.perform(get("/api/reservas/minhas").header("Authorization", token)
                .param("dataInicio", HOJE.minusDays(2).toString()).param("dataFim", HOJE.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", org.hamcrest.Matchers.contains(cancelada.getId().intValue(),
                        confirmada.getId().intValue(), antiga.getId().intValue())));
        mvc.perform(get("/api/reservas/minhas").header("Authorization", token)
                .param("dataInicio", HOJE.toString()).param("status", "CONFIRMADA"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", org.hamcrest.Matchers.contains(futura.getId().intValue(), confirmada.getId().intValue())));
        mvc.perform(get("/api/reservas/minhas").header("Authorization", token)
                .param("dataFim", HOJE.minusDays(2).toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", org.hamcrest.Matchers.contains(antiga.getId().intValue())));
        mvc.perform(get("/api/reservas/minhas").header("Authorization", token)
                .param("data", HOJE.toString()).param("status", "CANCELADA"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", org.hamcrest.Matchers.contains(cancelada.getId().intValue())));
        mvc.perform(get("/api/reservas/minhas").header("Authorization", token).param("status", "PENDENTE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", org.hamcrest.Matchers.contains(antiga.getId().intValue())));
        mvc.perform(get("/api/reservas/minhas").header("Authorization", token)
                .param("dataInicio", HOJE.toString()).param("dataFim", HOJE.toString()).param("status", "CONFIRMADA"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", org.hamcrest.Matchers.contains(confirmada.getId().intValue())));
        mvc.perform(get("/api/reservas/minhas").header("Authorization", token).param("data", HOJE.plusDays(1).toString()))
                .andExpect(status().isOk()).andExpect(content().json("[]"));
    }

    @Test
    void validaFiltrosDaListagemEExigeAutenticacao() throws Exception {
        for (String query : List.of("status=INVALIDO", "data=28-10-2026", "dataInicio=2026-02-30",
                "dataFim=invalida", "dataInicio=2026-10-28&dataFim=2026-10-26",
                "data=2026-10-26&dataInicio=2026-10-26", "data=2026-10-26&dataFim=2026-10-26")) {
            mvc.perform(get("/api/reservas/minhas?" + query)
                    .header("Authorization", "Bearer " + jwt.gerarToken(maria)))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.status").value(400));
        }
        mvc.perform(get("/api/reservas/minhas")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/reservas/minhas").header("Authorization", "Bearer " + jwt.gerarToken(maria)))
                .andExpect(status().isOk()).andExpect(content().json("[]"));
    }

    @Test
    void primeiraReservaConcorrenteDaMesmaMesaConfirmaSomenteUma() throws Exception {
        assertThat(reservas.contar()).isZero();
        var resultados = disputar(() -> criar(maria, mesa, HOJE).andReturn().getResponse().getStatus(),
                () -> criar(joao, mesa, HOJE).andReturn().getResponse().getStatus());
        assertThat(resultados).containsExactlyInAnyOrder(201, 409);
        assertThat(reservas.contar()).isEqualTo(1);
    }

    @Test
    void mesmoUsuarioNaoReservaDuasMesasConcorrentementeNoMesmoDia() throws Exception {
        var resultados = disputar(() -> criar(maria, mesa, HOJE).andReturn().getResponse().getStatus(),
                () -> criar(maria, outraMesa, HOJE).andReturn().getResponse().getStatus());
        assertThat(resultados).containsExactlyInAnyOrder(201, 409);
        assertThat(reservas.contar()).isEqualTo(1);
    }

    @Test
    void mesasDiferentesParaUsuariosDiferentesPodemConfirmarJuntas() throws Exception {
        assertThat(disputar(() -> criar(maria, mesa, HOJE).andReturn().getResponse().getStatus(),
                () -> criar(joao, outraMesa, HOJE).andReturn().getResponse().getStatus())).containsOnly(201);
        assertThat(reservas.contar()).isEqualTo(2);
    }

    @Test
    void aguardaLockDaMesaERevalidaAposCommitConcorrente() throws Exception {
        var travada = new CountDownLatch(1);
        var liberar = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var titular = executor.submit(() -> transacao().executeWithoutResult(tx -> {
                var bloqueada = mesas.buscarParaReserva(mesa.getId()).orElseThrow();
                travada.countDown();
                aguardar(liberar);
                reservas.salvarESincronizar(new Reserva(bloqueada, maria, HOJE, StatusReserva.CONFIRMADA));
            }));
            try {
                assertThat(travada.await(5, TimeUnit.SECONDS)).isTrue();
                var concorrente = executor.submit(() -> criar(joao, mesa, HOJE).andReturn().getResponse().getStatus());
                assertThatThrownBy(() -> concorrente.get(300, TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);
                liberar.countDown();
                titular.get(10, TimeUnit.SECONDS);
                assertThat(concorrente.get(10, TimeUnit.SECONDS)).isEqualTo(409);
            } finally {
                liberar.countDown();
            }
        }
        assertThat(reservas.contar()).isEqualTo(1);
    }

    @Test
    void falhaDesfazReservaELiberaLocksParaNovaTentativa() throws Exception {
        assertThatThrownBy(() -> transacao().executeWithoutResult(tx -> {
            service.criar(new CriarReservaRequest(mesa.getId(), HOJE), identidade(maria));
            throw new IllegalStateException("Falha posterior à escrita");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(reservas.contar()).isZero();
        criar(joao, mesa, HOJE).andExpect(status().isCreated());
        assertThat(reservas.contar()).isEqualTo(1);
    }

    ResultActions criar(Usuario usuario, Mesa mesa, LocalDate data) throws Exception {
        return mvc.perform(post("/api/reservas").header("Authorization", "Bearer " + jwt.gerarToken(usuario))
                .contentType(MediaType.APPLICATION_JSON).content(corpo(mesa, data)));
    }

    ResultActions disponiveis(LocalDate data) throws Exception {
        return mvc.perform(get("/api/mesas/disponiveis").param("data", data.toString())
                .header("Authorization", "Bearer " + jwt.gerarToken(maria)));
    }

    static String corpo(Mesa mesa, LocalDate data) {
        return "{\"mesaId\":" + mesa.getId() + ",\"data\":\"" + data + "\"}";
    }

    static UsuarioAutenticado identidade(Usuario u) {
        return new UsuarioAutenticado(u.getId(), u.getNome(), u.getEmail(), u.getPapel());
    }

    TransactionTemplate transacao() {
        var template = new TransactionTemplate(transactionManager);
        template.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
        return template;
    }

    static List<Integer> disputar(Callable<Integer> primeira, Callable<Integer> segunda) throws Exception {
        var prontas = new CountDownLatch(2);
        var inicio = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var a = executor.submit(() -> { prontas.countDown(); aguardar(inicio); return primeira.call(); });
            var b = executor.submit(() -> { prontas.countDown(); aguardar(inicio); return segunda.call(); });
            try {
                assertThat(prontas.await(5, TimeUnit.SECONDS)).isTrue();
            } finally {
                inicio.countDown();
            }
            return List.of(a.get(15, TimeUnit.SECONDS), b.get(15, TimeUnit.SECONDS));
        }
    }

    static void aguardar(CountDownLatch latch) {
        try {
            if (!latch.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Tempo de espera excedido");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }
}
