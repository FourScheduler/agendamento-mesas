package br.com.foursys.agendamento_mesas.reservas;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

/** Executa o mesmo contrato e as mesmas disputas no MySQL, em schema exclusivo de testes. */
@EnabledIfEnvironmentVariable(named = "TEST_MYSQL_URL", matches = ".+")
@ActiveProfiles(profiles = "mysql-test", inheritProfiles = false)
public class ReservaMySqlTests extends ReservaApiTests {
    @Autowired JdbcTemplate jdbc;

    @BeforeAll
    static void exigirSchemaExclusivoDeTestes() {
        assertThat(System.getenv("TEST_MYSQL_URL"))
                .as("Use um schema exclusivo de testes, com nome terminado em _test")
                .matches("jdbc:mysql://[^/]+/[^/?]+_test(?:\\?.*)?");
    }

    @Test
    void tabelasUsamInnoDBParaTransacoesELocks() {
        assertThat(jdbc.queryForList("""
                SELECT ENGINE FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('mesas', 'usuarios', 'reservas')
                """, String.class)).hasSize(3).containsOnly("InnoDB");
    }
}
