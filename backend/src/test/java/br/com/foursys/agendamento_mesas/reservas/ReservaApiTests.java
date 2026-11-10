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
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
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
    Usuario admin;
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
        usuarios.deletarTodos();
        maria = usuarios.salvar(new Usuario("Maria", "maria@teste.com", "hash", PerfilUsuario.USUARIO, true));
        joao = usuarios.salvar(new Usuario("João", "joao@teste.com", "hash", PerfilUsuario.USUARIO, true));
        admin = usuarios.salvar(new Usuario("Admin", "admin@teste.com", "hash", PerfilUsuario.ADMIN, true));
        mesa = mesas.salvar(new Mesa(null, "044", "DEMO", TipoMesa.LIVRE, true, "DEMO", 0, 0, null));
        outraMesa = mesas.salvar(new Mesa(null, "053", "DEMO", TipoMesa.LIVRE, true, "DEMO", 200, 0, null));
    }

    @Test
    void preflightPermiteCabecalhosDeConfirmacaoECorrelacaoSemLiberarOrigemAlheia() throws Exception {
        mvc.perform(options("/api/reservas").header("Origin", "http://localhost:4201")
                .header("Access-Control-Request-Method", "POST")
                .header("Access-Control-Request-Headers", "authorization,content-type,idempotency-key,x-correlation-id"))
            .andExpect(status().isOk())
            .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:4201"));
        mvc.perform(options("/api/reservas").header("Origin", "https://origem-nao-autorizada.example")
                .header("Access-Control-Request-Method", "POST"))
            .andExpect(status().isForbidden());
    }

    @Test
    void bloqueiaFinaisDeSemanaParaUsuarioEAdministradorSemPersistirReserva() throws Exception {
        for (var usuario : List.of(maria, admin)) {
            for (var data : List.of("2026-10-31", "2026-11-01")) {
                mvc.perform(post("/api/reservas")
                        .header("Authorization", "Bearer " + jwt.gerarToken(usuario))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mesaId\":" + mesa.getId() + ",\"data\":\"" + data + "\"}"))
                        .andExpect(status().isBadRequest())
                        .andExpect(jsonPath("$.detail").value("Reservas são permitidas apenas de segunda a sexta."));
            }
        }
        assertThat(reservas.contar()).isZero();
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
                .andExpect(jsonPath("$.criador.id").value(maria.getId()))
                .andExpect(jsonPath("$.criador.perfil").value("USUARIO"))
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
    void administradorPodeCriarReservaParaSolicitanteAtivoSelecionado() throws Exception {
        mvc.perform(post("/api/reservas").header("Authorization", "Bearer " + jwt.gerarToken(admin))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"mesaId\":" + mesa.getId() + ",\"data\":\"2026-10-26\",\"solicitanteId\":" + joao.getId() + "}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.solicitante.id").value(joao.getId()))
            .andExpect(jsonPath("$.solicitante.nome").value("João"))
            .andExpect(jsonPath("$.criador.id").value(admin.getId()))
            .andExpect(jsonPath("$.criador.perfil").value("ADMIN"));

        assertThat(reservas.buscarTodos()).singleElement()
            .extracting(reserva -> reserva.getUsuario().getId())
            .isEqualTo(joao.getId());
    }

    @Test
    void beneficiarioVeReservaCriadaPorAdminEAdminPodeListaLa() throws Exception {
        var criada = service.criar(new CriarReservaRequest(mesa.getId(), HOJE, joao.getId()), identidade(admin));

        mvc.perform(get("/api/reservas/minhas")
                .header("Authorization", "Bearer " + jwt.gerarToken(joao)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].id").value(criada.id()))
            .andExpect(jsonPath("$[0].usuarioId").value(joao.getId()))
            .andExpect(jsonPath("$[0].criador.perfil").value("ADMIN"));

        mvc.perform(get("/api/admin/reservas")
                .header("Authorization", "Bearer " + jwt.gerarToken(admin)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].id").value(criada.id()))
            .andExpect(jsonPath("$[0].solicitante.id").value(joao.getId()));

        mvc.perform(get("/api/admin/reservas")
                .header("Authorization", "Bearer " + jwt.gerarToken(joao)))
            .andExpect(status().isForbidden());
    }

    @Test
    void beneficiarioCancelaReservaCriadaPorAdminPreservandoAutoriaEHistorico() throws Exception {
        var criada = service.criar(new CriarReservaRequest(mesa.getId(), HOJE, joao.getId()), identidade(admin));

        mvc.perform(patch("/api/reservas/{id}/cancelamento", criada.id())
                .header("Authorization", "Bearer " + jwt.gerarToken(maria)))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.status").value(403));

        assertThat(reservas.buscarPorId(criada.id()).orElseThrow().getStatus())
            .isEqualTo(StatusReserva.CONFIRMADA);

        mvc.perform(patch("/api/reservas/{id}/cancelamento", criada.id())
                .header("Authorization", "Bearer " + jwt.gerarToken(joao)))
            .andExpect(status().isOk())
            .andExpect(content().string(""));

        var cancelada = reservas.buscarPorId(criada.id()).orElseThrow();
        assertThat(cancelada.getStatus()).isEqualTo(StatusReserva.CANCELADA);
        assertThat(cancelada.getCriadoPor().getId()).isEqualTo(admin.getId());
        assertThat(cancelada.getUsuario().getId()).isEqualTo(joao.getId());
        assertThat(cancelada.getMesa().getId()).isEqualTo(mesa.getId());
        assertThat(cancelada.getData()).isEqualTo(criada.data());
        assertThat(cancelada.getCriadaEm()).isEqualTo(criada.criadaEm());
        assertThat(cancelada.getConfirmadaEm()).isEqualTo(criada.confirmadaEm());
        var canceladaEm = cancelada.getCanceladaEm();
        assertThat(canceladaEm).isNotNull();
        disponiveis(HOJE).andExpect(jsonPath("$[*].id", org.hamcrest.Matchers.hasItem(mesa.getId().intValue())));

        cancelar(cancelada, joao).andExpect(status().isConflict());
        cancelar(cancelada, admin).andExpect(status().isConflict());
        assertThat(reservas.buscarPorId(criada.id()).orElseThrow().getCanceladaEm()).isEqualTo(canceladaEm);
        assertThat(reservas.contar()).isEqualTo(1);
    }

    @Test
    void administradorContinuaCancelandoDiariaCriadaParaTerceiro() throws Exception {
        var criada = service.criar(new CriarReservaRequest(mesa.getId(), HOJE, joao.getId()), identidade(admin));
        cancelar(reservas.buscarPorId(criada.id()).orElseThrow(), admin).andExpect(status().isOk());
        var cancelada = reservas.buscarPorId(criada.id()).orElseThrow();
        assertThat(cancelada.getStatus()).isEqualTo(StatusReserva.CANCELADA);
        assertThat(cancelada.getUsuario().getId()).isEqualTo(joao.getId());
        assertThat(cancelada.getCriadoPor().getId()).isEqualTo(admin.getId());
    }

    @Test
    void cancelamentoPeloBeneficiarioNaoRemoveSuaMesaFixa() throws Exception {
        var criada = service.criar(new CriarReservaRequest(mesa.getId(), HOJE, joao.getId()), identidade(admin));
        // A diária é anterior à fixação: cancelar o histórico não pode desfazer o vínculo atual.
        mesa.setTipo(TipoMesa.FIXA);
        mesa.setAtiva(false);
        mesa.setResponsavel(joao);
        mesa.setOcupante("Responsável preservado");
        mesas.salvarESincronizar(mesa);

        cancelar(reservas.buscarPorId(criada.id()).orElseThrow(), joao).andExpect(status().isOk());
        var atual = mesas.buscarPorId(mesa.getId()).orElseThrow();
        assertThat(atual.getTipo()).isEqualTo(TipoMesa.FIXA);
        assertThat(atual.isAtiva()).isFalse();
        assertThat(atual.getResponsavel().getId()).isEqualTo(joao.getId());
        assertThat(atual.getOcupante()).isEqualTo("Responsável preservado");
        mvc.perform(patch("/api/admin/mesas/{id}/desfixar", mesa.getId())
                .header("Authorization", "Bearer " + jwt.gerarToken(joao)))
            .andExpect(status().isForbidden());
        assertThat(mesas.buscarPorId(mesa.getId()).orElseThrow().getResponsavel().getId()).isEqualTo(joao.getId());
    }

    @Test
    void beneficiarioCancelaDiariasAdministrativasPassadasConfirmadasOuPendentes() throws Exception {
        for (var estado : List.of(StatusReserva.CONFIRMADA, StatusReserva.PENDENTE)) {
            var diaria = new Reserva(mesa, joao, HOJE.minusDays(1), estado);
            diaria.setCriadoPor(admin);
            var salva = reservas.salvarESincronizar(diaria);
            cancelar(salva, joao).andExpect(status().isOk());
            var cancelada = reservas.buscarPorId(salva.getId()).orElseThrow();
            assertThat(cancelada.getStatus()).isEqualTo(StatusReserva.CANCELADA);
            assertThat(cancelada.getData()).isEqualTo(HOJE.minusDays(1));
            assertThat(cancelada.getCriadoPor().getId()).isEqualTo(admin.getId());
        }
    }

    @Test
    void usuarioComumNaoPodeEscolherSolicitanteAoCriarReserva() throws Exception {
        mvc.perform(post("/api/reservas").header("Authorization", "Bearer " + jwt.gerarToken(maria))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"mesaId\":" + mesa.getId() + ",\"data\":\"2026-10-26\",\"solicitanteId\":" + joao.getId() + "}"))
            .andExpect(status().isForbidden());

        assertThat(reservas.contar()).isZero();
    }

    @Test
    void administradorBuscaUsuariosAtivosPorNomeOuEmail() throws Exception {
        var inativo = usuarios.salvar(new Usuario("Mariana Inativa", "mariana@teste.com", "hash", PerfilUsuario.USUARIO, false));
        var token = "Bearer " + jwt.gerarToken(admin);

        mvc.perform(get("/api/admin/usuarios/busca").param("termo", "mArI")
                .header("Authorization", token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[*].id", org.hamcrest.Matchers.contains(maria.getId().intValue())))
            .andExpect(jsonPath("$[0].email").value("maria@teste.com"));

        mvc.perform(get("/api/admin/usuarios/busca").param("termo", "JOAO@")
                .header("Authorization", token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[*].id", org.hamcrest.Matchers.contains(joao.getId().intValue())));

        mvc.perform(get("/api/admin/usuarios/busca").param("termo", "mariana")
                .header("Authorization", token))
            .andExpect(status().isOk())
            .andExpect(content().json("[]"));

        assertThat(inativo.isAtivo()).isFalse();
    }

    @Test
    void buscaDeUsuariosExigePerfilAdministrador() throws Exception {
        mvc.perform(get("/api/admin/usuarios/busca").param("termo", "maria")
                .header("Authorization", "Bearer " + jwt.gerarToken(maria)))
            .andExpect(status().isForbidden());
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
        criar(maria, fixa, HOJE).andExpect(status().isConflict())
            .andExpect(jsonPath("$.detail").value("Mesa 018 é fixa e não pode ser reservada."))
            .andExpect(jsonPath("$.code").doesNotExist());
        criar(maria, inativa, HOJE).andExpect(status().isConflict())
            .andExpect(jsonPath("$.detail").value("Mesa 005 está inativa."))
            .andExpect(jsonPath("$.code").doesNotExist());
        assertThat(reservas.contar()).isZero();
    }

    @Test
    void informaMesaVinculadaMesmoInativaOuComTipoLegadoInconsistente() throws Exception {
        outraMesa.setResponsavel(maria);
        for (var tipo : List.of(TipoMesa.FIXA, TipoMesa.LIVRE)) {
            for (boolean ativa : List.of(true, false)) {
                outraMesa.setTipo(tipo);
                outraMesa.setAtiva(ativa);
                mesas.salvarESincronizar(outraMesa);

                criar(maria, mesa, HOJE)
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.status").value(409))
                    .andExpect(jsonPath("$.code").value("USUARIO_COM_MESA_FIXA"))
                    .andExpect(jsonPath("$.mesa.id").value(outraMesa.getId()))
                    .andExpect(jsonPath("$.mesa.codigo").value(outraMesa.getCodigo()))
                    .andExpect(jsonPath("$.detail").value(
                        "Você já possui uma mesa fixa vinculada ao seu usuário e não pode realizar outra reserva."));

                assertThat(reservas.contar()).isZero();
            }
        }
    }

    @Test
    void repeteConfirmacaoComMesmaChaveSemNovaGravacaoEPodeConsultarAposRespostaPerdida() throws Exception {
        String chave = java.util.UUID.randomUUID().toString();
        var pedido = new CriarReservaRequest(mesa.getId(), HOJE, null);
        var primeira = service.criar(pedido, identidade(maria), chave);
        var repetida = service.criar(pedido, identidade(maria), chave);
        assertThat(repetida.id()).isEqualTo(primeira.id());
        assertThat(reservas.contar()).isEqualTo(1);
        mvc.perform(get("/api/reservas/confirmacoes/{chave}", chave)
                .header("Authorization", "Bearer " + jwt.gerarToken(maria)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(primeira.id()));
        mvc.perform(get("/api/reservas/confirmacoes/{chave}", chave)
                .header("Authorization", "Bearer " + jwt.gerarToken(joao)))
            .andExpect(status().isNotFound());
        mvc.perform(post("/api/reservas").header("Authorization", "Bearer " + jwt.gerarToken(maria))
                .header("Idempotency-Key", chave).contentType(MediaType.APPLICATION_JSON)
                .content(corpo(outraMesa, HOJE)))
            .andExpect(status().isConflict());
        assertThat(reservas.contar()).isEqualTo(1);
    }

    @Test
    void chaveInvalidaNaoGravaENemConsultaOutraReserva() throws Exception {
        mvc.perform(post("/api/reservas").header("Authorization", "Bearer " + jwt.gerarToken(maria))
                .header("Idempotency-Key", "invalida").contentType(MediaType.APPLICATION_JSON)
                .content(corpo(mesa, HOJE))).andExpect(status().isBadRequest());
        assertThat(reservas.contar()).isZero();
    }

    @Test
    void replayCanceladoNaoReativaReservaENemMudaVinculoFixo() {
        String chave = java.util.UUID.randomUUID().toString();
        var pedido = new CriarReservaRequest(mesa.getId(), HOJE, joao.getId());
        var criada = service.criar(pedido, identidade(admin), chave);
        service.cancelar(criada.id(), identidade(joao));
        outraMesa.setTipo(TipoMesa.FIXA);
        outraMesa.setResponsavel(joao);
        mesas.salvarESincronizar(outraMesa);
        var repetida = service.criar(pedido, identidade(admin), chave);
        assertThat(repetida.id()).isEqualTo(criada.id());
        assertThat(repetida.status()).isEqualTo(StatusReserva.CANCELADA);
        assertThat(reservas.contar()).isEqualTo(1);
        assertThat(mesas.buscarPorId(outraMesa.getId()).orElseThrow().getResponsavel().getId()).isEqualTo(joao.getId());
    }

    @Test
    void confirmaMesmaChaveConcorrenteUmaUnicaVez() throws Exception {
        String chave = java.util.UUID.randomUUID().toString();
        var pedido = new CriarReservaRequest(mesa.getId(), HOJE, null);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var inicio = new CountDownLatch(1);
            Callable<Long> chamada = () -> {
                inicio.await();
                return service.criar(pedido, identidade(maria), chave).id();
            };
            var a = executor.submit(chamada);
            var b = executor.submit(chamada);
            inicio.countDown();
            assertThat(a.get(15, TimeUnit.SECONDS)).isEqualTo(b.get(15, TimeUnit.SECONDS));
        }
        assertThat(reservas.contar()).isEqualTo(1);
    }

    @Test
    void chaveEIsoladaPorAutor() {
        String chave = java.util.UUID.randomUUID().toString();
        var a = service.criar(new CriarReservaRequest(mesa.getId(), HOJE, null), identidade(maria), chave);
        var b = service.criar(new CriarReservaRequest(outraMesa.getId(), HOJE, null), identidade(joao), chave);
        assertThat(a.id()).isNotEqualTo(b.id());
        assertThat(reservas.contar()).isEqualTo(2);
    }

    @Test
    void retencaoContaDoCancelamentoEPreservaLegadosEstadosEVinculos() {
        LocalDateTime limite = LocalDateTime.of(HOJE, LocalTime.of(9, 0)).minusDays(15);
        for (var estado : StatusReserva.values()) {
            for (var momento : List.of(limite.minusSeconds(1), limite, limite.plusSeconds(1))) {
                var reserva = new Reserva(mesa, maria, HOJE.minusDays(30), estado);
                reserva.setCanceladaEm(momento);
                reservas.salvarESincronizar(reserva);
            }
        }
        var legado = new Reserva(mesa, maria, HOJE.minusDays(40), StatusReserva.CANCELADA);
        reservas.salvarESincronizar(legado);
        long antes = reservas.contar();
        assertThat(reservas.excluirCanceladasAte(limite, 1)).isEqualTo(1);
        assertThat(reservas.excluirCanceladasAte(limite, 500)).isEqualTo(1);
        assertThat(reservas.excluirCanceladasAte(limite, 500)).isZero();
        assertThat(reservas.contar()).isEqualTo(antes - 2);
        assertThat(reservas.buscarPorId(legado.getId())).isPresent();
        assertThat(mesas.buscarPorId(mesa.getId())).isPresent();
        assertThat(usuarios.buscarPorId(maria.getId())).isPresent();
    }

    @Test
    void paginaPorSituacaoSemConfundirConfirmadaPassadaComCancelada() throws Exception {
        for (var data : List.of(HOJE.minusDays(20), HOJE, HOJE.plusDays(1))) {
            reservas.salvarESincronizar(new Reserva(mesa, maria, data, StatusReserva.CONFIRMADA));
        }
        var cancelada = new Reserva(outraMesa, maria, HOJE, StatusReserva.CANCELADA);
        reservas.salvarESincronizar(cancelada);
        reservas.salvarESincronizar(new Reserva(mesa, joao, HOJE, StatusReserva.PENDENTE));
        String token = "Bearer " + jwt.gerarToken(maria);
        mvc.perform(get("/api/reservas/minhas/pagina").param("tamanho", "2").header("Authorization", token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalRegistros").value(3))
            .andExpect(jsonPath("$.totalPaginas").value(2))
            .andExpect(jsonPath("$.conteudo[0].data").value(HOJE.minusDays(20).toString()))
            .andExpect(jsonPath("$.conteudo.length()").value(2));
        mvc.perform(get("/api/reservas/minhas/pagina").param("pagina", "1").param("tamanho", "2")
                .header("Authorization", token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.conteudo.length()").value(1));
        mvc.perform(get("/api/reservas/minhas/pagina").param("canceladas", "true").header("Authorization", token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalRegistros").value(1))
            .andExpect(jsonPath("$.conteudo[0].id").value(cancelada.getId()));
        mvc.perform(get("/api/reservas/minhas/pagina").param("tamanho", "101").header("Authorization", token))
            .andExpect(status().isBadRequest());
        mvc.perform(get("/api/admin/reservas/pagina").header("Authorization", token))
            .andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/reservas/pagina").param("dataInicio", HOJE.toString())
                .header("Authorization", "Bearer " + jwt.gerarToken(admin)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalRegistros").value(3));
    }

    @Test
    void administradorNaoPodeReservarParaSolicitanteComMesaFixa() throws Exception {
        outraMesa.setTipo(TipoMesa.FIXA);
        outraMesa.setResponsavel(joao);
        for (boolean ativa : List.of(true, false)) {
            outraMesa.setAtiva(ativa);
            mesas.salvarESincronizar(outraMesa);
            mvc.perform(post("/api/reservas").header("Authorization", "Bearer " + jwt.gerarToken(admin))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"mesaId\":" + mesa.getId() + ",\"data\":\"" + HOJE
                    + "\",\"solicitanteId\":" + joao.getId() + "}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("USUARIO_COM_MESA_FIXA"))
            .andExpect(jsonPath("$.mesa.id").value(outraMesa.getId()))
            .andExpect(jsonPath("$.mesa.codigo").value(outraMesa.getCodigo()))
            .andExpect(jsonPath("$.detail").value(
                joao.getNome() + " já possui a mesa fixa " + outraMesa.getCodigo()
                    + " vinculada. Remova o vínculo antes de realizar uma reserva para essa pessoa."));

            assertThat(reservas.contar()).isZero();
        }
    }

    @Test
    void verificaMesaFixaDoSolicitanteEscolhidoEmVezDoAdministrador() throws Exception {
        outraMesa.setTipo(TipoMesa.FIXA);
        outraMesa.setResponsavel(admin);
        mesas.salvarESincronizar(outraMesa);

        criar(admin, mesa, HOJE).andExpect(status().isConflict());

        mvc.perform(post("/api/reservas").header("Authorization", "Bearer " + jwt.gerarToken(admin))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"mesaId\":" + mesa.getId() + ",\"data\":\"" + HOJE
                    + "\",\"solicitanteId\":" + joao.getId() + "}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.solicitante.id").value(joao.getId()));

        assertThat(reservas.contar()).isEqualTo(1);
    }

    @Test
    void usuarioVoltaAReservarDepoisDeDesfixarSuaMesa() throws Exception {
        outraMesa.setTipo(TipoMesa.FIXA);
        outraMesa.setResponsavel(maria);
        mesas.salvarESincronizar(outraMesa);
        criar(maria, mesa, HOJE).andExpect(status().isConflict());

        mvc.perform(patch("/api/admin/mesas/{id}/desfixar", outraMesa.getId())
                .header("Authorization", "Bearer " + jwt.gerarToken(admin)))
            .andExpect(status().isOk());

        criar(maria, mesa, HOJE).andExpect(status().isCreated());
        assertThat(reservas.contar()).isEqualTo(1);
    }

    @Test
    void nomeNoCampoOcupanteNaoSubstituiVinculoDeResponsavel() throws Exception {
        outraMesa.setTipo(TipoMesa.FIXA);
        outraMesa.setOcupante(maria.getNome());
        mesas.salvarESincronizar(outraMesa);

        criar(maria, mesa, HOJE).andExpect(status().isCreated());
        assertThat(reservas.contar()).isEqualTo(1);
    }

    @Test
    void mesaFixaDeOutroUsuarioNaoImpedeReserva() throws Exception {
        outraMesa.setTipo(TipoMesa.FIXA);
        outraMesa.setResponsavel(joao);
        mesas.salvarESincronizar(outraMesa);

        criar(maria, mesa, HOJE).andExpect(status().isCreated());
        assertThat(reservas.contar()).isEqualTo(1);
    }

    @Test
    void homonimosSaoIdentificadosPeloCadastroENaoPeloNome() throws Exception {
        var homonima = usuarios.salvar(new Usuario(maria.getNome(), "outra.maria@teste.com", "hash", PerfilUsuario.USUARIO, true));
        outraMesa.setTipo(TipoMesa.FIXA);
        outraMesa.setResponsavel(homonima);
        outraMesa.setOcupante(maria.getNome());
        mesas.salvarESincronizar(outraMesa);

        criar(maria, mesa, HOJE).andExpect(status().isCreated());
        criar(homonima, mesa, HOJE.plusDays(1))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("USUARIO_COM_MESA_FIXA"))
            .andExpect(jsonPath("$.mesa.codigo").value(outraMesa.getCodigo()));
        assertThat(reservas.contar()).isEqualTo(1);
    }

    @Test
    void regularizarFixaSemResponsavelBloqueiaReservaParaOUsuario() throws Exception {
        outraMesa.setTipo(TipoMesa.FIXA);
        outraMesa.setOcupante(maria.getNome());
        mesas.salvarESincronizar(outraMesa);

        mvc.perform(patch("/api/admin/mesas/{id}/responsavel", outraMesa.getId())
                .header("Authorization", "Bearer " + jwt.gerarToken(admin))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"usuarioId\":" + maria.getId() + "}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.responsavel.id").value(maria.getId()));

        criar(maria, mesa, HOJE).andExpect(status().isConflict())
            .andExpect(jsonPath("$.mesa.codigo").value(outraMesa.getCodigo()));
        assertThat(reservas.contar()).isZero();
    }

    @Test
    void regularizacaoRecusadaPreservaReservasExistentesESemVinculoAutomatico() throws Exception {
        var existente = service.criar(new CriarReservaRequest(mesa.getId(), HOJE, null), identidade(maria));
        outraMesa.setTipo(TipoMesa.FIXA);
        outraMesa.setOcupante(maria.getNome());
        mesas.salvarESincronizar(outraMesa);

        mvc.perform(patch("/api/admin/mesas/{id}/responsavel", outraMesa.getId())
                .header("Authorization", "Bearer " + jwt.gerarToken(admin))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"usuarioId\":" + maria.getId() + "}"))
            .andExpect(status().isConflict());
        assertThat(mesas.buscarPorId(outraMesa.getId()).orElseThrow().getResponsavel()).isNull();
        assertThat(reservas.buscarPorId(existente.id()).orElseThrow().getStatus()).isEqualTo(StatusReserva.CONFIRMADA);
        assertThat(reservas.contar()).isEqualTo(1);
    }

    @Test
    void bloqueioPorMesaFixaPreservaReservasExistentes() throws Exception {
        criar(maria, mesa, HOJE).andExpect(status().isCreated());
        outraMesa.setTipo(TipoMesa.FIXA);
        outraMesa.setResponsavel(maria);
        mesas.salvarESincronizar(outraMesa);

        criar(maria, mesa, HOJE.plusDays(1)).andExpect(status().isConflict());

        assertThat(reservas.buscarTodos()).singleElement().satisfies(reserva -> {
            assertThat(reserva.getData()).isEqualTo(HOJE);
            assertThat(reserva.getStatus()).isEqualTo(StatusReserva.CONFIRMADA);
        });
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
            criar(joao, mesa, HOJE).andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("A mesa " + mesa.getCodigo()
                    + " já possui uma reserva não cancelada em " + HOJE + "."))
                .andExpect(jsonPath("$.code").doesNotExist())
                .andExpect(jsonPath("$.mesa").doesNotExist());
            criar(maria, outraMesa, HOJE).andExpect(status().isConflict());
        }
        reservas.deletarTodos();
        // O status é a referência de cancelamento, mesmo em dados legados sem timestamp.
        reservas.salvarESincronizar(new Reserva(mesa, maria, HOJE, StatusReserva.CANCELADA));
        disponiveis(HOJE).andExpect(jsonPath("$[*].id", org.hamcrest.Matchers.hasItem(mesa.getId().intValue())));
        criar(maria, mesa, HOJE).andExpect(status().isCreated());
    }

    @ParameterizedTest
    @CsvSource({
        "false, false, PENDENTE", "false, true, PENDENTE",
        "true, false, PENDENTE", "true, true, PENDENTE",
        "false, false, CONFIRMADA", "false, true, CONFIRMADA",
        "true, false, CONFIRMADA", "true, true, CONFIRMADA"
    })
    void duplicidadeIdentificaMesaDoBeneficiarioMesmoEmOutraMesa(boolean porAdmin,
            boolean mesmaMesa, StatusReserva estado) throws Exception {
        reservas.salvarESincronizar(new Reserva(mesa, maria, HOJE, estado));
        if (porAdmin) {
            reservas.salvarESincronizar(new Reserva(outraMesa, admin, HOJE, StatusReserva.CONFIRMADA));
        }
        Mesa solicitada = mesmaMesa ? mesa : outraMesa;
        String conteudo = porAdmin
            ? "{\"mesaId\":" + solicitada.getId() + ",\"data\":\"" + HOJE
                + "\",\"solicitanteId\":" + maria.getId() + "}"
            : corpo(solicitada, HOJE);
        mvc.perform(post("/api/reservas")
                .header("Authorization", "Bearer " + jwt.gerarToken(porAdmin ? admin : maria))
                .contentType(MediaType.APPLICATION_JSON).content(conteudo))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("USUARIO_COM_RESERVA_NA_DATA"))
            .andExpect(jsonPath("$.mesa.id").value(mesa.getId()))
            .andExpect(jsonPath("$.mesa.codigo").value(mesa.getCodigo()))
            .andExpect(jsonPath("$.detail").value("Você já tem uma reserva para a mesa " + mesa.getCodigo() + "."))
            .andExpect(jsonPath("$.solicitante").doesNotExist());
        assertThat(reservas.contar()).isEqualTo(porAdmin ? 2 : 1);
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
        assertThat(canceladaEm).isEqualTo(LocalDateTime.of(HOJE, LocalTime.of(9, 0)));

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
    void cancelamentoPreservaTipoAtivacaoResponsavelEOcupanteDaMesa() throws Exception {
        for (var tipo : List.of(TipoMesa.LIVRE, TipoMesa.FIXA)) {
            for (boolean ativa : List.of(true, false)) {
                // A reserva é anterior à configuração atual; inclui estados legados.
                mesa.setTipo(tipo);
                mesa.setAtiva(ativa);
                mesa.setResponsavel(tipo == TipoMesa.FIXA ? joao : null);
                mesa.setOcupante("Texto administrativo preservado");
                mesas.salvarESincronizar(mesa);
                var existente = new Reserva(mesa, maria, HOJE.minusDays(1), StatusReserva.CONFIRMADA);
                existente.setConfirmadaEm(LocalDateTime.of(HOJE.minusDays(1), LocalTime.of(9, 0)));
                var salva = reservas.salvarESincronizar(existente);
                var criadaEm = salva.getCriadaEm();
                var confirmadaEm = salva.getConfirmadaEm();

                cancelar(salva, maria).andExpect(status().isOk()).andExpect(content().string(""));

                var atual = mesas.buscarPorId(mesa.getId()).orElseThrow();
                assertThat(atual.getTipo()).isEqualTo(tipo);
                assertThat(atual.isAtiva()).isEqualTo(ativa);
                assertThat(atual.getOcupante()).isEqualTo("Texto administrativo preservado");
                if (tipo == TipoMesa.FIXA) assertThat(atual.getResponsavel().getId()).isEqualTo(joao.getId());
                else assertThat(atual.getResponsavel()).isNull();

                var cancelada = reservas.buscarPorId(salva.getId()).orElseThrow();
                assertThat(cancelada.getStatus()).isEqualTo(StatusReserva.CANCELADA);
                assertThat(cancelada.getCanceladaEm()).isEqualTo(LocalDateTime.of(HOJE, LocalTime.of(9, 0)));
                assertThat(cancelada.getData()).isEqualTo(HOJE.minusDays(1));
                assertThat(cancelada.getUsuario().getId()).isEqualTo(maria.getId());
                assertThat(cancelada.getMesa().getId()).isEqualTo(mesa.getId());
                assertThat(cancelada.getCriadaEm()).isEqualTo(criadaEm);
                assertThat(cancelada.getConfirmadaEm()).isEqualTo(confirmadaEm);
            }
        }
    }

    @Test
    void falhaNaTransacaoDesfazCancelamentoELiberaLocks() throws Exception {
        var diaria = new Reserva(mesa, maria, HOJE, StatusReserva.CONFIRMADA);
        diaria.setCriadoPor(admin);
        var existente = reservas.salvarESincronizar(diaria);

        assertThatThrownBy(() -> transacao().executeWithoutResult(tx -> {
            service.cancelar(existente.getId(), identidade(maria));
            throw new IllegalStateException("Falha depois do cancelamento");
        })).isInstanceOf(IllegalStateException.class);

        var preservada = reservas.buscarPorId(existente.getId()).orElseThrow();
        assertThat(preservada.getStatus()).isEqualTo(StatusReserva.CONFIRMADA);
        assertThat(preservada.getCanceladaEm()).isNull();
        assertThat(preservada.getCriadoPor().getId()).isEqualTo(admin.getId());
        cancelar(existente, maria).andExpect(status().isOk());
    }

    @Test
    void beneficiarioEAdministradorCancelamDiariaAdministrativaUmaUnicaVez() throws Exception {
        var criada = service.criar(new CriarReservaRequest(mesa.getId(), HOJE, joao.getId()), identidade(admin));
        var existente = reservas.buscarPorId(criada.id()).orElseThrow();
        assertThat(disputar(
            () -> cancelar(existente, joao).andReturn().getResponse().getStatus(),
            () -> cancelar(existente, admin).andReturn().getResponse().getStatus()
        )).containsExactlyInAnyOrder(200, 409);
        var cancelada = reservas.buscarPorId(criada.id()).orElseThrow();
        assertThat(cancelada.getStatus()).isEqualTo(StatusReserva.CANCELADA);
        assertThat(cancelada.getCanceladaEm()).isEqualTo(LocalDateTime.of(HOJE, LocalTime.of(9, 0)));
        assertThat(cancelada.getCriadoPor().getId()).isEqualTo(admin.getId());
        assertThat(cancelada.getUsuario().getId()).isEqualTo(joao.getId());
        assertThat(reservas.contar()).isEqualTo(1);
    }

    @Test
    void doisCancelamentosConcorrentesProduzemUmSucessoEUmConflito() throws Exception {
        var existente = reservas.salvarESincronizar(new Reserva(mesa, maria, HOJE, StatusReserva.CONFIRMADA));

        assertThat(disputar(
            () -> cancelar(existente, maria).andReturn().getResponse().getStatus(),
            () -> cancelar(existente, maria).andReturn().getResponse().getStatus()
        )).containsExactlyInAnyOrder(200, 409);

        var cancelada = reservas.buscarPorId(existente.getId()).orElseThrow();
        assertThat(cancelada.getStatus()).isEqualTo(StatusReserva.CANCELADA);
        assertThat(cancelada.getCanceladaEm()).isEqualTo(LocalDateTime.of(HOJE, LocalTime.of(9, 0)));
        assertThat(reservas.contar()).isEqualTo(1);
    }

    @Test
    void administradorAguardaCancelamentoDoDonoSemCancelarNovamente() throws Exception {
        var existente = reservas.salvarESincronizar(new Reserva(mesa, maria, HOJE, StatusReserva.CONFIRMADA));

        assertThat(concorrerComCancelamentoAntesDoCommit(existente,
            () -> cancelar(existente, admin).andReturn().getResponse().getStatus())).isEqualTo(409);
        assertThat(reservas.buscarPorId(existente.getId()).orElseThrow().getStatus())
            .isEqualTo(StatusReserva.CANCELADA);
    }

    @Test
    void doisAdministradoresCancelamUmaUnicaVezMesmoComBeneficiarioInativo() throws Exception {
        var outroAdmin = usuarios.salvar(new Usuario("Admin 2", "admin2@teste.com", "hash", PerfilUsuario.ADMIN, true));
        maria.setAtivo(false);
        usuarios.salvarESincronizar(maria);
        mesa.setTipo(TipoMesa.FIXA);
        mesa.setAtiva(false);
        mesa.setResponsavel(joao);
        mesa.setOcupante("Texto preservado");
        mesas.salvarESincronizar(mesa);
        var existente = reservas.salvarESincronizar(new Reserva(mesa, maria, HOJE.minusDays(1), StatusReserva.CONFIRMADA));

        assertThat(concorrerComCancelamentoAntesDoCommit(existente, admin,
            () -> cancelar(existente, outroAdmin).andReturn().getResponse().getStatus())).isEqualTo(409);
        var atual = mesas.buscarPorId(mesa.getId()).orElseThrow();
        assertThat(atual.getTipo()).isEqualTo(TipoMesa.FIXA);
        assertThat(atual.isAtiva()).isFalse();
        assertThat(atual.getResponsavel().getId()).isEqualTo(joao.getId());
        assertThat(atual.getOcupante()).isEqualTo("Texto preservado");
    }

    @Test
    void novaReservaDaMesaEsperaCommitDoCancelamento() throws Exception {
        var existente = reservas.salvarESincronizar(new Reserva(mesa, maria, HOJE, StatusReserva.CONFIRMADA));

        assertThat(concorrerComCancelamentoAntesDoCommit(existente,
            () -> criar(joao, mesa, HOJE).andReturn().getResponse().getStatus())).isEqualTo(201);

        assertThat(reservas.buscarPorId(existente.getId()).orElseThrow().getStatus()).isEqualTo(StatusReserva.CANCELADA);
        assertThat(reservas.buscarTodos()).filteredOn(r -> r.getStatus() == StatusReserva.CONFIRMADA)
            .singleElement().satisfies(r -> assertThat(r.getUsuario().getId()).isEqualTo(joao.getId()));
    }

    @Test
    void inativacaoEsperaCancelamentoSemReativacaoDaMesa() throws Exception {
        var existente = reservas.salvarESincronizar(new Reserva(mesa, maria, HOJE, StatusReserva.CONFIRMADA));

        assertThat(concorrerComCancelamentoAntesDoCommit(existente,
            () -> inativarMesa().andReturn().getResponse().getStatus())).isEqualTo(200);

        assertThat(reservas.buscarPorId(existente.getId()).orElseThrow().getStatus()).isEqualTo(StatusReserva.CANCELADA);
        assertThat(mesas.buscarPorId(mesa.getId()).orElseThrow().isAtiva()).isFalse();
    }

    @Test
    void cancelamentoDeReservaAntigaNaoDesfazFixacaoConcorrente() throws Exception {
        var existente = reservas.salvarESincronizar(new Reserva(mesa, maria, HOJE.minusDays(1), StatusReserva.CONFIRMADA));

        assertThat(disputar(
            () -> cancelar(existente, maria).andReturn().getResponse().getStatus(),
            () -> mvc.perform(patch("/api/admin/mesas/{id}/fixar", mesa.getId())
                .header("Authorization", "Bearer " + jwt.gerarToken(admin))
                .contentType(MediaType.APPLICATION_JSON).content("{\"usuarioId\":" + joao.getId() + "}"))
                .andReturn().getResponse().getStatus()
        )).containsOnly(200);

        var atual = mesas.buscarPorId(mesa.getId()).orElseThrow();
        assertThat(atual.getTipo()).isEqualTo(TipoMesa.FIXA);
        assertThat(atual.getResponsavel().getId()).isEqualTo(joao.getId());
        assertThat(atual.isAtiva()).isTrue();
        assertThat(reservas.buscarPorId(existente.getId()).orElseThrow().getStatus()).isEqualTo(StatusReserva.CANCELADA);
    }

    @Test
    void cancelamentoDeReservaAntigaNaoDesfazInativacaoConcorrente() throws Exception {
        var existente = reservas.salvarESincronizar(new Reserva(mesa, maria, HOJE.minusDays(1), StatusReserva.CONFIRMADA));

        assertThat(disputar(
            () -> cancelar(existente, maria).andReturn().getResponse().getStatus(),
            () -> inativarMesa().andReturn().getResponse().getStatus()
        )).containsOnly(200);

        assertThat(mesas.buscarPorId(mesa.getId()).orElseThrow().isAtiva()).isFalse();
        assertThat(mesas.buscarPorId(mesa.getId()).orElseThrow().getTipo()).isEqualTo(TipoMesa.LIVRE);
    }

    @Test
    void cancelamentoENovaReservaDoUsuarioNaoDuplicamReservasAtivas() throws Exception {
        var existente = reservas.salvarESincronizar(new Reserva(mesa, maria, HOJE, StatusReserva.CONFIRMADA));
        var resultados = disputar(
            () -> cancelar(existente, maria).andReturn().getResponse().getStatus(),
            () -> criar(maria, outraMesa, HOJE).andReturn().getResponse().getStatus());

        assertThat(resultados.getFirst()).isEqualTo(200);
        assertThat(resultados.getLast()).isIn(201, 409);
        if (resultados.getLast() == 409) criar(maria, outraMesa, HOJE).andExpect(status().isCreated());
        assertThat(reservas.buscarPorId(existente.getId()).orElseThrow().getStatus()).isEqualTo(StatusReserva.CANCELADA);
        assertThat(reservas.buscarTodos()).filteredOn(r -> r.getStatus() != StatusReserva.CANCELADA)
            .singleElement().satisfies(r -> assertThat(r.getMesa().getId()).isEqualTo(outraMesa.getId()));
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
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));

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
            service.criar(new CriarReservaRequest(mesa.getId(), HOJE, null), identidade(maria));
            throw new IllegalStateException("Falha posterior à escrita");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(reservas.contar()).isZero();
        criar(joao, mesa, HOJE).andExpect(status().isCreated());
        assertThat(reservas.contar()).isEqualTo(1);
    }

    @Test
    void repeteChaveAposCommitSemDuplicarERejeitaOutroPayload() throws Exception {
        String chave = java.util.UUID.randomUUID().toString();
        var criada = service.criar(new CriarReservaRequest(mesa.getId(), HOJE, null), identidade(maria), chave);
        mvc.perform(post("/api/reservas").header("Authorization", "Bearer " + jwt.gerarToken(maria))
                .header("Idempotency-Key", chave.toUpperCase(java.util.Locale.ROOT)).contentType(MediaType.APPLICATION_JSON).content(corpo(mesa, HOJE)))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.id").value(criada.id()))
            .andExpect(jsonPath("$.chaveRequisicao").value(chave));
        assertThat(reservas.contar()).isEqualTo(1);
        assertThatThrownBy(() -> service.criar(new CriarReservaRequest(outraMesa.getId(), HOJE, null), identidade(maria), chave))
            .isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        assertThat(reservas.contar()).isEqualTo(1);
    }

    @Test
    void chaveInvalidaERejeitadaEChaveEIsoladaPorAutor() throws Exception {
        mvc.perform(post("/api/reservas").header("Authorization", "Bearer " + jwt.gerarToken(maria))
                .header("Idempotency-Key", "invalida").contentType(MediaType.APPLICATION_JSON).content(corpo(mesa, HOJE)))
            .andExpect(status().isBadRequest());
        assertThat(reservas.contar()).isZero();
        String chave = java.util.UUID.randomUUID().toString();
        var criada = service.criar(new CriarReservaRequest(mesa.getId(), HOJE, null), identidade(maria), chave);
        mvc.perform(post("/api/reservas").header("Authorization", "Bearer " + jwt.gerarToken(joao))
                .header("Idempotency-Key", chave).contentType(MediaType.APPLICATION_JSON).content(corpo(outraMesa, HOJE)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.usuarioId").value(joao.getId()))
            .andExpect(jsonPath("$.id").value(org.hamcrest.Matchers.not(criada.id())));
        assertThat(reservas.contar()).isEqualTo(2);
        service.cancelar(criada.id(), identidade(maria));
        mvc.perform(post("/api/reservas").header("Authorization", "Bearer " + jwt.gerarToken(maria))
                .header("Idempotency-Key", chave).contentType(MediaType.APPLICATION_JSON).content(corpo(mesa, HOJE)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").value(criada.id()))
            .andExpect(jsonPath("$.status").value("CANCELADA"));
        assertThat(reservas.contar()).isEqualTo(2);
    }

    @Test
    void mesmaChaveConcorrenteRetornaMesmaReserva() throws Exception {
        String chave = java.util.UUID.randomUUID().toString();
        var ids = disputar(
            () -> service.criar(new CriarReservaRequest(mesa.getId(), HOJE, null), identidade(maria), chave).id().intValue(),
            () -> service.criar(new CriarReservaRequest(mesa.getId(), HOJE, null), identidade(maria), chave).id().intValue());
        assertThat(ids.get(0)).isEqualTo(ids.get(1));
        assertThat(reservas.contar()).isEqualTo(1);
    }

    @Test
    void administradoresCruzadosReservamSemInverterLocksDosUsuarios() throws Exception {
        var outroAdmin = usuarios.salvar(new Usuario("Admin 2", "admin2@teste.com", "hash", PerfilUsuario.ADMIN, true));
        assertThat(disputar(
            () -> { service.criar(new CriarReservaRequest(mesa.getId(), HOJE, outroAdmin.getId()), identidade(admin)); return 201; },
            () -> { service.criar(new CriarReservaRequest(outraMesa.getId(), HOJE, admin.getId()), identidade(outroAdmin)); return 201; }
        )).containsOnly(201);
        assertThat(reservas.contar()).isEqualTo(2);
    }

    @Test
    void rollbackLiberaChaveDaConfirmacaoParaNovaTentativa() {
        String chave = java.util.UUID.randomUUID().toString();
        assertThatThrownBy(() -> transacao().executeWithoutResult(tx -> {
            service.criar(new CriarReservaRequest(mesa.getId(), HOJE, null), identidade(maria), chave);
            throw new IllegalStateException("Falha depois do flush");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(reservas.contar()).isZero();
        assertThat(service.criar(new CriarReservaRequest(mesa.getId(), HOJE, null), identidade(maria), chave).chaveRequisicao()).isEqualTo(chave);
        assertThat(reservas.contar()).isEqualTo(1);
    }

    ResultActions criar(Usuario usuario, Mesa mesa, LocalDate data) throws Exception {
        return mvc.perform(post("/api/reservas").header("Authorization", "Bearer " + jwt.gerarToken(usuario))
                .contentType(MediaType.APPLICATION_JSON).content(corpo(mesa, data)));
    }

    ResultActions cancelar(Reserva reserva, Usuario usuario) throws Exception {
        return mvc.perform(patch("/api/reservas/{id}/cancelamento", reserva.getId())
            .header("Authorization", "Bearer " + jwt.gerarToken(usuario)));
    }

    ResultActions inativarMesa() throws Exception {
        return mvc.perform(patch("/api/admin/mesas/{id}/ativacao", mesa.getId())
            .header("Authorization", "Bearer " + jwt.gerarToken(admin))
            .contentType(MediaType.APPLICATION_JSON).content("{\"ativa\":false}"));
    }

    int concorrerComCancelamentoAntesDoCommit(Reserva reserva, Callable<Integer> concorrente) throws Exception {
        return concorrerComCancelamentoAntesDoCommit(reserva, maria, concorrente);
    }

    int concorrerComCancelamentoAntesDoCommit(Reserva reserva, Usuario cancelador, Callable<Integer> concorrente) throws Exception {
        var cancelada = new CountDownLatch(1);
        var liberar = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var titular = executor.submit(() -> transacao().executeWithoutResult(tx -> {
                service.cancelar(reserva.getId(), identidade(cancelador));
                cancelada.countDown();
                aguardar(liberar);
            }));
            try {
                assertThat(cancelada.await(5, TimeUnit.SECONDS)).isTrue();
                var resultado = executor.submit(concorrente);
                assertThatThrownBy(() -> resultado.get(300, TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);
                liberar.countDown();
                titular.get(10, TimeUnit.SECONDS);
                return resultado.get(10, TimeUnit.SECONDS);
            } finally { liberar.countDown(); }
        }
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
