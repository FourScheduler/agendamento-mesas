package br.com.foursys.agendamento_mesas.catalogo;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.test.context.ActiveProfiles;

/** Repete atribuição, troca, unicidade e concorrência em schema MySQL exclusivo. */
@EnabledIfEnvironmentVariable(named = "TEST_MYSQL_URL", matches = ".+")
@ActiveProfiles(profiles = "mysql-test", inheritProfiles = false)
public class ResponsavelUnicoMySqlTests extends ResponsavelUnicoApiTests {
    @BeforeAll
    static void exigirSchemaExclusivoDeTestes() {
        assertThat(System.getenv("TEST_MYSQL_URL"))
            .as("Use um schema exclusivo de testes, com nome terminado em _test")
            .matches("jdbc:mysql://[^/]+/[^/?]+_test(?:\\?.*)?");
    }
}
