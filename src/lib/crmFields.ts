export interface CrmFieldDef {
  key: string;
  label: string;
  group?: 'identity' | 'strategic' | 'contact' | 'state';
  tags?: boolean;
  multi?: boolean;
  opts?: string[];
}

export const CONTACT_FIELDS: CrmFieldDef[] = [
  { key: 'contact_id', label: 'ID', group: 'identity' },
  { key: 'first_name', label: 'First Name', group: 'identity' },
  { key: 'last_name', label: 'Last Name', group: 'identity' },
  { key: 'title', label: 'Title', group: 'identity' },
  { key: 'institution_role', label: 'Institution Role', group: 'identity', tags: true },
  { key: 'venue_id', label: 'Venue ID', group: 'identity' },
  { key: 'organization_name', label: 'Organization', group: 'identity' },
  { key: 'organization_type', label: 'Org Type', group: 'identity', opts: ['museum', 'library', 'university', 'publisher', 'gallery', 'archive', 'foundation', 'media', 'independent', 'cultural_platform', 'private_sector', 'other'] },
  { key: 'department_or_unit', label: 'Department', group: 'identity' },
  { key: 'stakeholder_group', label: 'Stakeholder Group', group: 'identity', opts: ['curator', 'museum_digital', 'museum_leadership', 'museum_institutional_curator', 'university_faculty', 'digital_humanities', 'independent_researcher', 'academic_researcher', 'object_medium_specialist', 'conservation_restoration', 'library', 'experience_editorial_strategy', 'learning_digital_strategy', 'institutional_influencer', 'publisher', 'educator', 'collector_patron', 'media', 'other'] },
  { key: 'source', label: 'Source', group: 'identity' },
  { key: 'city', label: 'City', group: 'identity' },
  { key: 'country', label: 'Country', group: 'identity' },
  { key: 'date_added', label: 'Date Added', group: 'identity' },

  { key: 'stakeholder_role_primary', label: 'Role (Primary)', group: 'strategic', opts: ['buyer', 'validator', 'collaborator', 'amplifier', 'access_node', 'introducer'] },
  { key: 'stakeholder_role_secondary', label: 'Role (Secondary)', group: 'strategic', opts: ['', 'buyer', 'validator', 'collaborator', 'amplifier', 'access_node', 'introducer'] },
  { key: 'product_tier_relevance', label: 'Product Tier', group: 'strategic', opts: ['tier_0_audience', 'tier_1_low_ticket', 'tier_1_high_leverage', 'tier_2_mid_tier', 'tier_3_premium', 'tier_3_institutional', 'tier_4_institutional'] },
  { key: 'priority_level', label: 'Priority', group: 'strategic', opts: ['P0', 'P1', 'P2', 'P3'] },
  { key: 'campaigns', label: 'Campaigns', group: 'strategic', tags: true },
  { key: 'why_this_matters', label: 'Why This Matters', group: 'strategic', multi: true },

  { key: 'email', label: 'Email', group: 'contact' },
  { key: 'phone', label: 'Phone', group: 'contact' },
  { key: 'linkedin', label: 'LinkedIn', group: 'contact' },
  { key: 'instagram', label: 'Instagram', group: 'contact' },
  { key: 'assistant_or_general_contact', label: 'Alt Contact', group: 'contact' },

  { key: 'outreach_status', label: 'Outreach Status', group: 'state', opts: ['not_started', 'drafted', 'sent', 'replied', 'replied_followup_due', 'waiting_for_me', 'waiting_for_them', 'reengage_for_call', 'meeting_scheduled', 'on_hold', 'no_response', 'closed'] },
  { key: 'relationship_status', label: 'Relationship', group: 'state', opts: ['unknown', 'researched', 'cold_email', 'cold_social', 'cold_linkedin', 'email_contact', 'prior_access_granted', 'warm_weak_tie', 'warm_email_contact', 'warm_linkedin_contact', 'met_in_person', 'in_conversation', 'active', 'dormant', 'closed'] },
  { key: 'contact_confidence', label: 'Confidence', group: 'state', opts: ['verified', 'partial', 'likely', 'unverified'] },
  { key: 'next_followup_date', label: 'Next Follow-up', group: 'state' },
  { key: 'completion_status', label: 'Completion Status', group: 'state', opts: ['complete', 'partial', 'placeholder', 'not_started'] },
];

export const INTERACTION_FIELDS: CrmFieldDef[] = [
  { key: 'interaction_id', label: 'ID' },
  { key: 'contact_id', label: 'Contact ID' },
  { key: 'date', label: 'Date' },
  { key: 'channel', label: 'Channel', opts: ['in_person', 'email', 'whatsapp', 'call', 'linkedin', 'instagram', 'video_call', 'other'] },
  { key: 'meeting_goal', label: 'Meeting Goal' },
  { key: 'next_action', label: 'Next Action', multi: true },
  { key: 'owner', label: 'Owner' },
];

export const NOTE_FIELDS: CrmFieldDef[] = [
  { key: 'note_id', label: 'ID' },
  { key: 'interaction_id', label: 'Interaction ID' },
  { key: 'source_url', label: 'Link to Meeting Materials' },
  { key: 'what_you_asked_or_said', label: 'What You Asked / Said', multi: true },
  { key: 'what_they_said_or_did', label: 'What They Said / Did', multi: true },
  { key: 'what_still_needs_confirming', label: 'What Still Needs Confirming', multi: true },
  { key: 'what_to_do_about_it', label: 'What To Do About It', multi: true },
];

export const GROUPS: Record<string, string> = { identity: 'Identity', strategic: 'Strategic', contact: 'Contact Details', state: 'Current State' };
export const GROUP_COLOR: Record<string, string> = { identity: '#1E2761', strategic: '#6E2A2A', contact: '#2D6A4F', state: '#B08A3E' };
export const PRIORITY_BG: Record<string, string> = { P0: '#F9E0DE', P1: '#FFF3CD', P2: '#F0EEEC', P3: '#E8E8E8' };

export const ROLE_CLASS: Record<string, string> = {
  director: 'role-director', curator: 'role-curator', digital: 'role-digital',
  access: 'role-access', gatekeeper: 'role-gatekeeper', general: 'role-general',
};
export function roleClass(role: string): string {
  return ROLE_CLASS[role] ?? 'role-general';
}
