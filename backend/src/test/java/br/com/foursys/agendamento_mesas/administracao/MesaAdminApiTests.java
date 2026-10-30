package br.com.foursys.agendamento_mesas.administracao;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import br.com.foursys.agendamento_mesas.dto.request.AtribuirResponsavelRequest;
import br.com.foursys.agendamento_mesas.enums.*;
import br.com.foursys.agendamento_mesas.model.*;
import br.com.foursys.agendamento_mesas.port.out.*;
import br.com.foursys.agendamento_mesas.infrastructure.persistence.repository.UsuarioJpaRepository;
import br.com.foursys.agendamento_mesas.security.JwtService;
import br.com.foursys.agendamento_mesas.service.MesaAdminService;
import br.com.foursys.agendamento_mesas.service.UsuarioService;
import java.time.*;
import java.util.List;
import java.util.concurrent.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.DataAccessException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import static org.mockito.Mockito.*;

/** Requisições reais e transações com commit, inclusive nas disputas concorrentes. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(MesaAdminApiTests.RelogioTeste.class)
public class MesaAdminApiTests {
    static final LocalDate HOJE = LocalDate.of(2026, 10, 26);
    @Autowired MockMvc mvc;
    @Autowired UsuarioJpaRepository usuariosPort;

    @Autowired UsuarioRepositoryPort usuarios;
    @Autowired MesaRepositoryPort mesas;
    @Autowired ReservaRepositoryPort reservas;
    @Autowired MesaAdminService service;
    @Autowired JwtService jwt;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager transactionManager;
    Usuario admin, maria, joao, inativo;
    Mesa mesa, outraMesa;

    @TestConfiguration
    public static class RelogioTeste {
        @Bean @Primary
        Clock relogioAdminTeste() {
            return Clock.fixed(Instant.parse("2026-10-26T12:00:00Z"), ZoneId.of("America/Sao_Paulo"));
        }
    }

    @BeforeEach
    void preparar() {
        reservas.deletarTodos();
        mesas.deletarTodos();
        usuariosPort.deleteAll();
        admin = usuariosPort.save(new Usuario("Administrador", "admin@teste.com", "hash", PerfilUsuario.ADMIN, true));
        maria = usuariosPort.save(new Usuario("Maria", "maria@teste.com", "hash", PerfilUsuario.USUARIO, true));
        joao = usuariosPort.save(new Usuario("Joao", "joao@teste.com", "hash", PerfilUsuario.USUARIO, true));
        inativo = usuariosPort.save(new Usuario("Inativo", "inativo@teste.com", "hash", PerfilUsuario.USUARIO, false));
        mesa = mesas.salvar(new Mesa(null, "044", "DEMO", TipoMesa.LIVRE, true, "DEMO", 0, 0));
        outraMesa = mesas.salvar(new Mesa(null, "053", "DEMO", TipoMesa.LIVRE, true, "DEMO", 200, 0));
    }

    @Test
    void exigeAdminEmTodasAsOperacoes() throws Exception {
        for (int i = 0; i < 5; i++) {
            mvc.perform(operacao(i)).andExpect(status().isUnauthorized());
            mvc.perform(operacao(i).header("Authorization", token(maria))).andExpect(status().isForbidden());
            mvc.perform(operacao(i).header("Authorization", "Bearer " + jwt.gerarToken(admin, Duration.ofHours(-2))))
                    .andExpect(status().isUnauthorized());
        }
        assertThat(mesas.buscarPorResponsavelId(maria.getId())).isEmpty();
    }

    private MockHttpServletRequestBuilder operacao(int i) {
        return switch (i) {
            case 0 -> get("/api/admin/usuarios");
            case 1 -> get("/api/admin/mesas");
            case 2 -> put("/api/admin/mesas/{id}/responsavel", mesa.getId()).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"usuarioId\":" + maria.getId() + "}");
            case 3 -> delete("/api/admin/mesas/{id}/responsavel", mesa.getId());
            default -> patch("/api/admin/mesas/{id}/estado", mesa.getId()).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"ativa\":false}");
        };
    }

    @Test
    void listaApenasAtivosOrdenadosComDadosMinimosEListaVaziaValida() throws Exception {
        mvc.perform(get("/api/admin/usuarios").param("ativo", "true").header("Authorization", token(admin)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].nome").value("Administrador"))
                .andExpect(jsonPath("$[1].nome").value("Joao"))
                .andExpect(jsonPath("$[2].id").value(maria.getId()))
                .andExpect(jsonPath("$[2].email").value(maria.getEmail()))
                .andExpect(jsonPath("$[2].length()").value(3))
                .andExpect(jsonPath("$[2].senhaHash").doesNotExist())
                .andExpect(jsonPath("$[2].token").doesNotExist());
        mvc.perform(get("/api/admin/usuarios").param("ativo", "false").header("Authorization", token(admin)))
                .andExpect(status().isBadRequest());
        var repositorio = mock(UsuarioRepositoryPort.class);
        when(repositorio.findByAtivoTrueOrderByNomeAscIdAsc()).thenReturn(List.of());
        assertThat(new UsuarioService(repositorio, mock(PasswordEncoder.class)).listarAtivos()).isEmpty();
    }

    @Test
    void listaMesasAtivasInativasEFixasLegadasSemExporResponsavelNoCatalogoComum() throws Exception {
        var legada = mesas.salvar(new Mesa(null, "001", "DEMO", TipoMesa.FIXA, false, "DEMO", 0, 20));
        atribuir(mesa, maria).andExpect(status().isOk());
        mvc.perform(get("/api/admin/mesas").header("Authorization", token(admin)))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(legada.getId()))
                .andExpect(jsonPath("$[0].ativa").value(false)).andExpect(jsonPath("$[0].responsavel").isEmpty())
                .andExpect(jsonPath("$[1].responsavel.id").value(maria.getId()))
                .andExpect(jsonPath("$[1].responsavel.nome").value("Maria"));
        mvc.perform(get("/api/mesas").header("Authorization", token(joao)))
                .andExpect(status().isOk()).andExpect(jsonPath("$[1].responsavel").doesNotExist());
        desfixar(legada).andExpect(status().isOk()).andExpect(jsonPath("$.ativa").value(false))
                .andExpect(jsonPath("$.tipo").value("LIVRE"));
    }

    @Test
    void fixaTrocaEDesfixaSemCriarReservasComConsultaDaPropriaMesa() throws Exception {
        mvc.perform(get("/api/mesas/minha-fixa").header("Authorization", token(maria)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.mesa").isEmpty());
        atribuir(mesa, maria).andExpect(status().isOk()).andExpect(jsonPath("$.tipo").value("FIXA"))
                .andExpect(jsonPath("$.ativa").value(true)).andExpect(jsonPath("$.responsavel.id").value(maria.getId()));
        atribuir(mesa, maria).andExpect(status().isOk()); // Mesmo vínculo é idempotente.
        mvc.perform(get("/api/mesas/minha-fixa").param("usuarioId", joao.getId().toString())
                .header("Authorization", token(maria))).andExpect(jsonPath("$.mesa.id").value(mesa.getId()));
        reservar(maria, outraMesa).andExpect(status().isConflict());
        atribuir(outraMesa, maria).andExpect(status().isConflict());
        atribuir(mesa, joao).andExpect(status().isOk()).andExpect(jsonPath("$.responsavel.id").value(joao.getId()));
        reservar(maria, outraMesa).andExpect(status().isCreated());
        reservar(joao, mesa).andExpect(status().isConflict());
        desfixar(mesa).andExpect(status().isOk()).andExpect(jsonPath("$.tipo").value("LIVRE"))
                .andExpect(jsonPath("$.responsavel").isEmpty());
        reservar(joao, mesa).andExpect(status().isCreated());
        assertThat(reservas.contar()).isEqualTo(2);
    }

    @Test
    void recusaMesaInativaUsuariosInvalidosECamposInvalidosSemAlteracoes() throws Exception {
        estado(mesa, false).andExpect(status().isOk());
        atribuir(mesa, maria).andExpect(status().isConflict());
        estado(mesa, true).andExpect(status().isOk());
        atribuir(mesa, inativo).andExpect(status().isConflict());
        mvc.perform(put("/api/admin/mesas/{id}/responsavel", mesa.getId()).header("Authorization", token(admin))
                .contentType(MediaType.APPLICATION_JSON).content("{\"usuarioId\":999999}"))
                .andExpect(status().isNotFound());
        for (String body : List.of("{}", "{\"usuarioId\":0}", "null", "{malformado")) {
            mvc.perform(put("/api/admin/mesas/{id}/responsavel", mesa.getId()).header("Authorization", token(admin))
                    .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
        }
        for (String body : List.of("{}", "null", "{\"ativa\":null}", "{\"ativa\":\"invalida\"}")) {
            mvc.perform(patch("/api/admin/mesas/{id}/estado", mesa.getId()).header("Authorization", token(admin))
                    .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
        }
        mvc.perform(delete("/api/admin/mesas/999999/responsavel").header("Authorization", token(admin)))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/admin/mesas/0/responsavel").header("Authorization", token(admin)))
                .andExpect(status().isBadRequest());
        assertThat(mesas.buscarPorId(mesa.getId()).orElseThrow().getTipo()).isEqualTo(TipoMesa.LIVRE);
    }

    @Test
    void inativacaoExigeDesfixarMesmoComResponsavelInativoENaoPermiteReatribuicao() throws Exception {
        atribuir(mesa, maria).andExpect(status().isOk());
        estado(mesa, false).andExpect(status().isConflict());
        jdbc.update("update usuarios set ativo = false where id = ?", maria.getId());
        estado(mesa, false).andExpect(status().isConflict());
        atribuir(mesa, maria).andExpect(status().isConflict()); // Revalida, mesmo com o mesmo ID.
        desfixar(mesa).andExpect(status().isOk());
        estado(mesa, false).andExpect(status().isOk()).andExpect(jsonPath("$.tipo").value("LIVRE"));
        reservar(joao, mesa).andExpect(status().isConflict());
        atribuir(mesa, joao).andExpect(status().isConflict());
        estado(mesa, true).andExpect(status().isOk()).andExpect(jsonPath("$.responsavel").isEmpty());
        reservar(joao, mesa).andExpect(status().isCreated());
    }

    @Test
    void trocaRecusadaPreservaResponsavelAnterior() throws Exception {
        atribuir(mesa, maria).andExpect(status().isOk());
        atribuir(outraMesa, joao).andExpect(status().isOk());
        atribuir(mesa, joao).andExpect(status().isConflict());
        assertThat(mesas.buscarPorResponsavelId(maria.getId())).hasValueSatisfying(m -> assertThat(m.getId()).isEqualTo(mesa.getId()));
        assertThat(mesas.buscarPorResponsavelId(joao.getId())).hasValueSatisfying(m -> assertThat(m.getId()).isEqualTo(outraMesa.getId()));
    }

    @Test
    void reservasDeHojeEFuturasImpedemFixacaoEInativacaoSemCancelamentoAutomatico() throws Exception {
        for (var status : List.of(StatusReserva.PENDENTE, StatusReserva.CONFIRMADA)) {
            for (var data : List.of(HOJE, HOJE.plusDays(1))) {
                reservas.deletarTodos();
                var reserva = reservas.salvarESincronizar(new Reserva(mesa, joao, data, status));
                atribuir(mesa, maria).andExpect(status().isConflict());
                estado(mesa, false).andExpect(status().isConflict());
                atribuir(outraMesa, joao).andExpect(status().isConflict());
                assertThat(reservas.buscarPorId(reserva.getId()).orElseThrow().getStatus()).isEqualTo(status);
            }
        }
        reservas.deletarTodos();
        reservas.salvarESincronizar(new Reserva(mesa, joao, HOJE, StatusReserva.CANCELADA));
        reservas.salvarESincronizar(new Reserva(mesa, joao, HOJE.minusDays(1), StatusReserva.CONFIRMADA));
        atribuir(mesa, maria).andExpect(status().isOk());
    }

    @Test
    void cancelamentoPreservaTipoAtivacaoEResponsavel() throws Exception {
        var antiga = reservas.salvarESincronizar(new Reserva(mesa, maria, HOJE.minusDays(1), StatusReserva.CONFIRMADA));
        atribuir(mesa, joao).andExpect(status().isOk());
        mvc.perform(patch("/api/reservas/{id}/cancelamento", antiga.getId()).header("Authorization", token(maria)))
                .andExpect(status().isOk());
        assertThat(mesas.buscarPorResponsavelId(joao.getId())).hasValueSatisfying(m -> {
            assertThat(m.getId()).isEqualTo(mesa.getId());
            assertThat(m.getTipo()).isEqualTo(TipoMesa.FIXA);
            assertThat(m.isAtiva()).isTrue();
        });
        var outra = reservas.salvarESincronizar(new Reserva(outraMesa, maria, HOJE.minusDays(1), StatusReserva.PENDENTE));
        estado(outraMesa, false).andExpect(status().isOk());
        mvc.perform(patch("/api/reservas/{id}/cancelamento", outra.getId()).header("Authorization", token(maria)))
                .andExpect(status().isOk());
        assertThat(mesas.buscarPorId(outraMesa.getId()).orElseThrow().isAtiva()).isFalse();
        var cancelada = reservas.buscarPorId(antiga.getId()).orElseThrow();
        assertThat(cancelada.getStatus()).isEqualTo(StatusReserva.CANCELADA);
        assertThat(cancelada.getCanceladaEm()).isEqualTo(LocalDateTime.of(2026, 10, 26, 9, 0));
    }

    @Test
    void bancoGaranteUnicidadeEVinculoComMesaAtivaFixa() throws Exception {
        atribuir(mesa, maria).andExpect(status().isOk());
        assertThatThrownBy(() -> jdbc.update("update mesas set tipo = 'FIXA', responsavel_id = ? where id = ?",
                maria.getId(), outraMesa.getId())).isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("update mesas set ativa = false where id = ?", mesa.getId()))
                .isInstanceOf(DataAccessException.class).hasMessageContaining("ck_mesas_responsavel_ativo_fixa");
        assertThatThrownBy(() -> jdbc.update("update mesas set tipo = 'LIVRE' where id = ?", mesa.getId()))
                .isInstanceOf(DataAccessException.class).hasMessageContaining("ck_mesas_responsavel_ativo_fixa");
    }

    @Test
    void rollbackDesfazAtribuicao() {
        assertThatThrownBy(() -> transacao().executeWithoutResult(tx -> {
            service.atribuir(mesa.getId(), new AtribuirResponsavelRequest(maria.getId()));
            throw new IllegalStateException("Falha posterior à escrita");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(mesas.buscarPorResponsavelId(maria.getId())).isEmpty();
        assertThat(mesas.buscarPorId(mesa.getId()).orElseThrow().getTipo()).isEqualTo(TipoMesa.LIVRE);
    }

    @Test
    void doisAdministradoresNaoAtribuemDuasMesasAoMesmoUsuario() throws Exception {
        assertThat(disputar(() -> codigo(atribuir(mesa, maria)), () -> codigo(atribuir(outraMesa, maria))))
                .containsExactlyInAnyOrder(200, 409);
        assertThat(jdbc.queryForObject("select count(*) from mesas where responsavel_id = ?", Integer.class, maria.getId())).isEqualTo(1);
    }

    @Test
    void fixacaoConcorrenteAInativacaoNaoProduzMesaInativaAtribuida() throws Exception {
        assertThat(disputar(() -> codigo(atribuir(mesa, maria)), () -> codigo(estado(mesa, false))))
                .containsExactlyInAnyOrder(200, 409);
    }

    @Test
    void fixacaoConcorrenteAReservaDoMesmoUsuarioNaoPermiteAmbas() throws Exception {
        var resultados = disputar(() -> codigo(atribuir(mesa, maria)), () -> codigo(reservar(maria, outraMesa)));
        assertThat(resultados).contains(409);
        assertThat(resultados.stream().filter(s -> s == 200 || s == 201).count()).isEqualTo(1);
    }

    @Test
    void fixacaoConcorrenteAReservaDaMesmaMesaNaoPermiteAmbas() throws Exception {
        var resultados = disputar(() -> codigo(atribuir(mesa, maria)), () -> codigo(reservar(joao, mesa)));
        assertThat(resultados).contains(409);
        assertThat(resultados.stream().filter(s -> s == 200 || s == 201).count()).isEqualTo(1);
    }

    @Test
    void inativacaoConcorrenteAReservaNaoPermiteAmbas() throws Exception {
        var resultados = disputar(() -> codigo(estado(mesa, false)), () -> codigo(reservar(joao, mesa)));
        assertThat(resultados).contains(409);
        assertThat(resultados.stream().filter(s -> s == 200 || s == 201).count()).isEqualTo(1);
    }

    @Test
    void doisAdministradoresAlterandoMesmaMesaMantemUmResponsavel() throws Exception {
        var resultados = disputar(() -> codigo(atribuir(mesa, maria)), () -> codigo(atribuir(mesa, joao)));
        assertThat(resultados).contains(200).allMatch(s -> s == 200 || s == 409);
        assertThat(jdbc.queryForObject("select count(*) from mesas where responsavel_id is not null", Integer.class)).isEqualTo(1);
    }

    String token(Usuario usuario) { return "Bearer " + jwt.gerarToken(usuario); }

    ResultActions atribuir(Mesa mesa, Usuario usuario) throws Exception {
        return mvc.perform(put("/api/admin/mesas/{id}/responsavel", mesa.getId()).header("Authorization", token(admin))
                .contentType(MediaType.APPLICATION_JSON).content("{\"usuarioId\":" + usuario.getId() + "}"));
    }

    ResultActions desfixar(Mesa mesa) throws Exception {
        return mvc.perform(delete("/api/admin/mesas/{id}/responsavel", mesa.getId()).header("Authorization", token(admin)));
    }

    ResultActions estado(Mesa mesa, boolean ativa) throws Exception {
        return mvc.perform(patch("/api/admin/mesas/{id}/estado", mesa.getId()).header("Authorization", token(admin))
                .contentType(MediaType.APPLICATION_JSON).content("{\"ativa\":" + ativa + "}"));
    }

    ResultActions reservar(Usuario usuario, Mesa mesa) throws Exception {
        return mvc.perform(post("/api/reservas").header("Authorization", token(usuario))
                .contentType(MediaType.APPLICATION_JSON).content("{\"mesaId\":" + mesa.getId() + ",\"data\":\"" + HOJE + "\"}"));
    }

    int codigo(ResultActions resposta) { return resposta.andReturn().getResponse().getStatus(); }

    TransactionTemplate transacao() {
        var tx = new TransactionTemplate(transactionManager);
        tx.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
        return tx;
    }

    static List<Integer> disputar(Callable<Integer> primeira, Callable<Integer> segunda) throws Exception {
        var prontas = new CountDownLatch(2);
        var iniciar = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var a = executor.submit(() -> { prontas.countDown(); iniciar.await(); return primeira.call(); });
            var b = executor.submit(() -> { prontas.countDown(); iniciar.await(); return segunda.call(); });
            try { assertThat(prontas.await(5, TimeUnit.SECONDS)).isTrue(); }
            finally { iniciar.countDown(); }
            return List.of(a.get(15, TimeUnit.SECONDS), b.get(15, TimeUnit.SECONDS));
        }
    }
}
