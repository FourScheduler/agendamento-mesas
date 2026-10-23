package br.com.foursys.agendamento_mesas.security;

import br.com.foursys.agendamento_mesas.model.Usuario;
import br.com.foursys.agendamento_mesas.repository.UsuarioRepository;
import java.util.Optional;
import org.springframework.stereotype.Service;

/**
 * Monta a identidade autenticada a partir do id do token, consultando o banco.
 * Usuário inativo ou inexistente devolve vazio: o request não autentica.
 */
@Service
public class UsuarioPorTokenService {

    private final UsuarioRepository usuarioRepository;

    public UsuarioPorTokenService(UsuarioRepository usuarioRepository) {
        this.usuarioRepository = usuarioRepository;
    }

    public Optional<UsuarioAutenticado> buscarAtivo(Long id) {
        return usuarioRepository.findById(id)
                .filter(Usuario::isAtivo)
                .map(usuario -> new UsuarioAutenticado(usuario.getId(), usuario.getNome(), usuario.getEmail(),
                        usuario.getPapel()));
    }
}
