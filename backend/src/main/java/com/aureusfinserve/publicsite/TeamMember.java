package com.aureusfinserve.publicsite;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "team_member")
public class TeamMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 100)
    private String designation;

    @Column(length = 20)
    private String euin;

    @Column(length = 1500)
    private String bio;

    @Column(name = "is_founder", nullable = false)
    private boolean founder;

    @Column(length = 300)
    private String qualifications;

    @Column(name = "years_experience")
    private Integer yearsExperience;

    @Column(name = "photo_url", length = 300)
    private String photoUrl;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;
}
