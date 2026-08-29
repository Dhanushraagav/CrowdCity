module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const supabaseUrl = 'https://swbktcwlxbnbsjrmmmjj.supabase.co';
    const supabaseAnonKey = 'sb_publishable_kUW0Yid-0eAcDlOde-ETPQ_Udmo8krY';
    const response = await fetch(`${supabaseUrl}/rest/v1/issues?select=id`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Accept': 'application/json'
      }
    });
    if (!response.ok) {
      return res.status(500).json({ ok: false, status: response.status });
    }
    const data = await response.json();
    return res.status(200).json({ ok: true, count: data.length });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};
