package com.aureusfinserve.seed;

import com.aureusfinserve.auth.AppUser;
import com.aureusfinserve.auth.AppUserRepository;
import com.aureusfinserve.common.*;
import com.aureusfinserve.kyc.KycApplication;
import com.aureusfinserve.kyc.KycDocument;
import com.aureusfinserve.kyc.KycRepos.KycApplicationRepository;
import com.aureusfinserve.kyc.KycRepos.KycDocumentRepository;
import com.aureusfinserve.security.CryptoService;
import com.lowagie.text.Document;
import com.lowagie.text.Paragraph;
import com.lowagie.text.pdf.PdfWriter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/** Three SAMPLE online KYC applications with tiny generated placeholder documents (clearly marked as samples). */
@Component
@RequiredArgsConstructor
public class KycSeed {

    private final KycApplicationRepository appRepo;
    private final KycDocumentRepository docRepo;
    private final AppUserRepository userRepo;
    private final CryptoService crypto;

    public void seed() {
        List<AppUser> rms = userRepo.findByRoleOrderByNameAsc(Role.RM);
        Long ananya = rms.stream().filter(u -> u.getName().startsWith("Ananya")).map(AppUser::getId).findFirst().orElse(null);
        Long vikram = rms.stream().filter(u -> u.getName().startsWith("Vikram")).map(AppUser::getId).findFirst().orElse(null);
        LocalDateTime now = Fmt.now();

        KycApplication a = base(Residency.RESIDENT, "Sneha Pillai", "Mohan Pillai", Gender.FEMALE, "1994-08-12",
                "ABDPP4821K", "9811100021", "sneha.pillai@example.com", "SINGLE", "PRIVATE_SECTOR", "10L_25L",
                KycApplicationStatus.SUBMITTED, null, now.minusHours(5));
        a.setAddressLine("Flat 4B, Lotus Residency, Kowdiar Road");
        a.setCity("Thiruvananthapuram");
        a.setState("Kerala");
        a.setPincode("695003");
        a.setPreferredVipvSlot("Weekday evenings after 6 PM");
        save(a, KycDocType.PAN_CARD, KycDocType.ADDRESS_PROOF, KycDocType.PHOTO, KycDocType.SIGNATURE);

        KycApplication b = base(Residency.NRI, "Faisal Rahman", "Abdul Rahman", Gender.MALE, "1987-03-25",
                "ABHPR7310M", "9811100022", "faisal.rahman@example.com", "MARRIED", "PROFESSIONAL", "25L_1CR",
                KycApplicationStatus.UNDER_REVIEW, vikram, now.minusDays(2));
        b.setCountryOfResidence("United Arab Emirates");
        b.setOverseasAddress("Apartment 1203, Marina Heights, Dubai Marina, Dubai");
        b.setTaxResidencyCountry("United Arab Emirates");
        b.setForeignTin("784198712345671");
        b.setNationality("Indian");
        b.setAddressLine("TC 12/345, Pattom Palace Road");
        b.setCity("Thiruvananthapuram");
        b.setState("Kerala");
        b.setPincode("695004");
        b.setPreferredVipvSlot("Saturday 10 AM - 1 PM IST");
        b.setStaffNotes("SAMPLE: passport and Emirates ID address proof look fine. Call to schedule VIPV.");
        save(b, KycDocType.PAN_CARD, KycDocType.PASSPORT, KycDocType.OVERSEAS_ADDRESS_PROOF, KycDocType.PHOTO,
                KycDocType.SIGNATURE, KycDocType.VISA_OR_OCI);

        KycApplication c = base(Residency.RESIDENT, "Lakshmi Narayanan", "R Narayanan", Gender.FEMALE, "1979-11-02",
                "ABKPN2264Q", "9811100023", "lakshmi.n@example.com", "MARRIED", "BUSINESS", "5L_10L",
                KycApplicationStatus.KYC_REGISTERED, ananya, now.minusDays(9));
        c.setAddressLine("12, 3rd Cross, Jayanagar 4th Block");
        c.setCity("Bengaluru");
        c.setState("Karnataka");
        c.setPincode("560011");
        c.setUpdatedAt(now.minusDays(2));
        c.setStaffNotes("SAMPLE: VIPV done, uploaded to KRA; KRA status Registered.");
        save(c, KycDocType.PAN_CARD, KycDocType.ADDRESS_PROOF, KycDocType.PHOTO, KycDocType.SIGNATURE,
                KycDocType.CANCELLED_CHEQUE);
    }

    private KycApplication base(Residency r, String name, String parent, Gender g, String dob, String pan, String mobile,
                                String email, String marital, String occ, String income, KycApplicationStatus st,
                                Long rmId, LocalDateTime at) {
        KycApplication a = new KycApplication();
        a.setResidency(r);
        a.setFullName(name);
        a.setFatherOrSpouseName(parent);
        a.setGender(g);
        a.setDob(dob);
        a.setPan(pan);
        a.setPanHash(crypto.panHash(pan));
        a.setMobile(mobile);
        a.setMobileHash(crypto.mobileHash(mobile));
        a.setEmail(email);
        a.setMaritalStatus(marital);
        a.setOccupation(occ);
        a.setAnnualIncome(income);
        a.setPoliticallyExposed(false);
        a.setConsent(true);
        a.setConsentAt(at);
        a.setStatus(st);
        a.setAssignedRmId(rmId);
        a.setCreatedAt(at);
        a.setUpdatedAt(at.plusHours(st == KycApplicationStatus.SUBMITTED ? 0 : 20));
        return a;
    }

    private void save(KycApplication a, KycDocType... types) {
        appRepo.save(a);
        a.setRef("KYC" + a.getCreatedAt().format(DateTimeFormatter.ofPattern("yyMMdd")) + String.format("%04d", a.getId() % 10000));
        appRepo.save(a);
        for (KycDocType t : types) {
            boolean pdf = t == KycDocType.ADDRESS_PROOF || t == KycDocType.OVERSEAS_ADDRESS_PROOF
                    || t == KycDocType.PASSPORT || t == KycDocType.CANCELLED_CHEQUE;
            byte[] bytes = pdf ? samplePdf(t, a) : samplePng(t);
            KycDocument d = new KycDocument();
            d.setApplicationId(a.getId());
            d.setDocType(t);
            d.setFileName("sample-" + t.name().toLowerCase().replace('_', '-') + (pdf ? ".pdf" : ".png"));
            d.setContentType(pdf ? "application/pdf" : "image/png");
            d.setSizeBytes(bytes.length);
            d.setData(crypto.encryptBytes(bytes));
            d.setUploadedAt(a.getCreatedAt());
            docRepo.save(d);
        }
    }

    private static byte[] samplePdf(KycDocType t, KycApplication a) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document doc = new Document();
        PdfWriter.getInstance(doc, out);
        doc.open();
        doc.add(new Paragraph("SAMPLE " + t.label() + " (demo data - not a real document)"));
        doc.add(new Paragraph("Placeholder created by the seed for KYC application " + a.getRef() + "."));
        doc.close();
        return out.toByteArray();
    }

    private static byte[] samplePng(KycDocType t) {
        BufferedImage img = new BufferedImage(240, 150, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        try {
            g.setColor(new Color(0xF3EFE7));
            g.fillRect(0, 0, 240, 150);
            g.setColor(new Color(0x0B2137));
            g.drawRect(4, 4, 231, 141);
            g.setColor(new Color(0x8A6A2F));
            g.fillRect(16, 20, 60, 72);
            g.setColor(new Color(0x0B2137));
            g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 16));
            g.drawString("SAMPLE", 92, 48);
            g.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 12));
            g.drawString(t.label(), 92, 70);
            g.drawString("demo placeholder", 92, 90);
        } finally {
            g.dispose();
        }
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(img, "png", out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
