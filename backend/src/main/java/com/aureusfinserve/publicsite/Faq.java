package com.aureusfinserve.publicsite;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "faq")
public class Faq {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 500)
    private String question;

    @Column(nullable = false, length = 4000)
    private String answer;

    @Column(length = 60)
    private String category;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;
}
