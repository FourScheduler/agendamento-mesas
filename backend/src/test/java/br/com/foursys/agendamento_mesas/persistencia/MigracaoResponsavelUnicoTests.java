package br.com.foursys.agendamento_mesas.persistencia;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.FlywayException;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class MigracaoResponsavelUnicoTests {
    @Test
    void migracaoPreservaMesasUsuariosEReservasENaoReaplica() {
        var ds = bancoAteV8();
        var jdbc = new JdbcTemplate(ds);
        prepararDados(jdbc);
        jdbc.update("UPDATE mesas SET responsavel_id = 1 WHERE id = 1");
        var mesasAntes = jdbc.queryForList("SELECT * FROM mesas ORDER BY id");
        var usuariosAntes = jdbc.queryForList("SELECT * FROM usuarios ORDER BY id");
        var reservasAntes = jdbc.queryForList("SELECT * FROM reservas ORDER BY id");

        var flyway = Flyway.configure().dataSource(ds).locations("classpath:db/migration").target("9").load();
        assertThat(flyway.migrate().migrationsExecuted).isEqualTo(1);
        assertThat(jdbc.queryForList("SELECT * FROM mesas ORDER BY id")).isEqualTo(mesasAntes);
        assertThat(jdbc.queryForList("SELECT * FROM usuarios ORDER BY id")).isEqualTo(usuariosAntes);
        assertThat(jdbc.queryForList("SELECT * FROM reservas ORDER BY id")).isEqualTo(reservasAntes);
        assertThat(flyway.migrate().migrationsExecuted).isZero();
    }

    @Test
    void duplicidadesImpedemMigracaoSemRemoverOuEscolherVinculos() {
        var ds = bancoAteV8();
        var jdbc = new JdbcTemplate(ds);
        prepararDados(jdbc);
        jdbc.update("UPDATE mesas SET responsavel_id = 1 WHERE id IN (1, 2)");
        var antes = jdbc.queryForList("SELECT * FROM mesas ORDER BY id");
        var flyway = Flyway.configure().dataSource(ds).locations("classpath:db/migration").target("9").load();

        assertThatThrownBy(flyway::migrate)
            .isInstanceOf(FlywayException.class)
            .hasMessageContaining("uk_mesas_responsavel");
        assertThat(jdbc.queryForList("SELECT * FROM mesas ORDER BY id")).isEqualTo(antes);
    }

    private DriverManagerDataSource bancoAteV8() {
        var ds = new DriverManagerDataSource(
            "jdbc:h2:mem:responsavel_" + UUID.randomUUID() + ";MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
            "sa", "");
        Flyway.configure().dataSource(ds).locations("classpath:db/migration").target("8").load().migrate();
        return ds;
    }

    private void prepararDados(JdbcTemplate jdbc) {
        jdbc.update("""
            INSERT INTO usuarios (id, nome, email, senha_hash, perfil, ativo, criado_em)
            VALUES (1, 'Teste', 'teste@exemplo.com', 'hash', 'USUARIO', TRUE, CURRENT_TIMESTAMP)
            """);
        jdbc.update("""
            INSERT INTO mesas (id, codigo, regiao, tipo, ativa, planta, posicao_x, posicao_y, ocupante)
            VALUES (1, '001', 'DEMO', 'FIXA', TRUE, 'DEMO', 0, 0, 'Texto preservado'),
                   (2, '002', 'DEMO', 'FIXA', FALSE, 'DEMO', 200, 0, NULL),
                   (3, '003', 'DEMO', 'LIVRE', TRUE, 'DEMO', 400, 0, NULL)
            """);
        jdbc.update("""
            INSERT INTO reservas (mesa_id, usuario_id, data, status, criada_em)
            VALUES (3, 1, '2026-10-28', 'CONFIRMADA', CURRENT_TIMESTAMP)
            """);
    }
}
