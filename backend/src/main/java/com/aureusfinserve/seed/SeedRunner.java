package com.aureusfinserve.seed;

import com.aureusfinserve.auth.AppUserRepository;
import com.aureusfinserve.publicsite.Scheme;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/** Seeds demo data on first start (only when app_user is empty). */
@Slf4j
@Component
@Order(1)
@ConditionalOnProperty(name = "app.seed.enabled", havingValue = "true", matchIfMissing = true)
@RequiredArgsConstructor
public class SeedRunner implements CommandLineRunner {

    private final AppUserRepository userRepo;
    private final SchemeSeed schemeSeed;
    private final ContentSeed contentSeed;
    private final DemoSeed demoSeed;
    private final KycSeed kycSeed;
    private final TransactionTemplate tx;
    private final com.aureusfinserve.config.AppProperties props;

    @Override
    public void run(String... args) {
        if (userRepo.count() > 0) {
            log.info("Database already contains users - skipping demo seed");
            return;
        }
        long t0 = System.currentTimeMillis();
        boolean sample = props.getSeed().isSampleData();
        log.info("Empty database detected - seeding real schemes (AMFI data), website content and {}",
                sample ? "SAMPLE clients / leads / KYC applications" : "the administrator login only");
        tx.executeWithoutResult(s -> {
            Map<Long, TreeMap<LocalDate, Double>> series = new HashMap<>();
            Map<String, Scheme> schemes = schemeSeed.seed(series);
            contentSeed.seed(schemeSeed.amcs());
            if (sample) {
                demoSeed.seed(schemes, series);
                kycSeed.seed();
            } else {
                demoSeed.seedAdminOnly(props.getSeed().getAdminEmail(), props.getSeed().getAdminPassword());
            }
        });
        log.info("Seed completed in {} ms", System.currentTimeMillis() - t0);
    }
}
