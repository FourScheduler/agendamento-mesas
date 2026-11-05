package br.com.foursys.agendamento_mesas.catalogo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.foursys.agendamento_mesas.enums.PerfilUsuario;
import br.com.foursys.agendamento_mesas.enums.StatusReserva;
import br.com.foursys.agendamento_mesas.enums.TipoMesa;
import br.com.foursys.agendamento_mesas.model.Mesa;
import br.com.foursys.agendamento_mesas.model.Reserva;
import br.com.foursys.agendamento_mesas.model.Usuario;
import br.com.foursys.agendamento_mesas.port.out.MesaRepositoryPort;
import br.com.foursys.agendamento_mesas.port.out.ReservaRepositoryPort;
import br.com.foursys.agendamento_mesas.port.out.UsuarioRepositoryPort;
import br.com.foursys.agendamento_mesas.reservas.ReservaApiTests;
import br.com.foursys.agendamento_mesas.security.JwtService;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/** A API precisa efetuar commit antes de responder; não há transação no teste. */
@ActiveProfiles("test")
@SpringBootTest
@AutoConfigureMockMvc
@Import(ReservaApiTests.RelogioTeste.class)
public class ConcorrenciaAdministrativaApiTests {
    private static final LocalDate HOJE = LocalDate.of(2026, 10, 26);
    @Autowired MockMvc mvc;
    @MockitoSpyBean MesaRepositoryPort mesas;
    @Autowired ReservaRepositoryPort reservas;
    @Autowired UsuarioRepositoryPort usuarios;
    @Autowired JwtService jwt;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager transactionManager;
    Usuario admin;
    Usuario maria;
    Usuario joao;
    Mesa primeira;
    Mesa segunda;

    @BeforeEach
    void preparar() {
        limpar();
        admin = usuarios.salvar(new Usuario("Admin", "admin@teste.com", "hash", PerfilUsuario.ADMIN, true));
        maria = usuarios.salvar(new Usuario("Maria", "maria@teste.com", "hash", PerfilUsuario.USUARIO, true));
        joao = usuarios.salvar(new Usuario("João", "joao@teste.com", "hash", PerfilUsuario.USUARIO, true));
        primeira = mesas.salvar(new Mesa(null, "044", "DEMO", TipoMesa.LIVRE, true, "DEMO", 0, 0, null));
        segunda = mesas.salvar(new Mesa(null, "053", "DEMO", TipoMesa.LIVRE, true, "DEMO", 200, 0, null));
    }

    @AfterEach
    void limpar() {
        reservas.deletarTodos();
        mesas.deletarTodos();
        usuarios.deletarTodos();
    }

    @Test
    void reservasDaMesaDeHojeEmDianteImpedemFixacaoInativacaoETipoFixo() throws Exception {
        for (var estado : List.of(StatusReserva.PENDENTE, StatusReserva.CONFIRMADA)) {
            for (var data : List.of(HOJE, HOJE.plusDays(1), HOJE.plusDays(20))) {
                reservas.deletarTodos();
                var existente = reservas.salvarESincronizar(new Reserva(primeira, joao, data, estado));

                atribuir(primeira, "fixar", maria).andExpect(status().isConflict())
                    .andExpect(jsonPath("$.detail").value(
                        "Mesa 044 possui reservas não canceladas de hoje em diante. Revise as reservas antes de alterar a mesa."));
                inativar(primeira).andExpect(status().isConflict());
                alterarTipo(primeira, TipoMesa.FIXA).andExpect(status().isConflict());

                assertThat(responsavel(primeira)).isNull();
                var mesa = mesas.buscarPorId(primeira.getId()).orElseThrow();
                assertThat(mesa.isAtiva()).isTrue();
                assertThat(mesa.getTipo()).isEqualTo(TipoMesa.LIVRE);
                var preservada = reservas.buscarPorId(existente.getId()).orElseThrow();
                assertThat(preservada.getData()).isEqualTo(data);
                assertThat(preservada.getStatus()).isEqualTo(estado);
            }
        }
    }

    @Test
    void reservaLegadaDaMesaImpedeTrocaEPreservaResponsavelAnterior() throws Exception {
        atribuir(primeira, "fixar", maria).andExpect(status().isOk());
        reservas.salvarESincronizar(new Reserva(primeira, joao, HOJE, StatusReserva.CONFIRMADA));

        atribuir(primeira, "responsavel", admin).andExpect(status().isConflict());
        assertThat(responsavel(primeira)).isEqualTo(maria.getId());
        assertThat(reservas.contar()).isEqualTo(1);
        // Manter o próprio responsável não é uma nova atribuição.
        atribuir(primeira, "responsavel", maria).andExpect(status().isOk());
    }

    @Test
    void reservasDoUsuarioImpedemFixacaoETrocaSemCancelarReservas() throws Exception {
        for (var estado : List.of(StatusReserva.PENDENTE, StatusReserva.CONFIRMADA)) {
            for (var data : List.of(HOJE, HOJE.plusDays(20))) {
                reservas.deletarTodos();
                reservas.salvarESincronizar(new Reserva(segunda, joao, data, estado));

                atribuir(primeira, "fixar", joao).andExpect(status().isConflict())
                    .andExpect(jsonPath("$.detail").value(
                        "O usuário possui reservas não canceladas de hoje em diante e não pode receber uma mesa fixa."));
                atribuir(primeira, "fixar", maria).andExpect(status().isOk());
                atribuir(primeira, "responsavel", joao).andExpect(status().isConflict());
                assertThat(responsavel(primeira)).isEqualTo(maria.getId());
                assertThat(reservas.buscarTodos()).singleElement()
                    .satisfies(r -> assertThat(r.getStatus()).isEqualTo(estado));
                desfixar(primeira).andExpect(status().isOk());
            }
        }
    }

    @Test
    void reservasPassadasOuCanceladasNaoBloqueiamMudancasAdministrativas() throws Exception {
        reservas.salvarESincronizar(new Reserva(primeira, joao, HOJE.minusDays(1), StatusReserva.CONFIRMADA));
        reservas.salvarESincronizar(new Reserva(primeira, maria, HOJE.plusDays(1), StatusReserva.CANCELADA));
        reservas.salvarESincronizar(new Reserva(segunda, maria, HOJE.minusDays(1), StatusReserva.PENDENTE));

        atribuir(primeira, "fixar", maria).andExpect(status().isOk());
        inativar(segunda).andExpect(status().isOk());
        assertThat(responsavel(primeira)).isEqualTo(maria.getId());
        assertThat(mesas.buscarPorId(segunda.getId()).orElseThrow().isAtiva()).isFalse();
        assertThat(reservas.contar()).isEqualTo(3);
    }

    @Test
    void fixacaoEAgendamentoDaMesmaMesaNaoConcluemJuntos() throws Exception {
        validarUmSucessoEUmConflito(disputar(
            () -> atribuir(primeira, "fixar", maria).andReturn().getResponse().getStatus(),
            () -> reservar(primeira, joao).andReturn().getResponse().getStatus()));

        if (responsavel(primeira) == null) {
            assertThat(reservas.contar()).isEqualTo(1);
            assertThat(mesas.buscarPorId(primeira.getId()).orElseThrow().getTipo()).isEqualTo(TipoMesa.LIVRE);
        } else {
            assertThat(reservas.contar()).isZero();
            assertThat(responsavel(primeira)).isEqualTo(maria.getId());
        }
    }

    @Test
    void inativacaoEAgendamentoDaMesmaMesaNaoConcluemJuntos() throws Exception {
        validarUmSucessoEUmConflito(disputar(
            () -> inativar(primeira).andReturn().getResponse().getStatus(),
            () -> reservar(primeira, joao).andReturn().getResponse().getStatus()));

        assertThat(mesas.buscarPorId(primeira.getId()).orElseThrow().isAtiva())
            .isEqualTo(reservas.contar() == 1);
        assertThat(responsavel(primeira)).isNull();
    }

    @Test
    void fixacaoDeOutraMesaEAgendamentoPeloMesmoUsuarioNaoConcluemJuntos() throws Exception {
        validarUmSucessoEUmConflito(disputar(
            () -> atribuir(segunda, "fixar", maria).andReturn().getResponse().getStatus(),
            () -> reservar(primeira, maria).andReturn().getResponse().getStatus()));

        assertThat(reservas.contar()).isEqualTo(responsavel(segunda) == null ? 1 : 0);
    }

    @Test
    void trocaDeResponsavelEAgendamentoPeloNovoUsuarioNaoConcluemJuntos() throws Exception {
        atribuir(segunda, "fixar", joao).andExpect(status().isOk());
        validarUmSucessoEUmConflito(disputar(
            () -> atribuir(segunda, "responsavel", maria).andReturn().getResponse().getStatus(),
            () -> reservar(primeira, maria).andReturn().getResponse().getStatus()));

        if (reservas.contar() == 1) assertThat(responsavel(segunda)).isEqualTo(joao.getId());
        else assertThat(responsavel(segunda)).isEqualTo(maria.getId());
    }

    @Test
    void tipoFixoDiretoEAgendamentoNaoContornamBloqueios() throws Exception {
        validarUmSucessoEUmConflito(disputar(
            () -> alterarTipo(primeira, TipoMesa.FIXA).andReturn().getResponse().getStatus(),
            () -> reservar(primeira, joao).andReturn().getResponse().getStatus()));

        var tipo = mesas.buscarPorId(primeira.getId()).orElseThrow().getTipo();
        assertThat(reservas.contar()).isEqualTo(tipo == TipoMesa.FIXA ? 0 : 1);
    }

    @Test
    void desfixacaoRevalidaMesaDepoisDeEsperarLockSemReativaLa() throws Exception {
        atribuir(primeira, "fixar", maria).andExpect(status().isOk());
        var travada = new CountDownLatch(1);
        var liberar = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var titular = executor.submit(() -> transacao().executeWithoutResult(tx -> {
                var mesa = mesas.buscarParaReserva(primeira.getId()).orElseThrow();
                travada.countDown();
                aguardar(liberar);
                mesa.setAtiva(false); // Simula estado legado confirmado durante a espera.
                mesas.salvarESincronizar(mesa);
            }));
            try {
                assertThat(travada.await(5, TimeUnit.SECONDS)).isTrue();
                var concorrente = executor.submit(() -> desfixar(primeira).andReturn().getResponse().getStatus());
                assertThatThrownBy(() -> concorrente.get(300, TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);
                liberar.countDown();
                titular.get(10, TimeUnit.SECONDS);
                assertThat(concorrente.get(10, TimeUnit.SECONDS)).isEqualTo(200);
            } finally { liberar.countDown(); }
        }
        assertThat(responsavel(primeira)).isNull();
        assertThat(mesas.buscarPorId(primeira.getId()).orElseThrow().isAtiva()).isFalse();
    }

    @Test
    void desfixacaoRecusaContextoDeResponsavelAlteradoEnquantoEsperava() throws Exception {
        atribuir(primeira, "fixar", maria).andExpect(status().isOk());
        var travado = new CountDownLatch(1);
        var observado = new CountDownLatch(1);
        var liberar = new CountDownLatch(1);
        doAnswer(invocacao -> {
            var resultado = invocacao.callRealMethod();
            observado.countDown();
            return resultado;
        }).when(mesas).buscarResponsavelId(primeira.getId());

        try (var executor = Executors.newFixedThreadPool(2)) {
            var titular = executor.submit(() -> transacao().executeWithoutResult(tx -> {
                usuarios.buscarParaReserva(maria.getId()).orElseThrow();
                travado.countDown();
                aguardar(liberar);
                var novo = usuarios.buscarParaReserva(joao.getId()).orElseThrow();
                var mesa = mesas.buscarParaReserva(primeira.getId()).orElseThrow();
                mesa.setResponsavel(novo);
                mesas.salvarESincronizar(mesa);
            }));
            try {
                assertThat(travado.await(5, TimeUnit.SECONDS)).isTrue();
                var concorrente = executor.submit(() -> desfixar(primeira).andReturn().getResponse().getStatus());
                assertThat(observado.await(5, TimeUnit.SECONDS)).isTrue();
                assertThatThrownBy(() -> concorrente.get(300, TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);
                liberar.countDown();
                titular.get(10, TimeUnit.SECONDS);
                assertThat(concorrente.get(10, TimeUnit.SECONDS)).isEqualTo(409);
            } finally { liberar.countDown(); }
        }
        assertThat(responsavel(primeira)).isEqualTo(joao.getId());
        assertThat(mesas.buscarPorId(primeira.getId()).orElseThrow().getTipo()).isEqualTo(TipoMesa.FIXA);
    }

    ResultActions atribuir(Mesa mesa, String operacao, Usuario usuario) throws Exception {
        return mvc.perform(patch("/api/admin/mesas/{id}/{operacao}", mesa.getId(), operacao)
            .header("Authorization", "Bearer " + jwt.gerarToken(admin)).contentType(MediaType.APPLICATION_JSON)
            .content("{\"usuarioId\":" + usuario.getId() + "}"));
    }

    ResultActions desfixar(Mesa mesa) throws Exception {
        return mvc.perform(patch("/api/admin/mesas/{id}/desfixar", mesa.getId())
            .header("Authorization", "Bearer " + jwt.gerarToken(admin)));
    }

    ResultActions inativar(Mesa mesa) throws Exception {
        return mvc.perform(patch("/api/admin/mesas/{id}/ativacao", mesa.getId())
            .header("Authorization", "Bearer " + jwt.gerarToken(admin)).contentType(MediaType.APPLICATION_JSON)
            .content("{\"ativa\":false}"));
    }

    ResultActions alterarTipo(Mesa mesa, TipoMesa tipo) throws Exception {
        return mvc.perform(patch("/api/admin/mesas/{id}/tipo", mesa.getId())
            .header("Authorization", "Bearer " + jwt.gerarToken(admin)).contentType(MediaType.APPLICATION_JSON)
            .content("{\"tipo\":\"" + tipo + "\"}"));
    }

    ResultActions reservar(Mesa mesa, Usuario usuario) throws Exception {
        return mvc.perform(post("/api/reservas").header("Authorization", "Bearer " + jwt.gerarToken(usuario))
            .contentType(MediaType.APPLICATION_JSON).content("{\"mesaId\":" + mesa.getId() + ",\"data\":\"" + HOJE + "\"}"));
    }

    Long responsavel(Mesa mesa) {
        return jdbc.queryForObject("SELECT responsavel_id FROM mesas WHERE id = ?", Long.class, mesa.getId());
    }

    TransactionTemplate transacao() {
        var template = new TransactionTemplate(transactionManager);
        template.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
        return template;
    }

    static void validarUmSucessoEUmConflito(List<Integer> resultados) {
        assertThat(resultados).contains(409);
        assertThat(resultados).filteredOn(s -> s == 200 || s == 201).hasSize(1);
    }

    static List<Integer> disputar(Callable<Integer> primeira, Callable<Integer> segunda) throws Exception {
        return ResponsavelUnicoApiTests.disputar(primeira, segunda);
    }

    static void aguardar(CountDownLatch latch) {
        ResponsavelUnicoApiTests.aguardar(latch);
    }
}
