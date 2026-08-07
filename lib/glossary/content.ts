/**
 * Launch glossary (§5.4) — every key seeded in Armenian and English.
 * This file is the SEED. At runtime the glossary lives in the database and is
 * editable by non-engineers without a deploy (admin CRUD screen). The seed is
 * also the fallback when the database has no entries yet.
 *
 * Rule that keeps this from rotting: no new domain noun ships without a
 * glossary entry in both locales. It is part of the definition of done.
 */
import type { GlossaryEntry } from "@/components/GlossaryProvider";

type Groups = "attributes" | "carbon" | "measurement" | "roles" | "system";

interface SeedEntry {
  key: string;
  group: Groups;
  related?: string[];
  en: { term: string; short: string; eli5: string; why: string; example?: string };
  hy: { term: string; short: string; eli5: string; why: string; example?: string };
}

const entries: SeedEntry[] = [
  /* ---------------------------------------------------- Attributes */
  {
    key: "environmental_attribute",
    group: "attributes",
    related: ["i_rec", "vcu", "double_counting"],
    en: {
      term: "Environmental attribute",
      short: "The 'greenness' of a unit of energy, separated from the energy itself.",
      eli5: "When your solar panels make electricity, two things are created: the electricity, and the right to say 'this electricity was clean'. That second thing is the environmental attribute. It can be sold separately from the power.",
      why: "This portal exists to turn your attributes into money. The electricity stays with you; the attribute is what gets certified and sold.",
      example: "Your bakery uses the solar power for its ovens, while the attribute for that same power is sold to a company that wants to prove it supports renewables.",
    },
    hy: {
      term: "Բնապահպանական ատրիբուտ",
      short: "Էներգիայի «մաքուր» լինելու իրավունքը՝ առանձնացված բուն էներգիայից:",
      eli5: "Երբ ձեր արևային վահանակները էլեկտրաէներգիա են արտադրում, ստեղծվում է երկու բան՝ էլեկտրաէներգիան և «այս էներգիան մաքուր է» ասելու իրավունքը: Այդ երկրորդը բնապահպանական ատրիբուտն է: Այն կարելի է վաճառել էներգիայից առանձին:",
      why: "Այս պորտալը գոյություն ունի ձեր ատրիբուտները գումարի վերածելու համար: Էլեկտրաէներգիան մնում է ձեզ, իսկ ատրիբուտը հավաստագրվում և վաճառվում է:",
      example: "Ձեր փռի վառարանները աշխատում են արևային էներգիայով, իսկ նույն էներգիայի ատրիբուտը վաճառվում է մի ընկերության, որն ուզում է ապացուցել, որ աջակցում է վերականգնվող էներգիային:",
    },
  },
  {
    key: "i_rec",
    group: "attributes",
    related: ["environmental_attribute", "vintage", "redemption"],
    en: {
      term: "I-REC",
      short: "An international certificate proving one megawatt-hour was renewable.",
      eli5: "An I-REC is like a birth certificate for one megawatt-hour of clean electricity. An official registry issues it, gives it a unique serial number, and tracks who owns it until it is finally 'used up' by a buyer.",
      why: "I-RECs are the first product this portal produces. Every certificate traces back to real readings from your site.",
      example: "Your site generated 12 MWh in March, so 12 I-RECs with serial numbers were issued for it.",
    },
    hy: {
      term: "I-REC",
      short: "Միջազգային վկայական, որ մեկ ՄՎտ·ժ էներգիան վերականգնվող էր:",
      eli5: "I-REC-ը նման է ծննդյան վկայականի՝ մեկ մեգավատտ·ժամ մաքուր էլեկտրաէներգիայի համար: Պաշտոնական ռեգիստրը թողարկում է այն, տալիս եզակի սերիական համար և հետևում, թե ով է տերը, մինչև գնորդը վերջնականապես «օգտագործի» այն:",
      why: "I-REC-ները այս պորտալի առաջին արտադրանքն են: Յուրաքանչյուր վկայական հետագծելի է մինչև ձեր կայանի իրական ցուցմունքները:",
      example: "Ձեր կայանը մարտին արտադրել է 12 ՄՎտ·ժ, ուստի դրա համար թողարկվել է 12 I-REC՝ սերիական համարներով:",
    },
  },
  {
    key: "vcu",
    group: "attributes",
    related: ["verra", "additionality", "environmental_attribute"],
    en: {
      term: "VCU (Verified Carbon Unit)",
      short: "A carbon credit: one tonne of CO₂ avoided, verified by an auditor.",
      eli5: "A VCU says 'because this solar plant exists, one tonne of CO₂ was NOT released'. Unlike an I-REC, a human auditor must read the evidence and agree before Verra (the carbon registry) issues it.",
      why: "VCUs are the second product. They pay more per unit but demand stricter proof — which is why this portal keeps such careful records.",
      example: "20 MWh of solar in Armenia avoids roughly 8.7 tonnes of grid CO₂, which could become 8 VCUs.",
    },
    hy: {
      term: "VCU (Ստուգված ածխածնային միավոր)",
      short: "Ածխածնային կրեդիտ՝ մեկ տոննա կանխված CO₂, հաստատված աուդիտորի կողմից:",
      eli5: "VCU-ն ասում է․ «քանի որ այս արևային կայանը գոյություն ունի, մեկ տոննա CO₂ ՉԻ արտանետվել»: Ի տարբերություն I-REC-ի, մարդ աուդիտորը պետք է կարդա ապացույցները և համաձայնի, նախքան Verra ռեգիստրը այն կթողարկի:",
      why: "VCU-ները երկրորդ արտադրանքն են: Դրանք ավելի թանկ են, բայց պահանջում են ավելի խիստ ապացույց — ահա թե ինչու է այս պորտալը այդքան մանրակրկիտ գրառումներ պահում:",
      example: "20 ՄՎտ·ժ արևային էներգիան Հայաստանում կանխում է մոտ 8.7 տոննա CO₂, որը կարող է դառնալ 8 VCU:",
    },
  },
  {
    key: "vintage",
    group: "attributes",
    related: ["redemption", "i_rec"],
    en: {
      term: "Vintage",
      short: "The year (or period) in which the energy was actually generated.",
      eli5: "Like wine, certificates have a vintage: the time the electricity was actually made. A certificate for March 2026 generation has a March 2026 vintage forever, no matter when it is issued or sold.",
      why: "Buyers care about vintage — recent vintages sell for more. Emission factors are also chosen by vintage, never by the date we do the maths.",
      example: "A certificate issued in 2027 for energy generated in 2026 has a 2026 vintage.",
    },
    hy: {
      term: "Տարեթիվ (Vintage)",
      short: "Տարին (կամ ժամանակաշրջանը), երբ էներգիան իրականում արտադրվել է:",
      eli5: "Գինու պես՝ վկայականներն ունեն տարեթիվ․ այն պահը, երբ էլեկտրաէներգիան իրականում արտադրվել է: 2026-ի մարտի արտադրության վկայականը ընդմիշտ կունենա 2026-ի մարտի տարեթիվ՝ անկախ նրանից, թե երբ է թողարկվում կամ վաճառվում:",
      why: "Գնորդների համար տարեթիվը կարևոր է․ թարմ տարեթվերն ավելի թանկ են վաճառվում: Արտանետումների գործակիցները նույնպես ընտրվում են ըստ տարեթվի:",
      example: "2027-ին թողարկված վկայականը 2026-ին արտադրված էներգիայի համար ունի 2026 տարեթիվ:",
    },
  },
  {
    key: "redemption",
    group: "attributes",
    related: ["vintage", "beneficiary", "double_counting"],
    en: {
      term: "Redemption",
      short: "Using a certificate up, permanently, in someone's name.",
      eli5: "Redemption is when a certificate is finally 'spent'. A buyer redeems it in their name to claim the clean energy, and after that it can never be sold or used again — like a stamped train ticket.",
      why: "Redemption is terminal in this portal. Once REDEEMED, an attribute is locked forever — that is what protects everyone from double-selling.",
      example: "A German retailer redeems 500 of your I-RECs to back their 'we run on renewables' claim for 2026.",
    },
    hy: {
      term: "Մարում (Redemption)",
      short: "Վկայականի վերջնական օգտագործումը՝ որևէ մեկի անունով:",
      eli5: "Մարումը այն է, երբ վկայականը վերջնականապես «ծախսվում» է: Գնորդը մարում է այն իր անունով՝ մաքուր էներգիան իրեն վերագրելու համար, և դրանից հետո այն այլևս երբեք չի կարող վաճառվել կամ օգտագործվել — ինչպես կնքված տոմսը:",
      why: "Մարումը այս պորտալում վերջնական է: REDEEMED կարգավիճակից հետո ատրիբուտը ընդմիշտ փակված է — հենց դա է բոլորին պաշտպանում կրկնակի վաճառքից:",
      example: "Գերմանական խանութների ցանցը մարում է ձեր 500 I-REC՝ իր «մենք աշխատում ենք վերականգնվող էներգիայով» հայտարարության համար:",
    },
  },
  {
    key: "double_counting",
    group: "attributes",
    related: ["redemption", "environmental_attribute", "retained_share"],
    en: {
      term: "Double counting",
      short: "Two parties claiming the same clean energy. Forbidden, everywhere.",
      eli5: "If you sell the attribute for your March electricity, you cannot ALSO tell customers 'our bakery ran on solar in March' — the buyer now owns that claim. Claiming it twice is double counting, and it is treated as fraud, not a mistake.",
      why: "The portal's database physically refuses to create two certificates for the same energy, and your contract explains exactly what you may still say after selling.",
      example: "Selling an I-REC and simultaneously advertising the same MWh as your own green power would be double counting.",
    },
    hy: {
      term: "Կրկնակի հաշվառում",
      short: "Երկու կողմ նույն մաքուր էներգիան իրենցն են համարում: Արգելված է ամենուր:",
      eli5: "Եթե վաճառում եք ձեր մարտի էլեկտրաէներգիայի ատրիբուտը, չեք կարող ՆԱԵՎ ասել հաճախորդներին՝ «մեր փուռը մարտին աշխատել է արևով» — այդ հայտարարությունն այժմ գնորդինն է: Երկու անգամ նույն բանը պնդելը կրկնակի հաշվառում է և դիտվում է որպես խարդախություն, ոչ թե սխալ:",
      why: "Պորտալի տվյալների բազան ֆիզիկապես մերժում է նույն էներգիայի համար երկու վկայական ստեղծելը, իսկ ձեր պայմանագիրը հստակ բացատրում է, թե վաճառքից հետո ինչ կարող եք դեռ ասել:",
      example: "I-REC վաճառելը և միաժամանակ նույն ՄՎտ·ժ-ը որպես ձեր սեփական կանաչ էներգիա գովազդելը կրկնակի հաշվառում կլիներ:",
    },
  },
  {
    key: "retained_share",
    group: "attributes",
    related: ["double_counting", "environmental_attribute"],
    en: {
      term: "Retained share",
      short: "The portion of attributes you keep for your own green claims.",
      eli5: "Your contract can let you keep some of your attributes — say 10% — instead of selling them all. That kept portion is your retained share, and it is what lets you honestly say 'partly solar powered'.",
      why: "The retained share is written into your agreement and your payout maths. The portal generates a claim statement for it, so your marketing stays audit-proof.",
      example: "With a 10% retained share on 100 MWh, 90 MWh are sold and you may claim 10 MWh as your own clean energy.",
    },
    hy: {
      term: "Պահվող բաժին",
      short: "Ատրիբուտների այն մասը, որ պահում եք ձեր սեփական «կանաչ» հայտարարությունների համար:",
      eli5: "Ձեր պայմանագիրը կարող է թույլ տալ պահել ատրիբուտների մի մասը՝ օրինակ 10%-ը, բոլորը չվաճառելու փոխարեն: Այդ պահված մասը ձեր պահվող բաժինն է, և հենց դա է թույլ տալիս ազնվորեն ասել՝ «մասամբ արևային էներգիայով»:",
      why: "Պահվող բաժինը գրված է ձեր պայմանագրում և վճարումների հաշվարկում: Պորտալը դրա համար ստեղծում է հայտարարության փաստաթուղթ, որ ձեր գովազդը դիմանա աուդիտին:",
      example: "100 ՄՎտ·ժ-ի վրա 10% պահվող բաժնով՝ վաճառվում է 90 ՄՎտ·ժ, իսկ 10 ՄՎտ·ժ-ը կարող եք համարել ձեր սեփական մաքուր էներգիան:",
    },
  },

  /* ---------------------------------------------------- Carbon */
  {
    key: "additionality",
    group: "carbon",
    related: ["baseline", "vcu", "grouped_project"],
    en: {
      term: "Additionality",
      short: "Proof the project would not have happened without carbon money.",
      eli5: "Carbon credits only count if the money from selling them is what made the project possible. If you would have built the solar plant anyway, stopping extra CO₂ was going to happen anyway — so no credit. That test is called additionality.",
      why: "Additionality decides which track a site goes on. It is assessed once, deliberately, and the decision is recorded because it is essentially irreversible.",
      example: "A site built purely because grid power is expensive may fail additionality; one that only penciled out with carbon revenue passes.",
    },
    hy: {
      term: "Հավելյալություն (Additionality)",
      short: "Ապացույց, որ նախագիծը չէր լինի առանց ածխածնային եկամտի:",
      eli5: "Ածխածնային կրեդիտները հաշվվում են միայն այն դեպքում, երբ դրանց վաճառքից ստացվող գումարն է հնարավոր դարձրել նախագիծը: Եթե արևային կայանը միևնույն է կառուցելու էիք, ապա CO₂-ի կանխումը միևնույն է լինելու էր — ուրեմն կրեդիտ չկա: Այդ թեստը կոչվում է հավելյալություն:",
      why: "Հավելյալությունը որոշում է, թե որ ուղով կգնա կայանը: Այն գնահատվում է մեկ անգամ, միտումնավոր, և որոշումը գրանցվում է, քանի որ այն ըստ էության անշրջելի է:",
      example: "Կայանը, որ կառուցվել է զուտ որովհետև ցանցի հոսանքը թանկ է, կարող է չանցնել հավելյալության թեստը:",
    },
  },
  {
    key: "grid_emission_factor",
    group: "carbon",
    related: ["baseline", "vcu"],
    en: {
      term: "Grid emission factor",
      short: "Tonnes of CO₂ the grid emits per megawatt-hour it produces.",
      eli5: "Every megawatt-hour from the national grid causes some CO₂, because part of it comes from gas plants. The grid emission factor is that number for Armenia. Your solar MWh avoids exactly that much CO₂.",
      why: "This single number converts your MWh into tonnes of CO₂ avoided — the basis of every carbon credit. It is stored as versioned, dated data with its official source attached.",
      example: "With a factor of 0.436 tCO₂/MWh, 100 MWh of solar avoids 43.6 tonnes of CO₂.",
    },
    hy: {
      term: "Ցանցի արտանետումների գործակից",
      short: "Տոննա CO₂, որ ցանցն արտանետում է մեկ ՄՎտ·ժ արտադրելիս:",
      eli5: "Ազգային ցանցի յուրաքանչյուր ՄՎտ·ժ առաջացնում է որոշակի CO₂, քանի որ դրա մի մասը գալիս է գազային կայաններից: Ցանցի արտանետումների գործակիցը հենց այդ թիվն է Հայաստանի համար: Ձեր արևային ՄՎտ·ժ-ը կանխում է ճիշտ այդքան CO₂:",
      why: "Այս մեկ թիվը ձեր ՄՎտ·ժ-ը վերածում է կանխված CO₂ տոննաների — ամեն ածխածնային կրեդիտի հիմքը: Այն պահվում է որպես տարբերակավորված, թվագրված տվյալ՝ պաշտոնական աղբյուրով:",
      example: "0.436 տCO₂/ՄՎտ·ժ գործակցով 100 ՄՎտ·ժ արևային էներգիան կանխում է 43.6 տոննա CO₂:",
    },
  },
  {
    key: "baseline",
    group: "carbon",
    related: ["grid_emission_factor", "additionality"],
    en: {
      term: "Baseline",
      short: "What would have happened without your project.",
      eli5: "To measure what your solar plant saved, we first imagine the world without it: the same electricity would have come from the grid. That imaginary 'without' scenario is the baseline. Savings = baseline emissions − your emissions (zero).",
      why: "Every carbon calculation in this portal is 'baseline minus actual'. Getting the baseline right is what makes the credits real.",
    },
    hy: {
      term: "Բազային գիծ",
      short: "Ինչ կլիներ առանց ձեր նախագծի:",
      eli5: "Ձեր կայանի խնայածը չափելու համար նախ պատկերացնում ենք աշխարհն առանց դրա․ նույն էլեկտրաէներգիան կգար ցանցից: Այդ երևակայական «առանց» սցենարը բազային գիծն է: Խնայողություն = բազային արտանետումներ − ձեր արտանետումներ (զրո):",
      why: "Այս պորտալի ամեն ածխածնային հաշվարկ «բազային հանած փաստացի» է: Ճիշտ բազային գիծը այն է, ինչ կրեդիտները դարձնում է իրական:",
    },
  },
  {
    key: "leakage",
    group: "carbon",
    related: ["baseline"],
    en: {
      term: "Leakage",
      short: "Emissions your project accidentally pushes somewhere else.",
      eli5: "Sometimes reducing emissions here causes extra emissions elsewhere — like a diet where you skip lunch but snack more at night. For small rooftop solar, leakage is essentially zero, but auditors still ask the question.",
      why: "Evidence packs include a short leakage statement so verification does not stall on it.",
    },
    hy: {
      term: "Արտահոսք (Leakage)",
      short: "Արտանետումներ, որ ձեր նախագիծը ակամա տեղափոխում է այլ տեղ:",
      eli5: "Երբեմն այստեղ արտանետումները նվազեցնելը այլ տեղ ավելացնում է դրանք — ինչպես դիետան, երբ բաց ես թողնում ճաշը, բայց գիշերը ավելի շատ ես ուտում: Փոքր տանիքային արևայինի համար արտահոսքը գործնականում զրո է, բայց աուդիտորները միևնույն է հարցնում են:",
      why: "Ապացույցների փաթեթները ներառում են կարճ արտահոսքի հայտարարություն, որ ստուգումը դրա վրա չկանգնի:",
    },
  },
  {
    key: "monitoring_period",
    group: "carbon",
    related: ["vvb", "vcu"],
    en: {
      term: "Monitoring period",
      short: "The window of generation data an auditor verifies in one go.",
      eli5: "Carbon credits are checked in batches. A monitoring period is one batch: for example, all generation from January to December 2026. The auditor reviews that whole window, then credits for it are issued together.",
      why: "When a monitoring period is locked in this portal, its underlying data is frozen for reporting — nothing can quietly change under the auditor's feet.",
    },
    hy: {
      term: "Մոնիտորինգի ժամանակաշրջան",
      short: "Արտադրության տվյալների պատուհանը, որ աուդիտորը ստուգում է մեկ անգամում:",
      eli5: "Ածխածնային կրեդիտները ստուգվում են խմբաքանակներով: Մոնիտորինգի ժամանակաշրջանը մեկ խմբաքանակ է․ օրինակ՝ 2026-ի հունվարից դեկտեմբեր ամբողջ արտադրությունը: Աուդիտորը ստուգում է ամբողջ պատուհանը, հետո դրա կրեդիտները թողարկվում են միասին:",
      why: "Երբ մոնիտորինգի ժամանակաշրջանը փակվում է այս պորտալում, դրա տվյալները սառեցվում են հաշվետվության համար — ոչինչ չի կարող աննկատ փոխվել աուդիտորի ոտքերի տակ:",
    },
  },
  {
    key: "grouped_project",
    group: "carbon",
    related: ["additionality", "verra"],
    en: {
      term: "Grouped project",
      short: "Many small sites bundled into one carbon project.",
      eli5: "A single bakery roof is too small to be its own carbon project — the paperwork would cost more than the credits. So dozens of small sites are grouped into one project that shares one additionality argument and one verification.",
      why: "Cohorts in this portal exist so an additionality assessment can be applied to a whole set of similar sites at once.",
    },
    hy: {
      term: "Խմբավորված նախագիծ",
      short: "Շատ փոքր կայաններ՝ միավորված մեկ ածխածնային նախագծում:",
      eli5: "Մեկ փռի տանիքը չափազանց փոքր է առանձին ածխածնային նախագիծ լինելու համար — փաստաթղթերը կարժենային ավելի, քան կրեդիտները: Ուստի տասնյակ փոքր կայաններ խմբավորվում են մեկ նախագծում՝ ընդհանուր հավելյալության հիմնավորմամբ և ընդհանուր ստուգմամբ:",
      why: "Կոհորտաները այս պորտալում գոյություն ունեն, որ հավելյալության գնահատումը կիրառվի միանգամից նման կայանների մի ամբողջ խմբի վրա:",
    },
  },
  {
    key: "vvb",
    group: "carbon",
    related: ["verra", "monitoring_period", "audit_trail"],
    en: {
      term: "VVB (Validation & Verification Body)",
      short: "The independent auditor who checks carbon claims.",
      eli5: "A VVB is a licensed auditing firm that Verra trusts. Before carbon credits are issued, a VVB reads your evidence — readings, calibrations, contracts, photos — and signs off that the tonnes are real.",
      why: "The auditor console in this portal exists for the VVB: a read-only account where they can check everything themselves, which makes every verification cheaper.",
    },
    hy: {
      term: "VVB (Վալիդացիայի և վերիֆիկացիայի մարմին)",
      short: "Անկախ աուդիտորը, որ ստուգում է ածխածնային հայտարարությունները:",
      eli5: "VVB-ն լիցենզավորված աուդիտորական ընկերություն է, որին Verra-ն վստահում է: Նախքան ածխածնային կրեդիտների թողարկումը VVB-ն կարդում է ձեր ապացույցները — ցուցմունքներ, չափաբերումներ, պայմանագրեր, լուսանկարներ — և հաստատում, որ տոննաները իրական են:",
      why: "Աուդիտորի վահանակը այս պորտալում հենց VVB-ի համար է․ միայն կարդալու հաշիվ, որտեղ նրանք ամեն ինչ ինքնուրույն կարող են ստուգել — դա ամեն ստուգում դարձնում է ավելի էժան:",
    },
  },
  {
    key: "verra",
    group: "carbon",
    related: ["vcu", "vvb", "ccp"],
    en: {
      term: "Verra",
      short: "The organisation that runs the biggest voluntary carbon registry.",
      eli5: "Verra is the referee of the voluntary carbon market. It sets the rules (the VCS standard), keeps the official ledger of credits, and only issues VCUs after an approved auditor has verified the project.",
      why: "Our VCUs are issued by Verra, so this portal's evidence packs are built to satisfy Verra's rules from day one.",
    },
    hy: {
      term: "Verra",
      short: "Կազմակերպությունը, որ վարում է ամենամեծ կամավոր ածխածնային ռեգիստրը:",
      eli5: "Verra-ն կամավոր ածխածնային շուկայի մրցավարն է: Այն սահմանում է կանոնները (VCS ստանդարտը), վարում է կրեդիտների պաշտոնական մատյանը և VCU-ներ թողարկում միայն այն բանից հետո, երբ հաստատված աուդիտորը ստուգել է նախագիծը:",
      why: "Մեր VCU-ները թողարկում է Verra-ն, ուստի այս պորտալի ապացույցների փաթեթները առաջին օրվանից կառուցված են Verra-ի կանոններին համապատասխան:",
    },
  },
  {
    key: "ccp",
    group: "carbon",
    related: ["verra", "vcu"],
    en: {
      term: "CCP (Core Carbon Principles)",
      short: "A quality label for carbon credits buyers trust more.",
      eli5: "The Core Carbon Principles are a checklist run by an independent body (the ICVCM) that marks which carbon credits are high quality. Credits with the CCP label sell more easily and for better prices.",
      why: "Building airtight evidence now is what keeps our future credits eligible for quality labels like CCP.",
    },
    hy: {
      term: "CCP (Հիմնական ածխածնային սկզբունքներ)",
      short: "Որակի պիտակ, որին գնորդներն ավելի շատ են վստահում:",
      eli5: "Հիմնական ածխածնային սկզբունքները անկախ մարմնի (ICVCM) ստուգաթերթ են, որ նշում է, թե որ ածխածնային կրեդիտներն են բարձրորակ: CCP պիտակով կրեդիտները վաճառվում են ավելի հեշտ և ավելի լավ գնով:",
      why: "Անթերի ապացույցներ կառուցելը հիմա այն է, ինչ մեր ապագա կրեդիտները կպահի CCP-ի նման որակի պիտակների համար պիտանի:",
    },
  },

  /* ---------------------------------------------------- Measurement */
  {
    key: "revenue_grade_meter",
    group: "measurement",
    related: ["calibration", "reconciliation"],
    en: {
      term: "Revenue-grade meter",
      short: "A certified meter accurate enough that money can depend on it.",
      eli5: "Not all meters are equal. A revenue-grade meter is built and certified to a legal accuracy standard, sealed against tampering, and is the instrument everyone agrees to trust when money changes hands.",
      why: "In any disagreement between data sources, the meter wins — it is the record of account in this portal.",
    },
    hy: {
      term: "Կոմերցիոն դասի հաշվիչ",
      short: "Հավաստագրված հաշվիչ, որին կարելի է վստահել փող հաշվելիս:",
      eli5: "Ոչ բոլոր հաշվիչներն են հավասար: Կոմերցիոն դասի հաշվիչը կառուցված և հավաստագրված է օրինական ճշգրտության ստանդարտով, կնքված է միջամտության դեմ, և հենց այն գործիքն է, որին բոլորը համաձայնում են վստահել, երբ փող է փոխանցվում:",
      why: "Տվյալների աղբյուրների ցանկացած տարաձայնության դեպքում հաղթում է հաշվիչը — այն այս պորտալի հաշվառման հիմքն է:",
    },
  },
  {
    key: "calibration",
    group: "measurement",
    related: ["revenue_grade_meter", "audit_trail"],
    en: {
      term: "Calibration",
      short: "Periodic proof that a meter still measures correctly.",
      eli5: "Meters drift over time, like a bathroom scale that slowly starts lying. Calibration is a lab check with a certificate saying 'this meter is accurate', valid for a fixed period. When it expires, the meter's numbers stop being trusted.",
      why: "Certificates cannot be issued for any period where the meter's calibration had lapsed. The portal warns 90, 30 and 7 days before expiry so this never surprises you.",
      example: "A meter calibrated until 15 March cannot back certificates for the second half of March unless recalibrated.",
    },
    hy: {
      term: "Չափաբերում",
      short: "Պարբերական ապացույց, որ հաշվիչը դեռ ճիշտ է չափում:",
      eli5: "Հաշվիչները ժամանակի ընթացքում շեղվում են, ինչպես լոգարանի կշեռքը, որ կամաց-կամաց սկսում է ստել: Չափաբերումը լաբորատոր ստուգում է՝ վկայականով, որ «այս հաշվիչը ճշգրիտ է», ուժի մեջ որոշակի ժամկետով: Երբ այն լրանում է, հաշվիչի թվերին այլևս չեն վստահում:",
      why: "Վկայականներ չեն կարող թողարկվել այն ժամանակաշրջանի համար, երբ հաշվիչի չափաբերումը լրացած էր: Պորտալը զգուշացնում է լրանալուց 90, 30 և 7 օր առաջ:",
      example: "Մինչև մարտի 15-ը չափաբերված հաշվիչը չի կարող հիմք լինել մարտի երկրորդ կեսի վկայականների համար՝ առանց նոր չափաբերման:",
    },
  },
  {
    key: "reconciliation",
    group: "measurement",
    related: ["tolerance", "revenue_grade_meter", "manual_reading"],
    en: {
      term: "Reconciliation",
      short: "Comparing meter, inverter and utility figures until they agree.",
      eli5: "Three different sources report how much your site generated: the meter, the inverter, and the utility's bill. Reconciliation lays them side by side. If they agree within a small margin, the period is trusted; if not, a human investigates.",
      why: "No certificate is ever issued from unreconciled data. This step is what makes every downstream number defensible.",
      example: "Meter says 10.0 MWh, inverter 10.1, utility 9.95 — within 2%, reconciled, meter value adopted.",
    },
    hy: {
      term: "Համադրում",
      short: "Հաշվիչի, ինվերտորի և ցանցի թվերի համեմատում մինչև համաձայնություն:",
      eli5: "Երեք տարբեր աղբյուր հայտնում է, թե որքան է արտադրել ձեր կայանը՝ հաշվիչը, ինվերտորը և էլեկտրացանցի հաշիվը: Համադրումը դրանք դնում է կողք կողքի: Եթե համընկնում են փոքր սահմանի մեջ, ժամանակաշրջանը վստահելի է. եթե ոչ՝ մարդ է ուսումնասիրում:",
      why: "Ոչ մի վկայական երբեք չի թողարկվում չհամադրված տվյալներից: Այս քայլն է, որ ամեն հետագա թիվ դարձնում է պաշտպանելի:",
      example: "Հաշվիչը ցույց է տալիս 10.0 ՄՎտ·ժ, ինվերտորը՝ 10.1, ցանցը՝ 9.95 — 2%-ի սահմանում, համադրված է, ընդունվում է հաշվիչի արժեքը:",
    },
  },
  {
    key: "tolerance",
    group: "measurement",
    related: ["reconciliation"],
    en: {
      term: "Tolerance",
      short: "How much the three sources may disagree before humans step in.",
      eli5: "Instruments never agree perfectly — cables lose a little energy, clocks differ slightly. Tolerance is the allowed disagreement, normally 2%. Inside it, the period reconciles automatically; outside it, the period is disputed and queued for review.",
      why: "Tolerance is configurable per site, but changing it requires a logged reason — loosening the rules quietly is not possible.",
    },
    hy: {
      term: "Թույլատրելի շեղում",
      short: "Որքան կարող են երեք աղբյուրները տարբերվել, մինչև մարդիկ միջամտեն:",
      eli5: "Գործիքները երբեք կատարյալ չեն համընկնում — մալուխները մի քիչ էներգիա են կորցնում, ժամացույցները փոքր-ինչ տարբեր են: Թույլատրելի շեղումը թույլատրված տարբերությունն է, սովորաբար 2%: Դրա սահմանում ժամանակաշրջանը համադրվում է ավտոմատ. դրանից դուրս՝ վիճարկվում է և ուղարկվում ստուգման:",
      why: "Շեղումը կարգավորելի է ամեն կայանի համար, բայց փոփոխությունը պահանջում է գրանցված պատճառ — կանոնները թաքուն թուլացնել հնարավոր չէ:",
    },
  },
  {
    key: "auxiliary_consumption",
    group: "measurement",
    related: ["net_export", "reconciliation"],
    en: {
      term: "Auxiliary consumption",
      short: "Electricity the solar system itself uses to run.",
      eli5: "Inverters, controllers and monitoring boxes consume a little electricity themselves. That self-use is auxiliary consumption. Certificates are issued on what the system delivered NET of what it ate.",
      why: "Deducting auxiliary consumption is the difference between an honest number and an inflated one. The portal does it in every calculation, automatically.",
    },
    hy: {
      term: "Սեփական սպառում",
      short: "Էլեկտրաէներգիան, որ արևային համակարգն ինքն է ծախսում աշխատելու համար:",
      eli5: "Ինվերտորները, կարգավորիչները և մոնիտորինգի սարքերը իրենք էլ մի քիչ էլեկտրաէներգիա են սպառում: Այդ ինքնասպառումը սեփական սպառումն է: Վկայականները թողարկվում են այն ՄԱՔՈՒՐ ծավալի վրա, ինչ համակարգը տվել է՝ հանած իր կերածը:",
      why: "Սեփական սպառումը հանելը ազնիվ թվի և ուռճացված թվի տարբերությունն է: Պորտալը դա անում է ամեն հաշվարկում՝ ավտոմատ:",
    },
  },
  {
    key: "net_export",
    group: "measurement",
    related: ["auxiliary_consumption", "revenue_grade_meter"],
    en: {
      term: "Net export",
      short: "Energy that actually left your site for the grid.",
      eli5: "Your panels may generate 100 units, but if the site used 30 itself, only 70 crossed the meter into the grid. That 70 is net export — the number the grid can confirm and the safest basis for certificates.",
      why: "The meter at your grid connection measures net export directly, which is why it is the record of account.",
    },
    hy: {
      term: "Զուտ արտահանում",
      short: "Էներգիան, որ իրականում դուրս է եկել ձեր կայանից դեպի ցանց:",
      eli5: "Ձեր վահանակները կարող են արտադրել 100 միավոր, բայց եթե կայանը ինքն օգտագործել է 30-ը, ապա միայն 70-ն է անցել հաշվիչով դեպի ցանց: Այդ 70-ը զուտ արտահանումն է — թիվը, որ ցանցը կարող է հաստատել, և վկայականների ամենաապահով հիմքը:",
      why: "Ձեր ցանցային միացման հաշվիչը ուղղակիորեն չափում է զուտ արտահանումը — ահա թե ինչու է այն հաշվառման հիմքը:",
    },
  },

  /* ---------------------------------------------------- Roles */
  {
    key: "registrant",
    group: "roles",
    related: ["participant", "issuer"],
    en: {
      term: "Registrant",
      short: "The company that registers devices and requests certificates.",
      eli5: "In the I-REC system, the registrant is the account holder who registers solar sites with the registry and asks for certificates to be issued. In this setup, that is us — the platform operator — acting for many site owners.",
      why: "You own the site; we hold the registry relationship. The contract you sign is what authorises us to register your site and issue from it.",
    },
    hy: {
      term: "Գրանցող (Registrant)",
      short: "Ընկերությունը, որ գրանցում է սարքերը և պահանջում վկայականներ:",
      eli5: "I-REC համակարգում գրանցողը հաշվետերն է, որ գրանցում է արևային կայանները ռեգիստրում և պահանջում վկայականների թողարկում: Այս դեպքում դա մենք ենք՝ հարթակի օպերատորը, որ գործում է բազմաթիվ կայանատերերի անունից:",
      why: "Կայանը ձերն է. ռեգիստրի հետ հարաբերությունը՝ մերը: Ձեր ստորագրած պայմանագիրն է, որ մեզ լիազորում է գրանցել ձեր կայանը և թողարկել դրանից:",
    },
  },
  {
    key: "participant",
    group: "roles",
    related: ["registrant", "beneficiary"],
    en: {
      term: "Participant",
      short: "A registry account holder who can hold and trade certificates.",
      eli5: "A participant has an account inside the registry where certificates can sit, like a brokerage account for green certificates. Traders and large buyers are participants.",
      why: "When your certificates are sold, they move from our participant account to the buyer's — every move is recorded in the registry.",
    },
    hy: {
      term: "Մասնակից (Participant)",
      short: "Ռեգիստրի հաշվետեր, որ կարող է պահել և առևտուր անել վկայականներով:",
      eli5: "Մասնակիցը ռեգիստրի ներսում հաշիվ ունի, որտեղ վկայականները կարող են պահվել — ինչպես բրոքերային հաշիվ կանաչ վկայականների համար: Թրեյդերները և խոշոր գնորդները մասնակիցներ են:",
      why: "Երբ ձեր վկայականները վաճառվում են, դրանք տեղափոխվում են մեր մասնակցի հաշվից գնորդի հաշիվ — ամեն տեղաշարժ գրանցվում է ռեգիստրում:",
    },
  },
  {
    key: "issuer",
    group: "roles",
    related: ["registrant", "i_rec"],
    en: {
      term: "Issuer",
      short: "The national body that approves sites and issues I-RECs.",
      eli5: "Each country has an accredited issuer for I-RECs. The issuer inspects site registrations, approves them, and is the only party who can actually mint certificates for generation in that country.",
      why: "Sprint 9's registration flow is built around the Issuer's forms and evidence requirements — their approval is the gate to the first revenue.",
    },
    hy: {
      term: "Թողարկող (Issuer)",
      short: "Ազգային մարմինը, որ հաստատում է կայանները և թողարկում I-REC-ներ:",
      eli5: "Յուրաքանչյուր երկիր ունի հավատարմագրված թողարկող I-REC-ների համար: Թողարկողը ստուգում է կայանների գրանցումները, հաստատում դրանք, և միակն է, որ իրականում կարող է վկայականներ «տպել» այդ երկրի արտադրության համար:",
      why: "Գրանցման հոսքը կառուցված է թողարկողի ձևաթղթերի և ապացույցների պահանջների շուրջ — նրանց հաստատումը առաջին եկամտի դարպասն է:",
    },
  },
  {
    key: "beneficiary",
    group: "roles",
    related: ["redemption", "participant"],
    en: {
      term: "Beneficiary",
      short: "The party in whose name a certificate is finally redeemed.",
      eli5: "When a certificate is redeemed, it names a beneficiary — the company that gets to claim the clean energy. That name is permanent and public in the registry.",
      why: "Provenance certificates from this portal show the beneficiary chain, which is exactly what auditors of the BUYER will want to see.",
    },
    hy: {
      term: "Շահառու (Beneficiary)",
      short: "Կողմը, ում անունով վկայականը վերջնականապես մարվում է:",
      eli5: "Երբ վկայականը մարվում է, նշվում է շահառու — ընկերությունը, որ իրավունք է ստանում հայտարարել մաքուր էներգիայի մասին: Այդ անունը մշտական է և հրապարակային ռեգիստրում:",
      why: "Այս պորտալի ծագման վկայականները ցույց են տալիս շահառուների շղթան — հենց այն, ինչ ԳՆՈՐԴԻ աուդիտորները կուզենան տեսնել:",
    },
  },

  /* ---------------------------------------------------- System */
  {
    key: "sandbox_mode",
    group: "system",
    related: ["manual_reading", "audit_trail"],
    en: {
      term: "Sandbox mode",
      short: "A safe practice mode that can never create real certificates.",
      eli5: "A sandbox site behaves exactly like a real one — same screens, same rules, same calculations — but it is physically blocked from ever reaching a real registry. Think of a flight simulator wired into the real cockpit: same controls, but the plane never takes off.",
      why: "Sandbox is how we train people and test the pipeline safely. The block is enforced in the deepest layer of the code, not by a checkbox.",
      example: "You can type in a whole year of fake readings for a sandbox site, watch certificates 'issue', and nothing ever touches the real registry.",
    },
    hy: {
      term: "Փորձնական ռեժիմ (Sandbox)",
      short: "Անվտանգ վարժանքի ռեժիմ, որ երբեք չի կարող իրական վկայական ստեղծել:",
      eli5: "Փորձնական կայանը վարվում է ճիշտ ինչպես իրականը — նույն էկրանները, նույն կանոնները, նույն հաշվարկները — բայց ֆիզիկապես արգելափակված է իրական ռեգիստր հասնելուց: Պատկերացրեք թռիչքի սիմուլյատոր՝ միացված իրական օդաչուի խցիկին. նույն ղեկը, բայց ինքնաթիռը երբեք չի թռչում:",
      why: "Փորձնական ռեժիմով ենք մարդկանց վարժեցնում և համակարգը փորձարկում առանց ռիսկի: Արգելքը կիրառվում է կոդի ամենախորը շերտում, ոչ թե որևէ նշավանդակով:",
      example: "Կարող եք փորձնական կայանի համար մուտքագրել մի ամբողջ տարվա հորինված ցուցմունքներ, տեսնել վկայականների «թողարկումը», և ոչինչ երբեք չի դիպչի իրական ռեգիստրին:",
    },
  },
  {
    key: "manual_reading",
    group: "system",
    related: ["sandbox_mode", "reconciliation", "hash_chain"],
    en: {
      term: "Manual reading",
      short: "A generation figure typed in by a person instead of sent by a device.",
      eli5: "Before real meters are connected, an operator can type generation figures in by hand. These manual readings flow through the exact same pipeline as real ones — but they are loudly labelled MANUAL everywhere, and they record who typed them.",
      why: "Manual entry is how the whole system was proven before hardware existed. The loud badge means a typed-in number can never masquerade as a measured one.",
    },
    hy: {
      term: "Ձեռքով մուտքագրված ցուցմունք",
      short: "Արտադրության թիվ, որ մուտքագրել է մարդը, ոչ թե ուղարկել սարքը:",
      eli5: "Մինչ իրական հաշվիչների միացումը օպերատորը կարող է արտադրության թվերը մուտքագրել ձեռքով: Այս ցուցմունքները անցնում են ճիշտ նույն ճանապարհով, ինչ իրականները — բայց ամենուր բարձրաձայն նշված են MANUAL պիտակով, և գրանցվում է, թե ով է մուտքագրել:",
      why: "Ձեռքով մուտքագրումն է, որով ամբողջ համակարգը ապացուցվել է մինչ սարքերի գոյությունը: Բարձրաձայն պիտակը նշանակում է, որ մուտքագրված թիվը երբեք չի կարող ձևանալ չափված:",
    },
  },
  {
    key: "hash_chain",
    group: "system",
    related: ["audit_trail", "point_in_time"],
    en: {
      term: "Hash chain",
      short: "A tamper-evident seal linking every reading to the one before it.",
      eli5: "Every reading is stamped with a fingerprint that includes the fingerprint of the previous reading — like links in a chain. Change any old reading, even directly in the database, and every link after it visibly breaks. A nightly job checks every chain.",
      why: "This is what lets an auditor trust two-year-old data: not our word, but mathematics. If the chain verifies, history was not rewritten.",
    },
    hy: {
      term: "Հեշ-շղթա",
      short: "Միջամտությունը բացահայտող կնիք, որ ամեն ցուցմունք կապում է նախորդին:",
      eli5: "Յուրաքանչյուր ցուցմունք կնքվում է մատնահետքով, որը ներառում է նախորդ ցուցմունքի մատնահետքը — ինչպես շղթայի օղակներ: Փոխեք ցանկացած հին ցուցմունք, նույնիսկ ուղղակիորեն բազայում, և դրանից հետո եկող բոլոր օղակները տեսանելիորեն կկոտրվեն: Գիշերային ստուգումն անցնում է ամեն շղթայով:",
      why: "Հենց սա է, ինչ աուդիտորին թույլ է տալիս վստահել երկու տարվա վաղեմության տվյալներին. ոչ թե մեր խոսքը, այլ մաթեմատիկան: Եթե շղթան ստուգվում է, պատմությունը չի վերաշարադրվել:",
    },
  },
  {
    key: "audit_trail",
    group: "system",
    related: ["hash_chain", "point_in_time"],
    en: {
      term: "Audit trail",
      short: "A permanent record of who did what, when.",
      eli5: "Every change in this portal — creating a site, entering a reading, approving a dispute, even opening a document — writes a permanent log entry: who, what, when, and what it looked like before and after.",
      why: "Certificates are legal claims. When anyone asks 'why does this number say 43.6?', the audit trail answers without anyone having to remember.",
    },
    hy: {
      term: "Աուդիտի հետք",
      short: "Մշտական գրառում, թե ով ինչ արեց և երբ:",
      eli5: "Ամեն փոփոխություն այս պորտալում — կայան ստեղծելը, ցուցմունք մուտքագրելը, վեճ հաստատելը, նույնիսկ փաստաթուղթ բացելը — գրում է մշտական մատյանի տող. ով, ինչ, երբ, և ինչ տեսք ուներ նախկինում ու հետո:",
      why: "Վկայականները իրավական հայտարարություններ են: Երբ որևէ մեկը հարցնի «ինչու է այս թիվը 43.6», աուդիտի հետքը կպատասխանի՝ առանց որևէ մեկի հիշողության վրա հույս դնելու:",
    },
  },
  {
    key: "point_in_time",
    group: "system",
    related: ["audit_trail", "hash_chain"],
    en: {
      term: "Point-in-time view",
      short: "Seeing the system exactly as it stood on any past date.",
      eli5: "Contracts change, calibrations renew, factors update — but the portal never overwrites the old version. It keeps every version with its dates, so an auditor can ask 'show me everything as of 5 May 2026' and see precisely that.",
      why: "Verification happens years after the fact. Point-in-time reconstruction is what makes 'prove it' a five-minute answer instead of a five-week archaeology project.",
    },
    hy: {
      term: "Ժամանակի կետի տեսք",
      short: "Համակարգը տեսնել ճիշտ այնպես, ինչպես կար անցյալի ցանկացած օր:",
      eli5: "Պայմանագրերը փոխվում են, չափաբերումները թարմացվում, գործակիցները նորացվում — բայց պորտալը երբեք չի ջնջում հին տարբերակը: Այն պահում է ամեն տարբերակ իր ամսաթվերով, այնպես որ աուդիտորը կարող է հարցնել «ցույց տվեք ամեն ինչ 2026-ի մայիսի 5-ի դրությամբ» և տեսնել հենց դա:",
      why: "Ստուգումը կատարվում է իրադարձություններից տարիներ անց: Ժամանակի կետի վերակառուցումն է, որ «ապացուցեք»-ը դարձնում է հինգ րոպեի պատասխան՝ հինգ շաբաթվա հնագիտության փոխարեն:",
    },
  },
];

export function seedGlossaryEntries(): GlossaryEntry[] {
  const out: GlossaryEntry[] = [];
  for (const e of entries) {
    for (const locale of ["en", "hy"] as const) {
      const l = e[locale];
      out.push({
        key: e.key,
        locale,
        term: l.term,
        short: l.short,
        eli5: l.eli5,
        whyItMatters: l.why,
        example: l.example ?? null,
        learnMoreUrl: null,
        groupKey: e.group,
        relatedKeys: e.related ?? null,
      });
    }
  }
  return out;
}

export const GLOSSARY_KEYS = entries.map((e) => e.key);
