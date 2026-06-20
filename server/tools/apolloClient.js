/**
 * Apollo.io REST API client for US lead prospecting.
 * Requires APOLLO_API_KEY in .env
 */

const APOLLO_BASE = "https://api.apollo.io/v1";

function headers() {
  return {
    "x-api-key": process.env.APOLLO_API_KEY || "",
    "Content-Type": "application/json",
    "Cache-Control": "no-cache"
  };
}

/**
 * Search for US contacts by industry, title, company size, etc.
 */
export async function searchUSLeads({
  jobTitles = ["CEO", "Founder", "Owner", "Director", "VP"],
  industries = [],
  companySizeMin = 1,
  companySizeMax = 500,
  keywords = [],
  perPage = 10
} = {}) {
  if (!process.env.APOLLO_API_KEY) {
    return { error: "APOLLO_API_KEY not set in server/.env", leads: [] };
  }

  const body = {
    page: 1,
    per_page: perPage,
    person_locations: ["United States"],
    person_titles: jobTitles,
    ...(industries.length > 0 && { organization_industry_tag_ids: industries }),
    ...(keywords.length > 0 && { q_keywords: keywords.join(" ") }),
    organization_num_employees_ranges: [`${companySizeMin},${companySizeMax}`],
    contact_email_status: ["likely to engage", "verified"]
  };

  try {
    const res = await fetch(`${APOLLO_BASE}/mixed_people/search`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body)
    });
    const data = await res.json();

    if (data.error) return { error: data.error, leads: [] };

    const leads = (data.people || []).map(p => ({
      id: p.id,
      name: p.name || `${p.first_name} ${p.last_name}`,
      title: p.title || "",
      email: p.email || (p.contact?.email_status !== "bounced" ? p.contact?.email : ""),
      phone: p.phone_numbers?.[0]?.sanitized_number || "",
      company: p.organization?.name || p.employment_history?.[0]?.organization_name || "",
      industry: p.organization?.industry || "",
      employees: p.organization?.num_employees || 0,
      city: p.city || "",
      state: p.state || "",
      country: "United States",
      linkedin: p.linkedin_url || "",
      website: p.organization?.website_url || "",
      foundAt: new Date().toISOString()
    }));

    return { leads, total: data.pagination?.total_entries || leads.length };
  } catch (err) {
    return { error: err.message, leads: [] };
  }
}

/**
 * Enrich a single contact by email or name+company
 */
export async function enrichLead({ email, name, company } = {}) {
  if (!process.env.APOLLO_API_KEY) return { error: "APOLLO_API_KEY not set" };

  try {
    const res = await fetch(`${APOLLO_BASE}/people/match`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ email, name, organization_name: company, reveal_personal_emails: true })
    });
    const data = await res.json();
    const p = data.person;
    if (!p) return { error: "Person not found" };

    return {
      id: p.id,
      name: p.name,
      title: p.title,
      email: p.email,
      phone: p.phone_numbers?.[0]?.sanitized_number || "",
      company: p.organization?.name || "",
      industry: p.organization?.industry || "",
      linkedin: p.linkedin_url || ""
    };
  } catch (err) {
    return { error: err.message };
  }
}
