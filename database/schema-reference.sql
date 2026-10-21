-- =====================================================================================
-- Aureus Finserve - schema reference (Microsoft SQL Server)
-- Exported from the Hibernate / JPA model with org.hibernate.dialect.SQLServerDialect.
-- For REFERENCE / review only: the application creates and updates the schema itself
-- (spring.jpa.hibernate.ddl-auto=update). Run create-database.sql first, then start the app.
-- Sensitive columns (pan, mobile, dob, account_number, cas_password, KYC addresses / foreign_tin) hold AES-256-GCM
-- ciphertext (base64); *_hash columns hold HMAC-SHA256 lookup hashes.
-- =====================================================================================
USE AureusFinserve;
GO


    create table activation_token (
        created_at datetime2(6) not null,
        expires_at datetime2(6) not null,
        id bigint identity not null,
        used_at datetime2(6),
        user_id bigint not null,
        token_hash nvarchar(64) not null,
        primary key (id)
    );

    create table amc (
        active bit not null,
        sort_order int not null,
        id bigint identity not null,
        logo_content_type nvarchar(40),
        website nvarchar(200),
        name nvarchar(100) not null,
        slug nvarchar(120) not null,
        logo varbinary(max),
        primary key (id)
    );

    create table app_user (
        enabled bit not null,
        failed_attempts int not null,
        created_at datetime2(6) not null,
        id bigint identity not null,
        investor_id bigint,
        last_login_at datetime2(6),
        locked_until datetime2(6),
        password_changed_at datetime2(6),
        euin nvarchar(20),
        login_status nvarchar(20) not null check (login_status in ('NOT_ACTIVATED','ACTIVE','LOCKED','DISABLED')),
        role nvarchar(20) not null check (role in ('INVESTOR','RM','ADMIN')),
        email_hash nvarchar(64),
        mobile_hash nvarchar(64),
        password_hash nvarchar(100),
        name nvarchar(150) not null,
        email nvarchar(200),
        mobile nvarchar(512),
        primary key (id)
    );

    create table article (
        read_minutes int,
        created_at datetime2(6) not null,
        id bigint identity not null,
        publish_at datetime2(6),
        updated_at datetime2(6) not null,
        category nvarchar(60),
        slug nvarchar(150) not null,
        title nvarchar(250) not null,
        video_url nvarchar(300),
        summary nvarchar(600),
        body nvarchar(max),
        primary key (id)
    );

    create table audit_log (
        created_at datetime2(6) not null,
        id bigint identity not null,
        user_id bigint,
        user_role nvarchar(20),
        action nvarchar(40) not null,
        entity nvarchar(60),
        entity_id nvarchar(60),
        ip nvarchar(64),
        user_name nvarchar(150),
        detail nvarchar(2000),
        primary key (id)
    );

    create table bank_account (
        is_primary bit not null,
        id bigint identity not null,
        investor_id bigint not null,
        ifsc nvarchar(11),
        bank_name nvarchar(100) not null,
        account_number nvarchar(512),
        primary key (id)
    );

    create table banner (
        active bit not null,
        ends_at datetime2(6),
        id bigint identity not null,
        starts_at datetime2(6),
        cta_label nvarchar(60),
        title nvarchar(200) not null,
        cta_url nvarchar(300),
        body_text nvarchar(1000),
        primary key (id)
    );

    create table brokerage (
        aum numeric(19,4),
        expected numeric(19,4),
        rate_pct numeric(9,4),
        received numeric(19,4),
        reconciled bit not null,
        brokerage_month nvarchar(7) not null,
        id bigint identity not null,
        amc nvarchar(100) not null,
        scheme_name nvarchar(250) not null,
        primary key (id)
    );

    create table cms_content (
        updated_at datetime2(6) not null,
        content_key nvarchar(80) not null,
        json_value nvarchar(max) not null,
        primary key (content_key)
    );

    create table cms_page (
        updated_at datetime2(6) not null,
        page_key nvarchar(40) not null,
        title nvarchar(200) not null,
        body nvarchar(max),
        primary key (page_key)
    );

    create table faq (
        sort_order int not null,
        id bigint identity not null,
        category nvarchar(60),
        question nvarchar(500) not null,
        answer nvarchar(4000) not null,
        primary key (id)
    );

    create table folio (
        created_at datetime2(6) not null,
        id bigint identity not null,
        investor_id bigint not null,
        scheme_id bigint not null,
        folio_no nvarchar(30) not null,
        primary key (id)
    );

    create table glossary_term (
        id bigint identity not null,
        term nvarchar(100) not null,
        definition nvarchar(2000) not null,
        primary key (id)
    );

    create table goal (
        target_amount numeric(19,4) not null,
        target_date date not null,
        id bigint identity not null,
        investor_id bigint not null,
        type nvarchar(20) not null check (type in ('RETIREMENT','EDUCATION','HOUSE','WEALTH','OTHER')),
        name nvarchar(150) not null,
        primary key (id)
    );

    create table goal_folio (
        folio_id bigint,
        goal_id bigint not null
    );

    create table investor (
        created_at datetime2(6) not null,
        family_head_id bigint,
        id bigint identity not null,
        rm_id bigint,
        kyc_status nvarchar(20) not null check (kyc_status in ('VALIDATED','REGISTERED','ON_HOLD','NOT_FOUND')),
        relation nvarchar(20) check (relation in ('SELF','SPOUSE','CHILD','PARENT','OTHER')),
        tax_status nvarchar(50),
        email_hash nvarchar(64),
        mobile_hash nvarchar(64),
        pan_hash nvarchar(64),
        name nvarchar(150) not null,
        email nvarchar(200),
        address nvarchar(500),
        dob nvarchar(512),
        mobile nvarchar(512),
        pan nvarchar(512),
        primary key (id)
    );

    -- Online KYC applications (website). pan, dob, mobile, address_line, overseas_address and
    -- foreign_tin hold AES-256-GCM ciphertext; pan_hash / mobile_hash are HMAC lookups.
    create table kyc_application (
        consent bit not null,
        politically_exposed bit not null,
        assigned_rm_id bigint,
        consent_at datetime2(6),
        created_at datetime2(6) not null,
        id bigint identity not null,
        updated_at datetime2(6) not null,
        pincode nvarchar(10),
        residency nvarchar(10) not null check (residency in ('RESIDENT','NRI')),
        gender nvarchar(12) check (gender in ('MALE','FEMALE','TRANSGENDER')),
        ref nvarchar(20),
        annual_income nvarchar(20),
        marital_status nvarchar(20),
        status nvarchar(20) not null check (status in ('SUBMITTED','UNDER_REVIEW','VIPV_SCHEDULED','SUBMITTED_TO_KRA','KYC_REGISTERED','ACTION_REQUIRED','REJECTED')),
        occupation nvarchar(30),
        otp_challenge_id nvarchar(36),
        mobile_hash nvarchar(64),
        pan_hash nvarchar(64),
        city nvarchar(80),
        country_of_residence nvarchar(80),
        nationality nvarchar(80),
        state_name nvarchar(80),
        tax_residency_country nvarchar(80),
        preferred_vipv_slot nvarchar(100),
        father_or_spouse_name nvarchar(150),
        full_name nvarchar(150) not null,
        email nvarchar(200),
        dob nvarchar(512),
        foreign_tin nvarchar(512),
        mobile nvarchar(512),
        pan nvarchar(512),
        address_line nvarchar(1024),
        overseas_address nvarchar(1024),
        staff_notes nvarchar(4000),
        primary key (id)
    );

    -- Documents uploaded with a KYC application; data = AES-256-GCM encrypted bytes (IV + ciphertext).
    create table kyc_document (
        application_id bigint not null,
        id bigint identity not null,
        size_bytes bigint not null,
        uploaded_at datetime2(6) not null,
        doc_type nvarchar(30) not null check (doc_type in ('PAN_CARD','ADDRESS_PROOF','PHOTO','SIGNATURE','CANCELLED_CHEQUE','PASSPORT','OVERSEAS_ADDRESS_PROOF','VISA_OR_OCI')),
        content_type nvarchar(60),
        file_name nvarchar(200),
        data varbinary(max) not null,
        primary key (id)
    );

    create table lead_attachment (
        created_at datetime2(6) not null,
        id bigint identity not null,
        lead_id bigint not null,
        size_bytes bigint not null,
        content_type nvarchar(60),
        file_name nvarchar(200),
        cas_password nvarchar(512),
        data varbinary(max) not null,
        primary key (id)
    );

    create table lead_enquiry (
        consent bit not null,
        follow_up_date date,
        has_attachment bit not null,
        assigned_rm_id bigint,
        created_at datetime2(6) not null,
        id bigint identity not null,
        interest nvarchar(20) check (interest in ('SIP','LUMPSUM','ELSS','RETIREMENT','CHILD_EDUCATION','NRI','PORTFOLIO_REVIEW','OTHER')),
        source nvarchar(20),
        status nvarchar(20) not null check (status in ('NEW','CONTACTED','CONVERTED','LOST')),
        city nvarchar(80),
        name nvarchar(150) not null,
        email nvarchar(200),
        mobile nvarchar(512),
        message nvarchar(2000),
        notes nvarchar(4000),
        primary key (id)
    );

    create table mandate (
        limit_amount numeric(19,4),
        id bigint identity not null,
        investor_id bigint not null,
        status nvarchar(20) not null check (status in ('ACTIVE','PENDING','REJECTED')),
        umrn nvarchar(30),
        bank_name nvarchar(100),
        primary key (id)
    );

    create table mf_order (
        all_units bit not null,
        amount numeric(19,4),
        installments int,
        risk_acknowledged bit not null,
        sip_day int,
        units numeric(19,4),
        created_at datetime2(6) not null,
        folio_id bigint,
        id bigint identity not null,
        investor_id bigint not null,
        placed_at datetime2(6),
        placed_by_user_id bigint,
        scheme_id bigint not null,
        target_scheme_id bigint,
        updated_at datetime2(6) not null,
        order_type nvarchar(10) not null check (order_type in ('LUMPSUM','SIP','REDEEM','SWITCH','STP','SWP')),
        payment_mode nvarchar(20) check (payment_mode in ('UPI','NETBANKING','MANDATE')),
        placed_by_role nvarchar(20) check (placed_by_role in ('INVESTOR','RM','ADMIN')),
        ref nvarchar(20),
        status nvarchar(20) not null check (status in ('PENDING_APPROVAL','PLACED','PAYMENT_RECEIVED','ALLOTTED','FAILED','CANCELLED')),
        exchange_ref nvarchar(30),
        placed_by_name nvarchar(150),
        primary key (id)
    );

    create table mf_order_history (
        changed_at datetime2(6) not null,
        id bigint identity not null,
        order_id bigint not null,
        status nvarchar(20) not null check (status in ('PENDING_APPROVAL','PLACED','PAYMENT_RECEIVED','ALLOTTED','FAILED','CANCELLED')),
        note nvarchar(500),
        primary key (id)
    );

    create table mf_transaction (
        amount numeric(19,4) not null,
        nav numeric(19,4) not null,
        txn_date date not null,
        units numeric(19,4) not null,
        created_at datetime2(6) not null,
        folio_id bigint not null,
        id bigint identity not null,
        investor_id bigint not null,
        order_id bigint,
        scheme_id bigint not null,
        source nvarchar(10),
        txn_type nvarchar(20) not null check (txn_type in ('PURCHASE','SIP','REDEMPTION','SWITCH_IN','SWITCH_OUT','STP_IN','STP_OUT','SWP')),
        primary key (id)
    );

    create table nav_history (
        nav numeric(19,4) not null,
        nav_date date not null,
        id bigint identity not null,
        scheme_id bigint not null,
        primary key (id)
    );

    create table nominee (
        share_pct numeric(5,2),
        id bigint identity not null,
        investor_id bigint not null,
        relation nvarchar(30),
        name nvarchar(150) not null,
        primary key (id)
    );

    create table nfo (
        close_date date,
        featured bit not null,
        hidden bit not null,
        min_amount numeric(19,2),
        one_pager_size int,
        open_date date not null,
        created_at datetime2(6) not null,
        id bigint identity not null,
        one_pager_updated_at datetime2(6),
        updated_at datetime2(6) not null,
        asset_class nvarchar(10) not null,
        close_date_source nvarchar(10),
        source nvarchar(10) not null,
        scheme_code nvarchar(20),
        riskometer nvarchar(20) check (riskometer in ('LOW','LOW_TO_MODERATE','MODERATE','MODERATELY_HIGH','HIGH','VERY_HIGH')),
        scheme_type nvarchar(30),
        one_pager_content_type nvarchar(40),
        sub_category nvarchar(60),
        amc_display nvarchar(150) not null,
        amc_name nvarchar(150) not null,
        amfi_category nvarchar(150),
        benchmark nvarchar(150),
        one_pager_file_name nvarchar(200),
        scheme_name nvarchar(250) not null,
        fund_managers nvarchar(300),
        min_amount_text nvarchar(300),
        sid_url nvarchar(300),
        scheme_key nvarchar(400),
        staff_edited_fields nvarchar(500),
        exit_load nvarchar(1000),
        objective nvarchar(2000),
        primary key (id)
    );

    -- NFO one-pager PDF (separate table so NFO lists never load the bytes); nfo_id = nfo.id
    create table nfo_one_pager (
        nfo_id bigint not null,
        data varbinary(max) not null,
        primary key (nfo_id)
    );

    create table notification (
        is_read bit not null,
        created_at datetime2(6) not null,
        id bigint identity not null,
        user_id bigint not null,
        notification_type nvarchar(20) not null check (notification_type in ('ORDER','SIP','NAV','SECURITY','GENERAL')),
        title nvarchar(200) not null,
        message nvarchar(1000),
        primary key (id)
    );

    create table otp_challenge (
        attempts int not null,
        dummy bit not null,
        used bit not null,
        created_at datetime2(6) not null,
        expires_at datetime2(6) not null,
        ref_id bigint,
        user_id bigint,
        masked_mobile nvarchar(20),
        purpose nvarchar(20) not null check (purpose in ('LOGIN','RESET','ACTIVATE','CHANGE_PASSWORD','LEAD','ORDER_APPROVAL')),
        id nvarchar(36) not null,
        otp_hash nvarchar(64),
        device_id nvarchar(100),
        ref_text nvarchar(100),
        masked_email nvarchar(120),
        primary key (id)
    );

    create table scheme (
        active bit not null,
        aum_cr numeric(19,4),
        expense_ratio numeric(9,4),
        launch_date date,
        min_lumpsum numeric(19,4),
        min_sip numeric(19,4),
        nav numeric(19,4),
        nav_date date,
        regular_plan bit not null,
        return_1y float(53),
        return_3y float(53),
        return_5y float(53),
        return_10y float(53),
        trail_commission_pct numeric(9,4),
        id bigint identity not null,
        category nvarchar(10) not null check (category in ('EQUITY','DEBT','HYBRID')),
        isin_growth nvarchar(12),
        code nvarchar(20) not null,
        risk nvarchar(20) not null check (risk in ('LOW','LOW_TO_MODERATE','MODERATE','MODERATELY_HIGH','HIGH','VERY_HIGH')),
        sub_category nvarchar(60),
        amc nvarchar(100) not null,
        benchmark nvarchar(150),
        fund_manager nvarchar(150),
        name nvarchar(250) not null,
        exit_load nvarchar(1000),
        factsheet_url nvarchar(300),
        sid_url nvarchar(300),
        objective nvarchar(2000),
        primary key (id)
    );

    create table sip_registration (
        amount numeric(19,4) not null,
        installments int,
        installments_done int not null,
        paused_until date,
        sip_day int not null,
        start_date date not null,
        step_up_pct int,
        created_at datetime2(6) not null,
        folio_id bigint,
        id bigint identity not null,
        investor_id bigint not null,
        order_id bigint,
        scheme_id bigint not null,
        target_scheme_id bigint,
        reg_type nvarchar(10) not null check (reg_type in ('SIP','STP','SWP')),
        status nvarchar(20) not null check (status in ('ACTIVE','PAUSED','CANCELLED')),
        primary key (id)
    );

    create table sync_run (
        failed int not null,
        processed int not null,
        finished_at datetime2(6),
        id bigint identity not null,
        started_at datetime2(6) not null,
        run_type nvarchar(10) not null,
        status nvarchar(10) not null,
        triggered_by nvarchar(150),
        summary nvarchar(500),
        errors nvarchar(max),
        primary key (id)
    );

    create table team_member (
        is_founder bit not null,
        sort_order int not null,
        years_experience int,
        id bigint identity not null,
        euin nvarchar(20),
        designation nvarchar(100),
        name nvarchar(100) not null,
        photo_url nvarchar(300),
        qualifications nvarchar(300),
        bio nvarchar(1500),
        primary key (id)
    );

    create table testimonial (
        active bit not null,
        consent bit not null,
        id bigint identity not null,
        city nvarchar(60),
        name nvarchar(100) not null,
        photo_url nvarchar(300),
        body_text nvarchar(1000) not null,
        primary key (id)
    );

    create table ticket (
        created_at datetime2(6) not null,
        id bigint identity not null,
        investor_id bigint not null,
        updated_at datetime2(6) not null,
        ref nvarchar(20),
        status nvarchar(20) not null check (status in ('OPEN','IN_PROGRESS','RESOLVED','CLOSED')),
        category nvarchar(30) not null check (category in ('ADDRESS_CHANGE','BANK_CHANGE','NOMINEE_CHANGE','MISSING_TRANSACTION','STATEMENT','OTHER')),
        subject nvarchar(200) not null,
        description nvarchar(max),
        primary key (id)
    );

    create table ticket_comment (
        created_at datetime2(6) not null,
        id bigint identity not null,
        ticket_id bigint not null,
        author_name nvarchar(150) not null,
        comment_text nvarchar(2000) not null,
        primary key (id)
    );

    create table user_device (
        first_seen_at datetime2(6) not null,
        id bigint identity not null,
        last_seen_at datetime2(6) not null,
        trusted_until datetime2(6),
        user_id bigint not null,
        device_id nvarchar(100) not null,
        primary key (id)
    );

    create table user_session (
        revoked bit not null,
        created_at datetime2(6) not null,
        expires_at datetime2(6) not null,
        id bigint identity not null,
        last_seen_at datetime2(6) not null,
        user_id bigint not null,
        role nvarchar(20) not null check (role in ('INVESTOR','RM','ADMIN')),
        revoked_reason nvarchar(50),
        ip nvarchar(64),
        token_hash nvarchar(64) not null,
        device_id nvarchar(100),
        primary key (id)
    );

    alter table activation_token 
       add constraint ux_activation_token_hash unique (token_hash);

    alter table amc 
       add constraint ux_amc_slug unique (slug);

    create index ix_app_user_email_hash 
       on app_user (email_hash);

    create index ix_app_user_mobile_hash 
       on app_user (mobile_hash);

    create index ix_app_user_investor 
       on app_user (investor_id);

    alter table article 
       add constraint ux_article_slug unique (slug);

    create index ix_audit_at 
       on audit_log (created_at);

    create index ix_audit_action 
       on audit_log (action);

    create index ix_bank_account_investor 
       on bank_account (investor_id);

    create index ix_brokerage_month 
       on brokerage (brokerage_month);

    create index ix_folio_investor 
       on folio (investor_id);

    create index ix_folio_no 
       on folio (folio_no);

    alter table folio 
       add constraint ux_folio_investor_scheme unique (investor_id, scheme_id);

    create index ix_goal_investor 
       on goal (investor_id);

    create index ix_investor_pan_hash 
       on investor (pan_hash);

    create index ix_investor_mobile_hash 
       on investor (mobile_hash);

    create index ix_investor_email_hash 
       on investor (email_hash);

    create index ix_investor_rm 
       on investor (rm_id);

    create index ix_investor_family_head 
       on investor (family_head_id);

    create index ix_kyc_application_pan_hash
       on kyc_application (pan_hash);

    create index ix_kyc_application_mobile_hash
       on kyc_application (mobile_hash);

    create index ix_kyc_application_rm
       on kyc_application (assigned_rm_id);

    create index ix_kyc_application_status
       on kyc_application (status);

    create index ix_kyc_application_ref
       on kyc_application (ref);

    create index ix_kyc_document_application
       on kyc_document (application_id);

    create index ix_lead_attachment_lead
       on lead_attachment (lead_id);

    create index ix_lead_rm 
       on lead_enquiry (assigned_rm_id);

    create index ix_mandate_investor 
       on mandate (investor_id);

    create index ix_mf_order_investor 
       on mf_order (investor_id);

    create index ix_mf_order_status 
       on mf_order (status);

    create index ix_order_history_order 
       on mf_order_history (order_id);

    create index ix_mf_txn_folio 
       on mf_transaction (folio_id);

    create index ix_mf_txn_investor 
       on mf_transaction (investor_id);

    create index ix_mf_txn_date 
       on mf_transaction (txn_date);

    alter table nav_history 
       add constraint ux_nav_scheme_date unique (scheme_id, nav_date);

    create index ix_nominee_investor 
       on nominee (investor_id);

    create index ix_nfo_scheme_key
       on nfo (scheme_key);

    create index ix_nfo_open_date
       on nfo (open_date);

    create index ix_notification_user 
       on notification (user_id);

    alter table scheme 
       add constraint ux_scheme_code unique (code);

    create index ix_sip_investor 
       on sip_registration (investor_id);

    create index ix_ticket_investor 
       on ticket (investor_id);

    create index ix_ticket_comment_ticket 
       on ticket_comment (ticket_id);

    alter table user_device 
       add constraint ux_user_device unique (user_id, device_id);

    create index ix_user_session_user 
       on user_session (user_id);

    alter table user_session 
       add constraint ux_user_session_token unique (token_hash);

    alter table goal_folio 
       add constraint FKp74gnsmfi9haikpeetgkms0js 
       foreign key (goal_id) 
       references goal;
