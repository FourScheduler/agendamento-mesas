package br.com.foursys.agendamento_mesas.administracao;

import static org.assertj.core.api.Assertions.assertThat;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class MigracaoResponsavelTests {
    @Test
    void atualizaBancoComSeedsSemPerderMesasUsuariosReservasNemAtribuirResponsaveis() {
        String url = "jdbc:h2:mem:migracao_admin;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1";
        Flyway.configure().dataSource(url, "sa", "").locations("classpath:db/migration", "classpath:db/seed")
                .target("4").load().migrate();
        var jdbc = new JdbcTemplate(new DriverManagerDataSource(url, "sa", ""));
        jdbc.update("insert into reservas (mesa_id, usuario_id, data, status, criada_em) "
                + "select m.id, u.id, '2026-10-26', 'CONFIRMADA', CURRENT_TIMESTAMP "
                + "from mesas m cross join usuarios u where m.codigo = '044' and u.email = 'maria.souza@exemplo.com'");
        var mesas = jdbc.queryForList("select id, codigo, tipo, ativa, planta, posicao_x, posicao_y from mesas order by id");
        var usuarios = jdbc.queryForList("select * from usuarios order by id");
        var reservas = jdbc.queryForList("select * from reservas order by id");
        var flyway = Flyway.configure().dataSource(url, "sa", "")
                .locations("classpath:db/migration", "classpath:db/seed").load();
        assertThat(flyway.migrate().migrationsExecuted).isEqualTo(3);
        assertThat(jdbc.queryForList("select id, codigo, tipo, ativa, planta, posicao_x, posicao_y from mesas order by id")).isEqualTo(mesas);
        assertThat(jdbc.queryForList("select * from usuarios order by id")).isEqualTo(usuarios);
        assertThat(jdbc.queryForList("select * from reservas order by id")).isEqualTo(reservas);
        assertThat(jdbc.queryForObject("select count(*) from mesas where responsavel_id is not null", Integer.class)).isZero();
        assertThat(flyway.migrate().migrationsExecuted).isZero();
    }
}
