package br.com.foursys.agendamento_mesas.catalogo;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.test.context.ActiveProfiles;

@EnabledIfEnvironmentVariable(named = "TEST_MYSQL_URL", matches = ".+")
@ActiveProfiles(profiles = "mysql-test", inheritProfiles = false)
public class OcupacaoDiariaMySqlTests extends OcupacaoDiariaApiTests {
    @BeforeAll
    static void exigirSchemaExclusivoDeTestes() {
        assertThat(System.getenv("TEST_MYSQL_URL")).matches("jdbc:mysql://[^/]+/[^/?]+_test(?:\\?.*)?");
    }
}
