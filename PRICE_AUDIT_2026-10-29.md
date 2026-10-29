# Price Recheck: 29 October 2026

Market: Peninsular Malaysia, OTR/retail excluding insurance, before rebates.
Private individual registration unless the existing model explicitly says otherwise.
This is a manual snapshot, not a live manufacturer feed or a guarantee of dealer stock.

## Applied Changes

| Selection | Net selling (RM) | OTR without insurance (RM) | Evidence |
| --- | ---: | ---: | --- |
| Chery Tiggo Cross 1.5 Turbo | 88,400 | 88,800 | [October price list](https://www.chery.my/wp-content/uploads/2026/10/PM_Tiggo_Cross_Pricelist_070102026_FA.pdf) |
| Chery Tiggo Cross 1.5 Hybrid CSH | 99,400 | 99,800 | Same official price list |
| Chery Tiggo Cross 1.5 Turbo Sport Edition (added) | 88,400 | 91,800 | Same official price list, effective 7 October 2026 |
| GWM WEY G9 Hi4 HEV 2.0T (added) | 248,910.80 | 249,800 | [Current GWM WM price list](https://www.gwm.com.my/content/dam/gwm/pages/my/en/models/wey-g9/1014/m4gwm00012_gwm_wey_g9_wm_a4_flyer_1_compressed.pdf) |
| GWM WEY G9 Hi4 PHEV (unchanged) | 269,380 | 269,800 | Same current GWM WM price list |
| Honda City Hatchback V | 95,560 | 95,900 | [Official pricing](https://www.honda.com.my/model/city-hatchback/pricing) |
| Honda City Hatchback RS | 100,560 | 100,900 | Same official pricing |
| Honda City Hatchback e:HEV RS | 112,560 | 112,900 | Same official pricing |

- Honda's [19 October launch release](https://www.honda.com.my/press-release/view/859/elevated-design-meets-uncompromised-utility-honda-malaysia-launches-the-new-city-hatchback) confirms only V, RS and e:HEV RS in the current lineup. Remove the old S/E selections; existing saved case/history data is not changed. Update the current paint note to Blazing Red Pearl rather than Ignite Red Metallic.
- Sport Edition's OTR already includes the RM3,000 aerokit. Preserve the published RM88,400 net selling amount and do not add the aerokit again in the calculator. The RM83,800 early-bird amount is not the standard OTR price.
- Repair Jetour Dashing, VT9 and T2 sources to the live model-page PDF paths. Their published private OTR amounts remain RM110,200/RM117,200, RM119,200/RM124,200 and RM157,669.20 respectively.
- Proton's [X50 Sport Edition announcement](https://www.proton.com/happenings/2026/october/all-new-proton-x50-sport-edition-launched-with-15-exclusive-upgrades-for-just-rm1-999) describes an accessory package, not a separate vehicle variant. Do not replace Flagship's RM113,300 retail price with the advertised after-rebate amount.
- ORA 5 HEV remains excluded: the [official page](https://www.gwm.com.my/en/models/ora-5-hev) offers registration of interest without a confirmed Malaysian price.

## Coverage and Evidence Limits

The original catalog contained 12 brands, 97 model groups and 221 priced selections. The revised catalog contains 12 brands, 98 model groups and 221 selections: two old Honda selections removed, two confirmed selections added.

All existing source URLs were attempted. Fetch success alone was not treated as verification: PDF/HTML content was checked, and image-only tables were read using rendered pages or OCR. An older effective date is kept when the retrieved official document still publishes those amounts. Rechecking an existing PDF does not prove that no other stock variant exists outside the published catalog.

| Brand | Model groups / selections now | Result |
| --- | --- | --- |
| Proton | 11 / 30 | Published price tables matched; no base-price change. Introductory/after-rebate amounts kept separate. |
| Perodua | 8 / 30 | Current calculator's non-legacy Peninsular price table matched. QV-E PDF visually checked; battery rental remains separate. |
| Honda | 9 / 24 | Current pricing pages matched; City Hatchback lineup updated using the October launch release. |
| Toyota | 21 / 42 | Existing official regional PDFs matched. Hiace Panel Van remains explicitly Company Commercial. |
| Jaecoo | 5 / 7 | Existing official PM price tables matched, including image-only J5/J5 EV/J7 tables. |
| OMODA | 2 / 3 | Existing official PM price tables matched. |
| Chery | 8 / 10 | Official PM PDFs matched; October Tiggo Cross list adds Sport Edition. |
| Jetour | 5 / 8 | Dashing/VT9/T2 links repaired and amounts matched. T1 remains Estimated; T2 i-DM regional-label conflict still requires confirmation. |
| Mitsubishi | 4 / 14 | Official price PDFs matched; current brochures/prices page still lists the included MY25/MY26 and Before Enhancement rows. |
| Mazda | 10 / 29 | CX-30's four prices matched the downloaded official PDF. Other nine model groups could not be fully revalidated; retained unchanged. |
| GWM | 8 / 9 | Published tables matched; current WEY brochure confirms the new HEV alongside PHEV. |
| BYD | 7 / 15 | Six model groups matched current official WM brochures; ATTO 3's linked Drive PDF could not be fully revalidated. |

Unresolved rows retain their previous `checkedAt: 2026-10-02`, rather than being falsely labelled checked today:

- Mazda3 Sedan, Mazda3 Liftback, MX-5 RF, All New CX-5, CX-5 CKD, CX-8, CX-60, CX-80 and BT-50 Double Cab (25 selections). Direct PDF retrieval returned a verification page. Chrome showed Mazda3's first page, but that did not establish all variants; no new price was inferred from headline model-page amounts or the older calculator.
- BYD 2026 ATTO 3 (3 selections). The [official model page](https://byd.simemotors.my/byd-atto-3) still links the catalog's Drive PDF, but full OTR tables were not readable during this audit. Retain previous prices and date.

Consequently, this change must not be described as all 221 prices newly confirmed. 193 selections have rechecked published amounts, including 3 selections with the pre-existing Jetour Estimated/confirmation caveats; 28 selections retain their earlier checks.

## Unchanged Behavior

No rebate registry, loan formula, default rate policy, insurance estimate, battery lease, customer record or authentication behavior was changed. Existing price advisories and manual price editing remain available. Rebates were not refreshed in this price-only task.

The individual official source URL, effective date and registration exception remain on each model/variant in `catalog.js`. Historical registers in `PRICE_SOURCES.md`, `NEW_BRANDS_2026-10-02.md` and `OMODA_2026-10-03.md` are not rewritten as newly verified prices.
