package br.com.foursys.agendamento_mesas.catalogo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import br.com.foursys.agendamento_mesas.enums.TipoMesa;
import br.com.foursys.agendamento_mesas.model.Mesa;
import br.com.foursys.agendamento_mesas.repository.MesaRepository;
import br.com.foursys.agendamento_mesas.repository.UsuarioRepository;
import br.com.foursys.agendamento_mesas.security.JwtService;
import br.com.foursys.agendamento_mesas.service.MesaService;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@ActiveProfiles("test")
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:catalogo;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
        "spring.flyway.locations=classpath:db/migration,classpath:db/seed"})
@AutoConfigureMockMvc
@Transactional
class CatalogoMesasTests {
    @Autowired MockMvc mvc;
    @Autowired MesaRepository repository;
    @Autowired MesaService service;
    @Autowired UsuarioRepository usuarios;
    @Autowired JwtService jwt;

    @Test
    void catalogoAutenticadoIncluiInativaEReferenciaVisualSemDisponibilidadeGlobal() throws Exception {
        String token = jwt.gerarToken(usuarios.findByEmail("maria.souza@exemplo.com").orElseThrow());
        String resposta = mvc.perform(get("/api/mesas").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(115))
                .andExpect(jsonPath("$[4].codigo").value("005"))
                .andExpect(jsonPath("$[4].ativa").value(false))
                .andExpect(jsonPath("$[43].id").value(44))
                .andExpect(jsonPath("$[43].codigo").value("044"))
                .andExpect(jsonPath("$[43].regiao").value("TAMBORÉ"))
                .andExpect(jsonPath("$[43].tipo").value("LIVRE"))
                .andExpect(jsonPath("$[43].referenciaVisual.planta").value("TAMBORÉ"))
                .andExpect(jsonPath("$[43].referenciaVisual.x").value(590))
                .andExpect(jsonPath("$[43].referenciaVisual.y").value(1108))
                .andExpect(jsonPath("$[43].disponivel").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        assertThat(mvc.perform(get("/api/mesas").header("Authorization", "Bearer " + token))
                .andReturn().getResponse().getContentAsString()).isEqualTo(resposta);
    }

    @Test
    void catalogoExigeAutenticacao() throws Exception {
        mvc.perform(get("/api/mesas")).andExpect(status().isUnauthorized());
    }

    @Test
    void elegibilidadeRecusaInativaMesmoQuandoLivreEFixaENaoEncontrada() {
        Mesa inativa = repository.save(new Mesa("999", "DEMO", TipoMesa.LIVRE, false, "DEMO", 0, 0));
        assertThatThrownBy(() -> service.obterParaReserva(inativa.getId()))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        erro -> assertThat(erro.getStatusCode()).isEqualTo(HttpStatus.CONFLICT))
                .hasMessageContaining("inativa");
        assertThatThrownBy(() -> service.obterParaReserva(repository.findByCodigo("001").orElseThrow().getId()))
                .hasMessageContaining("fixa");
        assertThatThrownBy(() -> service.obterParaReserva(-1L))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        erro -> assertThat(erro.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
        assertThat(service.obterParaReserva(repository.findByCodigo("044").orElseThrow().getId()).getCodigo())
                .isEqualTo("044");
    }

    @Test
    void cargaReproduzCatalogoCompletoEmDoisBancosVaziosSemReaplicar() {
        java.util.List<java.util.Map<String, Object>> anterior = null;
        for (String nome : java.util.List.of("seed_a", "seed_b")) {
            var ds = new DriverManagerDataSource("jdbc:h2:mem:" + nome + ";MODE=MySQL;DB_CLOSE_DELAY=-1", "sa", "");
            var flyway = Flyway.configure().dataSource(ds)
                    .locations("classpath:db/migration", "classpath:db/seed").load();
            flyway.migrate();
            var jdbc = new JdbcTemplate(ds);
            var catalogo = jdbc.queryForList("SELECT * FROM mesas ORDER BY codigo");
            assertThat(catalogo).hasSize(115);
            if (anterior != null) assertThat(catalogo).isEqualTo(anterior);
            anterior = catalogo;
            assertThat(flyway.migrate().migrationsExecuted).isZero();
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM mesas WHERE ativa = FALSE", Integer.class)).isEqualTo(1);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM reservas", Integer.class)).isZero();
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM (SELECT planta, posicao_x, posicao_y FROM mesas GROUP BY planta, posicao_x, posicao_y) p", Integer.class)).isEqualTo(115);
        }
    }

    @Test
    void plantaTemDoisBlocosSemSobreposicaoDeMesasOuEntrada() {
        var catalogo = service.listar();
        assertThat(catalogo).hasSize(115);
        assertThat(catalogo.stream().filter(m -> m.referenciaVisual().x() < 800).count()).isEqualTo(72);
        assertThat(catalogo.stream().filter(m -> m.referenciaVisual().x() >= 800).count()).isEqualTo(43);
        for (int i = 0; i < catalogo.size(); i++) {
            var a = catalogo.get(i).referenciaVisual();
            assertThat(a.x()).isBetween(24, 1402);
            assertThat(a.y()).isBetween(24, 1857);
            // Entrada: x=836, y=656, largura=745, altura=341.
            assertThat(a.x() < 1581 && a.x() + 180 > 836 && a.y() < 997 && a.y() + 92 > 656)
                    .as("Mesa %s fora da entrada", catalogo.get(i).codigo()).isFalse();
            for (int j = i + 1; j < catalogo.size(); j++) {
                var b = catalogo.get(j).referenciaVisual();
                assertThat(a.x() < b.x() + 180 && a.x() + 180 > b.x()
                        && a.y() < b.y() + 92 && a.y() + 92 > b.y())
                        .as("Mesas %s e %s sem sobreposição", catalogo.get(i).codigo(), catalogo.get(j).codigo())
                        .isFalse();
            }
        }
    }
}
