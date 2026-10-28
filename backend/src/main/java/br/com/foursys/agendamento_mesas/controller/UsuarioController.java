package br.com.foursys.agendamento_mesas.controller;

import br.com.foursys.agendamento_mesas.dto.request.CriarUsuarioRequest;
import br.com.foursys.agendamento_mesas.dto.UsuarioAdminResumo;
import br.com.foursys.agendamento_mesas.service.UsuarioService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import br.com.foursys.agendamento_mesas.dto.UsuarioResponsavelResumo;
import br.com.foursys.agendamento_mesas.web.DadosInvalidosException;
import java.util.List;

/**
 * Provisionamento de usuário fictício e consulta de usuários ativos. Rota administrativa:
 * exige perfil ADMIN (regra aplicada na SecurityConfig).
 */
@RestController
@RequestMapping("/api/admin/usuarios")
public class UsuarioController {

    private final UsuarioService usuarioService;

    public UsuarioController(UsuarioService usuarioService) {
        this.usuarioService = usuarioService;
    }

    @PostMapping
    public ResponseEntity<UsuarioAdminResumo> criar(@RequestBody CriarUsuarioRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(usuarioService.criar(request));
    }

    @GetMapping
    public List<UsuarioResponsavelResumo> listarAtivos(@RequestParam(defaultValue = "true") boolean ativo) {
        if (!ativo) throw new DadosInvalidosException("Esta consulta disponibiliza somente usuários ativos.");
        return usuarioService.listarAtivos();
    }
}
