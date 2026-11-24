package br.com.foursys.agendamento_mesas.controller;

import br.com.foursys.agendamento_mesas.dto.response.LoginResponse;
import br.com.foursys.agendamento_mesas.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Pattern;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class MicrosoftSsoController {

    public static final String BASE_AUTORIZACAO = "/api/auth/sso/autorizar";
    public static final String INICIO = BASE_AUTORIZACAO + "/microsoft";
    public static final String RETORNO = "/api/auth/sso/retorno/microsoft";
    public static final String SESSAO = "/api/auth/sso/sessao";

    private static final String IDENTIDADE_PENDENTE = MicrosoftSsoController.class.getName() + ".identidade";
    private static final int VALIDADE_SEGUNDOS = 60;
    private static final Pattern UUID = Pattern.compile("[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}");

    private final AuthService authService;

    public MicrosoftSsoController(AuthService authService) {
        this.authService = authService;
    }

    @GetMapping({INICIO, RETORNO})
    public void indisponivel(HttpServletResponse response) {
        retornarAoLogin(response, "indisponivel");
    }

    @PostMapping(path = SESSAO, consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<LoginResponse> trocarSessao(HttpServletRequest request) {
        HttpSession sessao = request.getSession(false);
        if (sessao == null || !(sessao.getAttribute(IDENTIDADE_PENDENTE) instanceof IdentidadePendente pendente)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).cacheControl(CacheControl.noStore()).build();
        }

        Identidade identidade = pendente.identidade().getAndSet(null);
        if (identidade == null || !Instant.now().isBefore(identidade.expiraEm())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).cacheControl(CacheControl.noStore()).build();
        }

        return authService.loginMicrosoft(identidade.tenantId(), identidade.objectId())
            .map(login -> ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(login))
            .orElseGet(() -> ResponseEntity.status(HttpStatus.FORBIDDEN).cacheControl(CacheControl.noStore()).build());
    }

    public void concluir(HttpServletRequest request, HttpServletResponse response, Authentication auth, String tenant) {
        encerrarTemporaria(request);
        if (auth.getPrincipal() instanceof OidcUser usuario) {
            String tid = usuario.getIdToken().getClaimAsString("tid");
            String oid = usuario.getIdToken().getClaimAsString("oid");
            if (tenant.equals(tid) && oid != null && UUID.matcher(oid).matches()) {
                HttpSession sessao = request.getSession(true);
                sessao.setMaxInactiveInterval(VALIDADE_SEGUNDOS);
                Identidade identidade = new Identidade(tid, oid, Instant.now().plusSeconds(VALIDADE_SEGUNDOS));
                sessao.setAttribute(IDENTIDADE_PENDENTE, new IdentidadePendente(new AtomicReference<>(identidade)));
                retornarAoLogin(response, "sucesso");
                return;
            }
        }
        retornarAoLogin(response, "falha");
    }

    public void falha(HttpServletRequest request, HttpServletResponse response, AuthenticationException erro) {
        encerrarTemporaria(request);
        boolean cancelado = erro instanceof OAuth2AuthenticationException oauth
            && "access_denied".equals(oauth.getError().getErrorCode());
        retornarAoLogin(response, cancelado ? "cancelado" : "falha");
    }

    private static void encerrarTemporaria(HttpServletRequest request) {
        HttpSession sessao = request.getSession(false);
        if (sessao != null) sessao.invalidate();
    }

    private static void retornarAoLogin(HttpServletResponse response, String status) {
        response.setStatus(HttpServletResponse.SC_SEE_OTHER);
        response.setHeader(HttpHeaders.LOCATION, "/login?microsoft=" + status);
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
    }

    private record Identidade(String tenantId, String objectId, Instant expiraEm) {}

    private record IdentidadePendente(AtomicReference<Identidade> identidade) {}
}
