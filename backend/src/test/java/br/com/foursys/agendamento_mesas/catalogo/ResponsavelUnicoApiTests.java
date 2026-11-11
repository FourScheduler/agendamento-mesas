package br.com.foursys.agendamento_mesas.catalogo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.foursys.agendamento_mesas.enums.PerfilUsuario;
import br.com.foursys.agendamento_mesas.enums.TipoMesa;
import br.com.foursys.agendamento_mesas.model.Mesa;
import br.com.foursys.agendamento_mesas.model.Usuario;
import br.com.foursys.agendamento_mesas.port.out.MesaRepositoryPort;
import br.com.foursys.agendamento_mesas.port.out.ReservaRepositoryPort;
import br.com.foursys.agendamento_mesas.port.out.UsuarioRepositoryPort;
import br.com.foursys.agendamento_mesas.security.JwtService;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/** Requisições com commit real: a unicidade deve valer inclusive entre transações. */
@ActiveProfiles("test")
@SpringBootTest
@AutoConfigureMockMvc
public class ResponsavelUnicoApiTests {
    @Autowired MockMvc mvc;
    @Autowired MesaRepositoryPort mesas;
    @Autowired ReservaRepositoryPort reservas;
    @Autowired UsuarioRepositoryPort usuarios;
    @Autowired JwtService jwt;
    @Autowired JdbcTemplate jdbc;
    Usuario admin;
    Usuario maria;
    Usuario joao;
    Mesa primeira;
    Mesa segunda;

    @BeforeEach
    void prepararBanco() {
        reservas.deletarTodos();
        mesas.deletarTodos();
        usuarios.deletarTodos();
        admin = usuarios.salvar(new Usuario("Admin", "admin@teste.com", "hash", PerfilUsuario.ADMIN, true));
        maria = usuarios.salvar(new Usuario("Maria", "maria@teste.com", "hash", PerfilUsuario.USUARIO, true));
        joao = usuarios.salvar(new Usuario("João", "joao@teste.com", "hash", PerfilUsuario.USUARIO, true));
        primeira = mesas.salvar(new Mesa(null, "044", "DEMO", TipoMesa.LIVRE, true, "DEMO", 0, 0, null));
        segunda = mesas.salvar(new Mesa(null, "053", "DEMO", TipoMesa.LIVRE, true, "DEMO", 200, 0, null));
    }

    @AfterEach
    void limparVinculos() {
        reservas.deletarTodos();
        mesas.deletarTodos();
        usuarios.deletarTodos();
    }

    @Test
    void naoFixaSegundaMesaParaMesmoUsuario() throws Exception {
        atribuir(primeira, "fixar", maria).andExpect(status().isOk());
        atribuir(segunda, "fixar", maria)
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.detail").value(mensagemConflito(maria, primeira)));

        assertThat(responsavel(primeira)).isEqualTo(maria.getId());
        assertThat(responsavel(segunda)).isNull();
        assertThat(mesas.buscarPorId(segunda.getId()).orElseThrow().getTipo()).isEqualTo(TipoMesa.LIVRE);
    }

    @Test
    void mesaLivreInativaExigeAtivacaoAntesDeFixar() throws Exception {
        jdbc.update("UPDATE mesas SET ativa = FALSE WHERE id = ?", primeira.getId());

        atribuir(primeira, "fixar", maria)
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.detail").value(
                "Mesa 044 está inativa. Ative a mesa antes de fixá-la ou atribuir um responsável."));

        var inativa = mesas.buscarPorId(primeira.getId()).orElseThrow();
        assertThat(inativa.isAtiva()).isFalse();
        assertThat(inativa.getTipo()).isEqualTo(TipoMesa.LIVRE);
        assertThat(responsavel(primeira)).isNull();

        ativar(primeira);
        atribuir(primeira, "fixar", maria)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ativa").value(true))
            .andExpect(jsonPath("$.tipo").value("FIXA"))
            .andExpect(jsonPath("$.responsavel.id").value(maria.getId()));
    }

    @Test
    void fixaLegadaInativaSemResponsavelExigeAtivacaoAntesDeAtribuir() throws Exception {
        jdbc.update("UPDATE mesas SET tipo = 'FIXA', ativa = FALSE WHERE id = ?", primeira.getId());

        atribuir(primeira, "responsavel", maria)
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.detail").value(
                "Mesa 044 está inativa. Ative a mesa antes de fixá-la ou atribuir um responsável."));

        assertThat(responsavel(primeira)).isNull();
        assertThat(mesas.buscarPorId(primeira.getId()).orElseThrow().isAtiva()).isFalse();
        assertThat(mesas.buscarPorId(primeira.getId()).orElseThrow().getTipo()).isEqualTo(TipoMesa.FIXA);

        ativar(primeira);
        atribuir(primeira, "responsavel", maria)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.responsavel.id").value(maria.getId()));
    }

    @Test
    void trocaDeResponsavelEmMesaInativaPreservaVinculoAnterior() throws Exception {
        atribuir(primeira, "fixar", joao).andExpect(status().isOk());
        // Simula estado legado; a atribuição deve recusar mudanças até a ativação.
        jdbc.update("UPDATE mesas SET ativa = FALSE WHERE id = ?", primeira.getId());

        atribuir(primeira, "responsavel", maria)
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.detail").value(
                "Mesa 044 está inativa. Ative a mesa antes de fixá-la ou atribuir um responsável."));

        assertThat(responsavel(primeira)).isEqualTo(joao.getId());
        assertThat(quantidadeDeMesas(maria)).isZero();
        assertThat(mesas.buscarPorId(primeira.getId()).orElseThrow().isAtiva()).isFalse();
        assertThat(mesas.buscarPorId(primeira.getId()).orElseThrow().getTipo()).isEqualTo(TipoMesa.FIXA);
    }

    @Test
    void alteracaoDiretaDeTipoNaoContornaBloqueioDeMesaInativa() throws Exception {
        jdbc.update("UPDATE mesas SET ativa = FALSE WHERE id = ?", primeira.getId());

        mvc.perform(patch("/api/admin/mesas/{id}/tipo", primeira.getId())
                .header("Authorization", "Bearer " + jwt.gerarToken(admin))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"tipo\":\"FIXA\"}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.detail").value(
                "Mesa 044 está inativa. Ative a mesa antes de fixá-la ou atribuir um responsável."));

        assertThat(mesas.buscarPorId(primeira.getId()).orElseThrow().getTipo()).isEqualTo(TipoMesa.LIVRE);
        assertThat(mesas.buscarPorId(primeira.getId()).orElseThrow().isAtiva()).isFalse();
        assertThat(responsavel(primeira)).isNull();

        ativar(primeira);
        mvc.perform(patch("/api/admin/mesas/{id}/tipo", primeira.getId())
                .header("Authorization", "Bearer " + jwt.gerarToken(admin))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"tipo\":\"FIXA\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ativa").value(true))
            .andExpect(jsonPath("$.tipo").value("FIXA"));
    }

    @Test
    void desfixarMesaLegadaInativaContinuaPermitidoSemAtivacaoAutomatica() throws Exception {
        atribuir(primeira, "fixar", maria).andExpect(status().isOk());
        jdbc.update("UPDATE mesas SET ativa = FALSE WHERE id = ?", primeira.getId());

        mvc.perform(patch("/api/admin/mesas/{id}/desfixar", primeira.getId())
                .header("Authorization", "Bearer " + jwt.gerarToken(admin)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ativa").value(false))
            .andExpect(jsonPath("$.tipo").value("LIVRE"))
            .andExpect(jsonPath("$.responsavel").doesNotExist());

        assertThat(responsavel(primeira)).isNull();
    }

    @Test
    void trocaParaUsuarioJaVinculadoPreservaOsDoisResponsaveis() throws Exception {
        atribuir(primeira, "fixar", maria).andExpect(status().isOk());
        atribuir(segunda, "fixar", joao).andExpect(status().isOk());

        atribuir(segunda, "responsavel", maria)
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.detail").value(mensagemConflito(maria, primeira)));

        assertThat(responsavel(primeira)).isEqualTo(maria.getId());
        assertThat(responsavel(segunda)).isEqualTo(joao.getId());
    }

    @Test
    void naoInativaMesaComResponsavelAtivoNemRemoveVinculoAutomaticamente() throws Exception {
        atribuir(primeira, "fixar", maria).andExpect(status().isOk());

        alterarAtivacao(primeira, false)
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.detail").value(
                "Mesa 044 possui um responsável vinculado. Remova o vínculo antes de inativá-la."));

        var preservada = mesas.buscarPorId(primeira.getId()).orElseThrow();
        assertThat(preservada.isAtiva()).isTrue();
        assertThat(preservada.getTipo()).isEqualTo(TipoMesa.FIXA);
        assertThat(responsavel(primeira)).isEqualTo(maria.getId());
    }

    @Test
    void responsavelInativoTambemImpedeInativacaoDaMesa() throws Exception {
        atribuir(primeira, "fixar", maria).andExpect(status().isOk());
        jdbc.update("UPDATE usuarios SET ativo = FALSE WHERE id = ?", maria.getId());

        alterarAtivacao(primeira, false)
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.detail").value(
                "Mesa 044 possui um responsável vinculado. Remova o vínculo antes de inativá-la."));

        assertThat(mesas.buscarPorId(primeira.getId()).orElseThrow().isAtiva()).isTrue();
        assertThat(responsavel(primeira)).isEqualTo(maria.getId());
        assertThat(usuarios.buscarPorId(maria.getId()).orElseThrow().isAtivo()).isFalse();
    }

    @Test
    void somenteAposDesfixarMesaPodeSerInativadaMesmoComUsuarioInativo() throws Exception {
        atribuir(primeira, "fixar", maria).andExpect(status().isOk());
        jdbc.update("UPDATE usuarios SET ativo = FALSE WHERE id = ?", maria.getId());
        alterarAtivacao(primeira, false).andExpect(status().isConflict());

        mvc.perform(patch("/api/admin/mesas/{id}/desfixar", primeira.getId())
                .header("Authorization", "Bearer " + jwt.gerarToken(admin)))
            .andExpect(status().isOk());
        alterarAtivacao(primeira, false)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ativa").value(false))
            .andExpect(jsonPath("$.tipo").value("LIVRE"))
            .andExpect(jsonPath("$.responsavel").doesNotExist());
        assertThat(responsavel(primeira)).isNull();
        assertThat(usuarios.buscarPorId(maria.getId()).orElseThrow().isAtivo()).isFalse();
    }

    @Test
    void inativarMesaSemResponsavelPreservaTipoLivreOuFixaLegada() throws Exception {
        jdbc.update("UPDATE mesas SET tipo = 'FIXA' WHERE id = ?", segunda.getId());

        for (Mesa mesa : List.of(primeira, segunda)) {
            var tipoAnterior = mesas.buscarPorId(mesa.getId()).orElseThrow().getTipo();
            alterarAtivacao(mesa, false)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ativa").value(false))
                .andExpect(jsonPath("$.tipo").value(tipoAnterior.name()));
            assertThat(responsavel(mesa)).isNull();
            // Sem vínculo, repetir a inativação continua permitido.
            alterarAtivacao(mesa, false).andExpect(status().isOk());
        }
    }

    @Test
    void tipoLivreComVinculoLegadoTambemImpedeInativacao() throws Exception {
        jdbc.update("UPDATE mesas SET responsavel_id = ? WHERE id = ?", maria.getId(), primeira.getId());

        alterarAtivacao(primeira, false).andExpect(status().isConflict());
        assertThat(mesas.buscarPorId(primeira.getId()).orElseThrow().isAtiva()).isTrue();
        assertThat(mesas.buscarPorId(primeira.getId()).orElseThrow().getTipo()).isEqualTo(TipoMesa.LIVRE);
        assertThat(responsavel(primeira)).isEqualTo(maria.getId());
    }

    @Test
    void ativacaoDeMesaLegadaPreservaResponsavelMesmoSeUsuarioEstaInativo() throws Exception {
        atribuir(primeira, "fixar", maria).andExpect(status().isOk());
        jdbc.update("UPDATE mesas SET ativa = FALSE WHERE id = ?", primeira.getId());
        jdbc.update("UPDATE usuarios SET ativo = FALSE WHERE id = ?", maria.getId());

        alterarAtivacao(primeira, true)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ativa").value(true))
            .andExpect(jsonPath("$.tipo").value("FIXA"))
            .andExpect(jsonPath("$.responsavel.id").value(maria.getId()));
        assertThat(responsavel(primeira)).isEqualTo(maria.getId());
    }

    @Test
    void inativacaoRepetidaDeMesaLegadaComResponsavelExigeRemocaoDoVinculo() throws Exception {
        atribuir(primeira, "fixar", maria).andExpect(status().isOk());
        jdbc.update("UPDATE mesas SET ativa = FALSE WHERE id = ?", primeira.getId());

        alterarAtivacao(primeira, false).andExpect(status().isConflict());
        assertThat(mesas.buscarPorId(primeira.getId()).orElseThrow().isAtiva()).isFalse();
        assertThat(responsavel(primeira)).isEqualTo(maria.getId());
    }

    @Test
    void fixacaoConcorrenteComInativacaoNaoProduzMesaInativaComResponsavel() throws Exception {
        assertThat(disputar(
            () -> atribuir(primeira, "fixar", maria).andReturn().getResponse().getStatus(),
            () -> alterarAtivacao(primeira, false).andReturn().getResponse().getStatus()
        )).containsExactlyInAnyOrder(200, 409);

        var finalizada = mesas.buscarPorId(primeira.getId()).orElseThrow();
        if (responsavel(primeira) == null) {
            assertThat(finalizada.isAtiva()).isFalse();
            assertThat(finalizada.getTipo()).isEqualTo(TipoMesa.LIVRE);
        } else {
            assertThat(finalizada.isAtiva()).isTrue();
            assertThat(finalizada.getTipo()).isEqualTo(TipoMesa.FIXA);
            assertThat(responsavel(primeira)).isEqualTo(maria.getId());
        }
    }

    @Test
    void atribuicaoConcorrenteComInativacaoDeFixaLegadaPreservaRegra() throws Exception {
        jdbc.update("UPDATE mesas SET tipo = 'FIXA' WHERE id = ?", primeira.getId());

        assertThat(disputar(
            () -> atribuir(primeira, "responsavel", maria).andReturn().getResponse().getStatus(),
            () -> alterarAtivacao(primeira, false).andReturn().getResponse().getStatus()
        )).containsExactlyInAnyOrder(200, 409);

        var finalizada = mesas.buscarPorId(primeira.getId()).orElseThrow();
        assertThat(finalizada.getTipo()).isEqualTo(TipoMesa.FIXA);
        assertThat(finalizada.isAtiva()).isEqualTo(responsavel(primeira) != null);
    }

    @Test
    void manterResponsavelDaPropriaMesaNaoEConflito() throws Exception {
        atribuir(primeira, "fixar", maria).andExpect(status().isOk());
        atribuir(primeira, "responsavel", maria)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.responsavel.id").value(maria.getId()));
    }

    @Test
    void mesaVinculadaInativaContinuaBloqueandoNovaAtribuicao() throws Exception {
        atribuir(primeira, "fixar", maria).andExpect(status().isOk());
        jdbc.update("UPDATE mesas SET ativa = FALSE WHERE id = ?", primeira.getId());

        atribuir(segunda, "fixar", maria)
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.detail").value(mensagemConflito(maria, primeira)));
        assertThat(responsavel(primeira)).isEqualTo(maria.getId());
        assertThat(responsavel(segunda)).isNull();
    }

    @Test
    void desfixarLiberaUsuarioParaOutraMesa() throws Exception {
        atribuir(primeira, "fixar", maria).andExpect(status().isOk());
        mvc.perform(patch("/api/admin/mesas/{id}/desfixar", primeira.getId())
                .header("Authorization", "Bearer " + jwt.gerarToken(admin)))
            .andExpect(status().isOk());

        atribuir(segunda, "fixar", maria).andExpect(status().isOk());
        assertThat(responsavel(primeira)).isNull();
        assertThat(responsavel(segunda)).isEqualTo(maria.getId());
    }

    @Test
    void conflitoIdentificaCadastroSelecionadoEMesaComCodigoDinamico() throws Exception {
        var homonima = usuarios.salvar(new Usuario(maria.getNome(), "homonima@teste.com",
            "hash", PerfilUsuario.USUARIO, true));
        var vinculada = mesas.salvar(new Mesa(null, "927", "DEMO", TipoMesa.LIVRE,
            true, "DEMO", 400, 0, null));
        atribuir(vinculada, "fixar", homonima).andExpect(status().isOk());
        atribuir(segunda, "fixar", joao).andExpect(status().isOk());
        atribuir(primeira, "fixar", maria).andExpect(status().isOk());

        atribuir(segunda, "responsavel", homonima)
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.detail").value(mensagemConflito(homonima, vinculada)));

        assertThat(responsavel(vinculada)).isEqualTo(homonima.getId());
        assertThat(responsavel(primeira)).isEqualTo(maria.getId());
        assertThat(responsavel(segunda)).isEqualTo(joao.getId());
    }

    private String mensagemConflito(Usuario usuario, Mesa mesa) {
        return usuario.getNome() + " já possui a mesa " + mesa.getCodigo()
            + " vinculada ao seu nome. Remova o vínculo atual antes de atribuir outra mesa.";
    }

    @Test
    void trocarResponsavelLiberaUsuarioAnteriorSemTransferenciaAutomatica() throws Exception {
        atribuir(primeira, "fixar", maria).andExpect(status().isOk());
        atribuir(primeira, "responsavel", joao).andExpect(status().isOk());
        atribuir(segunda, "fixar", maria).andExpect(status().isOk());

        assertThat(responsavel(primeira)).isEqualTo(joao.getId());
        assertThat(responsavel(segunda)).isEqualTo(maria.getId());
    }

    @Test
    void duasFixacoesConcorrentesParaMesmoUsuarioCriamSomenteUmVinculo() throws Exception {
        assertThat(disputar(
            () -> atribuir(primeira, "fixar", maria).andReturn().getResponse().getStatus(),
            () -> atribuir(segunda, "fixar", maria).andReturn().getResponse().getStatus()
        )).containsExactlyInAnyOrder(200, 409);

        assertThat(quantidadeDeMesas(maria)).isEqualTo(1);
    }

    @Test
    void duasTrocasConcorrentesParaMesmoUsuarioPreservamUmDosResponsaveis() throws Exception {
        atribuir(primeira, "fixar", joao).andExpect(status().isOk());
        atribuir(segunda, "fixar", admin).andExpect(status().isOk());

        assertThat(disputar(
            () -> atribuir(primeira, "responsavel", maria).andReturn().getResponse().getStatus(),
            () -> atribuir(segunda, "responsavel", maria).andReturn().getResponse().getStatus()
        )).containsExactlyInAnyOrder(200, 409);

        assertThat(quantidadeDeMesas(maria)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM mesas WHERE responsavel_id IS NOT NULL", Long.class))
            .isEqualTo(2);
    }

    @Test
    void bancoRejeitaDuplicidadeMesmoSemPassarPelaApi() throws Exception {
        atribuir(primeira, "fixar", maria).andExpect(status().isOk());

        assertThatThrownBy(() -> jdbc.update(
            "UPDATE mesas SET tipo = 'FIXA', responsavel_id = ? WHERE id = ?", maria.getId(), segunda.getId()))
            .isInstanceOf(DataIntegrityViolationException.class);

        assertThat(responsavel(primeira)).isEqualTo(maria.getId());
        assertThat(responsavel(segunda)).isNull();
    }

    @Test
    void mesasSemResponsavelContinuamPermitidas() {
        segunda.setTipo(TipoMesa.FIXA);
        mesas.salvarESincronizar(segunda);
        assertThat(responsavel(primeira)).isNull();
        assertThat(responsavel(segunda)).isNull();
        assertThat(mesas.contar()).isEqualTo(2);
    }

    ResultActions atribuir(Mesa mesa, String operacao, Usuario usuario) throws Exception {
        return mvc.perform(patch("/api/admin/mesas/{id}/{operacao}", mesa.getId(), operacao)
            .header("Authorization", "Bearer " + jwt.gerarToken(admin))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"usuarioId\":" + usuario.getId() + "}"));
    }

    void ativar(Mesa mesa) throws Exception {
        alterarAtivacao(mesa, true).andExpect(status().isOk());
    }

    ResultActions alterarAtivacao(Mesa mesa, boolean ativa) throws Exception {
        return mvc.perform(patch("/api/admin/mesas/{id}/ativacao", mesa.getId())
            .header("Authorization", "Bearer " + jwt.gerarToken(admin))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"ativa\":" + ativa + "}"));
    }

    Long responsavel(Mesa mesa) {
        return jdbc.queryForObject("SELECT responsavel_id FROM mesas WHERE id = ?", Long.class, mesa.getId());
    }

    long quantidadeDeMesas(Usuario usuario) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM mesas WHERE responsavel_id = ?", Long.class, usuario.getId());
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
