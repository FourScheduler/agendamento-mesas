package br.com.foursys.agendamento_mesas.security;

import br.com.foursys.agendamento_mesas.model.Usuario;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.stereotype.Service;

/**
 * Emite e valida tokens JWT (HS256). O token carrega apenas o id do usuário
 * como identificador; nome, email e perfil são lidos do banco a cada request,
 * o que dá efeito imediato a desativação de usuário.
 */
@Service
public class JwtService {

    private final NimbusJwtEncoder encoder;
    private final NimbusJwtDecoder decoder;
    private final Duration expiracaoPadrao;

    public JwtService(@Value("${app.jwt.secret}") String segredo,
            @Value("${app.jwt.expiracao-horas}") long horasExpiracao) {
        SecretKeySpec chave = new SecretKeySpec(segredo.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        this.encoder = new NimbusJwtEncoder(new ImmutableSecret<>(chave));
        this.decoder = NimbusJwtDecoder.withSecretKey(chave).macAlgorithm(MacAlgorithm.HS256).build();
        this.expiracaoPadrao = Duration.ofHours(horasExpiracao);
    }

    public String gerarToken(Usuario usuario) {
        return gerarToken(usuario, expiracaoPadrao);
    }

    public String gerarToken(Usuario usuario, Duration validade) {
        Instant agora = Instant.now();
        Instant expiracao = agora.plus(validade);
        // Validez vencida (usada em teste de token expirado): emissão também no
        // passado, pois o Spring Security exige expiresAt > issuedAt.
        Instant emissao = expiracao.isAfter(agora) ? agora : expiracao.minusSeconds(1);
        // Somente o id identifica o usuário; nome/email/perfil são lidos do banco a cada request.
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .subject(usuario.getId().toString())
                .issuedAt(emissao)
                .expiresAt(expiracao)
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }

    /**
     * Valida assinatura e expiração e devolve o id do usuário.
     *
     * @throws org.springframework.security.oauth2.jwt.JwtException se o token
     *         for inválido ou expirado.
     */
    public Long extrairIdUsuario(String token) {
        Jwt jwt = decoder.decode(token);
        return Long.valueOf(jwt.getSubject());
    }
}
