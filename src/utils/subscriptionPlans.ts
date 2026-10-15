import { SubscriptionPlan, SubscriptionTierId } from '../types';

/**
 * Centrally defined subscription plan definitions & configurable limits for InvoicePro 360.
 * Prices are in INR (₹). Ultra plan requires enterprise contact.
 */
export const SUBSCRIPTION_PLANS: Record<SubscriptionTierId, SubscriptionPlan> = {
  basic: {
    id: 'basic',
    name: 'Basic',
    priceInr: 0,
    invoiceQuota: 10,
    aiGenerationQuota: 5,
    customerQuota: 25,
    teamMemberQuota: 1,
    isContactUs: false,
    description: 'Essential GST billing and AI drafting for solopreneurs & freelancers.',
    features: [
      '10 successful invoices / month',
      '5 AI invoice generations / month',
      '25 customers & vendors directory',
      '1 team member seat',
      'Automated SGST/CGST/IGST tax calculation',
      'Standard PDF & CSV exports'
    ]
  },
  standard: {
    id: 'standard',
    name: 'Standard',
    priceInr: 499,
    invoiceQuota: 50,
    aiGenerationQuota: 25,
    customerQuota: 100,
    teamMemberQuota: 1,
    isContactUs: false,
    description: 'For growing businesses and consultants needing smart OCR image extraction.',
    features: [
      '50 successful invoices / month',
      '25 AI invoice generations / month',
      '100 customers & vendors directory',
      '1 team member seat',
      'Smart OCR invoice image scanning',
      'Payment tracking & recurring invoices',
      'Email reminder schedules'
    ]
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    priceInr: 1499,
    invoiceQuota: 300,
    aiGenerationQuota: 150,
    customerQuota: 500,
    teamMemberQuota: 3,
    isContactUs: false,
    description: 'Ideal for scaling SMBs, service agencies, and multi-client accounting practices.',
    features: [
      '300 successful invoices / month',
      '150 AI invoice generations / month',
      '500 customers & vendors directory',
      '3 team member seats',
      'AI Ledger Copilot conversational analytics',
      'Batch invoice auto-tagging & categorization',
      'Priority export & compliance audit'
    ]
  },
  elite: {
    id: 'elite',
    name: 'Elite',
    priceInr: 3999,
    invoiceQuota: 1000,
    aiGenerationQuota: 500,
    customerQuota: 2000,
    teamMemberQuota: 10,
    isContactUs: false,
    description: 'For high-volume retail, wholesale, and multi-department enterprises.',
    features: [
      '1,000 successful invoices / month',
      '500 AI invoice generations / month',
      '2,000 customers & vendors directory',
      '10 team member seats',
      'Multi-LLM failover (Google Gemini + OpenAI GPT-4o)',
      'Automated recurring payment collection logs',
      'Custom invoice templates & branding'
    ]
  },
  ultra: {
    id: 'ultra',
    name: 'Ultra',
    priceInr: 0,
    invoiceQuota: -1, // Unlimited subject to fair use
    aiGenerationQuota: 2500, // High configurable limit
    customerQuota: -1, // Unlimited
    teamMemberQuota: 25, // Configurable seats
    isContactUs: true,
    description: 'Tailored enterprise infrastructure with custom SLAs and high-concurrency throughput.',
    features: [
      'Unlimited successful invoices (fair use)',
      '2,500 AI invoice generations / month',
      'Unlimited customers & vendors',
      'Configurable team member seats',
      'Dedicated solution engineer & custom integrations',
      'Enterprise ERP & custom GST webhook sync'
    ]
  }
};

export const ORDERED_PLAN_IDS: SubscriptionTierId[] = [
  'basic',
  'standard',
  'professional',
  'elite',
  'ultra'
];

export function formatInrPrice(price: number, isContactUs = false): string {
  if (isContactUs) return 'Contact us';
  if (price === 0) return 'Free';
  return `₹${price.toLocaleString('en-IN')}`;
}

export function formatQuotaLabel(quota: number): string {
  if (quota === -1) return 'Unlimited';
  return quota.toLocaleString('en-IN');
}
