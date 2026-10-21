package com.aureusfinserve.investor;

import com.aureusfinserve.security.EncryptedStringConverter;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "bank_account", indexes = @Index(name = "ix_bank_account_investor", columnList = "investor_id"))
public class BankAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "investor_id", nullable = false)
    private Long investorId;

    @Column(name = "bank_name", nullable = false, length = 100)
    private String bankName;

    @Convert(converter = EncryptedStringConverter.class)
    @Column(name = "account_number", length = 512)
    private String accountNumber;

    @Column(length = 11)
    private String ifsc;

    @Column(name = "is_primary", nullable = false)
    private boolean primaryAccount;
}
