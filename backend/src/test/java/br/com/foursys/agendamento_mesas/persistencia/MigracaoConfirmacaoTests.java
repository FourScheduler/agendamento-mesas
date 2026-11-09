package br.com.foursys.agendamento_mesas.persistencia;

import static org.assertj.core.api.Assertions.*;

import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class MigracaoConfirmacaoTests {
    @Test
    void atualizaV9PreservandoDadosLegadosEAplicaUnicidadePorAutor() {
        var ds = new DriverManagerDataSource("jdbc:h2:mem:confirmacao_" + UUID.randomUUID()
            + ";MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1", "sa", "");
        Flyway.configure().dataSource(ds).locations("classpath:db/migration").target("9").load().migrate();
        var jdbc = new JdbcTemplate(ds);
        jdbc.update("""
            insert into usuarios (id, nome, email, senha_hash, perfil, ativo, criado_em)
            values (1, 'Teste', 'teste@exemplo.com', 'hash', 'USUARIO', true, current_timestamp),
                   (2, 'Outra pessoa', 'outra@exemplo.com', 'hash', 'USUARIO', true, current_timestamp)
            """);
        jdbc.update("""
            insert into mesas (id, codigo, regiao, tipo, ativa, planta, posicao_x, posicao_y)
            values (1, '001', 'DEMO', 'LIVRE', true, 'DEMO', 0, 0)
            """);
        jdbc.update("""
            insert into reservas (mesa_id, usuario_id, criado_por_id, data, status, criada_em)
            values (1, 1, null, '2026-10-26', 'CANCELADA', current_timestamp),
                   (1, 1, 1, '2026-10-27', 'CONFIRMADA', current_timestamp)
            """);
        var antes = jdbc.queryForList("select id, mesa_id, usuario_id, criado_por_id, data, status, criada_em, cancelada_em from reservas order by id");
        var flyway = Flyway.configure().dataSource(ds).locations("classpath:db/migration").load();
        assertThat(flyway.migrate().migrationsExecuted).isEqualTo(1);
        assertThat(jdbc.queryForList("select id, mesa_id, usuario_id, criado_por_id, data, status, criada_em, cancelada_em from reservas order by id"))
            .isEqualTo(antes);
        assertThat(jdbc.queryForObject("select count(*) from reservas where chave_requisicao is null", Integer.class)).isEqualTo(2);
        String chave = UUID.randomUUID().toString();
        jdbc.update("update reservas set chave_requisicao = ? where criado_por_id = 1", chave);
        String inserir = """
            insert into reservas (mesa_id, usuario_id, criado_por_id, chave_requisicao, data, status, criada_em)
            values (1, 1, ?, ?, '2026-10-28', 'CONFIRMADA', current_timestamp)
            """;
        assertThatThrownBy(() -> jdbc.update(inserir, 1, chave))
            .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThat(jdbc.update(inserir, 2, chave)).isEqualTo(1);
        assertThat(flyway.migrate().migrationsExecuted).isZero();
    }
}
