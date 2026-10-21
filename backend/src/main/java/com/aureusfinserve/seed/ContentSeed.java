package com.aureusfinserve.seed;

import com.aureusfinserve.common.AssetClass;
import com.aureusfinserve.common.Fmt;
import com.aureusfinserve.publicsite.*;
import com.aureusfinserve.publicsite.ContentDtos.*;
import com.aureusfinserve.publicsite.PublicRepos.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Website content seed: articles, FAQs, glossary, testimonials, team, banner, compliance pages,
 * home / about / site settings, 8 service pages and the AMC partner list.
 * All firm-specific facts (names, ARN, numbers, addresses) are PLACEHOLDERS to be replaced by the firm.
 */
@Component
@RequiredArgsConstructor
public class ContentSeed {

    private final ArticleRepository articleRepo;
    private final FaqRepository faqRepo;
    private final GlossaryTermRepository glossaryRepo;
    private final TestimonialRepository testimonialRepo;
    private final TeamMemberRepository teamRepo;
    private final BannerRepository bannerRepo;
    private final CmsPageRepository pageRepo;
    private final AmcRepository amcRepo;
    private final CmsContentService content;
    private final SiteService siteService;

    public void seed(List<SchemeSeed.AmcInfo> amcList) {
        articles();
        faqs();
        glossary();
        testimonials();
        team();
        banner();
        pages();
        home();
        about();
        site();
        services();
        amcs(amcList);
    }

    // ================================================================ articles

    private void article(String slug, String title, String category, String summary, int minutes, int daysAgo, String body) {
        Article a = new Article();
        a.setSlug(slug);
        a.setTitle(title);
        a.setCategory(category);
        a.setSummary(summary);
        a.setReadMinutes(minutes);
        a.setBody(body.strip());
        LocalDateTime when = Fmt.now().minusDays(daysAgo).withHour(9).withMinute(0).withSecond(0);
        a.setPublishAt(when);
        a.setCreatedAt(when);
        a.setUpdatedAt(when);
        articleRepo.save(a);
    }

    private void articles() {
        article("what-is-a-sip", "What is a SIP and how does it work?", "Basics",
                "A Systematic Investment Plan lets you invest a fixed amount in a mutual fund every month. Here is how it works and what to keep in mind.",
                5, 120, """
A Systematic Investment Plan (SIP) is a way of investing a fixed amount in a mutual fund scheme at regular intervals, usually every month. Instead of trying to find the "right time" to invest a large sum, you invest small amounts steadily from your regular income.

## How a SIP works

On the date you choose, the amount is debited from your bank account through a mandate and invested in the scheme at that day's Net Asset Value (NAV). You are allotted units based on the NAV. When the NAV is lower you receive more units, and when it is higher you receive fewer units. Over time this averages out your purchase cost, which is often called rupee cost averaging.

## Why investors use SIPs

A SIP builds a habit of saving before spending. Because each instalment is small, it is easier to start early and stay invested through market ups and downs. Starting early also gives your investment more time to compound.

## Things to keep in mind

Rupee cost averaging does not guarantee a profit or protect against a loss in falling markets. Equity-oriented schemes can be volatile in the short term, so a SIP is generally better suited to goals that are several years away. You can pause, step up or stop a SIP, and most open-ended schemes do not charge for missing an instalment, although your bank may levy a charge for a failed mandate debit.

## Getting started

You need to be KYC compliant, choose a scheme whose risk level matches your risk profile, decide the amount and date, and register a bank mandate. Read the Scheme Information Document before you invest, and talk to us if you would like help understanding the options available.
""");
        article("elss-tax-saving-explained", "ELSS funds: tax saving with a three-year lock-in", "Tax",
                "Equity Linked Savings Schemes qualify for deduction under Section 80C in the old tax regime. Understand the lock-in, the risks and how they compare with other options.",
                6, 95, """
An Equity Linked Savings Scheme (ELSS) is an equity mutual fund that invests mostly in shares and comes with a statutory lock-in of three years. Investments of up to Rs 1.5 lakh in a financial year can be claimed as a deduction under Section 80C if you file your return under the old tax regime.

## The three-year lock-in

Each investment is locked in for three years from its own allotment date. If you invest through a SIP, every monthly instalment has its own three-year lock-in, so the last instalment becomes free only three years after it was made.

## Old regime versus new regime

The Section 80C deduction is available only in the old tax regime. If you have opted for the new tax regime, an ELSS investment does not reduce your taxable income, although you may still choose it as an equity investment.

## Risk and taxation

ELSS funds carry the risks of equity investing and their value can fall as well as rise. On redemption, gains are taxed as long-term capital gains on equity under the prevailing rules. Tax laws change from time to time, so please consult your tax adviser for your specific situation.

## How ELSS compares

Compared with other 80C options, ELSS has the shortest lock-in, but its returns are market linked and not assured. Choosing between options depends on your goals, time horizon and comfort with volatility.
""");
        article("understanding-debt-funds", "Understanding debt mutual funds", "Basics",
                "Debt funds invest in bonds and money market instruments. Learn about interest-rate risk, credit risk and how different categories differ.",
                6, 70, """
Debt mutual funds invest in fixed-income instruments such as government securities, corporate bonds, treasury bills and certificates of deposit. They are often used for short-term goals, emergency reserves or to balance the equity part of a portfolio.

## Main categories

SEBI classifies debt funds mainly by the maturity or duration of their portfolio and by credit quality. Liquid and money market funds hold very short-term instruments. Short duration, corporate bond, banking and PSU, and gilt funds hold longer instruments and can move more when interest rates change.

## The two key risks

Interest-rate risk: when interest rates rise, bond prices fall, and the longer the duration of the portfolio, the larger the impact. Credit risk: the issuer of a bond may delay or default on payments. Funds that invest in lower-rated papers carry more credit risk.

## Taxation

For units purchased on or after 1 April 2023, gains from debt funds are taxed at your income-tax slab rate irrespective of how long you hold them. Units bought earlier may continue to receive different treatment. Please consult a tax adviser.

## Choosing a debt fund

Match the fund's duration to your time horizon and check its credit quality, expense ratio and the risk-o-meter in the scheme documents. Debt funds are not fixed deposits; their returns are not guaranteed and their NAV can fall.
""");
        article("reading-the-risk-o-meter", "How to read the SEBI risk-o-meter", "Basics",
                "Every mutual fund scheme shows a risk-o-meter with six levels from Low to Very High. Here is what it tells you and what it does not.",
                4, 45, """
SEBI requires every mutual fund scheme to display a risk-o-meter on its documents and advertisements. It shows the risk level of the scheme's portfolio on a six-point scale: Low, Low to Moderate, Moderate, Moderately High, High and Very High.

## How the level is decided

The level is calculated from the actual portfolio using parameters prescribed by SEBI, such as market capitalisation, volatility and liquidity for equity, and interest-rate and credit risk for debt. AMCs review it every month and must disclose changes.

## Using it with your risk profile

Before investing, compare the scheme's risk-o-meter with your own risk profile and time horizon. A Very High risk equity scheme can see sharp falls in the short term and is generally suited to long-term goals. A Low to Moderate liquid fund may suit money you need soon.

## What it does not tell you

The risk-o-meter is not a rating of how good a fund is and does not predict returns. It reflects the current portfolio, which can change. Always read the scheme documents and understand what you are investing in.
""");
        article("step-up-sip", "Step-up SIP: grow your investment with your income", "SIP",
                "A step-up (top-up) SIP increases your instalment by a fixed percentage every year. See why investors use it and how to set one up.",
                4, 25, """
A step-up SIP, also called a top-up SIP, automatically increases your SIP instalment every year by a percentage or amount you choose. For example, a Rs 10,000 monthly SIP with a 10% annual step-up becomes Rs 11,000 in the second year and Rs 12,100 in the third.

## Why consider a step-up

Most people's incomes rise over time, while their SIP amounts stay where they started. A step-up lets your savings keep pace with your income and can make a meaningful difference to the corpus you accumulate for long-term goals, without a large initial commitment.

## Choosing the step-up rate

A step-up rate in line with your expected annual salary increase is a practical starting point. Make sure the higher instalments will remain comfortable, and remember that the mandate limit registered with your bank must be high enough for future instalments.

## Use the calculator

Our Step-up SIP calculator shows how a step-up compares with a flat SIP under an assumed rate of return. The results are illustrative only; actual returns will vary and are not guaranteed.
""");
        article("swp-regular-income", "Systematic Withdrawal Plan: regular income from your investments", "Income",
                "An SWP lets you withdraw a fixed amount from a mutual fund at regular intervals. Learn how it works, how it is taxed and what to watch out for.",
                5, 10, """
A Systematic Withdrawal Plan (SWP) lets you redeem a fixed amount from a mutual fund scheme every month or quarter. It is commonly used by retirees and others who want a regular cash flow while keeping the rest of their money invested.

## How an SWP works

On the chosen date, units equal to the withdrawal amount at that day's NAV are redeemed and the money is credited to your bank account. The remaining units stay invested and continue to participate in the scheme's performance.

## Sustainability of withdrawals

If the withdrawal rate is higher than the return earned by the scheme, your capital will reduce over time and may eventually run out. Choosing a modest withdrawal rate and a scheme that suits your risk profile helps your corpus last longer. Our SWP calculator shows a month-by-month illustration.

## Taxation

Each SWP instalment is a redemption, so capital gains tax applies only to the gain portion of the units redeemed, based on the holding period and the type of scheme. This is different from interest income, which is fully taxable. Consult your tax adviser for details.

## Points to remember

Exit loads may apply to units redeemed within the exit-load period. Returns are market linked and not assured, so review your SWP periodically with us.
""");
    }

    // ================================================================ FAQs and glossary

    private void faq(int order, String category, String q, String a) {
        Faq f = new Faq();
        f.setSortOrder(order);
        f.setCategory(category);
        f.setQuestion(q);
        f.setAnswer(a);
        faqRepo.save(f);
    }

    private void faqs() {
        faq(1, "Getting started", "What do I need to start investing in mutual funds?",
                "You need a PAN, completed KYC, a bank account in your name and a mobile number and e-mail address. We can help you complete KYC online in a few minutes.");
        faq(2, "Getting started", "What is the minimum amount I can invest?",
                "Many schemes accept SIPs from Rs 500 per month and lump-sum investments from Rs 1,000 to Rs 5,000. The exact minimum for each scheme is shown on its page.");
        faq(3, "About us", "Are you an investment adviser?",
                "No. Aureus Finserve is an AMFI-registered mutual fund distributor. We help you understand schemes and execute transactions; we do not provide investment advice. We receive trail commission from AMCs, as disclosed on our Commission Disclosure page.");
        faq(4, "About us", "Do I pay any fee to Aureus Finserve?",
                "We do not charge you a separate fee for distribution services. We distribute regular plans of mutual fund schemes and receive commission from the AMCs, which is included in the scheme's expense ratio.");
        faq(5, "SIP", "Can I pause or stop my SIP?",
                "Yes. You can pause a SIP for up to six months, step it up or cancel it from your investor dashboard. A cancelled SIP does not affect the units you already hold.");
        faq(6, "SIP", "What happens if a SIP instalment fails?",
                "If your bank account does not have sufficient balance, the instalment is skipped. The AMC does not usually charge a penalty, but your bank may levy a mandate-bounce charge.");
        faq(7, "Redemption", "How long does it take to receive redemption money?",
                "Redemption proceeds are typically credited within one to three working days depending on the scheme type, as per SEBI timelines. Liquid funds usually pay out the next working day.");
        faq(8, "Tax", "How are mutual fund gains taxed?",
                "Taxation depends on the type of scheme and how long you hold your units. Our capital gains statement helps with reporting, but please consult a tax adviser for your specific situation.");
        faq(9, "Security", "How is my data protected?",
                "Sensitive information such as PAN, mobile number and bank account numbers is encrypted at rest, logins are protected with OTP, and we process personal data in line with the Digital Personal Data Protection Act, 2023.");
        // Grievance FAQ hidden for now - uncomment to show it again.
        // faq(10, "Grievance", "How do I raise a complaint?",
        //         "You can raise a service request from your dashboard or write to our grievance officer. We aim to respond within 21 days. If you are not satisfied, you may approach SEBI SCORES (https://scores.sebi.gov.in).");
    }

    private void term(String t, String d) {
        GlossaryTerm g = new GlossaryTerm();
        g.setTerm(t);
        g.setDefinition(d);
        glossaryRepo.save(g);
    }

    private void glossary() {
        term("NAV", "Net Asset Value: the per-unit market value of a scheme's assets after expenses, declared every business day.");
        term("AUM", "Assets Under Management: the total market value of the investments managed by a scheme or AMC.");
        term("SIP", "Systematic Investment Plan: investing a fixed amount in a scheme at regular intervals.");
        term("SWP", "Systematic Withdrawal Plan: redeeming a fixed amount from a scheme at regular intervals.");
        term("STP", "Systematic Transfer Plan: transferring a fixed amount at regular intervals from one scheme to another scheme of the same AMC.");
        term("Expense ratio", "The annual percentage of a scheme's assets charged to cover management, distribution and operating expenses.");
        term("Exit load", "A charge deducted from redemption proceeds if units are redeemed before a specified period.");
        term("ELSS", "Equity Linked Savings Scheme: an equity fund with a three-year lock-in that is eligible for Section 80C deduction in the old tax regime.");
        term("KYC", "Know Your Customer: the one-time identity and address verification required before investing.");
        term("Folio", "An account number allotted by an AMC to an investor; a folio can hold units of several schemes of the same AMC.");
        term("XIRR", "Extended Internal Rate of Return: an annualised return that accounts for the timing of each investment and withdrawal.");
        term("Regular plan", "The plan of a scheme bought through a distributor; its expense ratio includes the distributor's commission.");
        term("Riskometer", "SEBI's six-level scale (Low to Very High) showing the risk of a scheme's portfolio.");
        term("CAS", "Consolidated Account Statement: a single statement of all your mutual fund holdings across AMCs, issued by CAMS / KFintech / depositories.");
        term("Benchmark", "An index against which a scheme's performance is compared, such as the NIFTY 50 TRI.");
    }

    // ================================================================ testimonials, team, banner

    private void testimonials() {
        String[][] t = {
                {"Adarsh", "Trivandrum", "The team explained every scheme document patiently and never rushed me. Having one dashboard for my whole family's investments has made reviews simple."},
                {"Sikha", "Mumbai", "I started my first SIP with Aureus. Their reminders and quick responses to my questions gave me the confidence to stay disciplined."},
                {"Mohan & Mini", "Thrissur", "After retirement we wanted a simple way to receive a monthly payout. Our relationship manager walked us through how an SWP works and the risks involved."},
        };
        for (String[] x : t) {
            Testimonial tm = new Testimonial();
            tm.setName(x[0]);
            tm.setCity(x[1]);
            tm.setText(x[2]);
            tm.setConsent(true);
            tm.setActive(true);
            testimonialRepo.save(tm);
        }
    }

    private void member(int order, String name, String designation, String euin, boolean founder, int years,
                        String qualifications, String bio) {
        TeamMember m = new TeamMember();
        m.setSortOrder(order);
        m.setName(name);
        m.setDesignation(designation);
        m.setEuin(euin);
        m.setFounder(founder);
        m.setYearsExperience(years);
        m.setQualifications(qualifications);
        m.setBio(bio);
        teamRepo.save(m);
    }

    /** The firm's team. Years are shown on the site as "10+ years"; add the founder's EUIN in Content > Team. */
    private void team() {
        member(1, "Rahul Rajesh", "Founder", "E714199", true, 10, "NISM Series V-A certified; Graduate",
                "Rahul founded Aureus Finserve to help families invest in mutual funds with clear explanations and dependable service. He is NISM Series V-A certified and has more than 10 years of experience.");
    }

    private void banner() {
        Banner b = new Banner();
        b.setTitle("Start your SIP journey");
        b.setText("Book a free consultation with our relationship managers to understand SIPs and the schemes available. Mutual fund investments are subject to market risks.");
        b.setCtaLabel("Book a consultation");
        b.setCtaUrl("/contact");
        b.setActive(true);
        b.setStartsAt(Fmt.now().minusDays(30));
        bannerRepo.save(b);
    }

    // ================================================================ CMS pages

    private void page(String key, String title, String body) {
        CmsPage p = new CmsPage();
        p.setKey(key);
        p.setTitle(title);
        p.setBody(body.strip());
        p.setUpdatedAt(Fmt.now().minusDays(15));
        pageRepo.save(p);
    }

    private void pages() {
        page("about", "About Aureus Finserve", """
Aureus Finserve is an AMFI-registered Mutual Fund Distributor (ARN-372611) helping individuals and families invest in mutual funds with clarity and discipline.

We are a distributor and not an investment adviser. We help you understand schemes, their risks and costs, complete KYC and execute transactions, and we support you with statements, service requests and periodic reviews.

## Our approach

We distribute regular plans of mutual fund schemes of the AMCs we are empanelled with, and receive trail commission from them. We explain the risk-o-meter, costs and scheme documents before every investment so that you can make an informed decision.
""");
        page("disclaimer", "Disclaimer", """
Mutual fund investments are subject to market risks, read all scheme related documents carefully. Past performance may or may not be sustained in future and is not a guarantee of future returns.

Aureus Finserve is an AMFI-registered Mutual Fund Distributor (ARN-372611, valid till 31-03-2028). We are a distributor and not an investment adviser registered with SEBI. Information on this website is for general education and is not investment, tax or legal advice. Please consult your own advisers before making decisions.

Scheme names, NAVs and returns are based on NAVs published by AMFI and are updated from AMFI's daily NAV file. Returns are point-to-point on NAV for Regular Plan - Growth (1 year absolute; 3, 5 and 10 years annualised) and do not account for taxes or exit loads. Past performance may or may not be sustained in future. Risk-o-meter levels, expense ratios (Regular plan TER), fund size, fund managers, benchmarks, exit loads and minimum amounts are taken from AMC disclosures published on AMFI (daily risk-o-meter and TER disclosures, Scheme Summary Documents; compiled by TigZig) and may change; the scheme information document and factsheet on the AMC's website are the authoritative source. Calculators are illustrative only, assume a constant rate of return, and actual returns may vary.
""");
        page("privacy", "Privacy Policy", """
This policy explains how Aureus Finserve collects, uses and protects your personal data in accordance with the Digital Personal Data Protection Act, 2023 (DPDP Act) and applicable SEBI and AMFI requirements.

## Data we collect

Name, PAN, date of birth, contact details, address, bank account details, nominee details, KYC status and transaction history, and technical data such as device identifiers and IP address for security.

## Why we use it

To complete KYC, process transactions with AMCs, registrars and exchanges, provide statements and service, meet regulatory obligations and keep your account secure. We process your data only for these purposes and on the basis of your consent or legal obligation.

## How we protect it

Sensitive fields such as PAN, mobile number, date of birth and bank account numbers are encrypted at rest. Access is restricted to authorised staff on a need-to-know basis and every access to client records is logged.

""");
        page("terms", "Terms of Use", """
By using this website and the investor services of Aureus Finserve you agree to these terms.

Transactions are executed on the basis of instructions from you, authenticated by your login and one-time passwords. You are responsible for keeping your password and OTPs confidential. Orders are subject to the terms of the respective scheme documents, cut-off times and acceptance by the AMC and exchange.

Aureus Finserve acts only as a mutual fund distributor. We do not provide investment advice and do not guarantee any returns. Information on this website may change without notice.
""");
        page("commission", "Commission Disclosure", """
Aureus Finserve distributes regular plans of mutual fund schemes and receives trail commission from AMCs for the distribution services we provide. Commission is paid by the AMC out of the scheme's expenses and is included in the scheme's total expense ratio; we do not charge you any separate fee.

The trail commission rate varies by scheme and AMC, typically between 0.10% and 1.00% per year of the value of your investment. Scheme-wise commission rates are available on each scheme page and on request.

Direct plans of the same schemes, which do not carry distribution commission and therefore have a lower expense ratio, are available directly from AMCs. We do not distribute direct plans.
""");
        page("grievance", "Grievance Redressal", """
We take every complaint seriously and aim to resolve it as quickly as possible, and in any case respond within 21 days of receipt.

## Level 1: Client service desk

Raise a service request from your investor dashboard or write to care@aureusfinserve.in. Response within 7 working days.

## Level 2: Grievance nodal officer

If you are not satisfied, write to our nodal officer at grievance@aureusfinserve.in. Response within 14 days.

## Level 3: Principal officer

Escalate to principal@aureusfinserve.in. Final response within 21 days of the original complaint.

## Regulatory platforms

If your complaint is not resolved to your satisfaction, you may lodge it on SEBI SCORES at https://scores.sebi.gov.in.
""");
    }

    // ================================================================ home / about / site

    private void home() {
        Map<String, Boolean> sections = new LinkedHashMap<>();
        for (String k : List.of("trust", "services", "why", "how", "calculator", "amcs", "testimonials", "articles")) {
            sections.put(k, true);
        }
        content.put(SiteService.HOME, new HomeContent(
                new Hero("Grow your wealth with the right mutual funds",
                        "An AMFI-registered mutual fund distributor helping families invest with clarity, discipline and personal service.",
                        "Book a free consultation", "Calculate your SIP"),
                List.of(new TitleText("AMFI-registered", "We are an AMFI-registered mutual fund distributor (ARN-372611) and follow the AMFI code of conduct."),
                        new TitleText("Dedicated relationship manager", "A named relationship manager who knows your family's goals and is a call or message away."),
                        new TitleText("One dashboard for all your funds", "Track holdings, SIPs, goals and capital gains for your whole family in one secure place."),
                        new TitleText("Paperless investing", "Complete KYC, start SIPs and place orders online with OTP authentication - no forms, no couriers.")),
                List.of(new Step(1, "Talk to us", "Book a free consultation. We understand your goals and explain the scheme options and their risks."),
                        new Step(2, "Complete KYC", "Complete your KYC online in a few minutes with your PAN, Aadhaar and a selfie."),
                        new Step(3, "Start investing and track online", "Start SIPs or lump-sum investments and track everything on your dashboard.")),
                sections));
    }

    private void about() {
        content.put(SiteService.ABOUT, new AboutContent(
                "Aureus Finserve began with a simple belief: every family deserves patient, honest help with its investments. Our founder spent years watching investors buy and sell at the wrong time, often because nobody explained what they owned. We set out to build a practice where clients understand every scheme they invest in, see all their family's investments in one place and can reach a real person when they need one.\n\nToday we serve individuals and families across India, from first-time SIP investors to retirees drawing a monthly income, with the same focus on clarity and service.",
                "To help families build long-term wealth through mutual funds by explaining options clearly, executing transactions efficiently and supporting them at every stage of life.",
                "To be the most trusted mutual fund distributor for Indian families - known for transparency, discipline and service rather than product pushing.",
                List.of(new TitleText("Client first", "Every recommendation of a scheme category starts with your goals, time horizon and risk profile, not with our commission."),
                        new TitleText("Transparency", "We disclose our commission, explain costs and risks plainly and never promise returns."),
                        new TitleText("Long-term investing", "We encourage disciplined, goal-based investing and help you stay the course through market cycles.")),
                List.of(new ContentDtos.Milestone("2014", "Aureus Finserve founded and registered with AMFI (placeholder year)."),
                        new ContentDtos.Milestone("2017", "Crossed 250 client families (placeholder)."),
                        new ContentDtos.Milestone("2020", "Launched fully paperless onboarding and online SIP registration (placeholder)."),
                        new ContentDtos.Milestone("2023", "Introduced the family portfolio dashboard and goal tracking (placeholder)."),
                        new ContentDtos.Milestone("2026", "Serving 850+ clients across India (placeholder).")),
                null, null, null));
    }

    /** Contact details and stats come from app.firm in application.yml; admins can change them later in Site settings. */
    private void site() {
        SiteSettings fromConfig = siteService.defaultSettings();
        Stats st = fromConfig.stats();
        content.put(SiteService.SITE, new SiteSettings(
                new Stats(st.aumCr(), st.clients(), 620, st.years(), st.sipBookCr(), 1400),
                new Socials(null, null, "https://www.linkedin.com/company/aureus-finserve-placeholder",
                        "https://www.youtube.com/@aureusfinserve-placeholder", null),
                fromConfig.phone(), fromConfig.whatsapp(), fromConfig.email(), fromConfig.address(),
                fromConfig.officeHours(), fromConfig.mapEmbedUrl()));
    }

    // ================================================================ services

    private void service(int order, String slug, String title, String icon, String shortText, String whatItIs, String whoItSuits,
                         List<String> how, AssetClass cat, List<String> subs, List<String> calcs, List<QA> faqs) {
        content.put(SiteService.SERVICE_PREFIX + slug, new ServiceDetail(slug, title, shortText, whatItIs, whoItSuits, how, cat,
                subs, calcs, faqs, icon, order));
    }

    private void services() {
        service(1, "sip", "SIP (Systematic Investment Plan)", "repeat",
                "Invest a fixed amount every month and build wealth with discipline.",
                "A SIP lets you invest a fixed amount in a mutual fund scheme on a chosen date every month. Each instalment buys units at that day's NAV, so you buy more units when prices are low and fewer when they are high. Over long periods this rupee cost averaging, together with compounding, can help you build a corpus for your goals.",
                "Salaried professionals and anyone with a regular income who wants to invest steadily for goals that are five or more years away, without trying to time the market.",
                List.of("Tell us your goal and time horizon in a free consultation", "Choose a scheme whose risk-o-meter matches your risk profile",
                        "Register a one-time bank mandate (NACH / UPI AutoPay)", "Your SIP is debited automatically every month; track it on your dashboard",
                        "Step up, pause or stop your SIP online whenever you need"),
                AssetClass.EQUITY, List.of("Large Cap", "Flexi Cap", "Mid Cap", "Index"), List.of("sip", "step-up-sip"),
                List.of(new QA("What is the minimum SIP amount?", "Many schemes accept SIPs from Rs 500 per month; the minimum for each scheme is shown on its page."),
                        new QA("Can I change my SIP amount later?", "You can add a new SIP, set an annual step-up or cancel and restart a SIP with a different amount."),
                        new QA("Is a SIP return guaranteed?", "No. SIP returns depend on the scheme's performance and market movements; they are not guaranteed.")));
        service(2, "lump-sum", "Lump Sum Investment", "wallet",
                "Invest a bonus, inheritance or maturity proceeds in one go.",
                "A lump-sum investment puts a one-time amount into a mutual fund scheme at the day's NAV. It is often used for bonuses, maturity proceeds or savings already accumulated. For equity schemes, some investors choose to deploy a large sum gradually through a Systematic Transfer Plan from a liquid fund to reduce timing risk.",
                "Investors with a sizeable amount available today who have a clear time horizon and understand that equity values can fall in the short term.",
                List.of("Discuss the amount, goal and time horizon with your relationship manager", "Choose a scheme or a liquid fund with an STP into equity",
                        "Pay online by UPI or net banking", "Units are allotted at the applicable NAV and appear on your dashboard"),
                null, List.of("Liquid", "Balanced Advantage", "Large Cap", "Corporate Bond"), List.of("lump-sum"),
                List.of(new QA("Is lump sum better than SIP?", "Neither is better in every situation; it depends on whether you have the money now, your time horizon and your comfort with short-term volatility."),
                        new QA("What is an STP?", "A Systematic Transfer Plan moves a fixed amount at regular intervals from one scheme to another scheme of the same AMC.")));
        service(3, "tax-saving-elss", "Tax Saving (ELSS)", "receipt",
                "Equity Linked Savings Schemes with a 3-year lock-in and Section 80C benefit (old regime).",
                "ELSS funds are equity mutual funds with a statutory lock-in of three years. Investments of up to Rs 1.5 lakh a year qualify for deduction under Section 80C if you file under the old tax regime. Because they invest in equities, their value can rise or fall with the market.",
                "Taxpayers who file under the old tax regime, have not exhausted their Section 80C limit and are comfortable with equity risk and a three-year lock-in.",
                List.of("Check how much of your Section 80C limit is still available", "Invest through a monthly SIP or a lump sum before the financial year ends",
                        "Download the investment statement for tax proof from your dashboard", "Each instalment is locked in for three years from its own date"),
                AssetClass.EQUITY, List.of("ELSS"), List.of("elss"),
                List.of(new QA("Can I claim ELSS under the new tax regime?", "No. The Section 80C deduction is available only under the old tax regime."),
                        new QA("When can I redeem ELSS units?", "Each purchase can be redeemed three years after its own allotment date.")));
        service(4, "retirement", "Retirement Planning", "sunrise",
                "Estimate the corpus you may need and build it steadily.",
                "Retirement planning starts with estimating how much you may need to maintain your lifestyle after you stop working, adjusting for inflation and life expectancy. A disciplined SIP in a mix of equity and debt schemes, reviewed periodically and shifted gradually towards lower risk as retirement approaches, is a common approach.",
                "Working professionals and self-employed individuals at any age - starting early gives your investments more time to grow.",
                List.of("Use the retirement calculator to estimate a target corpus", "Discuss an asset mix suited to your age and risk profile",
                        "Start SIPs and link them to a Retirement goal on your dashboard", "Review progress every year and step up SIPs as income grows"),
                AssetClass.HYBRID, List.of("Flexi Cap", "Balanced Advantage", "Multi Asset Allocation", "Large Cap"), List.of("retirement"),
                List.of(new QA("How much corpus do I need?", "It depends on your expenses, inflation, expected returns and life expectancy. Our calculator gives an illustrative estimate."),
                        new QA("Should I stop equity investments near retirement?", "Many investors gradually reduce equity exposure as retirement approaches; the right mix depends on your situation.")));
        service(5, "child-education", "Child Education Planning", "graduation-cap",
                "Plan for the rising cost of your child's education.",
                "Education costs in India have been rising faster than general inflation. Planning early lets you invest smaller amounts over a longer period. You estimate the future cost of the course, then invest regularly towards it, moving to lower-risk schemes as the goal date approaches.",
                "Parents and grandparents who want to build a fund for a child's higher education, typically 5 to 18 years away.",
                List.of("Estimate today's cost of the course and the years remaining", "Use the goal calculator to see the future cost and the SIP needed",
                        "Start a SIP and link the folios to an Education goal", "Shift gradually to debt-oriented schemes in the last two to three years"),
                AssetClass.EQUITY, List.of("Flexi Cap", "Large & Mid Cap", "Aggressive Hybrid"), List.of("goal"),
                List.of(new QA("Can I invest in my child's name?", "Yes, investments can be made in a minor's name with a parent or guardian, subject to KYC of the guardian."),
                        new QA("What if the goal date is close?", "For goals less than three years away, lower-volatility schemes are usually considered.")));
        service(6, "regular-income-swp", "Regular Income (SWP)", "calendar",
                "Withdraw a fixed amount every month while staying invested.",
                "A Systematic Withdrawal Plan redeems a fixed amount from your mutual fund investment every month or quarter and credits it to your bank account. The remaining units stay invested. Each withdrawal is a redemption, so only the gain portion is subject to capital gains tax.",
                "Retirees and others who want a regular cash flow from an existing corpus and understand that the corpus can reduce if withdrawals exceed returns.",
                List.of("Decide the monthly amount you need and the corpus available", "Use the SWP calculator to see an illustrative month-by-month balance",
                        "Invest the corpus in suitable schemes and register the SWP", "Review the withdrawal rate with your relationship manager every year"),
                AssetClass.HYBRID, List.of("Balanced Advantage", "Conservative Hybrid", "Equity Savings", "Short Duration"), List.of("swp"),
                List.of(new QA("Is SWP income fixed?", "The withdrawal amount is fixed, but the value of your remaining investment varies with markets and is not guaranteed."),
                        new QA("How is SWP taxed?", "Each instalment is a redemption; tax applies to the gain on the units redeemed, depending on the scheme type and holding period.")));
        service(7, "nri", "NRI Investments", "globe",
                "Invest in Indian mutual funds from abroad through NRE / NRO accounts.",
                "Non-resident Indians can invest in most Indian mutual fund schemes through NRE or NRO bank accounts after completing KYC with their overseas address. Some AMCs have restrictions for investors resident in the USA and Canada. Repatriation and taxation depend on the account used and applicable laws.",
                "Non-resident Indians who want to invest in India for long-term goals or for family needs in India.",
                List.of("Complete KYC with passport, overseas address proof and PAN", "Choose AMCs and schemes that accept investments from your country of residence",
                        "Invest by SIP or lump sum from your NRE / NRO account", "Track your holdings online from anywhere"),
                null, List.of("Flexi Cap", "Large Cap", "Index"), List.of("sip", "lump-sum"),
                List.of(new QA("Can NRIs in the USA invest?", "Only some AMCs accept investments from residents of the USA and Canada, usually with additional declarations."),
                        new QA("Is tax deducted on redemption?", "Yes, tax is deducted at source on capital gains for NRIs as per applicable rates; consult a tax adviser.")));
        service(8, "portfolio-review", "Free Portfolio Review", "search",
                "Upload your CAS and get a clear picture of your existing mutual funds.",
                "Many investors hold schemes across several AMCs and folios without a clear view of the overall picture. Share your Consolidated Account Statement (CAS) and our team will walk you through your existing holdings - asset mix, overlap, costs and how the schemes' risk levels compare with your profile. We explain; the decisions remain yours.",
                "Anyone with existing mutual fund investments who wants a consolidated, easy-to-understand view of their portfolio.",
                List.of("Download your CAS from CAMS, KFintech or NSDL / CDSL", "Upload the PDF on this page and verify your mobile with an OTP",
                        "Your relationship manager reviews it and calls you within two working days", "We walk you through the observations - no obligation"),
                null, List.of(), List.of(),
                List.of(new QA("Is my CAS safe with you?", "The file is uploaded over a secure connection, stored in our database with access restricted to authorised staff, and every download is logged."),
                        new QA("Do I have to switch my investments?", "No. The review is free and without obligation.")));
    }

    // ================================================================ AMCs

    /** Top-10 AMCs by average AUM; logos from seed/amc-logos/<slug>.png when present (otherwise a text tile). */
    private void amcs(List<SchemeSeed.AmcInfo> list) {
        int i = 0;
        for (SchemeSeed.AmcInfo info : list) {
            Amc a = new Amc();
            a.setName(info.name());
            a.setSlug(info.slug());
            a.setWebsite(info.website());
            a.setActive(true);
            a.setSortOrder(++i * 10);
            org.springframework.core.io.ClassPathResource logo = new org.springframework.core.io.ClassPathResource("seed/amc-logos/" + info.slug() + ".png");
            if (logo.exists()) {
                try (java.io.InputStream in = logo.getInputStream()) {
                    a.setLogo(in.readAllBytes());
                    a.setLogoContentType("image/png");
                } catch (java.io.IOException e) {
                    throw new java.io.UncheckedIOException(e);
                }
            }
            amcRepo.save(a);
        }
    }
}
