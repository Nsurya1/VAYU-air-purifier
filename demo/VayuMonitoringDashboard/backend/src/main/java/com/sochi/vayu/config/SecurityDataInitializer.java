package com.sochi.vayu.config;

import com.sochi.vayu.domain.User;
import com.sochi.vayu.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Initializes default user personas for testing, role-based authorization, and triage.
 */
@Component
public class SecurityDataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(SecurityDataInitializer.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public SecurityDataInitializer(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        seedUsers();
    }

    private void seedUsers() {
        record UserSeed(String username, String rawPassword, String fullName, String role, String siteScope) {}

        List<UserSeed> defaultUsers = List.of(
                new UserSeed("admin", "SochiAdmin2026!", "SOCHI Operations Administrator", "ROLE_ADMIN", "*"),
                new UserSeed("tech_pune", "TechPune2026!", "Pune Service Technician", "ROLE_SERVICE_TECH", "SITE-HQ-PUNE"),
                new UserSeed("dev_eng", "DevEng2026!", "R&D Firmware Engineer", "ROLE_DEV_ENGINEER", "*"),
                new UserSeed("kiosk", "KioskView2026!", "SOCHI TV Wall Kiosk", "ROLE_KIOSK", "*")
        );

        for (UserSeed seed : defaultUsers) {
            if (userRepository.findByUsername(seed.username()).isEmpty()) {
                String encodedPassword = passwordEncoder.encode(seed.rawPassword());
                User user = new User(
                        seed.username(),
                        encodedPassword,
                        seed.fullName(),
                        seed.role(),
                        seed.siteScope(),
                        true
                );
                userRepository.save(user);
                log.info("[SECURITY INIT] Seeded default user '{}' with role '{}' and siteScope '{}'",
                        seed.username(), seed.role(), seed.siteScope());
            }
        }
    }
}
