package com.aureusfinserve.security;

import com.aureusfinserve.config.AppProperties;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;

/**
 * AES-256-GCM column encryption plus HMAC-SHA256 lookup hashes for PII (PAN, mobile, email, DOB, bank a/c).
 * A static holder is kept so JPA {@link EncryptedStringConverter} instances can reach the key even when
 * Hibernate instantiates them itself.
 */
@Slf4j
@Service
public class CryptoService {

    static final String DEV_KEY = "QXVyZXVzRmluc2VydmVEZXZLZXktRE8tTk9ULVVTRSE=";
    static final String DEV_HMAC_KEY = "QXVyZXVzRmluc2VydmVEZXZIbWFjS2V5LURPLU5PVC1VU0UtSU4tUFJPRA==";
    private static final int IV_LEN = 12;
    private static final int TAG_BITS = 128;

    private static volatile CryptoService INSTANCE;

    private final AppProperties props;
    private final SecureRandom random = new SecureRandom();
    private SecretKeySpec aesKey;
    private byte[] hmacKey;

    public CryptoService(AppProperties props) {
        this.props = props;
        init();
    }

    @PostConstruct
    void register() {
        INSTANCE = this;
    }

    private void init() {
        String k = props.getCrypto().getKey();
        if (k == null || k.isBlank()) {
            k = DEV_KEY;
        }
        if (DEV_KEY.equals(k)) {
            log.warn("**************************************************************************");
            log.warn("* app.crypto.key is the built-in DEVELOPMENT key. Set APP_CRYPTO_KEY to a *");
            log.warn("* random base64 32-byte key before storing any real investor data.        *");
            log.warn("**************************************************************************");
        }
        byte[] keyBytes = Base64.getDecoder().decode(k);
        if (keyBytes.length != 32) {
            throw new IllegalStateException("app.crypto.key must be base64 of exactly 32 bytes (AES-256)");
        }
        aesKey = new SecretKeySpec(keyBytes, "AES");
        String hk = props.getCrypto().getHmacKey();
        if (hk == null || hk.isBlank()) {
            hk = DEV_HMAC_KEY;
        }
        if (DEV_HMAC_KEY.equals(hk)) {
            log.warn("app.crypto.hmac-key is the built-in DEVELOPMENT key. Set APP_HMAC_KEY in production.");
        }
        hmacKey = Base64.getDecoder().decode(hk);
        INSTANCE = this;
    }

    static CryptoService instance() {
        CryptoService i = INSTANCE;
        if (i == null) {
            throw new IllegalStateException("CryptoService not initialised");
        }
        return i;
    }

    public String encrypt(String plain) {
        if (plain == null) {
            return null;
        }
        try {
            byte[] iv = new byte[IV_LEN];
            random.nextBytes(iv);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, aesKey, new GCMParameterSpec(TAG_BITS, iv));
            byte[] ct = c.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(ByteBuffer.allocate(iv.length + ct.length).put(iv).put(ct).array());
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Encryption failed", e);
        }
    }

    public String decrypt(String stored) {
        if (stored == null) {
            return null;
        }
        try {
            byte[] all = Base64.getDecoder().decode(stored);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, aesKey, new GCMParameterSpec(TAG_BITS, all, 0, IV_LEN));
            return new String(c.doFinal(all, IV_LEN, all.length - IV_LEN), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            throw new IllegalStateException("Decryption failed - wrong APP_CRYPTO_KEY?", e);
        }
    }

    /** AES-256-GCM for binary content (uploaded KYC documents): returns IV + ciphertext. */
    public byte[] encryptBytes(byte[] plain) {
        if (plain == null) {
            return null;
        }
        try {
            byte[] iv = new byte[IV_LEN];
            random.nextBytes(iv);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, aesKey, new GCMParameterSpec(TAG_BITS, iv));
            byte[] ct = c.doFinal(plain);
            return ByteBuffer.allocate(iv.length + ct.length).put(iv).put(ct).array();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Encryption failed", e);
        }
    }

    public byte[] decryptBytes(byte[] stored) {
        if (stored == null) {
            return null;
        }
        try {
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, aesKey, new GCMParameterSpec(TAG_BITS, stored, 0, IV_LEN));
            return c.doFinal(stored, IV_LEN, stored.length - IV_LEN);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            throw new IllegalStateException("Decryption failed - wrong APP_CRYPTO_KEY?", e);
        }
    }

    /** Keyed lookup hash (hex) of a normalised value. */
    public String hmac(String value) {
        if (value == null) {
            return null;
        }
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(hmacKey, "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    public String panHash(String pan) {
        return pan == null ? null : hmac("PAN:" + pan.trim().toUpperCase(Locale.ROOT));
    }

    public String mobileHash(String mobile) {
        return mobile == null ? null : hmac("MOB:" + normaliseMobile(mobile));
    }

    public String emailHash(String email) {
        return email == null ? null : hmac("EML:" + email.trim().toLowerCase(Locale.ROOT));
    }

    public static String normaliseMobile(String mobile) {
        String d = mobile.replaceAll("\\D", "");
        return d.length() > 10 ? d.substring(d.length() - 10) : d;
    }

    /** Unkeyed SHA-256 (hex) - used for session / activation tokens and OTPs. */
    public static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    public String randomToken(int bytes) {
        byte[] b = new byte[bytes];
        random.nextBytes(b);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    public SecureRandom random() {
        return random;
    }
}
