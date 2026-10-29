package br.com.foursys.agendamento_mesas.security;

import br.com.foursys.agendamento_mesas.model.Usuario;
import br.com.foursys.agendamento_mesas.port.out.UsuarioRepositoryPort;
import java.util.Optional;
import org.springframework.stereotype.Service;

//Monta a identidade autenticada a partir do id do token, consultando o banco.
@Service
public class UsuarioPorTokenService {

    private final UsuarioRepositoryPort usuarioRepositoryPort;

    public UsuarioPorTokenService(UsuarioRepositoryPort usuarioRepositoryPort) {
        this.usuarioRepositoryPort = usuarioRepositoryPort;
    }

    public Optional<UsuarioAutenticado> buscarAtivo(Long id) {
        return usuarioRepositoryPort.buscarPorId(id)
                .filter(Usuario::isAtivo)
                .map(usuario ->
                    new UsuarioAutenticado(
                        usuario.getId(),
                        usuario.getNome(),
                        usuario.getEmail(),
                        usuario.getPapel()
                    )
                );
    }
}
