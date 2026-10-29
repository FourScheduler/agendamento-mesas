package br.com.foursys.agendamento_mesas.service;

import br.com.foursys.agendamento_mesas.dto.request.CriarUsuarioRequest;
import br.com.foursys.agendamento_mesas.dto.UsuarioAdminResumo;
import br.com.foursys.agendamento_mesas.enums.PerfilUsuario;
import br.com.foursys.agendamento_mesas.exceptions.EmailJaCadastradoException;
import br.com.foursys.agendamento_mesas.model.Usuario;
import br.com.foursys.agendamento_mesas.port.out.UsuarioRepositoryPort;
import br.com.foursys.agendamento_mesas.web.DadosInvalidosException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Provisionamento de usuários fictícios para demonstração. Cadastro público
 * não existe; somente administradores criam usuário pela API. A senha é
 * gravada apenas como hash BCrypt.
 */
@Service
public class UsuarioService {

    private static final int SENHA_MINIMA = 6;

    private final UsuarioRepositoryPort usuarioRepositoryPort;
    private final PasswordEncoder passwordEncoder;

    public UsuarioService(UsuarioRepositoryPort usuarioRepositoryPort, PasswordEncoder passwordEncoder) {
        this.usuarioRepositoryPort = usuarioRepositoryPort;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public UsuarioAdminResumo criar(CriarUsuarioRequest request) {
        validarEntrada(request);

        if (usuarioRepositoryPort.existePorEmail(request.email())) {
            throw new EmailJaCadastradoException();
        }

        PerfilUsuario perfil = request.perfil() != null ? request.perfil() : PerfilUsuario.USUARIO;
        Usuario usuario = usuarioRepositoryPort
            .salvar(new Usuario(
                        request.nome(),
                        request.email(),
                        passwordEncoder.encode(request.senha()),
                        perfil,
                        true));

        return new UsuarioAdminResumo(
            usuario.getId(),
            usuario.getNome(),
            usuario.getEmail(),
            usuario.getPapel(),
            usuario.isAtivo());
    }

    @Transactional(readOnly = true)
    public List<UsuarioAdminResumo> listarAtivos() {
        return usuarioRepositoryPort.listarAtivos();
    }

    private void validarEntrada(CriarUsuarioRequest request) {
        if (request == null || request.nome() == null || request.nome().isBlank()) {
            throw new DadosInvalidosException("Campo 'nome' é obrigatório.");
        }
        if (request.email() == null || request.email().isBlank()) {
            throw new DadosInvalidosException("Campo 'email' é obrigatório.");
        }
        if (request.senha() == null || request.senha().isBlank()) {
            throw new DadosInvalidosException("Campo 'senha' é obrigatório.");
        }
        if (request.senha().length() < SENHA_MINIMA) {
            throw new DadosInvalidosException("A senha deve ter pelo menos " + SENHA_MINIMA + " caracteres.");
        }
    }
}
