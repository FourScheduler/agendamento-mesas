package br.com.foursys.agendamento_mesas.administracao;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.test.context.ActiveProfiles;

/** Repete contratos e concorrência em schema MySQL exclusivo de testes. */
@EnabledIfEnvironmentVariable(named = "TEST_MYSQL_URL", matches = ".+")
@ActiveProfiles(profiles = "mysql-test", inheritProfiles = false)
public class MesaAdminMySqlTests extends MesaAdminApiTests {
    @BeforeAll
    static void exigirSchemaDeTestes() {
        assertThat(System.getenv("TEST_MYSQL_URL")).matches("jdbc:mysql://[^/]+/[^/?]+_test(?:\\?.*)?");
    }
}
