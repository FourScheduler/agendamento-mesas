package br.com.foursys.agendamento_mesas.controller;

import br.com.foursys.agendamento_mesas.service.AuthService;
import br.com.foursys.agendamento_mesas.dto.request.LoginRequest;
import br.com.foursys.agendamento_mesas.dto.response.LoginResponse;
import br.com.foursys.agendamento_mesas.dto.UsuarioResumo;
import br.com.foursys.agendamento_mesas.security.UsuarioAutenticado;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Rotas de autenticação: login (única rota pública) e perfil do autenticado.
 * A identidade vem sempre do token validado, nunca do request.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @GetMapping("/perfil")
    public UsuarioResumo perfil(@AuthenticationPrincipal UsuarioAutenticado usuario) {
        return new UsuarioResumo(usuario.id(), usuario.nome(), usuario.email(), usuario.perfil());
    }
}
