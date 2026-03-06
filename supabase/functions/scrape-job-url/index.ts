const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
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
        formats: [
          {
            type: 'json',
            schema: {
              type: 'object',
              properties: {
                company: { type: 'string', description: 'The company or employer name' },
                position: { type: 'string', description: 'The job title or position name' },
                location: { type: 'string', description: 'The job location (city, state, remote, etc.)' },
                salary_min: { type: 'number', description: 'Minimum salary as integer (annual, in local currency, no symbols)' },
                salary_max: { type: 'number', description: 'Maximum salary as integer (annual, in local currency, no symbols)' },
              },
              required: ['company', 'position'],
            },
            prompt: 'Extract the job listing details from this page. Get the company name, job title/position, location, and salary range if available.',
          },
        ],
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

    // Extract the JSON data from Firecrawl response
    const extracted = data?.data?.json || data?.json || {};

    console.log('Extracted job data:', extracted);

    // Determine source from URL
    let source = 'manual';
    const lowerUrl = formattedUrl.toLowerCase();
    if (lowerUrl.includes('linkedin.com')) source = 'linkedin';
    else if (lowerUrl.includes('seek.com')) source = 'seek';

    return new Response(
      JSON.stringify({
        success: true,
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
