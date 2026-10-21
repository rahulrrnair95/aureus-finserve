package com.aureusfinserve.publicsite;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "testimonial")
public class Testimonial {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 60)
    private String city;

    @Column(name = "body_text", nullable = false, length = 1000)
    private String text;

    @Column(name = "photo_url", length = 300)
    private String photoUrl;

    /** Client consented to publication (only consented testimonials are shown). */
    @Column(nullable = false)
    private boolean consent;

    @Column(nullable = false)
    private boolean active = true;
}
