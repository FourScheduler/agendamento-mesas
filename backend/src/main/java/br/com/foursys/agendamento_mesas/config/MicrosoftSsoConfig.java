package br.com.foursys.agendamento_mesas.config;

import br.com.foursys.agendamento_mesas.controller.MicrosoftSsoController;
import java.net.URI;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.HttpSessionOAuth2AuthorizedClientRepository;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy;
import org.springframework.util.Assert;

@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(name = "app.microsoft.enabled", havingValue = "true")
public class MicrosoftSsoConfig {

    @Bean
    @Order(1)
    SecurityFilterChain filtroMicrosoft(
        HttpSecurity http,
        MicrosoftSsoController controlador,
        @Value("${app.microsoft.tenant-id}") String tenantId,
        @Value("${app.microsoft.client-id}") String clientId,
        @Value("${app.microsoft.client-secret}") String clientSecret,
        @Value("${app.microsoft.redirect-uri}") URI redirectUri
    ) throws Exception {
        Assert.hasText(clientSecret, "Defina MICROSOFT_CLIENT_SECRET para habilitar o SSO.");
        String tenant = UUID.fromString(tenantId).toString();
        validarRedirectUri(redirectUri);
        String autoridade = "https://login.microsoftonline.com/" + tenant;
        ClientRegistration microsoft = ClientRegistration.withRegistrationId("microsoft")
            .clientId(UUID.fromString(clientId).toString())
            .clientSecret(clientSecret)
            .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_POST)
            .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
            .clientSettings(ClientRegistration.ClientSettings.builder().requireProofKey(true).build())
            .redirectUri(redirectUri.toString())
            .scope("openid", "profile")
            .authorizationUri(autoridade + "/oauth2/v2.0/authorize")
            .tokenUri(autoridade + "/oauth2/v2.0/token")
            .issuerUri(autoridade + "/v2.0")
            .jwkSetUri(autoridade + "/discovery/v2.0/keys")
            .build();

        return http
            .securityMatcher(MicrosoftSsoController.INICIO, MicrosoftSsoController.RETORNO)
            .authorizeHttpRequests(requisicoes -> requisicoes.anyRequest().permitAll())
            .sessionManagement(sessao -> sessao.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .requestCache(AbstractHttpConfigurer::disable)
            .headers(headers -> headers.referrerPolicy(policy -> policy.policy(ReferrerPolicy.NO_REFERRER)))
            .oauth2Login(login -> login
                .loginPage("/login")
                .clientRegistrationRepository(new InMemoryClientRegistrationRepository(microsoft))
                .authorizedClientRepository(new HttpSessionOAuth2AuthorizedClientRepository())
                .authorizationEndpoint(endpoint -> endpoint.baseUri(MicrosoftSsoController.BASE_AUTORIZACAO))
                .redirectionEndpoint(endpoint -> endpoint.baseUri(MicrosoftSsoController.RETORNO))
                .successHandler((request, response, auth) -> controlador.concluir(request, response, auth, tenant))
                .failureHandler(controlador::falha))
            .build();
    }

    private static void validarRedirectUri(URI uri) {
        String host = uri.getHost();
        boolean httpLocal = "http".equals(uri.getScheme()) && host != null
            && Set.of("localhost", "127.0.0.1", "[::1]").contains(host);
        if ((!"https".equals(uri.getScheme()) && !httpLocal) || host == null
            || !MicrosoftSsoController.RETORNO.equals(uri.getRawPath())
            || uri.getRawQuery() != null || uri.getRawFragment() != null || uri.getRawUserInfo() != null) {
            throw new IllegalArgumentException("MICROSOFT_SSO_REDIRECT_URI deve apontar para o retorno público do SSO.");
        }
    }
}
