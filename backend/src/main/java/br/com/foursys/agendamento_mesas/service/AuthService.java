package br.com.foursys.agendamento_mesas.service;

import br.com.foursys.agendamento_mesas.dto.LoginRequest;
import br.com.foursys.agendamento_mesas.dto.LoginResponse;
import br.com.foursys.agendamento_mesas.dto.UsuarioResumo;
import br.com.foursys.agendamento_mesas.exceptions.CredenciaisInvalidasException;
import br.com.foursys.agendamento_mesas.exceptions.UsuarioInativoException;
import br.com.foursys.agendamento_mesas.model.Usuario;
import br.com.foursys.agendamento_mesas.repository.UsuarioRepository;
import br.com.foursys.agendamento_mesas.security.JwtService;
import br.com.foursys.agendamento_mesas.web.DadosInvalidosException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Autenticação local: e-mail + senha verificada por hash BCrypt, emitindo JWT.
 */
@Service
public class AuthService {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UsuarioRepository usuarioRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest request) {
        validarEntrada(request);
        Usuario usuario = usuarioRepository.findByEmail(request.email())
                .orElseThrow(CredenciaisInvalidasException::new);
        if (!passwordEncoder.matches(request.senha(), usuario.getSenhaHash())) {
            throw new CredenciaisInvalidasException();
        }
        if (!usuario.isAtivo()) {
            throw new UsuarioInativoException();
        }
        String token = jwtService.gerarToken(usuario);
        return LoginResponse.comToken(token, resumo(usuario));
    }

    private void validarEntrada(LoginRequest request) {
        if (request == null || request.email() == null || request.email().isBlank()) {
            throw new DadosInvalidosException("Campo 'email' é obrigatório.");
        }
        if (request.senha() == null || request.senha().isBlank()) {
            throw new DadosInvalidosException("Campo 'senha' é obrigatório.");
        }
    }

    static UsuarioResumo resumo(Usuario usuario) {
        return new UsuarioResumo(usuario.getId(), usuario.getNome(), usuario.getEmail(), usuario.getPapel());
    }
}
