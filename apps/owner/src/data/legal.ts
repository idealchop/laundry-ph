/**
 * Laundry.ph vendor Terms of Service and Privacy Policy — DRAFT FOR LEGAL REVIEW.
 * Modelled on River Mobile's Terms & Privacy (river-mobile-ui repo, src/data/legalDocs.ts).
 * Entity and contact details are copied from there unchanged.
 */

export type LegalBlock = string | { list: string[] };
export type LegalSection = { id: string; title: string; blocks: LegalBlock[] };
export type LegalDoc = { slug: "terms" | "privacy"; title: string; effective: string; intro: string[]; sections: LegalSection[] };

export const LEGAL_ENTITY = {
  company: "River Technology Inc.",
  brand: "River Apps",
  app: "Laundry.ph",
  marketplace: "River Mobile",
  address: "BF Homes, 410 El Grande Ave, Parañaque, 1720 Metro Manila",
  legalEmail: "legal@smartrefill.io",
  privacyEmail: "privacy@smartrefill.io",
  dpo: "Jimboy Regalado",
} as const;

export const LEGAL_DRAFT_NOTICE = "Draft for legal review — not yet final.";
export const LEGAL_EFFECTIVE = "Effective: October 14, 2026";

const E = LEGAL_ENTITY;

export const TERMS: LegalDoc = {
  slug: "terms",
  title: "Terms of Service",
  effective: LEGAL_EFFECTIVE,
  intro: [
    `Welcome to ${E.app}, an app of ${E.brand} operated by ${E.company} (“River,” “we,” “our,” or “us”).`,
    `These Terms of Service (“Terms”) govern your use of ${E.app} as a laundry shop owner or staff member (“Vendor,” “you”), including the owner app, your shop listing, the shop QR, customer tickets and related services (the “Services”). By creating an account, listing a shop or using the Services for your business, you agree to these Terms on behalf of yourself and your shop. If you do not agree, please do not use the Services.`,
  ],
  sections: [
    {
      id: "about",
      title: `1. What ${E.app} is`,
      blocks: [
        `${E.app} helps neighbourhood laundry shops run their business from a phone: walk-in orders, an order board, customer tickets, sales records and bookings. Shops listed on ${E.app} can also be found and booked by customers on ${E.marketplace}, the ${E.brand} marketplace app.`,
        "You run your own independent business. River provides the software and passes bookings to you; River is not a party to the laundry service you provide to your customers.",
      ],
    },
    {
      id: "accounts",
      title: "2. Accounts and eligibility",
      blocks: [
        { list: [
          "You must be at least 18 years old and authorised to act for the shop you list.",
          "You sign in with your Philippine mobile number (one-time SMS code) or your Google account. Keep access to your phone and Google account secure; activity on your account and your shop is your responsibility.",
          "Give accurate details about yourself and your shop, and keep them current.",
          "Guests can browse sample data without an account; an account is needed to create a shop, record orders, accept bookings or save settings.",
        ] },
      ],
    },
    {
      id: "listing",
      title: "3. Your shop listing and prices",
      blocks: [
        { list: [
          "You are responsible for your shop listing: shop name, address and map pin, opening hours, photos, description, services, clothes types, add-ons and prices.",
          "Information must be accurate, lawful and yours to use. Do not use photos or names you do not have rights to.",
          "Prices you set are shown to customers in the app, on your shop QR page and on customer tickets. You must honour the prices shown at the time a customer books or drops off, including VAT where applicable, unless you agree a change with the customer before starting the service.",
          `You give River a non-exclusive, royalty-free licence to display your listing, logo and photos in ${E.app}, on ${E.marketplace} and in related promotion of ${E.brand}.`,
        ] },
      ],
    },
    {
      id: "bookings",
      title: "4. Orders and bookings",
      blocks: [
        { list: [
          `Bookings can reach you from ${E.marketplace} customers, from your shop QR, or from River partners through the Partner API. A booking is a request; it is confirmed when you accept it in the app.`,
          "Accept or decline bookings promptly. If you cannot fulfil a booking you accepted, cancel it in the app as early as possible and tell the customer.",
          "Pickup and delivery times you show are your commitments. Keep order statuses up to date so customers see accurate progress on their ticket.",
          "Walk-in orders you record are your own records; you are responsible for their accuracy.",
        ] },
      ],
    },
    {
      id: "service",
      title: "5. Service quality, lost or damaged items, and disputes",
      blocks: [
        { list: [
          "<b>You are responsible</b> for the laundry service itself: washing, drying, folding, pressing, handling of special items, pickup and delivery, your staff, permits, and compliance with health, safety, labour and consumer laws.",
          "<b>Lost or damaged items</b> are your responsibility as the shop that received them. Have a clear policy for claims, tell customers about it, and handle claims fairly and in line with the Consumer Act of the Philippines (RA 7394).",
          `<b>Customer disputes</b> should be resolved directly with the customer first. For bookings made through ${E.marketplace}, River may contact you to help resolve a complaint and may share relevant booking details with both sides. You agree to respond in good faith.`,
          "River is not responsible for the quality of your service, for items in your care, or for agreements between you and your customers.",
        ] },
      ],
    },
    {
      id: "staff",
      title: "6. Staff access",
      blocks: [
        { list: [
          "The shop owner may give staff access to the shop, for example through a staff link. The owner is responsible for who has access and for everything done with it.",
          "Give staff only the access they need, and remove access when someone leaves. Staff links expire and should not be shared publicly.",
          "Staff must follow these Terms and may only use customer data to serve your shop's customers.",
        ] },
      ],
    },
    {
      id: "plans",
      title: "7. Plans, billing, cancellation and refunds",
      blocks: [
        { list: [
          `<b>Partner:</b> the entry plan: a shop listing for ${E.marketplace}, incoming bookings, scanning customers, booking history and up to 10 walk-in orders per day (Philippine time).`,
          "<b>Pro (₱499/month, regularly ₱950):</b> all features for 1 shop: everything in Partner plus unlimited walk-ins, the order board, sales records and public customer tickets. Billed monthly in advance and renews automatically until you cancel.",
          "<b>Lifetime (₱10,000 one-time for 1–5 locations, regularly ₱18,000; ₱20,000 one-time for 5+ locations, regularly ₱35,000):</b> a single payment that unlocks the Pro features for as long as the Services are offered, without a monthly bill.",
          "Payments are processed by PayMongo (cards, GCash, Maya and other methods offered). River does not store your full card number. Prices include VAT where applicable and are shown before you pay.",
          "You can cancel the Pro plan anytime in Settings → Plans. Cancellation takes effect at the end of the current billing period; your shop then returns to Partner and your records stay available.",
          "Fees already paid are not pro-rated or refunded, except where the law requires it or a charge was made in error. Contact us within 7 days about a billing error.",
          "We may change plan prices or features with at least 30 days' notice in the app. A price change applies from your next billing period.",
        ] },
      ],
    },
    {
      id: "use",
      title: "8. Acceptable use",
      blocks: [
        { list: [
          "Use the Services only for lawful business purposes of your laundry shop.",
          "Do not create fake shops, bookings, orders or reviews, and do not misrepresent your services or prices.",
          "Do not misuse, copy, reverse-engineer, scrape or interfere with the Services, or try to get around security, plans or payments.",
          "Do not use customer contact details for spam or for anything other than serving that customer, and do not harass customers, riders or other users.",
          "Posts in Moments must be honest and respectful. Do not post illegal, hateful, misleading or sexual content, personal data of others, or spam.",
        ] },
      ],
    },
    {
      id: "suspension",
      title: "9. Suspension and closing your account",
      blocks: [
        `We may suspend or remove a shop or account that breaks these Terms, commits fraud, receives repeated serious complaints, or puts customers or others at risk. Where reasonable we will tell you why and give you a chance to respond. You can stop using the Services at any time; contact us to close your shop and account.`,
      ],
    },
    {
      id: "ip",
      title: "10. Intellectual property",
      blocks: [
        `River owns the Services, including software, the ${E.brand}, ${E.app} and ${E.marketplace} names, logos and designs. Your shop name, logo and photos remain yours.`,
      ],
    },
    {
      id: "availability",
      title: "11. Service availability and maps",
      blocks: [
        "We aim for high availability but cannot guarantee uninterrupted service. Keep your own records where your business depends on them. Maps, routes and distances are estimates based on third-party map data (including OpenStreetMap) and may not be exact.",
      ],
    },
    {
      id: "liability",
      title: "12. Limitation of liability",
      blocks: [
        "To the maximum extent permitted by law: River is not liable for indirect or consequential damages, lost profits or lost data, or for your services or your dealings with customers; and our total liability for any claim is limited to the plan fees you paid to River in the 3 months before the claim. Nothing in these Terms excludes liability that cannot be excluded under Philippine law.",
      ],
    },
    {
      id: "indemnity",
      title: "13. Indemnification",
      blocks: [
        "You agree to indemnify River for claims arising from your laundry services, items in your care, your listing and content, your handling of customer data, or your violation of these Terms or the law.",
      ],
    },
    {
      id: "privacy",
      title: "14. Data privacy",
      blocks: [
        "Our Privacy Policy explains how we handle your data. For your customers' personal data, you are a personal information controller under the Data Privacy Act of 2012 (RA 10173) and must comply with it, as described in the Privacy Policy.",
      ],
    },
    {
      id: "changes",
      title: "15. Changes to these Terms",
      blocks: [
        "We may update these Terms to reflect new features or legal requirements. We will show the new effective date and, for material changes, notify you in the app before they apply. Continuing to use the Services after that means you accept the updated Terms.",
      ],
    },
    {
      id: "law",
      title: "16. Governing law and disputes",
      blocks: [
        "These Terms are governed by the laws of the Philippines. We will first try to resolve any dispute informally. Unresolved disputes are subject to the courts of Parañaque City.",
      ],
    },
    {
      id: "contact",
      title: "17. Contact us",
      blocks: [
        { list: [`Email: ${E.legalEmail}`, `Company: ${E.company}`, `Business address: ${E.address}`] },
      ],
    },
  ],
};

export const PRIVACY: LegalDoc = {
  slug: "privacy",
  title: "Privacy Policy",
  effective: LEGAL_EFFECTIVE,
  intro: [
    `${E.company} (“River,” “we”) operates ${E.app}, an app of ${E.brand} for laundry shop owners and their staff. We are committed to protecting personal data in line with the Data Privacy Act of 2012 (Republic Act No. 10173), its Implementing Rules and Regulations, and the issuances of the National Privacy Commission (NPC).`,
    `For your ${E.app} account and shop listing we are the personal information controller. For the personal data of your own customers that you record or receive in ${E.app}, your shop is the personal information controller and River processes that data on your behalf to provide the Services.`,
  ],
  sections: [
    {
      id: "collect",
      title: "1. Information you give us",
      blocks: [
        { list: [
          "<b>Account data:</b> your name, mobile number, email, and your Google account name and email if you sign in with Google.",
          "<b>Sign-in data:</b> we use Firebase Authentication by Google for phone (SMS code) and Google sign-in. reCAPTCHA by Google may check that sign-in is not automated.",
          "<b>Shop data:</b> shop name, description, services and prices, opening hours, logo and photos, and the shop phone or email you choose to show.",
          "<b>Location:</b> your shop address and the map pin you set; your device location only if you tap “Use my location” when setting the pin.",
          "<b>Staff:</b> the staff members you give access to and their role.",
          "<b>Plan and payments:</b> your plan, payment method type, amount, status and reference. Card and e-wallet details are collected by PayMongo, not stored by River.",
          "<b>Device and usage data:</b> app version, device and browser type, IP address, error logs and in-app activity, used to keep the Services secure and fix problems.",
        ] },
      ],
    },
    {
      id: "customers",
      title: "2. Your customers' data",
      blocks: [
        "When you use the Services you record or receive personal data of your customers: names, mobile numbers or emails, addresses and map pins for pickup or delivery, order details, notes and payment status.",
        { list: [
          "<b>You are the controller.</b> Your shop decides why and how this data is used and is responsible for complying with the Data Privacy Act, including telling customers how you use their data, having a lawful basis, keeping it accurate and secure, and answering their requests.",
          "Use customer data only to provide and follow up on your laundry service. Do not sell it, use it for unrelated marketing without consent, or share it outside your shop.",
          "Limit access to staff who need it, and remove access when staff leave.",
          "Tell us promptly at the email below if you suspect a breach involving customer data in your account.",
          "<b>River as processor:</b> we store and process your customers' data only to run the Services for you, protect it with the safeguards in Section 7, and do not use it for our own marketing.",
          `For bookings made on ${E.marketplace}, River is also a controller of the customer's ${E.marketplace} account data under the ${E.marketplace} Privacy Policy.`,
        ] },
      ],
    },
    {
      id: "use",
      title: "3. How we use your information",
      blocks: [
        { list: [
          "To create and secure your account and verify your mobile number.",
          `To show your shop to customers on ${E.marketplace} and on your shop QR page, and to pass bookings to you.`,
          "To run your order board, customer tickets and sales records.",
          "To process plan payments and handle billing questions.",
          "To provide support, handle complaints, prevent fraud and keep the Services safe.",
          "To improve the Services through aggregated analytics.",
          "To send service messages (sign-in codes, booking alerts, plan notices). Promotions only if you opt in.",
        ] },
        "Our lawful bases are the performance of our contract with you, your consent, our legitimate interests (security, fraud prevention, improving the Services) and legal obligations.",
      ],
    },
    {
      id: "share",
      title: "4. Who we share data with",
      blocks: [
        "We do not sell personal data. We share it only as needed:",
        { list: [
          `<b>${E.marketplace} and its users:</b> your public shop listing (name, address and map pin, photos, description, services, prices, hours and the contact details you choose to show) so customers can find and book your shop.`,
          "<b>Customers you serve:</b> your shop name, order status and the details shown on their ticket.",
          "<b>Service providers (processors):</b> Google Firebase and Google Cloud (hosting, database, sign-in, file storage), PayMongo (payments), SMS providers, and map services: OpenStreetMap (map tiles and address search) and OSRM (route and distance estimates, using start and end points only).",
          "<b>Authorities</b> when required by law or to protect rights and safety.",
        ] },
        "Some service providers store data outside the Philippines (for example Google Cloud in Singapore). We use contracts and safeguards as required by the Data Privacy Act.",
      ],
    },
    {
      id: "retention",
      title: "5. How long we keep data",
      blocks: [
        { list: [
          "Account and shop data: while your account is active.",
          "Orders, bookings, sales and payment records: 10 years, as required for tax and accounting records under the National Internal Revenue Code (NIRC), then deleted or anonymised.",
          "Posts in Moments: until you delete them or your account.",
          "After your account is closed we remove or anonymise personal data within 30 days, except records we must keep by law.",
        ] },
      ],
    },
    {
      id: "location",
      title: "6. Location data",
      blocks: [
        "Your shop pin is public so customers can find you. Device location is used only when you tap “Use my location” and is not tracked in the background. You can turn off location access anytime in your browser or phone settings.",
      ],
    },
    {
      id: "security",
      title: "7. Security",
      blocks: [
        { list: [
          "Encryption of data in transit and at rest.",
          "Access rules so only active members of a shop can read its data.",
          "Role-based access for owners and staff, and monitoring.",
          "Regular backups.",
          "We will notify affected parties and the NPC of a personal data breach as required by law (within 72 hours of knowledge where applicable).",
        ] },
      ],
    },
    {
      id: "rights",
      title: "8. Your rights under the Data Privacy Act",
      blocks: [
        "As a data subject you have the right to be informed; to access your data; to object; to correct inaccurate data; to erasure or blocking; to data portability; to withdraw consent; to damages; and to file a complaint with the National Privacy Commission (privacy.gov.ph).",
        "You can edit your shop and profile in the app. For other requests, contact our Data Protection Officer. We respond within 15 days. Requests from your customers about data your shop holds should go to your shop first; we will help you respond.",
      ],
    },
    {
      id: "changes",
      title: "9. Changes to this policy",
      blocks: ["We may update this policy. We will show the new effective date and tell you in the app about material changes."],
    },
    {
      id: "dpo",
      title: "10. Contact our Data Protection Officer",
      blocks: [
        { list: [`Email: ${E.privacyEmail}`, `Data Protection Officer: ${E.dpo}`, `Company: ${E.company}`, `Address: ${E.address}`] },
      ],
    },
  ],
};
