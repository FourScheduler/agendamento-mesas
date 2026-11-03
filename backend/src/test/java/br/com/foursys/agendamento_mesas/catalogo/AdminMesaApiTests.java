package br.com.foursys.agendamento_mesas.catalogo;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.foursys.agendamento_mesas.model.Mesa;
import br.com.foursys.agendamento_mesas.port.out.MesaRepositoryPort;
import br.com.foursys.agendamento_mesas.port.out.UsuarioRepositoryPort;
import br.com.foursys.agendamento_mesas.security.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@ActiveProfiles("test")
@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:admin_mesas;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
    "spring.flyway.locations=classpath:db/migration,classpath:db/seed"
})
@AutoConfigureMockMvc
@Transactional
class AdminMesaApiTests {

    @Autowired MockMvc mvc;
    @Autowired MesaRepositoryPort mesas;
    @Autowired UsuarioRepositoryPort usuarios;
    @Autowired JwtService jwt;

    @Test
    void administradorPodeFixarDesfixarInativarEAtivarMesa() throws Exception {
        var admin = usuarios.buscarPorEmail("bianca.rodrigues@foursys.com.br").orElseThrow();
        var responsavel = usuarios.buscarPorEmail("hudson.silva@foursys.com.br").orElseThrow();
        Mesa mesa = mesas.buscarPorCodigo("044").orElseThrow();
        String token = "Bearer " + jwt.gerarToken(admin);

        mvc.perform(patch("/api/admin/mesas/{id}/fixar", mesa.getId())
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"usuarioId\":" + responsavel.getId() + "}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.tipo").value("FIXA"))
            .andExpect(jsonPath("$.responsavel.id").value(responsavel.getId()))
            .andExpect(jsonPath("$.responsavel.email").value(responsavel.getEmail()));

        mvc.perform(get("/api/mesas")
                        .header("Authorization", token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[43].responsavel.id").value(responsavel.getId()));

        mvc.perform(patch("/api/admin/mesas/{id}/desfixar", mesa.getId())
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.tipo").value("LIVRE"))
            .andExpect(jsonPath("$.responsavel").doesNotExist());

        mvc.perform(patch("/api/admin/mesas/{id}/ativacao", mesa.getId())
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ativa\":false}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ativa").value(false));

        mvc.perform(patch("/api/admin/mesas/{id}/ativacao", mesa.getId())
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ativa\":true}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ativa").value(true));
    }

    @Test
    void operacoesDeMesaExigemPerfilAdministrador() throws Exception {
        var usuario = usuarios.buscarPorEmail("hudson.silva@foursys.com.br").orElseThrow();
        Mesa mesa = mesas.buscarPorCodigo("044").orElseThrow();

        mvc.perform(patch("/api/admin/mesas/{id}/ativacao", mesa.getId())
                        .header("Authorization", "Bearer " + jwt.gerarToken(usuario))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ativa\":false}"))
            .andExpect(status().isForbidden());
    }
}
