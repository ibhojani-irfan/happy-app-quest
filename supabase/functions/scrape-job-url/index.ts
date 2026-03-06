const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function detectSource(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('linkedin.com')) return 'linkedin';
  if (lower.includes('seek.com')) return 'seek';
  return 'manual';
}

// Sites that Firecrawl cannot scrape
const BLOCKED_DOMAINS = ['linkedin.com', 'seek.com', 'seek.co'];

function isBlockedSite(url: string): boolean {
  const lower = url.toLowerCase();
  return BLOCKED_DOMAINS.some(d => lower.includes(d));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    const source = detectSource(formattedUrl);

    // For blocked sites, return partial data from URL only
    if (isBlockedSite(formattedUrl)) {
      return new Response(
        JSON.stringify({
          success: true,
          partial: true,
          message: `${source === 'linkedin' ? 'LinkedIn' : 'Seek'} doesn't allow automated scraping. The URL has been saved — please fill in the job details manually.`,
          data: {
            company: '',
            position: '',
            location: '',
            salary_min: null,
            salary_max: null,
            url: formattedUrl,
            source,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For other sites, use Firecrawl
    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Scraping job URL:', formattedUrl);

    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['extract'],
        extract: {
          schema: {
            type: 'object',
            properties: {
              company: { type: 'string', description: 'The company or employer name' },
              position: { type: 'string', description: 'The job title or position name' },
              location: { type: 'string', description: 'The job location (city, state, remote, etc.)' },
              salary_min: { type: 'number', description: 'Minimum salary as integer (annual, no symbols)' },
              salary_max: { type: 'number', description: 'Maximum salary as integer (annual, no symbols)' },
            },
            required: ['company', 'position'],
          },
          prompt: 'Extract the job listing details from this page.',
        },
        onlyMainContent: true,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Firecrawl API error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.error || `Request failed with status ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const extracted = data?.data?.extract || data?.extract || {};

    return new Response(
      JSON.stringify({
        success: true,
        partial: false,
        data: {
          company: extracted.company || '',
          position: extracted.position || '',
          location: extracted.location || '',
          salary_min: extracted.salary_min || null,
          salary_max: extracted.salary_max || null,
          url: formattedUrl,
          source,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error scraping job URL:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to scrape';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
