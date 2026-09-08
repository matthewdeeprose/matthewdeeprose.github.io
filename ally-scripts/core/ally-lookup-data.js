/**
 * @fileoverview Ally Accessibility Reporting Tool - Lookup Data Payload
 * @module AllyLookup
 * @requires ally-scripts/core/ally-data-runtime.js - MUST load before this file
 * @generated 2026-09-08T12:13:54.331Z
 * @version 2.0.0
 *
 * @description
 * Generated from CSV files - provides human-readable names for Ally internal IDs.
 * Contains 39 terms and 92 departments.
 *
 * THIS FILE IS DATA ONLY. Every method on ALLY_LOOKUP - including the course
 * methods that delegate to ALLY_COURSES - lives in
 * ally-scripts/core/ally-data-runtime.js, which is shipped once and never
 * regenerated. This file hands the runtime a payload, and the runtime assigns
 * the global. Do not add behaviour here; it would be lost on the next rebuild.
 */

(function () {
  "use strict";

  if (typeof ALLY_DATA_RUNTIME === "undefined") {
    console.error(
      "[AllyLookupData] ally-scripts/core/ally-data-runtime.js must load " +
        "BEFORE this payload. Term and department lookups have NOT been " +
        "installed, and every ID will render raw."
    );
    return;
  }

  /**
   * Term ID to term data mapping
   * @type {Object.<string, {name: string, type: string, sortOrder: number}>}
   */
  const terms = {
    "_110_1": {
      "name": "2015-16",
      "type": "academic",
      "sortOrder": 15
    },
    "_117_1": {
      "name": "2016-17",
      "type": "academic",
      "sortOrder": 16
    },
    "_127_1": {
      "name": "2017-18",
      "type": "academic",
      "sortOrder": 17
    },
    "_138_1": {
      "name": "2018-19",
      "type": "academic",
      "sortOrder": 18
    },
    "_148_1": {
      "name": "2019-20 Modules",
      "type": "academic",
      "sortOrder": 19
    },
    "_159_1": {
      "name": "2020-21 Modules",
      "type": "academic",
      "sortOrder": 20
    },
    "_160_1": {
      "name": "2021-22 Modules",
      "type": "academic",
      "sortOrder": 21
    },
    "_161_1": {
      "name": "2022-23 Modules",
      "type": "academic",
      "sortOrder": 22
    },
    "_162_1": {
      "name": "2023-24 Modules",
      "type": "academic",
      "sortOrder": 23
    },
    "_174_1": {
      "name": "Sandboxes",
      "type": "system",
      "sortOrder": -2
    },
    "_207_1": {
      "name": "Further Resources",
      "type": "system",
      "sortOrder": -99
    },
    "_211_1": {
      "name": "Pre sessional",
      "type": "system",
      "sortOrder": -99
    },
    "_21_1": {
      "name": "2013-14",
      "type": "academic",
      "sortOrder": 13
    },
    "_22_1": {
      "name": "2012-13",
      "type": "academic",
      "sortOrder": 12
    },
    "_231_1": {
      "name": "Programme Information",
      "type": "system",
      "sortOrder": -99
    },
    "_23_1": {
      "name": "2011-12",
      "type": "academic",
      "sortOrder": 11
    },
    "_241_1": {
      "name": "Organisations",
      "type": "system",
      "sortOrder": -99
    },
    "_24_1": {
      "name": "2010-11",
      "type": "academic",
      "sortOrder": 10
    },
    "_253_1": {
      "name": "External courses",
      "type": "system",
      "sortOrder": -99
    },
    "_287_1": {
      "name": "Guest Access",
      "type": "system",
      "sortOrder": -99
    },
    "_299_1": {
      "name": "Templates",
      "type": "system",
      "sortOrder": -99
    },
    "_313_1": {
      "name": "Preparation for 2023-24",
      "type": "system",
      "sortOrder": -99
    },
    "_344_1": {
      "name": "2024-25 Modules",
      "type": "academic",
      "sortOrder": 24
    },
    "_362_1": {
      "name": "Preparation for 2024-25",
      "type": "system",
      "sortOrder": -99
    },
    "_383_1": {
      "name": "2025-26 Modules",
      "type": "academic",
      "sortOrder": 25
    },
    "_384_1": {
      "name": "Preparation for 2025-26",
      "type": "system",
      "sortOrder": -99
    },
    "_387_1": {
      "name": "Archived",
      "type": "system",
      "sortOrder": -1
    },
    "_42_1": {
      "name": "Faculty of Medicine Subjects",
      "type": "system",
      "sortOrder": -99
    },
    "_430_1": {
      "name": "Demonstration courses",
      "type": "system",
      "sortOrder": -99
    },
    "_448_1": {
      "name": "CPD / LLL Courses",
      "type": "system",
      "sortOrder": -99
    },
    "_451_1": {
      "name": "Preparation for 2026-27",
      "type": "system",
      "sortOrder": -99
    },
    "_462_1": {
      "name": "2025-26 Modules (Delhi)",
      "type": "academic",
      "sortOrder": 25
    },
    "_463_1": {
      "name": "2025-26 Modules (Malaysia)",
      "type": "academic",
      "sortOrder": 25
    },
    "_465_1": {
      "name": "2026-27 Modules",
      "type": "academic",
      "sortOrder": 26
    },
    "_466_1": {
      "name": "2026-27 Modules (Delhi)",
      "type": "academic",
      "sortOrder": 26
    },
    "_467_1": {
      "name": "2026-27 Modules (Malaysia)",
      "type": "academic",
      "sortOrder": 26
    },
    "_482_1": {
      "name": "Mandatory Student Training",
      "type": "system",
      "sortOrder": -99
    },
    "_483_1": {
      "name": "Recommended Training",
      "type": "system",
      "sortOrder": -99
    },
    "_81_1": {
      "name": "2014-15",
      "type": "academic",
      "sortOrder": 14
    }
  };

  /**
   * Department ID to department data mapping
   * @type {Object.<string, {name: string, shortCode: string|null, isSystemTag: boolean, parentId: string|null, parentName: string|null}>}
   */
  const departments = {
    "_100_1": {
      "name": "Politics & International Relations (CA)",
      "shortCode": "CA",
      "isSystemTag": false,
      "parentId": "_101_1",
      "parentName": "School of Economic, Social and Political Sciences (CC)"
    },
    "_101_1": {
      "name": "School of Economic, Social and Political Sciences (CC)",
      "shortCode": "CC",
      "isSystemTag": false,
      "parentId": "_90_1",
      "parentName": "(A5) Faculty of Social Sciences"
    },
    "_102_1": {
      "name": "School of Health Sciences (CF)",
      "shortCode": "CF",
      "isSystemTag": false,
      "parentId": "_87_1",
      "parentName": "(A2) Faculty of Environmental and Life Sciences"
    },
    "_103_1": {
      "name": "Southampton Education School (CJ)",
      "shortCode": "CJ",
      "isSystemTag": false,
      "parentId": "_90_1",
      "parentName": "(A5) Faculty of Social Sciences"
    },
    "_104_1": {
      "name": "Cancer Sciences (CM)",
      "shortCode": "CM",
      "isSystemTag": false,
      "parentId": "_89_1",
      "parentName": "(A4) Faculty of Medicine"
    },
    "_105_1": {
      "name": "School of Engineering (DA)",
      "shortCode": "DA",
      "isSystemTag": false,
      "parentId": "_88_1",
      "parentName": "(A3) Faculty of Engineering and Physical Sciences"
    },
    "_106_1": {
      "name": "School of Chemistry (EB)",
      "shortCode": "EB",
      "isSystemTag": false,
      "parentId": "_88_1",
      "parentName": "(A3) Faculty of Engineering and Physical Sciences"
    },
    "_108_1": {
      "name": "Clinical and Experimental Sciences (FC)",
      "shortCode": "FC",
      "isSystemTag": false,
      "parentId": "_89_1",
      "parentName": "(A4) Faculty of Medicine"
    },
    "_109_1": {
      "name": "Winchester School of Art (FH)",
      "shortCode": "FH",
      "isSystemTag": false,
      "parentId": "_86_1",
      "parentName": "(A1) Faculty of Arts and Humanities"
    },
    "_110_1": {
      "name": "Philosophy (FJ)",
      "shortCode": "FJ",
      "isSystemTag": false,
      "parentId": "_95_1",
      "parentName": "School of Humanities (AR)"
    },
    "_111_1": {
      "name": "School of Electronics & Computer Science (FP)",
      "shortCode": "FP",
      "isSystemTag": false,
      "parentId": "_88_1",
      "parentName": "(A3) Faculty of Engineering and Physical Sciences"
    },
    "_112_1": {
      "name": "Languages, Cultures and Linguistics (GC)",
      "shortCode": "GC",
      "isSystemTag": false,
      "parentId": "_95_1",
      "parentName": "School of Humanities (AR)"
    },
    "_113_1": {
      "name": "Faculty Central (FEPS) (GN)",
      "shortCode": "GN",
      "isSystemTag": false,
      "parentId": "_88_1",
      "parentName": "(A3) Faculty of Engineering and Physical Sciences"
    },
    "_114_1": {
      "name": "Academic Centre for International Students (HG)",
      "shortCode": "HG",
      "isSystemTag": false,
      "parentId": "_95_1",
      "parentName": "School of Humanities (AR)"
    },
    "_115_1": {
      "name": "National Oceanography Centre (HK)",
      "shortCode": "HK",
      "isSystemTag": false,
      "parentId": "_87_1",
      "parentName": "(A2) Faculty of Environmental and Life Sciences"
    },
    "_116_1": {
      "name": "School of Ocean and Earth Science (HN)",
      "shortCode": "HN",
      "isSystemTag": false,
      "parentId": "_87_1",
      "parentName": "(A2) Faculty of Environmental and Life Sciences"
    },
    "_117_1": {
      "name": "Nursing, Midwifery and Health (JB)",
      "shortCode": "JB",
      "isSystemTag": false,
      "parentId": "_102_1",
      "parentName": "School of Health Sciences (CF)"
    },
    "_118_1": {
      "name": "Southampton Law School (JJ)",
      "shortCode": "JJ",
      "isSystemTag": false,
      "parentId": "_90_1",
      "parentName": "(A5) Faculty of Social Sciences"
    },
    "_120_1": {
      "name": "School of Psychology (JW)",
      "shortCode": "JW",
      "isSystemTag": false,
      "parentId": "_87_1",
      "parentName": "(A2) Faculty of Environmental and Life Sciences"
    },
    "_121_1": {
      "name": "Social Statistics & Demography (KA)",
      "shortCode": "KA",
      "isSystemTag": false,
      "parentId": "_101_1",
      "parentName": "School of Economic, Social and Political Sciences (CC)"
    },
    "_122_1": {
      "name": "Institute of Sound & Vibration Research (KR)",
      "shortCode": "KR",
      "isSystemTag": false,
      "parentId": "_105_1",
      "parentName": "School of Engineering (DA)"
    },
    "_123_1": {
      "name": "Centre for Higher Education Practice (LD)",
      "shortCode": "LD",
      "isSystemTag": false,
      "parentId": "_135_1",
      "parentName": "Faculty Central (FSS) (PD)"
    },
    "_124_1": {
      "name": "Primary Care, Population Sciences and Medical Education (LG)",
      "shortCode": "LG",
      "isSystemTag": false,
      "parentId": "_89_1",
      "parentName": "(A4) Faculty of Medicine"
    },
    "_126_1": {
      "name": "Faculty Central (Medicine) (LL)",
      "shortCode": "LL",
      "isSystemTag": false,
      "parentId": "_89_1",
      "parentName": "(A4) Faculty of Medicine"
    },
    "_127_1": {
      "name": "Film Studies (LT)",
      "shortCode": "LT",
      "isSystemTag": false,
      "parentId": "_95_1",
      "parentName": "School of Humanities (AR)"
    },
    "_129_1": {
      "name": "Archaeology (MH)",
      "shortCode": "MH",
      "isSystemTag": false,
      "parentId": "_95_1",
      "parentName": "School of Humanities (AR)"
    },
    "_130_1": {
      "name": "Engineering Education - Central (MM)",
      "shortCode": "MM",
      "isSystemTag": false,
      "parentId": "_105_1",
      "parentName": "School of Engineering (DA)"
    },
    "_131_1": {
      "name": "Music (NC)",
      "shortCode": "NC",
      "isSystemTag": false,
      "parentId": "_95_1",
      "parentName": "School of Humanities (AR)"
    },
    "_132_1": {
      "name": "Engineering Education - Acoustical Engineering (ND)",
      "shortCode": "ND",
      "isSystemTag": false,
      "parentId": "_105_1",
      "parentName": "School of Engineering (DA)"
    },
    "_133_1": {
      "name": "Engineering Education - Audiology (NT)",
      "shortCode": "NT",
      "isSystemTag": false,
      "parentId": "_105_1",
      "parentName": "School of Engineering (DA)"
    },
    "_134_1": {
      "name": "Faculty Central (Arts and Humanities) (NX)",
      "shortCode": "NX",
      "isSystemTag": false,
      "parentId": "_86_1",
      "parentName": "(A1) Faculty of Arts and Humanities"
    },
    "_135_1": {
      "name": "Faculty Central (FSS) (PD)",
      "shortCode": "PD",
      "isSystemTag": false,
      "parentId": "_90_1",
      "parentName": "(A5) Faculty of Social Sciences"
    },
    "_136_1": {
      "name": "Engineering Education - Aerospace Engineering (PE)",
      "shortCode": "PE",
      "isSystemTag": false,
      "parentId": "_105_1",
      "parentName": "School of Engineering (DA)"
    },
    "_137_1": {
      "name": "School of Mathematical Sciences (PJ)",
      "shortCode": "PJ",
      "isSystemTag": false,
      "parentId": "_90_1",
      "parentName": "(A5) Faculty of Social Sciences"
    },
    "_138_1": {
      "name": "English (PL)",
      "shortCode": "PL",
      "isSystemTag": false,
      "parentId": "_95_1",
      "parentName": "School of Humanities (AR)"
    },
    "_139_1": {
      "name": "Zepler Institute for Photonics and Nanoelectronics (PN)",
      "shortCode": "PN",
      "isSystemTag": false,
      "parentId": "_88_1",
      "parentName": "(A3) Faculty of Engineering and Physical Sciences"
    },
    "_140_1": {
      "name": "Engineering Education - Civil and Environmental Engineering (PV)",
      "shortCode": "PV",
      "isSystemTag": false,
      "parentId": "_105_1",
      "parentName": "School of Engineering (DA)"
    },
    "_142_1": {
      "name": "History (RG)",
      "shortCode": "RG",
      "isSystemTag": false,
      "parentId": "_95_1",
      "parentName": "School of Humanities (AR)"
    },
    "_143_1": {
      "name": "Faculty Central (FELS) (RW)",
      "shortCode": "RW",
      "isSystemTag": false,
      "parentId": "_87_1",
      "parentName": "(A2) Faculty of Environmental and Life Sciences"
    },
    "_145_1": {
      "name": "Sociology, Social Policy & Criminology (TG)",
      "shortCode": "TG",
      "isSystemTag": false,
      "parentId": "_101_1",
      "parentName": "School of Economic, Social and Political Sciences (CC)"
    },
    "_146_1": {
      "name": "Southampton Business School (TR)",
      "shortCode": "TR",
      "isSystemTag": false,
      "parentId": "_90_1",
      "parentName": "(A5) Faculty of Social Sciences"
    },
    "_147_1": {
      "name": "Wessex Institute (VB)",
      "shortCode": "VB",
      "isSystemTag": false,
      "parentId": "_89_1",
      "parentName": "(A4) Faculty of Medicine"
    },
    "_148_1": {
      "name": "Engineering Education - Foundation Year (VL)",
      "shortCode": "VL",
      "isSystemTag": false,
      "parentId": "_105_1",
      "parentName": "School of Engineering (DA)"
    },
    "_149_1": {
      "name": "Engineering Education - Mechanical Engineering (VN)",
      "shortCode": "VN",
      "isSystemTag": false,
      "parentId": "_105_1",
      "parentName": "School of Engineering (DA)"
    },
    "_150_1": {
      "name": "Engineering Education - Maritime Engineering (VT)",
      "shortCode": "VT",
      "isSystemTag": false,
      "parentId": "_105_1",
      "parentName": "School of Engineering (DA)"
    },
    "_151_1": {
      "name": "Allied Health Professions (WA)",
      "shortCode": "WA",
      "isSystemTag": false,
      "parentId": "_102_1",
      "parentName": "School of Health Sciences (CF)"
    },
    "_152_1": {
      "name": "Gerontology (WB)",
      "shortCode": "WB",
      "isSystemTag": false,
      "parentId": "_101_1",
      "parentName": "School of Economic, Social and Political Sciences (CC)"
    },
    "_153_1": {
      "name": "School of Physics & Astronomy (WF)",
      "shortCode": "WF",
      "isSystemTag": false,
      "parentId": "_88_1",
      "parentName": "(A3) Faculty of Engineering and Physical Sciences"
    },
    "_154_1": {
      "name": "School of Geography and Environmental Science (WR)",
      "shortCode": "WR",
      "isSystemTag": false,
      "parentId": "_87_1",
      "parentName": "(A2) Faculty of Environmental and Life Sciences"
    },
    "_155_1": {
      "name": "(P1) Professional Services",
      "shortCode": null,
      "isSystemTag": false,
      "parentId": "_157_1",
      "parentName": "Academic Structure"
    },
    "_157_1": {
      "name": "Academic Structure",
      "shortCode": null,
      "isSystemTag": false,
      "parentId": "_1_1",
      "parentName": "University of Southampton"
    },
    "_160_1": {
      "name": "Engagement & Advancement (CD)",
      "shortCode": "CD",
      "isSystemTag": false,
      "parentId": "_155_1",
      "parentName": "(P1) Professional Services"
    },
    "_161_1": {
      "name": "Human Resources (DD)",
      "shortCode": "DD",
      "isSystemTag": false,
      "parentId": "_155_1",
      "parentName": "(P1) Professional Services"
    },
    "_162_1": {
      "name": "Student Services (EW)",
      "shortCode": "EW",
      "isSystemTag": false,
      "parentId": "_155_1",
      "parentName": "(P1) Professional Services"
    },
    "_163_1": {
      "name": "Residences (FB)",
      "shortCode": "FB",
      "isSystemTag": false,
      "parentId": "_155_1",
      "parentName": "(P1) Professional Services"
    },
    "_164_1": {
      "name": "Student & Academic Administration (GX)",
      "shortCode": "GX",
      "isSystemTag": false,
      "parentId": "_155_1",
      "parentName": "(P1) Professional Services"
    },
    "_165_1": {
      "name": "Widening Participation and Social Mobility (HL)",
      "shortCode": "HL",
      "isSystemTag": false,
      "parentId": "_155_1",
      "parentName": "(P1) Professional Services"
    },
    "_166_1": {
      "name": "iSolutions (JF)",
      "shortCode": "JF",
      "isSystemTag": false,
      "parentId": "_155_1",
      "parentName": "(P1) Professional Services"
    },
    "_168_1": {
      "name": "Library & the Arts (KX)",
      "shortCode": "KX",
      "isSystemTag": false,
      "parentId": "_155_1",
      "parentName": "(P1) Professional Services"
    },
    "_169_1": {
      "name": "Global Recruitment and Admissions (NP)",
      "shortCode": "NP",
      "isSystemTag": false,
      "parentId": "_155_1",
      "parentName": "(P1) Professional Services"
    },
    "_172_1": {
      "name": "Estates & Facilities (TD)",
      "shortCode": "TD",
      "isSystemTag": false,
      "parentId": "_155_1",
      "parentName": "(P1) Professional Services"
    },
    "_173_1": {
      "name": "Research & Innovation Services (TW)",
      "shortCode": "TW",
      "isSystemTag": false,
      "parentId": "_155_1",
      "parentName": "(P1) Professional Services"
    },
    "_1_1": {
      "name": "University of Southampton",
      "shortCode": null,
      "isSystemTag": false,
      "parentId": null,
      "parentName": null
    },
    "_205_1": {
      "name": "Careers & Employability (LR)",
      "shortCode": "LR",
      "isSystemTag": false,
      "parentId": "_155_1",
      "parentName": "(P1) Professional Services"
    },
    "_265_1": {
      "name": "Course Format",
      "shortCode": null,
      "isSystemTag": false,
      "parentId": "_1_1",
      "parentName": "University of Southampton"
    },
    "_266_1": {
      "name": "Original",
      "shortCode": null,
      "isSystemTag": true,
      "parentId": "_265_1",
      "parentName": "Course Format"
    },
    "_267_1": {
      "name": "Ultra",
      "shortCode": null,
      "isSystemTag": true,
      "parentId": "_265_1",
      "parentName": "Course Format"
    },
    "_274_1": {
      "name": "LTI Tool Availablity",
      "shortCode": null,
      "isSystemTag": false,
      "parentId": "_1_1",
      "parentName": "University of Southampton"
    },
    "_275_1": {
      "name": "CourseArc",
      "shortCode": null,
      "isSystemTag": false,
      "parentId": "_274_1",
      "parentName": "LTI Tool Availablity"
    },
    "_281_1": {
      "name": "No Turnitin",
      "shortCode": null,
      "isSystemTag": false,
      "parentId": "_274_1",
      "parentName": "LTI Tool Availablity"
    },
    "_283_1": {
      "name": "Chirun",
      "shortCode": null,
      "isSystemTag": false,
      "parentId": "_274_1",
      "parentName": "LTI Tool Availablity"
    },
    "_300_1": {
      "name": "Design (WJ)",
      "shortCode": "WJ",
      "isSystemTag": false,
      "parentId": "_109_1",
      "parentName": "Winchester School of Art (FH)"
    },
    "_301_1": {
      "name": "Fashion and Textiles (CP)",
      "shortCode": "CP",
      "isSystemTag": false,
      "parentId": "_109_1",
      "parentName": "Winchester School of Art (FH)"
    },
    "_302_1": {
      "name": "Arts and Media Technology (EN)",
      "shortCode": "EN",
      "isSystemTag": false,
      "parentId": "_109_1",
      "parentName": "Winchester School of Art (FH)"
    },
    "_303_1": {
      "name": "Optoelectronics Research Centre (BA)",
      "shortCode": "BA",
      "isSystemTag": false,
      "parentId": "_88_1",
      "parentName": "(A3) Faculty of Engineering and Physical Sciences"
    },
    "_327_1": {
      "name": "Final LTI tests in PROD",
      "shortCode": null,
      "isSystemTag": false,
      "parentId": "_1_1",
      "parentName": "University of Southampton"
    },
    "_328_1": {
      "name": "Jove",
      "shortCode": null,
      "isSystemTag": false,
      "parentId": "_327_1",
      "parentName": "Final LTI tests in PROD"
    },
    "_347_1": {
      "name": "Southampton Online",
      "shortCode": null,
      "isSystemTag": false,
      "parentId": "_1_1",
      "parentName": "University of Southampton"
    },
    "_348_1": {
      "name": "Southampton Online BLUEPRINT",
      "shortCode": null,
      "isSystemTag": false,
      "parentId": "_347_1",
      "parentName": "Southampton Online"
    },
    "_349_1": {
      "name": "Southampton Online BUILD",
      "shortCode": null,
      "isSystemTag": false,
      "parentId": "_347_1",
      "parentName": "Southampton Online"
    },
    "_369_1": {
      "name": "CPDHUB/BCC/TDM",
      "shortCode": null,
      "isSystemTag": false,
      "parentId": "_1_1",
      "parentName": "University of Southampton"
    },
    "_86_1": {
      "name": "(A1) Faculty of Arts and Humanities",
      "shortCode": null,
      "isSystemTag": false,
      "parentId": "_157_1",
      "parentName": "Academic Structure"
    },
    "_87_1": {
      "name": "(A2) Faculty of Environmental and Life Sciences",
      "shortCode": null,
      "isSystemTag": false,
      "parentId": "_157_1",
      "parentName": "Academic Structure"
    },
    "_88_1": {
      "name": "(A3) Faculty of Engineering and Physical Sciences",
      "shortCode": null,
      "isSystemTag": false,
      "parentId": "_157_1",
      "parentName": "Academic Structure"
    },
    "_89_1": {
      "name": "(A4) Faculty of Medicine",
      "shortCode": null,
      "isSystemTag": false,
      "parentId": "_157_1",
      "parentName": "Academic Structure"
    },
    "_90_1": {
      "name": "(A5) Faculty of Social Sciences",
      "shortCode": null,
      "isSystemTag": false,
      "parentId": "_157_1",
      "parentName": "Academic Structure"
    },
    "_92_1": {
      "name": "Human Development and Health (AF)",
      "shortCode": "AF",
      "isSystemTag": false,
      "parentId": "_89_1",
      "parentName": "(A4) Faculty of Medicine"
    },
    "_94_1": {
      "name": "Aeronautical and Astronautical Engineering (AK)",
      "shortCode": "AK",
      "isSystemTag": false,
      "parentId": "_105_1",
      "parentName": "School of Engineering (DA)"
    },
    "_95_1": {
      "name": "School of Humanities (AR)",
      "shortCode": "AR",
      "isSystemTag": false,
      "parentId": "_86_1",
      "parentName": "(A1) Faculty of Arts and Humanities"
    },
    "_96_1": {
      "name": "Civil, Maritime & Environmental Engineering (AT)",
      "shortCode": "AT",
      "isSystemTag": false,
      "parentId": "_105_1",
      "parentName": "School of Engineering (DA)"
    },
    "_97_1": {
      "name": "School of Biological Sciences (BJ)",
      "shortCode": "BJ",
      "isSystemTag": false,
      "parentId": "_87_1",
      "parentName": "(A2) Faculty of Environmental and Life Sciences"
    },
    "_98_1": {
      "name": "Economics (BL)",
      "shortCode": "BL",
      "isSystemTag": false,
      "parentId": "_101_1",
      "parentName": "School of Economic, Social and Political Sciences (CC)"
    }
  };

  ALLY_DATA_RUNTIME.installLookup({
    terms: terms,
    departments: departments
  });
})();
