import { PulseContextData } from "@/components/pulse/types";

export function getRecommendedModules(industry?: string, ctx?: PulseContextData): string[] {
  const ind = (industry || "").toLowerCase();
  const intent = (ctx?.intent || "").toLowerCase();

  if (ind.includes("restaurant") || ind.includes("food") || ind.includes("hospitality") || intent.includes("food") || intent.includes("restaurant")) {
    return [
      "Custom Digital Ordering & Customer Cart Engine",
      "Kitchen Display System (KDS) & Order Pipeline",
      "Real-Time Order Tracking & Customer SMS Alerts",
      "Multi-Branch Owner Command & Inventory Center",
      "Revenue Intelligence & Customer Retention Suite",
    ];
  }

  if (ind.includes("health") || ind.includes("medical") || intent.includes("doctor") || intent.includes("clinic")) {
    return [
      "HIPAA-Compliant Patient Telehealth & Appointment Booking",
      "Digital Health Records & Prescription Vault",
      "Doctor Schedule & Consultation Queue Manager",
      "Automated Patient SMS Reminders & Intake Forms",
      "Clinic Operations & Revenue Intelligence Dashboard",
    ];
  }

  if (ind.includes("commerce") || ind.includes("retail") || intent.includes("sell") || intent.includes("store")) {
    return [
      "High-Conversion Custom Storefront & Checkout",
      "Multi-Warehouse Inventory & SKU Sync Engine",
      "Automated Order Fulfillment & Shipping Tracker",
      "Customer Loyalty & Repeat Purchase Automation",
      "E-Commerce Financial Telemetry & Profit Analytics",
    ];
  }

  if (ind.includes("real estate") || ind.includes("property") || intent.includes("tenant") || intent.includes("rent")) {
    return [
      "Property Listing Portal & 3D Virtual Tour Showcase",
      "Tenant Application & Screening Workflow Engine",
      "Automated Rent Collection & Payment Gateway",
      "Maintenance Request & Contractor Dispatch Center",
      "Portfolio Yield & Occupancy Analytics Dashboard",
    ];
  }

  if (ind.includes("logistics") || ind.includes("transport") || intent.includes("fleet") || intent.includes("dispatch")) {
    return [
      "Real-Time Fleet Telemetry & GPS Dispatch Tower",
      "Driver Mobile App & Digital Proof-of-Delivery",
      "Automated Route Optimization & Fuel Calculator",
      "Shipment Handoff & Customer Milestone Tracking",
      "Logistics Margin & Fleet Utilization Dashboard",
    ];
  }

  if (ind.includes("construction") || intent.includes("builder") || intent.includes("contractor")) {
    return [
      "Field Activity & Worker Daily Reporting Portal",
      "Subcontractor Schedule & Job Coordination",
      "Client Progress Visibility & Photo Updates",
      "Job Cost & Material Inventory Tracker",
      "Project Milestone & Margin Control Dashboard",
    ];
  }

  if (ind.includes("education") || ind.includes("school") || intent.includes("school") || intent.includes("course") || intent.includes("student")) {
    return [
      "Course Catalog & Video Lesson Portal",
      "Student & Parent Dashboard (Grades, Attendance)",
      "Online Tuition Fee Payment Gateway",
      "Automated Certificate & Quiz Engine",
      "Academic Administration Analytics Dashboard",
    ];
  }

  if (ind.includes("beauty") || ind.includes("wellness") || intent.includes("salon") || intent.includes("spa")) {
    return [
      "Online Self-Booking Calendar & Staff Scheduler",
      "Service Menu & Stylist Availability Selector",
      "Client Preference & History Record Notes",
      "Automated SMS Appointment & Birthday Reminders",
      "Salon Revenue & Service Analytics Dashboard",
    ];
  }

  if (ind.includes("fitness") || intent.includes("gym") || intent.includes("workout")) {
    return [
      "Member Mobile Check-In & Class Booking App",
      "Trainer Scheduling & Personal Session Tracker",
      "Membership Subscription Billing Portal",
      "Workout & Fitness Goal Tracking Module",
      "Gym Attendance & Revenue Analytics Dashboard",
    ];
  }

  if (ind.includes("legal") || ind.includes("professional") || intent.includes("law") || intent.includes("consulting")) {
    return [
      "Qualified Client Intake & Questionnaire Portal",
      "Matter & Document Workflow Tracker",
      "Secure Client Portal & Encrypted File Vault",
      "Automated Time Tracking & Invoicing Module",
      "Practice Performance & Billing Dashboard",
    ];
  }

  if (ind.includes("event") || intent.includes("ticket") || intent.includes("event")) {
    return [
      "Event Landing Page & Direct Ticket Checkout",
      "QR Code Ticket Scanner & Check-In App",
      "Guest RSVP & Seating Arrangement Manager",
      "Speaker Schedule & Interactive Event Agenda",
      "Ticket Sales & Attendee Demographics Dashboard",
    ];
  }

  if (ind.includes("finance") || intent.includes("fintech") || intent.includes("loan") || intent.includes("wallet")) {
    return [
      "Digital Customer Onboarding & KYC Verification",
      "Loan Application & Automated Approval Workflow",
      "Secure Customer Account & Wallet Dashboard",
      "Transaction Processing & Payment Gateway",
      "Financial Risk Assessment & Audit Dashboard",
    ];
  }

  if (ind.includes("mobile") || intent.includes("mobile app") || intent.includes("ios") || intent.includes("android")) {
    return [
      "Custom iOS & Android Mobile User Experience",
      "Push Notifications & Instant Mobile Messaging",
      "Offline Data Sync & Location Services",
      "User Profile & Authentication Security Vault",
      "Mobile App Engagement & Usage Analytics",
    ];
  }

  if (ind.includes("web") || intent.includes("website") || intent.includes("landing page")) {
    return [
      "High-Converting Custom Web Design Platform",
      "Lead Qualification & Interactive Intake Forms",
      "Content & Case Study Management System",
      "Customer Account & Inquiry Dashboard",
      "Website Analytics & Conversion Telemetry",
    ];
  }

  const customTitle = intent.length > 5 ? intent.charAt(0).toUpperCase() + intent.slice(1, 35) : "Custom Digital System";
  return [
    `Custom ${customTitle} Core Platform`,
    "Role-Based User Management & Security Vault",
    "Automated Customer & Team Workflow Engine",
    "Real-Time Operational Command Dashboard",
    "Performance Telemetry & Growth Analytics",
  ];
}
