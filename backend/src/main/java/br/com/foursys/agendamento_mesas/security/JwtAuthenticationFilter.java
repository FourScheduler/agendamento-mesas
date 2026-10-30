package br.com.foursys.agendamento_mesas.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Valida o token Bearer e autentica o usuário correspondente.
 *
 * O usuário é consultado no banco a cada request: token de usuário inativo ou
 * removido não autentica (as rotas protegidas respondem 401 pelo entry point).
 * Token ausente/inválido também não autentica, mas nunca interrompe a cadeia:
 * rotas públicas como o login continuam funcionando.
 */
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UsuarioPorTokenService usuarioPorTokenService;

    public JwtAuthenticationFilter(JwtService jwtService, UsuarioPorTokenService usuarioPorTokenService) {
        this.jwtService = jwtService;
        this.usuarioPorTokenService = usuarioPorTokenService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain cadeia)
            throws ServletException, IOException {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);

        if (header == null || !header.startsWith("Bearer ")) {
            cadeia.doFilter(request, response);
            return;
        }

        try {
            Long idUsuario = jwtService.extrairIdUsuario(header.substring(7));
            usuarioPorTokenService.buscarAtivo(idUsuario).ifPresent(usuario -> {
                var autoridades = List.of(new SimpleGrantedAuthority("ROLE_" + usuario.perfil().name()));
                var autenticacao = new UsernamePasswordAuthenticationToken(usuario, null, autoridades);
                SecurityContextHolder.getContext().setAuthentication(autenticacao);
            });
        } catch (JwtException | IllegalArgumentException e) {
            // Token inválido/expirado: segue sem autenticação; rotas protegidas respondem 401.
            logger.debug("Token JWT rejeitado: " + e.getMessage());
        }

        cadeia.doFilter(request, response);
    }
}
