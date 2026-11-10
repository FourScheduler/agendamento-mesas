package br.com.foursys.agendamento_mesas.persistencia;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class MigracaoIdempotenciaRetencaoTests {
    @Test
    void upgradePreservaHistoricoLegadoEImpedeDuplicarChaveSemExigirChaveDosAntigos() {
        var ds = new DriverManagerDataSource("jdbc:h2:mem:idempotencia_" + UUID.randomUUID()
            + ";MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1", "sa", "");
        Flyway.configure().dataSource(ds).locations("classpath:db/migration").target("9").load().migrate();
        var jdbc = new JdbcTemplate(ds);
        jdbc.update("""
            INSERT INTO usuarios (id,nome,email,senha_hash,perfil,ativo,criado_em)
            VALUES (1,'Teste','teste@example.com','hash','USUARIO',TRUE,CURRENT_TIMESTAMP)
            """);
        jdbc.update("""
            INSERT INTO mesas (id,codigo,regiao,tipo,ativa,planta,posicao_x,posicao_y)
            VALUES (1,'001','DEMO','LIVRE',TRUE,'DEMO',0,0)
            """);
        jdbc.update("""
            INSERT INTO reservas (id,mesa_id,usuario_id,criado_por_id,data,status,criada_em,cancelada_em)
            VALUES (1,1,1,1,'2026-10-26','CONFIRMADA',CURRENT_TIMESTAMP,NULL),
                   (2,1,1,1,'2026-10-27','CANCELADA',CURRENT_TIMESTAMP,NULL)
            """);
        String campos = "id,mesa_id,usuario_id,data,status,criada_em,cancelada_em,criado_por_id";
        var antes = jdbc.queryForList("SELECT " + campos + " FROM reservas ORDER BY id");
        var migracao = Flyway.configure().dataSource(ds).locations("classpath:db/migration").load();
        assertThat(migracao.migrate().migrationsExecuted).isEqualTo(1);
        assertThat(jdbc.queryForList("SELECT " + campos + " FROM reservas ORDER BY id")).isEqualTo(antes);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM reservas WHERE chave_requisicao IS NULL", Integer.class)).isEqualTo(2);
        String chave = UUID.randomUUID().toString();
        jdbc.update("UPDATE reservas SET chave_requisicao=? WHERE id=1", chave);
        assertThatThrownBy(() -> jdbc.update("UPDATE reservas SET chave_requisicao=? WHERE id=2", chave))
            .isInstanceOf(DataIntegrityViolationException.class);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM reservas WHERE id=2 AND cancelada_em IS NULL", Integer.class)).isEqualTo(1);
        assertThat(migracao.migrate().migrationsExecuted).isZero();
    }
}
