package com.sochi.vayu.service;

import com.sochi.vayu.config.JwtTokenProvider;
import com.sochi.vayu.domain.User;
import com.sochi.vayu.dto.LoginRequestDto;
import com.sochi.vayu.dto.LoginResponseDto;
import com.sochi.vayu.dto.UserProfileDto;
import com.sochi.vayu.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final AuditLogService auditLogService;

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtTokenProvider jwtTokenProvider,
            AuditLogService auditLogService
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
        this.auditLogService = auditLogService;
    }

    public LoginResponseDto login(LoginRequestDto request) {
        String username = request.getUsername().trim();

        User user = userRepository.findByUsername(username)
                .orElse(null);

        if (user == null || !passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            log.warn("[AUTH FAILED] Failed login attempt for username: '{}'", username);
            auditLogService.logAction(
                    username,
                    "LOGIN_FAILED",
                    "USER",
                    username,
                    Map.of("reason", "Bad credentials")
            );
            throw new BadCredentialsException("Invalid username or password");
        }

        if (!user.isEnabled()) {
            log.warn("[AUTH DENIED] Disabled user account attempt: '{}'", username);
            auditLogService.logAction(
                    username,
                    "LOGIN_DENIED",
                    "USER",
                    username,
                    Map.of("reason", "Account disabled")
            );
            throw new BadCredentialsException("User account is disabled");
        }

        String token = jwtTokenProvider.generateToken(user);

        auditLogService.logAction(
                username,
                "LOGIN_SUCCESS",
                "USER",
                username,
                Map.of("role", user.getRole(), "site_scope", user.getSiteScope())
        );

        log.info("[AUTH SUCCESS] User '{}' logged in with role '{}' and siteScope '{}'",
                user.getUsername(), user.getRole(), user.getSiteScope());

        return new LoginResponseDto(
                token,
                jwtTokenProvider.getExpirationMs(),
                user.getUsername(),
                user.getFullName(),
                user.getRole(),
                user.getSiteScope()
        );
    }

    public UserProfileDto getCurrentUserProfile(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new BadCredentialsException("User not found: " + username));

        return new UserProfileDto(
                user.getUsername(),
                user.getFullName(),
                user.getRole(),
                user.getSiteScope(),
                user.isEnabled()
        );
    }
}
